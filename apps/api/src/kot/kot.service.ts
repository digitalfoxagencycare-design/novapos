import { Injectable, Logger, forwardRef, Inject } from '@nestjs/common';
import { and, asc, eq, gte, inArray, notInArray, sql } from 'drizzle-orm';
import { DatabaseService } from '../db/db.service';
import { kots, kotLines, stations, orderLines, orders } from '../db/schema';
import { KotGateway } from './kot.gateway';
import { PrintingService } from '../printing/printing.service';
import { AuditService } from '../common/audit.service';
import { InvoiceNumberService } from '../orders/invoice-number.service';
import { Errors } from '../common/errors';
import { requireTenantContext } from '../tenancy/tenant-context';

export interface KotOrderView {
  id: string;
  tenantId: string;
  outletId: string;
  orderNumber: string;
  channel: string;
  notes: string | null;
  tables?: { table: { label: string } }[];
  staff?: { name: string } | null;
}

export interface KotLineView {
  id: string;
  nameSnapshot: string;
  quantity: number | string;
  stationId: string | null;
  notes: string | null;
  status: string;
  firedAt: Date | null;
  modifiers?: { nameSnapshot: string }[];
}

/**
 * The KOT engine.
 *
 * Responsibilities, in the order they matter:
 *
 *   1. Route each fired line to the right kitchen station.
 *   2. Get it onto the pass in under a second — pushed to KDS screens over
 *      WebSocket and queued to station printers *in parallel*, never
 *      serially, because a jammed printer must not delay the screen.
 *   3. Track the ticket through preparing → ready → served.
 *   4. Make modifications legible: a cook needs the delta, not a fresh ticket
 *      they have to diff by eye against the one already clipped to the rail.
 */
@Injectable()
export class KotService {
  private readonly logger = new Logger(KotService.name);

  constructor(
    private readonly db: DatabaseService,
    @Inject(forwardRef(() => KotGateway)) private readonly gateway: KotGateway,
    private readonly printing: PrintingService,
    private readonly audit: AuditService,
    private readonly sequences: InvoiceNumberService,
  ) {}

  /**
   * Group fired lines by station and create one KOT per station.
   *
   * One ticket per station, not per order: the grill does not need to read the
   * bar's drinks, and printing the whole order everywhere is how tickets get
   * skimmed and items get missed.
   */
  async createForLines(order: KotOrderView, lines: KotLineView[], kind: 'NEW' | 'MODIFIED' = 'NEW') {
    const ctx = requireTenantContext();

    const created = await this.db.tx(async (db) => {
      const activeStations = await db.select().from(stations)
        .where(and(eq(stations.outletId, order.outletId), eq(stations.isActive, true)))
        .orderBy(asc(stations.sortOrder));

      if (activeStations.length === 0) {
        throw Errors.invalidState(
          'No kitchen stations are configured for this outlet, so orders cannot be routed. ' +
          'Add at least one in Admin → Outlets → Stations.',
        );
      }

      // A line whose station is missing or inactive falls back to the first
      // station rather than vanishing. A ticket in the wrong place is
      // recoverable; a ticket nobody ever sees is a walked-out customer.
      const fallback = activeStations[0];
      const byStation = new Map<string, KotLineView[]>();
      for (const line of lines) {
        const stationId = line.stationId && activeStations.some((s) => s.id === line.stationId)
          ? line.stationId
          : fallback.id;
        if (line.stationId && stationId !== line.stationId) {
          this.logger.warn(
            `Line ${line.id} points at station ${line.stationId}, which is not active at outlet ` +
            `${order.outletId}; routing to ${fallback.name}.`,
          );
        }
        const list = byStation.get(stationId) ?? [];
        list.push(line);
        byStation.set(stationId, list);
      }

      const results = [];
      for (const [stationId, stationLines] of byStation) {
        const station = activeStations.find((s) => s.id === stationId)!;
        const businessDate = this.businessDate();
        const kotNumber = await this.nextKotNumber(db, ctx.tenantId, order.outletId, businessDate);

        const [ticket] = await db.insert(kots).values({
          tenantId: ctx.tenantId,
          orderId: order.id,
          stationId,
          kotNumber,
          businessDate,
          kind,
          status: 'PLACED',
          notes: order.notes,
        }).returning();

        const insertedLines = await db.insert(kotLines).values(
          stationLines.map((l) => ({
            tenantId: ctx.tenantId,
            kotId: ticket.id,
            orderLineId: l.id,
            nameSnapshot: l.nameSnapshot,
            quantity: String(l.quantity),
            modifiersSnapshot: (l.modifiers ?? []).map((m) => m.nameSnapshot),
            notes: l.notes,
            change: 'NEW' as const,
          })),
        ).returning();

        results.push({ ...ticket, lines: insertedLines, station });
      }
      return results;
    });

    await this.deliver(order, created);
    return created;
  }

  /**
   * A modification after firing.
   *
   * The kitchen already has paper on the rail, so the modified ticket carries
   * only the delta — added, voided, quantity-changed — with the previous
   * quantity printed alongside the new one.
   */
  async createModification(
    order: KotOrderView,
    changes: { line: KotLineView; change: 'ADDED' | 'VOIDED' | 'QTY_CHANGED'; previousQuantity?: number }[],
  ) {
    if (changes.length === 0) return [];
    const ctx = requireTenantContext();

    const created = await this.db.tx(async (db) => {
      const activeStations = await db.select().from(stations)
        .where(and(eq(stations.outletId, order.outletId), eq(stations.isActive, true)));
      const fallback = activeStations[0];
      if (!fallback) throw Errors.invalidState('No kitchen stations are configured for this outlet.');

      const byStation = new Map<string, typeof changes>();
      for (const c of changes) {
        const stationId = c.line.stationId && activeStations.some((s) => s.id === c.line.stationId)
          ? c.line.stationId
          : fallback.id;
        const list = byStation.get(stationId) ?? [];
        list.push(c);
        byStation.set(stationId, list);
      }

      const results = [];
      for (const [stationId, stationChanges] of byStation) {
        const station = activeStations.find((s) => s.id === stationId)!;
        const businessDate = this.businessDate();
        const kotNumber = await this.nextKotNumber(db, ctx.tenantId, order.outletId, businessDate);

        const [ticket] = await db.insert(kots).values({
          tenantId: ctx.tenantId,
          orderId: order.id,
          stationId,
          kotNumber,
          businessDate,
          kind: 'MODIFIED',
          status: 'PLACED',
          notes: order.notes,
        }).returning();

        const insertedLines = await db.insert(kotLines).values(
          stationChanges.map((c) => ({
            tenantId: ctx.tenantId,
            kotId: ticket.id,
            orderLineId: c.line.id,
            nameSnapshot: c.line.nameSnapshot,
            quantity: String(c.line.quantity),
            previousQuantity: c.previousQuantity != null ? String(c.previousQuantity) : null,
            modifiersSnapshot: (c.line.modifiers ?? []).map((m) => m.nameSnapshot),
            notes: c.line.notes,
            change: c.change,
          })),
        ).returning();

        results.push({ ...ticket, lines: insertedLines, station });
      }
      return results;
    });

    await this.deliver(order, created);

    await this.audit.record({
      action: 'kot.modify', entityType: 'Order', entityId: order.id,
      outletId: order.outletId,
      detail: { changes: changes.map((c) => ({ line: c.line.nameSnapshot, change: c.change })) },
    });

    return created;
  }

  /** Tell every station holding paper for this order to stop cooking. */
  async cancelForOrder(order: KotOrderView) {
    const cancelled = await this.db.tx(async (db) => {
      const live = await db.select({
        kot: kots,
        station: stations,
      }).from(kots)
        .innerJoin(stations, eq(kots.stationId, stations.id))
        .where(and(
          eq(kots.orderId, order.id),
          notInArray(kots.status, ['CANCELLED', 'SERVED']),
        ));

      if (live.length === 0) return [];

      await db.update(kots)
        .set({ status: 'CANCELLED', cancelledAt: new Date() })
        .where(inArray(kots.id, live.map((r) => r.kot.id)));

      const withLines = [];
      for (const row of live) {
        const lines = await db.select().from(kotLines).where(eq(kotLines.kotId, row.kot.id));
        withLines.push({
          ...row.kot, kind: 'CANCELLED' as const, status: 'CANCELLED' as const,
          lines, station: row.station,
        });
      }
      return withLines;
    });

    if (cancelled.length) await this.deliver(order, cancelled, 'KOT_CANCEL');
    return cancelled;
  }

  /**
   * Advance a ticket's status.
   *
   * Forward-only, because a KDS is operated with a thumb on a greasy screen
   * and accidental backwards taps are common. A genuine mistake is corrected
   * by a manager, not by the line cook who mis-tapped.
   */
  async updateStatus(kotId: string, status: 'PREPARING' | 'READY' | 'SERVED' | 'CANCELLED') {
    const result = await this.db.tx(async (db) => {
      const [ticket] = await db.select().from(kots).where(eq(kots.id, kotId)).limit(1);
      if (!ticket) throw Errors.notFound('KOT', kotId);

      const rank: Record<string, number> = { PLACED: 0, PREPARING: 1, READY: 2, SERVED: 3 };
      if (status !== 'CANCELLED' && rank[status] <= rank[ticket.status]) {
        throw Errors.invalidState(
          `This ticket is already ${ticket.status}; it cannot go back to ${status}.`,
          { current: ticket.status, requested: status },
        );
      }

      const stamp = {
        PREPARING: 'preparingAt', READY: 'readyAt', SERVED: 'servedAt', CANCELLED: 'cancelledAt',
      }[status] as 'preparingAt' | 'readyAt' | 'servedAt' | 'cancelledAt';

      const [updated] = await db.update(kots)
        .set({ status, [stamp]: new Date() })
        .where(eq(kots.id, kotId))
        .returning();

      const lines = await db.select().from(kotLines).where(eq(kotLines.kotId, kotId));

      // Keep the order lines in step so the POS shows what is ready to run.
      if (status === 'READY' || status === 'SERVED') {
        await db.update(orderLines)
          .set({ status: status === 'READY' ? 'READY' : 'SERVED' })
          .where(and(
            inArray(orderLines.id, lines.map((l) => l.orderLineId)),
            sql`${orderLines.status} <> 'VOIDED'`,
          ));
      }

      const [order] = await db.select({ outletId: orders.outletId })
        .from(orders).where(eq(orders.id, ticket.orderId)).limit(1);

      return { ticket: { ...updated, lines }, outletId: order?.outletId };
    });

    if (result.outletId) {
      await this.gateway.pushKotStatus(result.outletId, result.ticket).catch((err) =>
        this.logger.error(`KDS status push failed for ${kotId}: ${err.message}`));
    }
    return result.ticket;
  }

  /** Reprint an existing ticket — the printer jammed, or the paper was lost. */
  async reprint(kotId: string) {
    const bundle = await this.db.tx(async (db) => {
      const [ticket] = await db.select().from(kots).where(eq(kots.id, kotId)).limit(1);
      if (!ticket) throw Errors.notFound('KOT', kotId);

      const [updated] = await db.update(kots)
        .set({ reprintCount: sql`${kots.reprintCount} + 1` })
        .where(eq(kots.id, kotId))
        .returning();

      const [lines, stationRows, orderRows] = await Promise.all([
        db.select().from(kotLines).where(eq(kotLines.kotId, kotId)),
        db.select().from(stations).where(eq(stations.id, ticket.stationId)).limit(1),
        db.select().from(orders).where(eq(orders.id, ticket.orderId)).limit(1),
      ]);

      return {
        kot: { ...updated, lines },
        station: stationRows[0],
        order: orderRows[0],
      };
    });

    await this.printing.queueKot(
      bundle.kot,
      {
        id: bundle.order.id, outletId: bundle.order.outletId,
        orderNumber: bundle.order.orderNumber, channel: bundle.order.channel,
      },
      bundle.station,
    );

    await this.audit.record({
      action: 'kot.reprint', entityType: 'Kot', entityId: kotId,
      detail: { kotNumber: bundle.kot.kotNumber, count: bundle.kot.reprintCount },
    });
    return bundle.kot;
  }

  /** Everything a KDS screen needs on connect or after a reconnect. */
  async activeForStation(stationId: string) {
    return this.db.tx(async (db) => {
      const rows = await db.select({
        kot: kots,
        order: {
          orderNumber: orders.orderNumber,
          channel: orders.channel,
          notes: orders.notes,
        },
      }).from(kots)
        .innerJoin(orders, eq(kots.orderId, orders.id))
        .where(and(
          eq(kots.stationId, stationId),
          inArray(kots.status, ['PLACED', 'PREPARING', 'READY']),
        ))
        .orderBy(asc(kots.createdAt));

      if (rows.length === 0) return [];
      const lines = await db.select().from(kotLines)
        .where(inArray(kotLines.kotId, rows.map((r) => r.kot.id)));

      return rows.map((r) => ({
        ...r.kot,
        order: r.order,
        lines: lines.filter((l) => l.kotId === r.kot.id),
      }));
    });
  }

  /* ───────────────────────── internals ───────────────────────── */

  /**
   * Push to screens and queue to printers concurrently.
   *
   * `allSettled`, not `all`: a station whose printer is offline must still get
   * its ticket on screen, and a screen that has disconnected must not stop the
   * paper. Each leg fails independently and is logged.
   */
  private async deliver(
    order: KotOrderView,
    tickets: { id: string; tenantId: string; stationId: string; kotNumber: string;
               station: { id: string; name: string; mode: string } }[],
    printType: 'KOT' | 'KOT_CANCEL' = 'KOT',
  ) {
    await Promise.allSettled(tickets.map(async (ticket) => {
      const legs = await Promise.allSettled([
        ticket.station.mode !== 'PRINT'
          ? this.gateway.pushKot(order.outletId, ticket)
          : Promise.resolve(),
        ticket.station.mode !== 'SCREEN'
          ? this.printing.queueKot(ticket as never, order, ticket.station, printType)
          : Promise.resolve(),
      ]);
      for (const leg of legs) {
        if (leg.status === 'rejected') {
          this.logger.error(`KOT ${ticket.kotNumber} delivery leg failed: ${leg.reason}`);
        }
      }
      await this.db.tx(async (db) => {
        await db.update(kots).set({ pushedAt: new Date() }).where(eq(kots.id, ticket.id));
      }).catch(() => undefined);
    }));
  }

  /**
   * KOT numbers restart each business day, prefixed K, so a cook can call
   * "K12" across a noisy pass rather than "K10412".
   *
   * Allocated through the same locked counter as invoice numbers. Gaps are
   * harmless here — this is a kitchen reference, not a tax document — but
   * *duplicates* are not, because two tickets sharing a number is exactly the
   * confusion the number exists to prevent. `count(*) + 1` raced under
   * concurrent firing and produced them.
   */
  private async nextKotNumber(
    db: Parameters<Parameters<DatabaseService['tx']>[0]>[0],
    tenantId: string,
    outletId: string,
    businessDate: string,
  ): Promise<string> {
    const n = await this.sequences.allocateFor(db as never, {
      tenantId, outletId, period: businessDate, prefix: 'KOT',
    });
    return `K${String(n).padStart(4, '0')}`;
  }

  /**
   * The business day a ticket belongs to.
   *
   * TODO (see docs/known-limitations.md): this uses the UTC date, so a
   * restaurant open past midnight sees the number reset mid-service. It should
   * use the outlet's timezone and a configurable day-start hour.
   */
  private businessDate(at = new Date()): string {
    return at.toISOString().slice(0, 10);
  }
}

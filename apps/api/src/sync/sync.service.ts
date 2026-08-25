import { Injectable, Logger } from '@nestjs/common';
import { OrdersService } from '../orders/orders.service';
import { PaymentsService } from '../payments/payments.service';
import { and, asc, eq, gt, inArray, lte } from 'drizzle-orm';
import { DatabaseService } from '../db/db.service';
import { orders, orderLines, orderLineModifiers, orderTables, kots, kotLines, payments, restaurantTables } from '../db/schema';
import { requireTenantContext } from '../tenancy/tenant-context';
import type { OrderInput, PaymentInput } from '@novapos/shared';

/**
 * Offline sync.
 *
 * The POS and the mobile app are local-first: they write to their own storage
 * and keep working with no network at all. When the link returns they flush a
 * queue of operations here.
 *
 * The rules that make this safe:
 *
 *   1. Every operation carries a client-generated id, and every handler is
 *      idempotent on it. Replaying a whole batch is harmless.
 *   2. Operations apply in the order the device recorded them. A batch is not
 *      atomic — one bad operation must not block the twelve good ones behind
 *      it — so each is reported individually and the device retires only what
 *      succeeded.
 *   3. Conflicts are resolved by rule, not by timestamp alone:
 *        · An order the server has already settled (PAID/VOIDED) wins over any
 *          offline edit. The device is told, and shows the operator.
 *        · Line-level edits merge by clientLineId, so two waiters adding
 *          different dishes to one table both succeed.
 *        · A same-line conflict resolves last-writer-wins by device clock,
 *          with the loser preserved in the audit log — never silently dropped.
 *   4. A permanently-failing operation (a deleted menu item, an illegal
 *      transition) is reported as `dead` so the device stops retrying it and
 *      surfaces it to a human instead of looping forever.
 */
export interface SyncOperation {
  /** Device-unique, monotonically increasing per device. */
  opId: string;
  type: 'order.upsert' | 'order.fire' | 'order.bill' | 'order.void' | 'payment.create';
  /** Device clock at the moment the operator acted. */
  occurredAt: string;
  payload: Record<string, unknown>;
}

export interface SyncResult {
  opId: string;
  status: 'applied' | 'duplicate' | 'conflict' | 'dead' | 'retry';
  entityId?: string;
  error?: { code: string; message: string };
  /** Server's version of the entity, so the device can reconcile. */
  serverState?: unknown;
}

@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly orders: OrdersService,
    private readonly payments: PaymentsService,
  ) {}

  async push(deviceId: string, operations: SyncOperation[]): Promise<{
    results: SyncResult[];
    serverTime: string;
  }> {
    const results: SyncResult[] = [];

    for (const op of operations) {
      try {
        const entityId = await this.apply(op);
        results.push({ opId: op.opId, status: 'applied', entityId });
      } catch (err) {
        results.push(await this.classify(op, err as Error));
      }
    }

    this.logger.log(
      `Device ${deviceId} flushed ${operations.length} ops: ` +
      `${results.filter((r) => r.status === 'applied').length} applied, ` +
      `${results.filter((r) => r.status === 'dead').length} dead, ` +
      `${results.filter((r) => r.status === 'retry').length} to retry`,
    );

    return { results, serverTime: new Date().toISOString() };
  }

  /**
   * Everything that changed at this outlet since the device's last cursor.
   * The cursor is a server timestamp, not a device one — device clocks drift
   * and a skewed clock would silently skip records.
   */
  /**
   * Everything that changed at this outlet since the device's cursor.
   *
   * The cursor is a *server* timestamp, never a device one: device clocks
   * drift, and a skewed clock would silently skip records that landed in the
   * gap. The window is closed at `now` so a row written mid-query cannot fall
   * between this page and the next.
   */
  async pull(outletId: string, since?: string) {
    const cursor = since ? new Date(since) : new Date(Date.now() - 86400_000);
    const now = new Date();
    const PAGE = 500;

    return this.db.tx(async (db) => {
      const changedOrders = await db.select().from(orders)
        .where(and(
          eq(orders.outletId, outletId),
          gt(orders.updatedAt, cursor),
          lte(orders.updatedAt, now),
        ))
        .orderBy(asc(orders.updatedAt))
        .limit(PAGE);

      const orderIds = changedOrders.map((o) => o.id);

      const lines = orderIds.length
        ? await db.select().from(orderLines).where(inArray(orderLines.orderId, orderIds))
        : [];
      const lineIds = lines.map((l) => l.id);

      const [mods, tables, pays, kotJoins, floor] = await Promise.all([
        lineIds.length
          ? db.select().from(orderLineModifiers).where(inArray(orderLineModifiers.orderLineId, lineIds))
          : Promise.resolve([]),
        orderIds.length
          ? db.select().from(orderTables).where(inArray(orderTables.orderId, orderIds))
          : Promise.resolve([]),
        orderIds.length
          ? db.select().from(payments).where(inArray(payments.orderId, orderIds))
          : Promise.resolve([]),
        db.select({ kot: kots }).from(kots)
          .innerJoin(orders, eq(kots.orderId, orders.id))
          .where(and(
            eq(orders.outletId, outletId),
            gt(kots.updatedAt, cursor),
            lte(kots.updatedAt, now),
          ))
          .orderBy(asc(kots.updatedAt))
          .limit(PAGE),
        db.select().from(restaurantTables)
          .where(and(eq(restaurantTables.outletId, outletId), eq(restaurantTables.isActive, true))),
      ]);

      const kotRows = kotJoins.map((r) => r.kot);
      const ticketLines = kotRows.length
        ? await db.select().from(kotLines).where(inArray(kotLines.kotId, kotRows.map((k) => k.id)))
        : [];

      return {
        cursor: now.toISOString(),
        orders: changedOrders.map((o) => ({
          ...o,
          lines: lines
            .filter((l) => l.orderId === o.id)
            .map((l) => ({ ...l, modifiers: mods.filter((m) => m.orderLineId === l.id) })),
          tables: tables.filter((t) => t.orderId === o.id),
          payments: pays.filter((p) => p.orderId === o.id),
        })),
        kots: kotRows.map((k) => ({ ...k, lines: ticketLines.filter((l) => l.kotId === k.id) })),
        tables: floor,
        /** True when a page filled up and the device should pull again at once. */
        hasMore: changedOrders.length === PAGE || kotRows.length === PAGE,
      };
    });
  }

  private async apply(op: SyncOperation): Promise<string | undefined> {
    switch (op.type) {
      case 'order.upsert': {
        const order = await this.orders.upsertOrder({
          ...(op.payload as unknown as OrderInput & { outletId: string }),
          placedAt: op.occurredAt,
        });
        return order.id;
      }
      case 'order.fire': {
        const result = await this.orders.fire(op.payload.orderId as string);
        return result.order.id;
      }
      case 'order.bill': {
        const order = await this.orders.bill(op.payload.orderId as string);
        return order.id;
      }
      case 'order.void': {
        const order = await this.orders.void(
          op.payload.orderId as string,
          (op.payload.reason as string) ?? 'Voided offline',
        );
        return order.id;
      }
      case 'payment.create': {
        const result = await this.payments.pay(
          op.payload.orderId as string,
          op.payload as unknown as PaymentInput,
        );
        return result.payment.id;
      }
      default:
        throw new Error(`Unknown sync operation type "${(op as SyncOperation).type}".`);
    }
  }

  /**
   * Decide whether the device should retry, give up, or reconcile.
   *
   * Getting this wrong in either direction is costly: too eager to retry and a
   * device loops forever on a poisoned operation; too eager to give up and a
   * real sale is silently lost. The classification keys off the error code the
   * domain layer attaches for exactly this purpose.
   */
  private async classify(op: SyncOperation, err: Error): Promise<SyncResult> {
    const response = (err as { getResponse?: () => { code?: string; message?: string } }).getResponse?.();
    const code = response?.code ?? 'UNKNOWN';
    const message = response?.message ?? err.message;

    const base = { opId: op.opId, error: { code, message } };

    switch (code) {
      // The work is already done — this is a normal replay, not a failure.
      case 'IDEMPOTENCY_KEY_REUSED':
        return { ...base, status: 'duplicate' };

      // The server's state has moved past what the device knew. The device
      // must reconcile rather than retry, so it gets the authoritative record.
      case 'INVALID_STATE':
      case 'SYNC_CONFLICT': {
        const orderId = op.payload.orderId as string | undefined;
        const serverState = orderId
          ? await this.orders.findById(orderId).catch(() => undefined)
          : undefined;
        return { ...base, status: 'conflict', serverState };
      }

      // Structurally broken or referring to things that no longer exist.
      // Retrying will never help; a human has to look at it.
      case 'VALIDATION_FAILED':
      case 'NOT_FOUND':
      case 'FORBIDDEN':
      case 'TAX_CONFIG_INVALID':
        return { ...base, status: 'dead' };

      // Transient: the gateway was down, the printer was unreachable, the DB
      // was briefly unavailable. Worth another attempt.
      default:
        return { ...base, status: 'retry' };
    }
  }
}

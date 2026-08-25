import { Injectable } from '@nestjs/common';
import { and, eq, gte, inArray, lt, sql } from 'drizzle-orm';
import { DatabaseService } from '../db/db.service';
import { orders, orderLines, payments, shifts, kots, staff } from '../db/schema';
import { requireTenantContext } from '../tenancy/tenant-context';

/**
 * Reporting.
 *
 * These queries run against a growing orders table on modest hardware, so they
 * are written as aggregates in SQL rather than as row fetches the API then
 * reduces in memory. The indexes they rely on — (tenant_id, outlet_id,
 * created_at) and the partial `orders_live_idx` — are declared in the schema
 * and the post-migration SQL.
 *
 * Every figure comes from the *snapshot* frozen on each order, never
 * recomputed, so a report of last quarter does not change when this quarter's
 * tax rates do.
 */
@Injectable()
export class ReportsService {
  constructor(private readonly db: DatabaseService) {}

  async salesSummary(input: { outletId?: string; from: Date; to: Date }) {
    return this.db.tx(async (db) => {
      const rows = await db.select({
        day: sql<string>`date_trunc('day', ${orders.createdAt})::date::text`,
        orderCount: sql<number>`count(*)::int`,
        grossMinor: sql<number>`coalesce(sum(${orders.totalMinor}), 0)::bigint`,
        discountMinor: sql<number>`coalesce(sum(${orders.discountMinor}), 0)::bigint`,
        taxMinor: sql<number>`coalesce(sum(${orders.taxMinor}), 0)::bigint`,
        netMinor: sql<number>`coalesce(sum(${orders.totalMinor} - ${orders.taxMinor}), 0)::bigint`,
      }).from(orders)
        .where(and(
          eq(orders.status, 'PAID'),
          gte(orders.createdAt, input.from),
          lt(orders.createdAt, input.to),
          ...(input.outletId ? [eq(orders.outletId, input.outletId)] : []),
        ))
        .groupBy(sql`1`)
        .orderBy(sql`1`);

      return rows.map((r) => ({
        day: r.day,
        orders: Number(r.orderCount),
        grossMinor: Number(r.grossMinor),
        discountMinor: Number(r.discountMinor),
        taxMinor: Number(r.taxMinor),
        netMinor: Number(r.netMinor),
      }));
    });
  }

  /**
   * Tax collected per component — the figures that go on a GST return or a VAT
   * filing. Unnests the frozen per-order snapshots, so historical rates are
   * honoured even after the tenant edits their rule set.
   */
  async taxSummary(input: { outletId?: string; from: Date; to: Date }) {
    const ctx = requireTenantContext();
    return this.db.tx(async (db) => {
      const result = await db.execute<{
        code: string; rate: string; taxable: string; amount: string;
      }>(sql`
        SELECT comp->>'code'                       AS code,
               comp->>'rate'                       AS rate,
               sum((comp->>'baseMinor')::bigint)   AS taxable,
               sum((comp->>'amountMinor')::bigint) AS amount
        FROM orders o,
             LATERAL jsonb_array_elements(o.tax_snapshot->'componentTotals') AS comp
        WHERE o.tenant_id = ${ctx.tenantId}::uuid
          AND (${input.outletId ?? null}::uuid IS NULL OR o.outlet_id = ${input.outletId ?? null}::uuid)
          AND o.status = 'PAID'
          AND o.created_at >= ${input.from} AND o.created_at < ${input.to}
          AND o.tax_snapshot IS NOT NULL
        GROUP BY 1, 2
        ORDER BY 1, 2
      `);

      const rows = (result as unknown as { rows?: Record<string, string>[] }).rows
        ?? (result as unknown as Record<string, string>[]);

      return rows.map((r) => ({
        code: r.code,
        rate: Number(r.rate),
        taxableMinor: Number(r.taxable ?? 0),
        amountMinor: Number(r.amount ?? 0),
      }));
    });
  }

  async topItems(input: { outletId?: string; from: Date; to: Date; limit?: number }) {
    return this.db.tx(async (db) => {
      const rows = await db.select({
        name: orderLines.nameSnapshot,
        quantity: sql<string>`sum(${orderLines.quantity})`,
        revenueMinor: sql<string>`coalesce(sum(${orderLines.lineTotalMinor}), 0)::bigint`,
        orderCount: sql<number>`count(DISTINCT ${orderLines.orderId})::int`,
      }).from(orderLines)
        .innerJoin(orders, eq(orderLines.orderId, orders.id))
        .where(and(
          eq(orders.status, 'PAID'),
          sql`${orderLines.status} <> 'VOIDED'`,
          gte(orders.createdAt, input.from),
          lt(orders.createdAt, input.to),
          ...(input.outletId ? [eq(orders.outletId, input.outletId)] : []),
        ))
        .groupBy(orderLines.nameSnapshot)
        .orderBy(sql`3 DESC`)
        .limit(input.limit ?? 20);

      return rows.map((r) => ({
        name: r.name,
        quantity: Number(r.quantity),
        revenueMinor: Number(r.revenueMinor),
        orders: Number(r.orderCount),
      }));
    });
  }

  async paymentMix(input: { outletId?: string; from: Date; to: Date }) {
    return this.db.tx(async (db) => {
      const rows = await db.select({
        method: payments.method,
        count: sql<number>`count(*)::int`,
        amountMinor: sql<string>`coalesce(sum(${payments.amountMinor} - ${payments.refundedMinor}), 0)::bigint`,
      }).from(payments)
        .innerJoin(orders, eq(payments.orderId, orders.id))
        .where(and(
          inArray(payments.status, ['CAPTURED', 'REFUNDED']),
          gte(payments.createdAt, input.from),
          lt(payments.createdAt, input.to),
          ...(input.outletId ? [eq(orders.outletId, input.outletId)] : []),
        ))
        .groupBy(payments.method)
        .orderBy(sql`3 DESC`);

      return rows.map((r) => ({
        method: r.method, count: Number(r.count), amountMinor: Number(r.amountMinor),
      }));
    });
  }

  /**
   * Shift close-out: what should be in the drawer versus what was counted.
   * The variance line is the one an owner actually reads.
   */
  async shiftReport(shiftId: string) {
    return this.db.tx(async (db) => {
      const [shift] = await db.select({
        shift: shifts,
        staffName: staff.name,
      }).from(shifts)
        .innerJoin(staff, eq(shifts.staffId, staff.id))
        .where(eq(shifts.id, shiftId))
        .limit(1);
      if (!shift) return null;

      const shiftOrders = await db.select().from(orders).where(eq(orders.shiftId, shiftId));
      const paid = shiftOrders.filter((o) => o.status === 'PAID');

      const pays = shiftOrders.length
        ? await db.select().from(payments)
            .where(inArray(payments.orderId, shiftOrders.map((o) => o.id)))
        : [];

      const byMethod = new Map<string, number>();
      for (const p of pays) {
        if (p.status !== 'CAPTURED') continue;
        byMethod.set(p.method, (byMethod.get(p.method) ?? 0) + p.amountMinor - p.refundedMinor);
      }

      const cashTaken = byMethod.get('CASH') ?? 0;
      const expectedCash = shift.shift.openingFloatMinor + cashTaken;

      return {
        shift: {
          id: shift.shift.id,
          staffName: shift.staffName,
          openedAt: shift.shift.openedAt,
          closedAt: shift.shift.closedAt,
          openingFloatMinor: shift.shift.openingFloatMinor,
        },
        orderCount: paid.length,
        voidCount: shiftOrders.filter((o) => o.status === 'VOIDED').length,
        grossMinor: paid.reduce((s, o) => s + o.totalMinor, 0),
        taxMinor: paid.reduce((s, o) => s + o.taxMinor, 0),
        discountMinor: paid.reduce((s, o) => s + o.discountMinor, 0),
        byMethod: [...byMethod.entries()].map(([method, amountMinor]) => ({ method, amountMinor })),
        expectedCashMinor: expectedCash,
        countedCashMinor: shift.shift.countedCashMinor,
        varianceMinor: shift.shift.countedCashMinor != null
          ? shift.shift.countedCashMinor - expectedCash
          : null,
      };
    });
  }

  /** Live dashboard tiles — deliberately cheap, polled on a short interval. */
  async today(outletId: string) {
    return this.db.tx(async (db) => {
      const from = new Date();
      from.setHours(0, 0, 0, 0);

      const [[agg], [openRow], [kotRow]] = await Promise.all([
        db.select({
          count: sql<number>`count(*)::int`,
          grossMinor: sql<string>`coalesce(sum(${orders.totalMinor}), 0)::bigint`,
          taxMinor: sql<string>`coalesce(sum(${orders.taxMinor}), 0)::bigint`,
          discountMinor: sql<string>`coalesce(sum(${orders.discountMinor}), 0)::bigint`,
        }).from(orders)
          .where(and(
            eq(orders.outletId, outletId),
            eq(orders.status, 'PAID'),
            gte(orders.createdAt, from),
          )),
        db.select({ count: sql<number>`count(*)::int` }).from(orders)
          .where(and(
            eq(orders.outletId, outletId),
            inArray(orders.status, ['OPEN', 'BILLED']),
          )),
        db.select({ count: sql<number>`count(*)::int` }).from(kots)
          .innerJoin(orders, eq(kots.orderId, orders.id))
          .where(and(
            eq(orders.outletId, outletId),
            inArray(kots.status, ['PLACED', 'PREPARING']),
          )),
      ]);

      const count = Number(agg?.count ?? 0);
      const gross = Number(agg?.grossMinor ?? 0);
      return {
        orders: count,
        grossMinor: gross,
        taxMinor: Number(agg?.taxMinor ?? 0),
        discountMinor: Number(agg?.discountMinor ?? 0),
        openOrders: Number(openRow?.count ?? 0),
        pendingKots: Number(kotRow?.count ?? 0),
        averageOrderMinor: count ? Math.round(gross / count) : 0,
      };
    });
  }
}

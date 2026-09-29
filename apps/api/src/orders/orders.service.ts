import { subscriptionStatus } from '../payments/subscription.service';
import { Injectable, Logger } from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import { and, asc, desc, eq, gte, inArray, isNull, ne, not, sql } from 'drizzle-orm';
import { DatabaseService } from '../db/db.service';
import type { Db } from '../db/client';
import {
  orders, orderLines, orderLineModifiers, orderTables, restaurantTables,
  menuItems, menuItemVariants, modifiers as modifiersTable, menuItemModifierGroups, modifierGroups, categories,
  outlets, tenants, customers, payments, kots, kotLines, staff,
} from '../db/schema';
import { PricingService, type PricedLineInput, type PricedLine } from './pricing.service';
import { InvoiceNumberService } from './invoice-number.service';
import { TaxConfigService } from '../tax/tax-config.service';
import { AuditService } from '../common/audit.service';
import { IdempotencyService } from '../common/idempotency.service';
import { KotService } from '../kot/kot.service';
import { Errors } from '../common/errors';
import { requireTenantContext } from '../tenancy/tenant-context';
import type { OrderInput, DiscountType } from '@novapos/shared';

/**
 * Order lifecycle.
 *
 *   DRAFT ──fire──▶ OPEN ──bill──▶ BILLED ──pay──▶ PAID
 *      │              │               │
 *      └──────────────┴───────────────┴──────▶ VOIDED
 *
 * Transitions are enforced here rather than trusted from the client, because
 * an offline device replaying a stale batch will happily ask for an illegal
 * one. A PAID order is immutable: correcting it means a refund and a fresh
 * bill, which is also the shape tax authorities expect to see in the record.
 */
const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ['OPEN', 'BILLED', 'VOIDED'],
  OPEN: ['OPEN', 'BILLED', 'VOIDED'],
  BILLED: ['PAID', 'OPEN', 'VOIDED'],
  PAID: [],
  VOIDED: [],
};

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly pricing: PricingService,
    private readonly tax: TaxConfigService,
    private readonly invoiceNumbers: InvoiceNumberService,
    private readonly audit: AuditService,
    private readonly idempotency: IdempotencyService,
    private readonly kot: KotService,
  ) {}

  private async assertLicense(db: Db) {
    const { tenantId } = requireTenantContext();
    const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId)).limit(1);
    if (!tenant || subscriptionStatus(tenant).isExpired) {
      // Retryable: retain queued offline operations until renewal, never discard sales.
      throw Errors.paymentFailed('Your license has expired. Renew to create or bill orders.');
    }
  }

  /**
   * Create or update an order from a POS device.
   *
   * Idempotent on `clientOrderId`: a device retrying a flush gets the same
   * order back rather than a duplicate. This is the single most important
   * property in the system — duplicate bills are what destroy trust in a POS.
   */
  async upsertOrder(input: OrderInput & { outletId: string }) {
    // Key on the *write attempt*, not on the order. Keying on clientOrderId
    // would make every legitimate edit to an open tab look like a replay.
    const requestKey = input.clientRequestId
      ?? `${input.clientOrderId}:${hashRequest(input)}`;

    return this.idempotency.execute('order', requestKey, input, async () => {
      const ctx = requireTenantContext();

      const saved = await this.db.tx(async (db) => {
        await this.assertLicense(db);
        const existing = await this.loadOrderRow(db, { clientOrderId: input.clientOrderId });

        if (existing && ['PAID', 'VOIDED'].includes(existing.status)) {
          // Not an error: the device is replaying work the server already
          // finished. Return the settled order so the client can reconcile.
          return existing;
        }

        const { outlet, tenant } = await this.loadOutlet(db, input.outletId);
        const priced = await this.priceOrder(db, input, outlet, tenant);

        const base = {
          channel: input.channel,
          staffId: ctx.staffId,
          customerId: input.customerId ?? null,
          guestCount: input.guestCount ?? null,
          notes: input.notes ?? null,
          currency: priced.currency,
          subtotalMinor: priced.subtotalMinor,
          discountMinor: priced.discountMinor,
          serviceChargeMinor: priced.serviceChargeMinor,
          deliveryChargeMinor: priced.deliveryChargeMinor,
          tipMinor: priced.tipMinor,
          taxMinor: priced.taxMinor,
          roundingMinor: priced.roundingMinor,
          totalMinor: priced.totalMinor,
          discountType: (input.orderDiscount?.type ?? null) as DiscountType | null,
          discountValue: input.orderDiscount?.value != null ? String(input.orderDiscount.value) : null,
          discountReason: input.orderDiscount?.reason ?? null,
          taxSnapshot: priced.taxSnapshot as never,
          taxRuleSetKey: priced.taxSnapshot.ruleSetId,
          placedAt: input.placedAt ? new Date(input.placedAt) : new Date(),
          lastWriterId: ctx.staffId,
        };

        let orderId: string;
        if (existing) {
          const [updated] = await db.update(orders)
            .set({ ...base, version: sql`${orders.version} + 1` })
            .where(eq(orders.id, existing.id))
            .returning();
          orderId = updated.id;
        } else {
          const orderNumber = await this.invoiceNumbers.nextOrderNumber(db, {
            tenantId: ctx.tenantId, outletId: outlet.id,
          });
          const [created] = await db.insert(orders).values({
            ...base,
            tenantId: ctx.tenantId,
            outletId: outlet.id,
            clientOrderId: input.clientOrderId,
            orderNumber,
            status: 'DRAFT',
          }).returning();
          orderId = created.id;
        }

        const priorLines = existing
          ? await db.select().from(orderLines).where(eq(orderLines.orderId, orderId))
          : [];

        await this.syncLines(db, orderId, ctx.tenantId, priced.lines, priorLines);
        await this.syncTables(db, orderId, ctx.tenantId, input.tableIds ?? []);

        return (await this.loadOrderRow(db, { id: orderId }))!;
      });

      await this.audit.record({
        action: 'order.upsert', entityType: 'Order', entityId: saved.id,
        outletId: saved.outletId,
        detail: { orderNumber: saved.orderNumber, totalMinor: saved.totalMinor },
      });

      return this.findById(saved.id);
    });
  }

  /**
   * Fire pending lines to the kitchen.
   *
   * Deliberately separate from saving the order: a waiter builds a round at
   * the table and fires when the guest has finished ordering. Only unfired
   * lines are included, so re-firing can never duplicate a dish already on
   * the pass.
   */
  async fire(orderId: string) {
    const prepared = await this.db.tx(async (db) => {
      await this.assertLicense(db);
      const order = await this.requireOrder(db, orderId);
      this.assertTransition(order.status, 'OPEN');

      const pending = order.lines.filter((l) => !l.firedAt && l.status !== 'VOIDED');
      if (pending.length === 0) {
        throw Errors.invalidState('Every line on this order has already been sent to the kitchen.');
      }
      return { order, pending };
    });

    // KOT creation talks to printers and sockets, so it runs outside the
    // transaction above — a slow printer must not hold a database lock.
    const created = await this.kot.createForLines(prepared.order, prepared.pending, 'NEW');

    await this.db.tx(async (db) => {
      await db.update(orderLines)
        .set({ firedAt: new Date(), status: 'FIRED' })
        .where(inArray(orderLines.id, prepared.pending.map((l) => l.id)));
      await db.update(orders)
        .set({ status: 'OPEN', version: sql`${orders.version} + 1` })
        .where(eq(orders.id, orderId));
    });

    await this.audit.record({
      action: 'order.fire', entityType: 'Order', entityId: orderId,
      outletId: prepared.order.outletId,
      detail: { lineCount: prepared.pending.length, kotIds: created.map((k) => k.id) },
    });

    return { order: await this.findById(orderId), kots: created };
  }

  /**
   * Generate the bill: assign the invoice number and freeze the totals.
   *
   * The number is assigned here rather than at order creation so that an
   * abandoned draft never consumes one from a gapless series.
   */
  async bill(orderId: string) {
    const ctx = requireTenantContext();

    const billed = await this.db.tx(async (db) => {
      await this.assertLicense(db);
      const order = await this.requireOrder(db, orderId);
      if (order.invoiceNumber) return order; // already billed — idempotent
      this.assertTransition(order.status, 'BILLED');

      const active = order.lines.filter((l) => l.status !== 'VOIDED');
      if (active.length === 0) {
        throw Errors.invalidState('Cannot bill an order with no active lines.');
      }

      const [outlet] = await db.select().from(outlets).where(eq(outlets.id, order.outletId)).limit(1);
      if (!outlet) throw Errors.notFound('Outlet', order.outletId);

      const invoiceNumber = await this.invoiceNumbers.next(db, {
        tenantId: ctx.tenantId,
        outletId: order.outletId,
        prefix: outlet.invoicePrefix,
      });

      await db.update(orders).set({
        invoiceNumber,
        status: 'BILLED',
        billedAt: new Date(),
        version: sql`${orders.version} + 1`,
      }).where(eq(orders.id, orderId));

      const tableIds = order.tables.map((t) => t.tableId);
      if (tableIds.length) {
        await db.update(restaurantTables)
          .set({ status: 'BILLED' })
          .where(inArray(restaurantTables.id, tableIds));
      }

      return (await this.requireOrder(db, orderId));
    });

    await this.audit.record({
      action: 'order.bill', entityType: 'Order', entityId: orderId,
      outletId: billed.outletId,
      detail: { invoiceNumber: billed.invoiceNumber, totalMinor: billed.totalMinor },
    });

    return this.findById(orderId);
  }

  /**
   * Void an order. Never deletes: the record is required for audit, and a
   * missing number in a gapless series is itself a compliance problem.
   */
  async void(orderId: string, reason: string) {
    if (!reason?.trim()) {
      throw Errors.validation('A void requires a reason — it is the first thing an auditor asks for.');
    }

    const order = await this.db.tx(async (db) => {
      const found = await this.requireOrder(db, orderId);
      this.assertTransition(found.status, 'VOIDED');
      return found;
    });

    await this.kot.cancelForOrder(order);

    await this.db.tx(async (db) => {
      await db.update(orders).set({
        status: 'VOIDED', voidedAt: new Date(), voidReason: reason,
        version: sql`${orders.version} + 1`,
      }).where(eq(orders.id, orderId));

      await db.update(orderLines)
        .set({ status: 'VOIDED', voidedAt: new Date() })
        .where(eq(orderLines.orderId, orderId));

      const tableIds = order.tables.map((t) => t.tableId);
      if (tableIds.length) {
        await db.update(restaurantTables)
          .set({ status: 'FREE' })
          .where(inArray(restaurantTables.id, tableIds));
      }
    });

    await this.audit.record({
      action: 'order.void', entityType: 'Order', entityId: orderId,
      outletId: order.outletId,
      detail: { reason, totalMinor: order.totalMinor, invoiceNumber: order.invoiceNumber },
    });

    return this.findById(orderId);
  }

  async findById(id: string) {
    const order = await this.db.tx(async (db) => this.loadOrderRow(db, { id }));
    if (!order) throw Errors.notFound('Order', id);
    return order;
  }

  /** The POS running-tabs view. */
  async listOpen(outletId: string) {
    return this.db.tx(async (db) => {
      const rows = await db.select().from(orders)
        .where(and(
          eq(orders.outletId, outletId),
          inArray(orders.status, ['DRAFT', 'OPEN', 'BILLED']),
        ))
        .orderBy(asc(orders.createdAt));

      if (rows.length === 0) return [];

      const ids = rows.map((o) => o.id);
      const [lines, tables] = await Promise.all([
        db.select().from(orderLines)
          .where(and(inArray(orderLines.orderId, ids), ne(orderLines.status, 'VOIDED'))),
        db.select({
          orderId: orderTables.orderId,
          tableId: orderTables.tableId,
          isPrimary: orderTables.isPrimary,
          label: restaurantTables.label,
        }).from(orderTables)
          .innerJoin(restaurantTables, eq(orderTables.tableId, restaurantTables.id))
          .where(inArray(orderTables.orderId, ids)),
      ]);

      return rows.map((o) => ({
        ...o,
        lines: lines.filter((l) => l.orderId === o.id),
        tables: tables.filter((t) => t.orderId === o.id),
      }));
    });
  }

  /* ───────────────────────── internals ───────────────────────── */

  private assertTransition(from: string, to: string) {
    if (!ALLOWED_TRANSITIONS[from]?.includes(to)) {
      throw Errors.invalidState(
        `An order that is ${from} cannot become ${to}.` +
        (from === 'PAID' ? ' A paid bill is final; issue a refund and a fresh bill instead.' : ''),
        { from, to, allowed: ALLOWED_TRANSITIONS[from] ?? [] },
      );
    }
  }

  /** Load an order with everything a caller realistically needs. */
  private async loadOrderRow(db: Db, by: { id?: string; clientOrderId?: string }) {
    const where = by.id
      ? eq(orders.id, by.id)
      : eq(orders.clientOrderId, by.clientOrderId!);

    const [order] = await db.select().from(orders).where(where).limit(1);
    if (!order) return null;

    const [lines, mods, tables, pays, ticketRows, outletRow, customerRow, staffRow] = await Promise.all([
      db.select().from(orderLines)
        .where(eq(orderLines.orderId, order.id))
        .orderBy(asc(orderLines.sortOrder)),
      db.select().from(orderLineModifiers)
        .where(sql`${orderLineModifiers.orderLineId} IN (
          SELECT id FROM order_lines WHERE order_id = ${order.id}
        )`),
      db.select({
        orderId: orderTables.orderId,
        tableId: orderTables.tableId,
        isPrimary: orderTables.isPrimary,
        table: { id: restaurantTables.id, label: restaurantTables.label },
      }).from(orderTables)
        .innerJoin(restaurantTables, eq(orderTables.tableId, restaurantTables.id))
        .where(eq(orderTables.orderId, order.id)),
      db.select().from(payments).where(eq(payments.orderId, order.id)),
      db.select().from(kots).where(eq(kots.orderId, order.id)),
      db.select().from(outlets).where(eq(outlets.id, order.outletId)).limit(1),
      order.customerId
        ? db.select().from(customers).where(eq(customers.id, order.customerId)).limit(1)
        : Promise.resolve([]),
      order.staffId
        ? db.select({ id: staff.id, name: staff.name }).from(staff).where(eq(staff.id, order.staffId)).limit(1)
        : Promise.resolve([]),
    ]);

    return {
      ...order,
      lines: lines.map((l) => ({
        ...l,
        quantity: Number(l.quantity),
        modifiers: mods.filter((m) => m.orderLineId === l.id),
      })),
      tables,
      payments: pays,
      kots: ticketRows,
      outlet: outletRow[0] ?? null,
      customer: customerRow[0] ?? null,
      staff: staffRow[0] ?? null,
    };
  }

  private async requireOrder(db: Db, id: string) {
    const order = await this.loadOrderRow(db, { id });
    if (!order) throw Errors.notFound('Order', id);
    return order;
  }

  private async loadOutlet(db: Db, outletId: string) {
    const [outlet] = await db.select().from(outlets)
      .where(and(eq(outlets.id, outletId), eq(outlets.isActive, true))).limit(1);
    if (!outlet) throw Errors.notFound('Outlet', outletId);

    // The tenants table is not tenant-scoped (it *is* the tenant), so this
    // read is not filtered by RLS — it is keyed by the outlet's own tenantId,
    // which RLS already vouched for.
    const [tenant] = await db.select().from(tenants).where(eq(tenants.id, outlet.tenantId)).limit(1);
    if (!tenant) throw Errors.notFound('Tenant', outlet.tenantId);
    return { outlet, tenant };
  }

  /**
   * Turn the client's line inputs into priced lines using server-side menu
   * data. The client sends item ids and quantities; names, prices and tax
   * slabs all come from the database, so a tampered client cannot set its own
   * prices.
   */
  private async priceOrder(
    db: Db,
    input: OrderInput & { outletId: string },
    outlet: Awaited<ReturnType<OrdersService['loadOutlet']>>['outlet'],
    tenant: Awaited<ReturnType<OrdersService['loadOutlet']>>['tenant'],
  ) {
    const tenantId = tenant.id;
    const itemIds = [...new Set(input.lines.map((l) => l.itemId))];
    if (itemIds.length === 0) throw Errors.validation('An order must have at least one line.');

    const items = await db.select().from(menuItems)
      .where(and(inArray(menuItems.id, itemIds), isNull(menuItems.deletedAt)));
    const itemMap = new Map(items.map((i) => [i.id, i]));

    const missing = itemIds.filter((id) => !itemMap.has(id));
    if (missing.length) {
      throw Errors.validation(
        `These menu items no longer exist or are not available at this outlet: ${missing.join(', ')}`,
        { missingItemIds: missing },
      );
    }

    const [variants, cats] = await Promise.all([
      db.select().from(menuItemVariants).where(and(
        inArray(menuItemVariants.itemId, itemIds),
        eq(menuItemVariants.tenantId, tenantId),
        eq(menuItemVariants.isActive, true),
      )),
      db.select().from(categories)
        .where(inArray(categories.id, [...new Set(items.map((i) => i.categoryId))])),
    ]);
    const categoryMap = new Map(cats.map((c) => [c.id, c]));
    const modifierGroupLinks = itemIds.length
      ? await db.select({
        itemId: menuItemModifierGroups.itemId,
        groupId: modifierGroups.id,
        name: modifierGroups.name,
        minSelect: modifierGroups.minSelect,
        maxSelect: modifierGroups.maxSelect,
      }).from(menuItemModifierGroups)
        .innerJoin(modifierGroups, eq(menuItemModifierGroups.groupId, modifierGroups.id))
        .where(and(
          inArray(menuItemModifierGroups.itemId, itemIds),
          eq(menuItemModifierGroups.tenantId, tenantId),
          eq(modifierGroups.tenantId, tenantId),
          eq(modifierGroups.isActive, true),
        ))
      : [];
    const groupsByItem = new Map<string, typeof modifierGroupLinks>();
    for (const group of modifierGroupLinks) {
      const rows = groupsByItem.get(group.itemId) ?? [];
      rows.push(group);
      groupsByItem.set(group.itemId, rows);
    }

    const modifierIds = [...new Set(input.lines.flatMap((l) => l.modifierIds ?? []))];
    const mods = modifierIds.length
    ? await db.select().from(modifiersTable).where(and(
      inArray(modifiersTable.id, modifierIds),
      eq(modifiersTable.tenantId, tenantId),
      eq(modifiersTable.isActive, true),
    ))
    : [];
    const modMap = new Map(mods.map((m) => [m.id, m]));

    const pricedInputs: PricedLineInput[] = input.lines.map((l) => {
      const item = itemMap.get(l.itemId)!;
      if (!item.isActive) throw Errors.validation(`"${item.name}" is not currently available.`);

      const variant = l.variantId ? variants.find((v) => v.id === l.variantId) : null;
      if (l.variantId && (!variant || variant.itemId !== item.id)) {
        throw Errors.validation(`Variant ${l.variantId} does not belong to "${item.name}".`);
      }

      // Channel pricing: a delivery-only price overrides the base price.
      const channelPrices = (item.channelPrices ?? {}) as Record<string, number>;
      const basePrice = channelPrices[input.channel] ?? item.priceMinor;
      const unitPriceMinor = (variant?.priceMinor ?? (basePrice + (variant?.priceDeltaMinor ?? 0)))
        + item.packagingChargeMinor;

      const lineModifiers = (l.modifierIds ?? []).map((id) => {
        const m = modMap.get(id);
        if (!m) throw Errors.validation(`Modifier ${id} does not exist.`);
        return { id: m.id, name: m.name, priceMinor: m.priceMinor };
      });
      const itemGroups = groupsByItem.get(item.id) ?? [];
      if (itemGroups.length) {
        const allowedGroups = new Map(itemGroups.map(group => [group.groupId, group]));
        const selectedByGroup = new Map<string, number>();
        for (const modifier of lineModifiers) {
          const source = modMap.get(modifier.id)!;
          if (!allowedGroups.has(source.groupId)) {
            throw Errors.validation(`Modifier "${source.name}" is not available for "${item.name}".`);
          }
          selectedByGroup.set(source.groupId, (selectedByGroup.get(source.groupId) ?? 0) + 1);
        }
        for (const group of itemGroups) {
          const count = selectedByGroup.get(group.groupId) ?? 0;
          if (count < group.minSelect || count > group.maxSelect) {
            throw Errors.validation(`Choose between ${group.minSelect} and ${group.maxSelect} options for "${group.name}".`);
          }
        }
      }

      return {
        clientLineId: l.clientLineId,
        itemId: item.id,
        variantId: variant?.id ?? null,
        name: variant ? `${item.name} (${variant.name})` : item.name,
        quantity: l.quantity,
        unitPriceMinor,
        modifiers: lineModifiers,
        discount: l.discount ?? null,
        taxSlabId: item.taxSlabId,
        hsnSac: item.hsnSac,
        stationId: l.stationId ?? item.stationId ?? categoryMap.get(item.categoryId)?.stationId ?? null,
        notes: l.notes ?? null,
      };
    });

    const customer = input.customerId
      ? (await db.select().from(customers).where(eq(customers.id, input.customerId)).limit(1))[0] ?? null
      : null;

    const ruleSet = await this.tax.resolveForOutlet(outlet, tenant);
    const taxContext = this.tax.buildContext({
      outlet: { country: outlet.country, region: outlet.region },
      customer,
      channel: input.channel,
    });

    return this.pricing.price({
      lines: pricedInputs,
      orderDiscount: input.orderDiscount ?? null,
      serviceChargePercent: input.serviceChargePercent ?? Number(outlet.serviceChargePercent ?? 0),
      tipMinor: input.tipMinor ?? 0,
      deliveryChargeMinor: input.deliveryChargeMinor ?? 0,
      currency: outlet.currency ?? tenant.defaultCurrency,
      ruleSet,
      taxContext,
    });
  }

  /**
   * Reconcile saved lines against incoming ones.
   *
   * Matching is by `clientLineId`, never by array position — an offline client
   * may reorder, insert or drop lines between flushes. A line that has already
   * been fired is voided rather than deleted, so the kitchen's paper copy and
   * the database stay in agreement.
   */
  private async syncLines(
    db: Db,
    orderId: string,
    tenantId: string,
    incoming: PricedLine[],
    existing: { id: string; clientLineId: string; firedAt: Date | null }[],
  ) {
    const existingByClientId = new Map(existing.map((l) => [l.clientLineId, l]));
    const incomingIds = new Set(incoming.map((l) => l.clientLineId));

    for (const [clientLineId, line] of existingByClientId) {
      if (incomingIds.has(clientLineId)) continue;
      if (line.firedAt) {
        await db.update(orderLines).set({
          status: 'VOIDED', voidedAt: new Date(), voidReason: 'Removed at the POS after firing',
        }).where(eq(orderLines.id, line.id));
      } else {
        await db.delete(orderLines).where(eq(orderLines.id, line.id));
      }
    }

    for (const [index, line] of incoming.entries()) {
      const prior = existingByClientId.get(line.clientLineId);
      const values = {
        tenantId,
        itemId: line.itemId,
        variantId: line.variantId,
        nameSnapshot: line.nameSnapshot,
        quantity: String(line.quantity),
        unitPriceMinor: line.unitPriceMinor,
        modifiersMinor: line.modifiersMinor,
        discountMinor: line.discountMinor,
        discountType: line.discountType,
        discountValue: line.discountValue != null ? String(line.discountValue) : null,
        lineTotalMinor: line.lineTotalMinor,
        taxSlabId: line.taxSlabId,
        hsnSac: line.hsnSac,
        taxMinor: line.taxMinor,
        taxSnapshot: line.taxSnapshot as never,
        notes: line.notes,
        stationId: line.stationId,
        sortOrder: index,
      };

      const lineId = prior
        ? (await db.update(orderLines).set(values).where(eq(orderLines.id, prior.id)).returning())[0].id
        : (await db.insert(orderLines)
            .values({ ...values, orderId, clientLineId: line.clientLineId })
            .returning())[0].id;

      await db.delete(orderLineModifiers).where(eq(orderLineModifiers.orderLineId, lineId));
      if (line.modifiers.length) {
        await db.insert(orderLineModifiers).values(
          line.modifiers.map((m) => ({
            tenantId, orderLineId: lineId, modifierId: m.id,
            nameSnapshot: m.name, priceMinor: m.priceMinor,
          })),
        );
      }
    }
  }

  private async syncTables(db: Db, orderId: string, tenantId: string, tableIds: string[]) {
    await db.delete(orderTables).where(eq(orderTables.orderId, orderId));
    if (!tableIds.length) return;
    await db.insert(orderTables).values(
      tableIds.map((tableId, i) => ({ orderId, tableId, tenantId, isPrimary: i === 0 })),
    );
    await db.update(restaurantTables)
      .set({ status: 'OCCUPIED' })
      .where(inArray(restaurantTables.id, tableIds));
  }

  /**
   * Directly record a completed retail/counter POS sale.
   * Creates or resolves menu items as needed, writes orders, order_lines, and payments with status PAID.
   * Completely idempotent on clientOrderId.
   */
  async recordPosSale(input: {
    clientOrderId: string;
    orderNumber?: string;
    invoiceNumber?: string;
    amount: number;
    paymentMode: 'cash' | 'upi' | 'card' | 'credit';
    customerName?: string;
    customerPhone?: string;
    notes?: string;
    taxSnapshot?: any;
    receiptSnapshot?: any;
    lines?: {
      itemId?: string;
      name: string;
      quantity: number;
      price: number;
      uom?: string;
      taxSlabId?: string;
      hsnSac?: string;
      netMinor?: number;
    }[];
    placedAt?: string;
  }) {
    const ctx = requireTenantContext();
    return this.db.tx(async (db) => {
      // 1. Resolve outlet
      let outletId = ctx.outletId;
      if (!outletId) {
        const [firstOutlet] = await db.select().from(outlets)
          .where(eq(outlets.tenantId, ctx.tenantId)).limit(1);
        if (!firstOutlet) throw Errors.notFound('Outlet', 'None configured for tenant');
        outletId = firstOutlet.id;
      }

      // 2. Check for existing order by clientOrderId (Idempotent)
      const existing = await db.select().from(orders)
        .where(and(
          eq(orders.tenantId, ctx.tenantId),
          eq(orders.clientOrderId, input.clientOrderId),
        )).limit(1);
      if (existing.length > 0) {
        return existing[0];
      }

      const totalMinor = Math.round(input.amount * 100);
      const placedAt = input.placedAt ? new Date(input.placedAt) : new Date();
      const invoiceNum = input.invoiceNumber || input.orderNumber || `INV-${Date.now()}`;
      const orderNum = input.orderNumber || invoiceNum;

      // 3. Ensure a general Category for this tenant exists
      let [generalCat] = await db.select().from(categories)
        .where(and(eq(categories.tenantId, ctx.tenantId), eq(categories.name, 'General')))
        .limit(1);
      if (!generalCat) {
        [generalCat] = await db.insert(categories).values({
          tenantId: ctx.tenantId,
          name: 'General',
          sortOrder: 0,
        }).returning();
      }

      // 4. Insert into orders table
      const [newOrder] = await db.insert(orders).values({
        tenantId: ctx.tenantId,
        outletId,
        clientOrderId: input.clientOrderId,
        orderNumber: orderNum,
        channel: 'QUICK_BILL',
        status: 'PAID',
        staffId: ctx.staffId ?? null,
        currency: 'INR',
        subtotalMinor: input.taxSnapshot?.taxableMinor ?? totalMinor,
        taxMinor: input.taxSnapshot?.totalTaxMinor ?? 0,
        totalMinor,
        paidMinor: totalMinor,
        invoiceNumber: invoiceNum,
        taxSnapshot: input.taxSnapshot ?? null,
        notes: input.notes ?? (input.customerName ? `Customer: ${input.customerName}${input.customerPhone ? ` (${input.customerPhone})` : ''}` : null),
        billedAt: placedAt,
        paidAt: placedAt,
        placedAt,
        createdAt: placedAt,
        updatedAt: new Date(),
      }).returning();

      // 5. Handle lines if provided
      if (input.lines && input.lines.length > 0) {
        for (const line of input.lines) {
          let menuItemId: string | null = null;
          if (line.itemId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(line.itemId)) {
            const [itemExists] = await db.select({ id: menuItems.id }).from(menuItems)
              .where(and(eq(menuItems.tenantId, ctx.tenantId), eq(menuItems.id, line.itemId))).limit(1);
            if (itemExists) menuItemId = itemExists.id;
          }

          if (!menuItemId) {
            const itemName = (line.name || 'General Item').trim();
            const [byName] = await db.select({ id: menuItems.id }).from(menuItems)
              .where(and(eq(menuItems.tenantId, ctx.tenantId), eq(menuItems.name, itemName))).limit(1);
            if (byName) {
              menuItemId = byName.id;
            } else {
              const [createdItem] = await db.insert(menuItems).values({
                tenantId: ctx.tenantId,
                categoryId: generalCat.id,
                name: itemName,
                priceMinor: Math.round(line.price * 100),
                taxSlabId: line.taxSlabId || 'gst-0',
                hsnSac: line.hsnSac ?? null,
                isActive: true,
              }).returning();
              menuItemId = createdItem.id;
            }
          }

          const lineTotal = line.netMinor != null ? line.netMinor : Math.round(line.price * line.quantity * 100);
          await db.insert(orderLines).values({
            tenantId: ctx.tenantId,
            orderId: newOrder.id,
            clientLineId: randomUUID(),
            itemId: menuItemId,
            nameSnapshot: line.name || 'Item',
            quantity: String(line.quantity),
            unitPriceMinor: Math.round(line.price * 100),
            lineTotalMinor: lineTotal,
            taxSlabId: line.taxSlabId || 'gst-0',
            hsnSac: line.hsnSac ?? null,
            status: 'SERVED',
          });
        }
      }

      // 6. Record payment in payments table
      const methodMap: Record<string, 'CASH' | 'UPI' | 'CARD' | 'CREDIT'> = {
        cash: 'CASH',
        upi: 'UPI',
        card: 'CARD',
        credit: 'CREDIT',
      };
      const mappedMethod = methodMap[input.paymentMode] || 'CASH';

      await db.insert(payments).values({
        tenantId: ctx.tenantId,
        orderId: newOrder.id,
        clientPaymentId: randomUUID(),
        method: mappedMethod,
        status: 'CAPTURED',
        amountMinor: totalMinor,
        currency: 'INR',
        gateway: 'counter',
        reference: invoiceNum,
        capturedAt: placedAt,
      });

      return newOrder;
    });
  }

  async listSales(outletId: string, limit = 100) {
    const ctx = requireTenantContext();
    return this.db.tx(async (db) => {
      const rows = await db.select().from(orders)
        .where(and(
          eq(orders.tenantId, ctx.tenantId),
          eq(orders.outletId, outletId),
          eq(orders.status, 'PAID'),
        ))
        .orderBy(desc(orders.placedAt))
        .limit(limit);

      if (rows.length === 0) return [];
      const orderIds = rows.map((r) => r.id);

      const [lines, pays] = await Promise.all([
        db.select().from(orderLines).where(inArray(orderLines.orderId, orderIds)),
        db.select().from(payments).where(inArray(payments.orderId, orderIds)),
      ]);

      return rows.map((o) => ({
        ...o,
        lines: lines.filter((l) => l.orderId === o.id),
        payments: pays.filter((p) => p.orderId === o.id),
      }));
    });
  }
}

/**
 * A stable fingerprint of an order write, used when the client does not supply
 * its own request key. Key order is normalised so that a device which
 * re-serialises a queued request before retrying still produces the same hash.
 */
function hashRequest(input: unknown): string {
  return createHash('sha256').update(stableStringify(input)).digest('hex').slice(0, 32);
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value ?? null);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(',')}}`;
}

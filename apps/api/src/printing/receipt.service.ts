import { Injectable } from '@nestjs/common';
import { and, asc, eq, inArray, ne } from 'drizzle-orm';
import type { ReceiptDocument } from '@novapos/escpos';
import { DatabaseService } from '../db/db.service';
import {
  orders, orderLines, orderLineModifiers, orderTables, restaurantTables,
  payments, customers, outlets, tenants, staff,
} from '../db/schema';
import { PrintingService } from './printing.service';
import { Errors } from '../common/errors';

/**
 * Turns a billed order into a printable receipt document.
 *
 * Reads the *snapshot* stored on the order rather than recomputing from the
 * live menu and current tax rules, so a bill reprinted six months later shows
 * exactly what the guest was charged — even after prices and rates have moved.
 * Recomputing here would quietly rewrite history, which is both a customer
 * dispute and an audit finding waiting to happen.
 */
@Injectable()
export class ReceiptService {
  constructor(
    private readonly db: DatabaseService,
    private readonly printing: PrintingService,
  ) {}

  async build(orderId: string): Promise<ReceiptDocument> {
    return this.db.tx(async (db) => {
      const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
      if (!order) throw Errors.notFound('Order', orderId);
      if (!order.invoiceNumber) {
        throw Errors.invalidState('This order has not been billed yet, so it has no invoice number.');
      }

      const [lines, tables, pays, outletRows, customerRows, staffRows] = await Promise.all([
        db.select().from(orderLines)
          .where(and(eq(orderLines.orderId, orderId), ne(orderLines.status, 'VOIDED')))
          .orderBy(asc(orderLines.sortOrder)),
        db.select({ label: restaurantTables.label }).from(orderTables)
          .innerJoin(restaurantTables, eq(orderTables.tableId, restaurantTables.id))
          .where(eq(orderTables.orderId, orderId)),
        db.select().from(payments)
          .where(and(eq(payments.orderId, orderId), inArray(payments.status, ['CAPTURED', 'REFUNDED']))),
        db.select().from(outlets).where(eq(outlets.id, order.outletId)).limit(1),
        order.customerId
          ? db.select().from(customers).where(eq(customers.id, order.customerId)).limit(1)
          : Promise.resolve([]),
        order.staffId
          ? db.select({ name: staff.name }).from(staff).where(eq(staff.id, order.staffId)).limit(1)
          : Promise.resolve([]),
      ]);

      const outlet = outletRows[0];
      if (!outlet) throw Errors.notFound('Outlet', order.outletId);

      const [tenant] = await db.select().from(tenants).where(eq(tenants.id, order.tenantId)).limit(1);

      const mods = lines.length
        ? await db.select().from(orderLineModifiers)
            .where(inArray(orderLineModifiers.orderLineId, lines.map((l) => l.id)))
        : [];

      const snapshot = order.taxSnapshot as {
        componentTotals?: {
          code: string; label: string; rate: number; baseMinor: number; amountMinor: number;
        }[];
      } | null;

      const customer = customerRows[0];
      const changeMinor = pays.reduce((s, p) => s + p.changeMinor, 0);

      return {
        invoiceNumber: order.invoiceNumber,
        orderNumber: order.orderNumber,
        issuedAt: (order.billedAt ?? order.createdAt).toISOString(),
        outlet: {
          name: outlet.name,
          addressLines: [
            ...outlet.addressLines,
            [outlet.city, outlet.postalCode].filter(Boolean).join(' '),
          ].filter((l) => l && l.trim().length > 0),
          phone: outlet.phone,
          taxId: outlet.taxId ?? tenant?.taxId ?? null,
          extraIds: outlet.extraIds,
        },
        customer: customer
          ? {
              name: customer.name,
              phone: customer.phone,
              taxId: customer.taxId,
              addressLines: customer.addressLines,
            }
          : null,
        channel: order.channel,
        tableLabel: tables.map((t) => t.label).join(', ') || null,
        staffName: staffRows[0]?.name ?? null,
        guestCount: order.guestCount,
        currency: order.currency,
        locale: outlet.locale ?? tenant?.defaultLocale ?? 'en-IN',
        lines: lines.map((l) => ({
          name: l.nameSnapshot,
          quantity: Number(l.quantity),
          // The unit price on the receipt includes chosen modifiers, because
          // that is the per-item figure a guest checks against the menu.
          unitPriceMinor: l.unitPriceMinor + l.modifiersMinor,
          lineTotalMinor: l.lineTotalMinor,
          modifiers: mods.filter((m) => m.orderLineId === l.id).map((m) => m.nameSnapshot),
          notes: l.notes,
          hsnSac: l.hsnSac,
          discountMinor: l.discountMinor || undefined,
        })),
        subtotalMinor: order.subtotalMinor,
        discountMinor: order.discountMinor,
        serviceChargeMinor: order.serviceChargeMinor,
        deliveryChargeMinor: order.deliveryChargeMinor,
        tipMinor: order.tipMinor,
        taxRows: (snapshot?.componentTotals ?? []).map((c) => ({
          code: c.code, label: c.label, rate: c.rate,
          baseMinor: c.baseMinor, amountMinor: c.amountMinor,
        })),
        taxTotalMinor: order.taxMinor,
        roundingMinor: order.roundingMinor,
        totalMinor: order.totalMinor,
        payments: pays.map((p) => ({
          method: p.method, amountMinor: p.amountMinor, reference: p.reference,
        })),
        changeMinor,
        showHsnSac: outlet.country === 'IN',
      };
    });
  }

  async print(orderId: string, printerId?: string) {
    const doc = await this.build(orderId);
    const meta = await this.db.tx(async (db) => {
      const [order] = await db.select({
        outletId: orders.outletId,
      }).from(orders).where(eq(orders.id, orderId)).limit(1);
      if (!order) throw Errors.notFound('Order', orderId);
      const [outlet] = await db.select({ templateId: outlets.receiptTemplateId })
        .from(outlets).where(eq(outlets.id, order.outletId)).limit(1);
      return { outletId: order.outletId, templateId: outlet?.templateId ?? 'in-gst' };
    });

    return this.printing.queueReceipt(doc, {
      outletId: meta.outletId,
      orderId,
      printerId,
      templateId: meta.templateId,
    });
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { DatabaseService } from '../db/db.service';
import {
  orders, orderLines, orderTables, restaurantTables, payments, customers, tenants,
} from '../db/schema';
import { GatewayRegistry } from './gateways/registry';
import { IdempotencyService } from '../common/idempotency.service';
import { AuditService } from '../common/audit.service';
import { Errors } from '../common/errors';
import { requireTenantContext } from '../tenancy/tenant-context';
import { allocate } from '@novapos/shared';
import type { PaymentInput, PaymentMethod } from '@novapos/shared';

/**
 * Payments.
 *
 * Two invariants the rest of the system leans on:
 *
 *   1. An order becomes PAID exactly when captured payments cover its total.
 *      Nothing else may set that status.
 *
 *   2. Over-tendering is normal (cash); overpaying is not (card/UPI). Cash
 *      change is computed and recorded; a card overpayment is rejected,
 *      because it means the amount was keyed wrong, and a refund is a far
 *      messier fix than a re-key.
 */
@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly gateways: GatewayRegistry,
    private readonly idempotency: IdempotencyService,
    private readonly audit: AuditService,
  ) {}

  async pay(orderId: string, input: PaymentInput) {
    return this.idempotency.execute('payment', input.clientPaymentId, { orderId, ...input }, async () => {
      const ctx = requireTenantContext();

      // Read the order and work out what is owed, before touching a gateway.
      const state = await this.db.tx(async (db) => {
        const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
        if (!order) throw Errors.notFound('Order', orderId);
        if (order.status === 'VOIDED') throw Errors.invalidState('This order has been voided.');
        if (order.status === 'DRAFT') {
          throw Errors.invalidState('Generate the bill before taking payment.');
        }

        const existing = await db.select().from(payments).where(eq(payments.orderId, orderId));
        const alreadyPaid = existing
          .filter((p) => p.status === 'CAPTURED')
          .reduce((s, p) => s + p.amountMinor - p.refundedMinor, 0);

        const customer = order.customerId
          ? (await db.select().from(customers).where(eq(customers.id, order.customerId)).limit(1))[0]
          : null;

        const [tenant] = await db.select().from(tenants).where(eq(tenants.id, order.tenantId)).limit(1);

        return { order, alreadyPaid, outstanding: order.totalMinor - alreadyPaid, customer, tenant };
      });

      if (state.outstanding <= 0) {
        throw Errors.invalidState('This bill is already settled in full.');
      }
      if (input.amountMinor <= 0) {
        throw Errors.validation('A payment must be for a positive amount.');
      }

      const isCash = input.method === 'CASH';
      if (!isCash && input.amountMinor > state.outstanding) {
        throw Errors.validation(
          `This payment of ${input.amountMinor} exceeds the ${state.outstanding} still outstanding. ` +
          'Re-enter the amount, or take the excess as a tip.',
          { outstanding: state.outstanding, offered: input.amountMinor },
        );
      }

      const applied = Math.min(input.amountMinor, state.outstanding);
      const tendered = input.tenderedMinor ?? input.amountMinor;
      const changeMinor = isCash ? Math.max(0, tendered - applied) : 0;

      const preference =
        (state.tenant?.settings as { paymentGateway?: string } | null)?.paymentGateway ?? null;
      const gateway = this.gateways.resolve({
        method: input.method,
        currency: state.order.currency,
        tenantPreference: input.gateway ?? preference,
      });

      // The gateway call is outside any transaction: it is network I/O, and
      // holding a database transaction open across it would pin a connection
      // for as long as the provider takes to answer.
      let result;
      try {
        result = await gateway.createIntent({
          orderId: state.order.id,
          amountMinor: applied,
          currency: state.order.currency,
          clientPaymentId: input.clientPaymentId,
          customer: state.customer,
          metadata: { invoiceNumber: state.order.invoiceNumber ?? '' },
        });
      } catch (err) {
        // A gateway that is down must not lose the sale. Record the attempt as
        // FAILED so the cashier can retry or fall back to cash, and surface
        // the provider's own reason rather than "something went wrong".
        const message = (err as Error).message;
        this.logger.error(`Gateway ${gateway.key} failed for order ${orderId}: ${message}`);
        await this.db.tx(async (db) => {
          await db.insert(payments).values({
            tenantId: ctx.tenantId, orderId, clientPaymentId: input.clientPaymentId,
            method: input.method as PaymentMethod, status: 'FAILED', amountMinor: applied,
            currency: state.order.currency, gateway: gateway.key,
            failureReason: message.slice(0, 500),
          });
        });
        throw Errors.paymentFailed(message, { gateway: gateway.key });
      }

      const payment = await this.db.tx(async (db) => {
        const [row] = await db.insert(payments).values({
          tenantId: ctx.tenantId,
          orderId,
          clientPaymentId: input.clientPaymentId,
          method: input.method as PaymentMethod,
          status: result.status === 'CAPTURED' ? 'CAPTURED' : result.status,
          amountMinor: applied,
          tenderedMinor: tendered,
          changeMinor,
          currency: state.order.currency,
          gateway: gateway.key,
          gatewayRef: result.gatewayRef || null,
          reference: input.reference ?? null,
          gatewayPayload: (result.raw ?? null) as never,
          failureReason: result.failureReason ?? null,
          capturedAt: result.status === 'CAPTURED' ? new Date() : null,
        }).returning();
        return row;
      });

      const settled = await this.settleIfPaid(orderId);

      await this.audit.record({
        action: 'payment.create', entityType: 'Payment', entityId: payment.id,
        outletId: state.order.outletId,
        detail: {
          method: input.method, amountMinor: applied,
          gateway: gateway.key, status: payment.status,
        },
      });

      const capturedNow = payment.status === 'CAPTURED' ? applied : 0;
      return {
        payment,
        changeMinor,
        outstandingMinor: Math.max(0, state.order.totalMinor - (state.alreadyPaid + capturedNow)),
        action: result.actionType && result.actionType !== 'NONE'
          ? { type: result.actionType, payload: result.actionPayload }
          : null,
        order: settled,
      };
    });
  }

  /**
   * Split a bill n ways, by named amounts, or by who ate what.
   *
   * The apportionment is exact: the parts always sum to the total, with odd
   * minor units distributed rather than dropped. Splitting a ₹100.01 bill
   * three ways gives 33.34 / 33.34 / 33.33 — never 33.33 × 3 with a lost paisa
   * that leaves the till short at close.
   */
  async computeSplit(orderId: string, input:
    | { mode: 'EVEN'; ways: number }
    | { mode: 'AMOUNTS'; amountsMinor: number[] }
    | { mode: 'BY_LINE'; groups: string[][] },
  ) {
    return this.db.tx(async (db) => {
      const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
      if (!order) throw Errors.notFound('Order', orderId);
      const lines = await db.select().from(orderLines).where(eq(orderLines.orderId, orderId));

      if (input.mode === 'EVEN') {
        if (input.ways < 1) throw Errors.validation('A bill must be split at least one way.');
        return {
          totalMinor: order.totalMinor,
          parts: allocate(order.totalMinor, Array(input.ways).fill(1)).map((amountMinor, i) => ({
            label: `Guest ${i + 1}`, amountMinor,
          })),
        };
      }

      if (input.mode === 'AMOUNTS') {
        const sum = input.amountsMinor.reduce((a, b) => a + b, 0);
        if (sum !== order.totalMinor) {
          throw Errors.validation(
            `The split amounts total ${sum} but the bill is ${order.totalMinor}. They must match exactly.`,
            { billTotal: order.totalMinor, splitTotal: sum, difference: order.totalMinor - sum },
          );
        }
        return {
          totalMinor: order.totalMinor,
          parts: input.amountsMinor.map((amountMinor, i) => ({ label: `Guest ${i + 1}`, amountMinor })),
        };
      }

      // BY_LINE: each guest pays for what they had, with tax and order-level
      // charges apportioned across the groups by their share of the subtotal.
      const lineById = new Map(lines.map((l) => [l.id, l]));
      const assigned = new Set(input.groups.flat());
      const unassigned = lines.filter((l) => l.status !== 'VOIDED' && !assigned.has(l.id));
      if (unassigned.length) {
        throw Errors.validation(
          `${unassigned.length} line(s) are not assigned to anyone: ` +
          unassigned.map((l) => l.nameSnapshot).join(', '),
        );
      }

      const groupSubtotals = input.groups.map((ids) =>
        ids.reduce((s, id) => s + (lineById.get(id)?.lineTotalMinor ?? 0), 0));
      const shares = allocate(order.totalMinor, groupSubtotals);

      return {
        totalMinor: order.totalMinor,
        parts: shares.map((amountMinor, i) => ({
          label: `Guest ${i + 1}`, amountMinor, lineIds: input.groups[i],
        })),
      };
    });
  }

  async refund(paymentId: string, input: { amountMinor: number; reason: string; clientRefundId: string }) {
    if (!input.reason?.trim()) throw Errors.validation('A refund requires a reason.');

    const payment = await this.db.tx(async (db) => {
      const [row] = await db.select().from(payments).where(eq(payments.id, paymentId)).limit(1);
      if (!row) throw Errors.notFound('Payment', paymentId);
      return row;
    });

    if (payment.status !== 'CAPTURED') {
      throw Errors.invalidState(`Only a captured payment can be refunded; this one is ${payment.status}.`);
    }
    const refundable = payment.amountMinor - payment.refundedMinor;
    if (input.amountMinor > refundable) {
      throw Errors.validation(
        `Cannot refund ${input.amountMinor}; only ${refundable} remains on this payment.`,
        { refundable },
      );
    }

    const gateway = this.gateways.get(payment.gateway);
    if (!gateway) {
      throw Errors.invalidState(
        `This payment was taken via "${payment.gateway}", which is no longer configured, so it cannot ` +
        'be refunded automatically. Refund it in the provider dashboard and record it manually.',
      );
    }

    const result = await gateway.refund({
      gatewayRef: payment.gatewayRef ?? '',
      amountMinor: input.amountMinor,
      currency: payment.currency,
      reason: input.reason,
      clientRefundId: input.clientRefundId,
    });

    if (result.status === 'FAILED') {
      throw Errors.paymentFailed(result.failureReason ?? 'The refund was declined by the provider.');
    }

    const updated = await this.db.tx(async (db) => {
      const fullyRefunded = payment.refundedMinor + input.amountMinor >= payment.amountMinor;
      const [row] = await db.update(payments).set({
        refundedMinor: sql`${payments.refundedMinor} + ${input.amountMinor}`,
        refundedAt: new Date(),
        status: fullyRefunded ? 'REFUNDED' : 'CAPTURED',
      }).where(eq(payments.id, paymentId)).returning();

      await db.update(orders)
        .set({ paidMinor: sql`${orders.paidMinor} - ${input.amountMinor}` })
        .where(eq(orders.id, payment.orderId));

      return row;
    });

    await this.audit.record({
      action: 'payment.refund', entityType: 'Payment', entityId: paymentId,
      detail: { amountMinor: input.amountMinor, reason: input.reason, gateway: payment.gateway },
    });

    return updated;
  }

  /**
   * Handle an asynchronous status change from a provider.
   *
   * Runs as system: a webhook carries no session, so the tenant is resolved
   * from the payment row the event refers to.
   */
  async handleWebhook(gatewayKey: string, rawBody: string, headers: Record<string, string>) {
    const gateway = this.gateways.get(gatewayKey);
    if (!gateway) return { handled: false, reason: `Unknown gateway "${gatewayKey}".` };

    const verification = gateway.verifyWebhook(rawBody, headers);
    if (!verification.valid) {
      // Fail closed and loudly. An unverified webhook that could mark an order
      // paid is free food, so this is a security event, not a warning.
      this.logger.warn(`Rejected ${gatewayKey} webhook: ${verification.reason}`);
      return { handled: false, reason: verification.reason };
    }
    if (!verification.gatewayRef || !verification.status) {
      return { handled: true, reason: 'Event carried no payment reference; nothing to do.' };
    }

    const payment = await this.db.system(async (db) => {
      const [row] = await db.select().from(payments)
        .where(eq(payments.gatewayRef, verification.gatewayRef!)).limit(1);
      return row;
    });

    if (!payment) {
      this.logger.warn(`Webhook for unknown gateway ref ${verification.gatewayRef}`);
      return { handled: false, reason: 'No matching payment.' };
    }

    // Never move a payment backwards — provider webhooks arrive out of order
    // more often than their documentation admits.
    const rank: Record<string, number> = {
      PENDING: 0, AUTHORIZED: 1, CAPTURED: 2, FAILED: 2, REFUNDED: 3, VOIDED: 3,
    };
    if (rank[verification.status] < rank[payment.status]) {
      return { handled: true, reason: `Ignored out-of-order ${verification.status} event.` };
    }

    await this.db.system(async (db) => {
      await db.update(payments).set({
        status: verification.status!,
        capturedAt: verification.status === 'CAPTURED' ? new Date() : payment.capturedAt,
      }).where(eq(payments.id, payment.id));
    });

    await this.settleIfPaid(payment.orderId, true);
    return { handled: true, paymentId: payment.id, status: verification.status };
  }

  /** Flip the order to PAID once captured payments cover the total. */
  private async settleIfPaid(orderId: string, asSystem = false) {
    const run = async (db: Parameters<Parameters<DatabaseService['tx']>[0]>[0]) => {
      const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
      if (!order || order.status === 'VOIDED') return order ?? null;

      const rows = await db.select().from(payments).where(eq(payments.orderId, orderId));
      const captured = rows
        .filter((p) => p.status === 'CAPTURED')
        .reduce((s, p) => s + p.amountMinor - p.refundedMinor, 0);

      await db.update(orders).set({ paidMinor: captured }).where(eq(orders.id, orderId));

      if (captured >= order.totalMinor && order.status !== 'PAID') {
        await db.update(orders).set({
          status: 'PAID', paidAt: new Date(), version: sql`${orders.version} + 1`,
        }).where(eq(orders.id, orderId));

        // Free the table for the next party — via CLEANING, not straight to
        // FREE, so the floor staff still see it needs turning over.
        const tables = await db.select().from(orderTables).where(eq(orderTables.orderId, orderId));
        if (tables.length) {
          await db.update(restaurantTables)
            .set({ status: 'CLEANING' })
            .where(inArray(restaurantTables.id, tables.map((t) => t.tableId)));
        }
      }

      const [final] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
      return final;
    };

    return asSystem ? this.db.system(run) : this.db.tx(run);
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { DatabaseService } from '../db/db.service';
import { tenants } from '../db/schema';
import { Errors } from '../common/errors';

export interface PlanDetails {
  key: string;
  name: string;
  pricePaise: number;
  durationDays: number;
  description: string;
}

export const SAAS_PLANS: Record<string, PlanDetails> = {
  starter_monthly: {
    key: 'starter_monthly',
    name: 'Starter Monthly',
    pricePaise: 49900, // ₹499
    durationDays: 30,
    description: '1 POS Terminal, Unlimited offline billing, Basic reports',
  },
  pro_yearly: {
    key: 'pro_yearly',
    name: 'Pro Annual (Best Value)',
    pricePaise: 499900, // ₹4,999
    durationDays: 365,
    description: 'Multi-Terminal, Auto GST Reports (GSTR-1), Cloud Backup & AI Posters',
  },
  enterprise_yearly: {
    key: 'enterprise_yearly',
    name: 'Enterprise Multi-Store',
    pricePaise: 999900, // ₹9,999
    durationDays: 365,
    description: 'Multi-Branch chain management, Central inventory, Dedicated support',
  },
};

/** Resolve legacy tenants deterministically; reading status never restarts a trial. */
export function subscriptionStatus(tenant: { id: string; name: string; createdAt: Date; status?: string; settings: unknown }) {
  const settings = (tenant.settings || {}) as Record<string, any>;
  const sub = settings.subscription ?? {
    status: 'TRIAL', plan: 'starter_monthly',
    validUntil: new Date(new Date(tenant.createdAt).getTime() + 72 * 60 * 60 * 1000).toISOString(),
  };
  const now = Date.now();
  const expiry = Date.parse(sub.validUntil);
  const isExpired = !Number.isFinite(expiry) || expiry <= now ||
    !['TRIAL', 'ACTIVE'].includes(sub.status) || (tenant.status !== undefined && tenant.status !== 'ACTIVE');
  const plan = sub.plan === 'STARTER' ? 'starter_monthly' : sub.plan;
  const pro = ['pro_yearly', 'enterprise_yearly'].includes(plan);
  return {
    tenantId: tenant.id, tenantName: tenant.name,
    status: sub.status === 'SUSPENDED' || tenant.status === 'SUSPENDED' ? 'SUSPENDED' : isExpired ? 'EXPIRED' : sub.status,
    isTrial: sub.status === 'TRIAL', plan,
    startedAt: new Date(tenant.createdAt).toISOString(),
    validUntil: Number.isFinite(expiry) ? new Date(expiry).toISOString() : new Date(0).toISOString(),
    serverTime: new Date(now).toISOString(),
    daysRemaining: isExpired ? 0 : Math.ceil((expiry - now) / 86400000), isExpired,
    features: { cloudBackup: !isExpired && pro, offlineBilling: !isExpired, gstReports: !isExpired && pro, multiTerminal: !isExpired && pro },
  };
}

@Injectable()
export class SubscriptionService {
  private readonly logger = new Logger(SubscriptionService.name);
  private readonly keyId = process.env.RAZORPAY_KEY_ID || '';
  private readonly keySecret = process.env.RAZORPAY_KEY_SECRET || '';
  constructor(private readonly db: DatabaseService) {}

  getAvailablePlans() {
    return Object.values(SAAS_PLANS).map(p => ({ ...p, priceRupees: p.pricePaise / 100, currency: 'INR' }));
  }

  async getStatus(tenantId: string) {
    return this.db.txAs(tenantId, async db => {
      const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId)).limit(1);
      if (!tenant) throw Errors.notFound('Tenant');
      return subscriptionStatus(tenant);
    });
  }

  private assertConfigured() {
    if (!this.keyId || !this.keySecret) throw Errors.paymentFailed('Payment gateway is not configured. Contact support.');
  }

  private async gateway(path: string, body?: unknown): Promise<any> {
    this.assertConfigured();
    const res = await fetch(`https://api.razorpay.com/v1/${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Basic ' + Buffer.from(`${this.keyId}:${this.keySecret}`).toString('base64') },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw Errors.paymentFailed('Payment provider could not confirm this request. Please retry or contact support.');
    return data;
  }

  async createOrder(tenantId: string, planKey: string) {
    const plan = Object.hasOwn(SAAS_PLANS, planKey) ? SAAS_PLANS[planKey] : undefined;
    if (!plan) throw Errors.validation('Invalid subscription plan.');
    this.assertConfigured();
    await this.getStatus(tenantId);
    const order = await this.gateway('orders', {
      amount: plan.pricePaise, currency: 'INR',
      receipt: `sub_${tenantId.slice(0, 8)}_${Date.now()}`,
      notes: { tenantId, planKey, type: 'SAAS_SUBSCRIPTION' },
    });
    if (!/^order_[a-zA-Z0-9]+$/.test(order.id ?? '')) throw Errors.paymentFailed('Invalid payment order response.');
    return { orderId: order.id, amount: plan.pricePaise, currency: 'INR', planKey, planName: plan.name, keyId: this.keyId };
  }

  async verifyAndActivate(input: { tenantId: string; planKey: string; orderId: string; paymentId: string; signature: string }) {
    this.assertConfigured();
    const expected = createHmac('sha256', this.keySecret).update(`${input.orderId}|${input.paymentId}`).digest('hex');
    if (!/^[a-f0-9]{64}$/.test(input.signature) || !timingSafeEqual(Buffer.from(expected), Buffer.from(input.signature))) {
      throw Errors.validation('Invalid payment signature.');
    }
    return this.confirmCaptured(input);
  }

  /** Razorpay owns the immutable order notes; neither the device nor webhook supplies a trusted plan. */
  private async confirmCaptured(input: { tenantId?: string; planKey?: string; orderId: string; paymentId: string }) {
    if (!/^order_[a-zA-Z0-9]+$/.test(input.orderId) || !/^pay_[a-zA-Z0-9]+$/.test(input.paymentId)) throw Errors.validation('Invalid payment reference.');
    const order = await this.gateway(`orders/${input.orderId}`);
    const notes = order.notes ?? {};
    const plan = Object.hasOwn(SAAS_PLANS, notes.planKey ?? '') ? SAAS_PLANS[notes.planKey] : undefined;
    if (!plan || notes.type !== 'SAAS_SUBSCRIPTION' || typeof notes.tenantId !== 'string' ||
        (input.tenantId && notes.tenantId !== input.tenantId) || (input.planKey && plan.key !== input.planKey) ||
        order.id !== input.orderId || order.amount !== plan.pricePaise || order.currency !== 'INR') {
      throw Errors.validation('Payment order does not match this tenant and plan.');
    }
    const payment = await this.gateway(`payments/${input.paymentId}`);
    if (payment.id !== input.paymentId || payment.order_id !== order.id || payment.amount !== plan.pricePaise ||
        payment.currency !== 'INR' || payment.status !== 'captured' || (payment.amount_refunded ?? 0) !== 0) {
      throw Errors.paymentFailed('Payment is not captured yet. Refresh license status before trying another payment.');
    }
    return this.db.txAs(notes.tenantId, async db => {
      // Serialize callback/webhook/retry activation across every API instance.
      const [tenant] = await db.select().from(tenants).where(eq(tenants.id, notes.tenantId)).limit(1).for('update');
      if (!tenant) throw Errors.notFound('Tenant');
      const settings = (tenant.settings ?? {}) as Record<string, any>;
      const applied = settings.subscriptionPayments ?? {};
      if (!applied[input.orderId] && settings.subscription?.lastOrderId !== input.orderId && settings.subscription?.lastPaymentId !== input.paymentId) {
        const currentExpiry = Date.parse(settings.subscription?.validUntil ?? '');
        const base = settings.subscription?.status === 'ACTIVE' && Number.isFinite(currentExpiry) ? Math.max(Date.now(), currentExpiry) : Date.now();
        const validUntil = new Date(base + plan.durationDays * 86400000).toISOString();
        const updated = {
          ...settings,
          subscriptionPayments: { ...applied, [input.orderId]: { paymentId: input.paymentId, plan: plan.key, validUntil } },
          subscription: { status: 'ACTIVE', plan: plan.key, validUntil, lastPaymentId: input.paymentId, lastOrderId: input.orderId, updatedAt: new Date().toISOString() },
        };
        await db.update(tenants).set({ settings: updated, updatedAt: new Date() }).where(eq(tenants.id, tenant.id));
        tenant.settings = updated;
      }
      return { success: true, ...subscriptionStatus(tenant) };
    });
  }

  async handleWebhook(raw: string, signature: string) {
    const secret = process.env.RAZORPAY_SUBSCRIPTION_WEBHOOK_SECRET;
    if (!secret || !/^[a-f0-9]{64}$/.test(signature)) throw Errors.unauthorized('Invalid webhook signature.');
    const expected = createHmac('sha256', secret).update(raw).digest('hex');
    if (!timingSafeEqual(Buffer.from(expected), Buffer.from(signature))) throw Errors.unauthorized('Invalid webhook signature.');
    let event: any;
    try { event = JSON.parse(raw); } catch { throw Errors.validation('Invalid webhook payload.'); }
    if (!['payment.captured', 'order.paid'].includes(event.event)) return { received: true };
    const payment = event.payload?.payment?.entity;
    if (!payment?.id || !payment?.order_id) throw Errors.validation('Webhook payment is missing.');
    const order = await this.gateway(`orders/${payment.order_id}`);
    if (order.notes?.type !== 'SAAS_SUBSCRIPTION') return { received: true };
    await this.confirmCaptured({ orderId: payment.order_id, paymentId: payment.id });
    return { received: true };
  }
}


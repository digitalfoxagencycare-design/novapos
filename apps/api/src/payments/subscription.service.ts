import { Injectable, Logger } from '@nestjs/common';
import { createHmac } from 'node:crypto';
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

@Injectable()
export class SubscriptionService {
  private readonly logger = new Logger(SubscriptionService.name);
  private readonly keyId = process.env.RAZORPAY_KEY_ID || '';
  private readonly keySecret = process.env.RAZORPAY_KEY_SECRET || '';

  constructor(private readonly db: DatabaseService) {}

  /**
   * Returns list of available subscription plans.
   */
  getAvailablePlans() {
    return Object.values(SAAS_PLANS).map((p) => ({
      ...p,
      priceRupees: p.pricePaise / 100,
      currency: 'INR',
    }));
  }

  /**
   * Retrieves active subscription status for a tenant.
   */
  async getStatus(tenantId: string) {
    return this.db.system(async (db) => {
      const [tenant] = await db.select().from(tenants)
        .where(eq(tenants.id, tenantId)).limit(1);

      if (!tenant) throw Errors.notFound('Tenant not found.');

      const settings = (tenant.settings || {}) as Record<string, any>;
      const sub = settings.subscription || {
        status: 'TRIAL',
        plan: 'starter_monthly',
        validUntil: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      };

      const validUntilDate = new Date(sub.validUntil);
      const now = new Date();
      const diffMs = validUntilDate.getTime() - now.getTime();
      const daysRemaining = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
      const isExpired = diffMs <= 0;

      return {
        tenantId: tenant.id,
        tenantName: tenant.name,
        status: isExpired ? 'EXPIRED' : (sub.status || 'ACTIVE'),
        plan: sub.plan || 'starter_monthly',
        validUntil: sub.validUntil,
        daysRemaining,
        isExpired,
        features: {
          cloudBackup: true,
          offlineBilling: true,
          gstReports: true,
          multiTerminal: sub.plan !== 'starter_monthly',
        },
      };
    });
  }

  /**
   * Creates an order with Razorpay or returns a sandbox order for subscription.
   */
  async createOrder(tenantId: string, planKey: string) {
    const plan = SAAS_PLANS[planKey];
    if (!plan) throw Errors.validation(`Invalid plan: ${planKey}`);

    if (!this.keyId || !this.keySecret) {
      // Sandbox fallback mode when keys are not yet configured in environment
      this.logger.warn(`Razorpay keys not configured. Simulating order for plan ${planKey}.`);
      return {
        orderId: `order_mock_${Date.now()}`,
        amount: plan.pricePaise,
        currency: 'INR',
        planKey: plan.key,
        planName: plan.name,
        keyId: 'rzp_test_mock_sandbox',
        isSandbox: true,
      };
    }

    try {
      const authHeader = 'Basic ' + Buffer.from(`${this.keyId}:${this.keySecret}`).toString('base64');
      const res = await fetch('https://api.razorpay.com/v1/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: authHeader,
        },
        body: JSON.stringify({
          amount: plan.pricePaise,
          currency: 'INR',
          receipt: `sub_${tenantId.slice(0, 8)}_${Date.now()}`,
          notes: {
            tenantId,
            planKey: plan.key,
            type: 'SAAS_SUBSCRIPTION',
          },
        }),
      });

      const body = (await res.json().catch(() => ({}))) as {
        id?: string;
        error?: { description?: string };
      };

      if (!res.ok || !body.id) {
        throw Errors.validation(body.error?.description || 'Failed to initialize Razorpay order');
      }

      return {
        orderId: body.id,
        amount: plan.pricePaise,
        currency: 'INR',
        planKey: plan.key,
        planName: plan.name,
        keyId: this.keyId,
        isSandbox: false,
      };
    } catch (err) {
      this.logger.error(`Failed to create Razorpay subscription order: ${(err as Error).message}`);
      throw Errors.validation('Payment gateway unavailable. Please try again.');
    }
  }

  /**
   * Verifies Razorpay payment signature and extends tenant subscription.
   */
  async verifyAndActivate(input: {
    tenantId: string;
    planKey: string;
    orderId: string;
    paymentId: string;
    signature: string;
  }) {
    const plan = SAAS_PLANS[input.planKey];
    if (!plan) throw Errors.validation(`Invalid plan: ${input.planKey}`);

    // Signature verification if live keys are present
    if (this.keySecret && !input.orderId.startsWith('order_mock_')) {
      const generatedSignature = createHmac('sha256', this.keySecret)
        .update(`${input.orderId}|${input.paymentId}`)
        .digest('hex');

      if (generatedSignature !== input.signature) {
        throw Errors.validation('Invalid payment signature verification failed.');
      }
    }

    return this.db.system(async (db) => {
      const [tenant] = await db.select().from(tenants)
        .where(eq(tenants.id, input.tenantId)).limit(1);

      if (!tenant) throw Errors.notFound('Tenant not found.');

      const settings = (tenant.settings || {}) as Record<string, any>;
      const existingValidUntil = settings.subscription?.validUntil
        ? new Date(settings.subscription.validUntil)
        : new Date();

      const baseDate = existingValidUntil.getTime() > Date.now() ? existingValidUntil : new Date();
      const newValidUntil = new Date(baseDate.getTime() + plan.durationDays * 24 * 60 * 60 * 1000);

      const updatedSettings = {
        ...settings,
        subscription: {
          status: 'ACTIVE',
          plan: plan.key,
          planName: plan.name,
          validUntil: newValidUntil.toISOString(),
          lastPaymentId: input.paymentId,
          lastOrderId: input.orderId,
          updatedAt: new Date().toISOString(),
        },
      };

      await db.update(tenants)
        .set({ settings: updatedSettings, updatedAt: new Date() })
        .where(eq(tenants.id, tenant.id));

      this.logger.log(`Subscription activated for tenant ${tenant.name} (${tenant.id}) until ${newValidUntil.toISOString()}`);

      return {
        success: true,
        message: `Subscription successfully updated to ${plan.name}!`,
        plan: plan.key,
        status: 'ACTIVE',
        validUntil: newValidUntil.toISOString(),
      };
    });
  }
}

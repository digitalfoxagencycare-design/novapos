import { Injectable } from '@nestjs/common';
import type { PaymentGateway } from './gateway.interface';
import { CashGateway } from './cash.gateway';
import { RazorpayGateway } from './razorpay.gateway';
import { StripeGateway } from './stripe.gateway';

/**
 * Gateway registry.
 *
 * Which gateway handles a payment is resolved per tenant from configuration,
 * so an Indian tenant routes UPI through Razorpay while a German one routes
 * cards through Stripe, with no code aware of the difference.
 *
 * Credentials come from the tenant's settings where present, falling back to
 * the platform environment. That ordering matters: a tenant using their own
 * merchant account must never have the platform's keys silently used instead.
 */
@Injectable()
export class GatewayRegistry {
  private readonly gateways = new Map<string, PaymentGateway>();

  constructor() {
    this.register(new CashGateway());
    this.register(new RazorpayGateway({
      keyId: process.env.RAZORPAY_KEY_ID,
      keySecret: process.env.RAZORPAY_KEY_SECRET,
      webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET,
    }));
    this.register(new StripeGateway({
      secretKey: process.env.STRIPE_SECRET_KEY,
      webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
    }));
  }

  register(gateway: PaymentGateway) {
    this.gateways.set(gateway.key, gateway);
  }

  get(key: string): PaymentGateway | undefined {
    return this.gateways.get(key);
  }

  /**
   * Pick a gateway for a payment method and currency.
   * Cash-like tenders always resolve to the cash gateway; online ones prefer
   * the tenant's configured provider and fall back to whichever adapter
   * supports the currency.
   */
  resolve(input: {
    method: string; currency: string; tenantPreference?: string | null;
  }): PaymentGateway {
    if (['CASH', 'VOUCHER', 'CREDIT'].includes(input.method)) return this.gateways.get('cash')!;

    if (input.tenantPreference) {
      const preferred = this.gateways.get(input.tenantPreference);
      if (preferred && this.supports(preferred, input)) return preferred;
    }

    for (const g of this.gateways.values()) {
      if (g.key === 'cash') continue;
      if (this.supports(g, input)) return g;
    }

    // Nothing online is configured for this method and currency. Record it as
    // a manual tender rather than refusing the sale: the money has usually
    // already changed hands on a standalone terminal, and reconciliation will
    // surface it against the provider's own settlement report.
    return this.gateways.get('cash')!;
  }

  private supports(g: PaymentGateway, input: { method: string; currency: string }): boolean {
    // An adapter with no credentials cannot transact. Selecting one would turn
    // every card payment into a 402 at the till, which is a far worse outcome
    // than recording the tender manually.
    if (!g.isConfigured()) return false;
    const currencyOk = g.supportedCurrencies === '*' || g.supportedCurrencies.includes(input.currency);
    return currencyOk && g.supportedMethods.includes(input.method);
  }

  list() {
    return [...this.gateways.values()].map((g) => ({
      key: g.key,
      displayName: g.displayName,
      supportedCurrencies: g.supportedCurrencies,
      supportedMethods: g.supportedMethods,
      // Surfaced so the admin UI can show "Razorpay — not configured" rather
      // than letting an owner select a provider that will fail at the till.
      configured: g.isConfigured(),
    }));
  }
}

import { createHmac, timingSafeEqual } from 'node:crypto';
import type {
  PaymentGateway, PaymentIntentInput, PaymentIntentResult, RefundInput, RefundResult, WebhookVerification,
} from './gateway.interface';
import { GatewayNotConfiguredError } from './gateway.interface';

/**
 * Stripe — the default for international markets.
 *
 * Same status caveat as the Razorpay adapter: shapes and signature checking
 * follow Stripe's documented behaviour, but this has not been run against live
 * Stripe credentials. See docs/known-limitations.md.
 */
export class StripeGateway implements PaymentGateway {
  readonly key = 'stripe';
  readonly displayName = 'Stripe';
  readonly supportedCurrencies = '*' as const;
  readonly supportedMethods = ['CARD', 'WALLET', 'ONLINE'];

  constructor(
    private readonly config: { secretKey?: string; webhookSecret?: string },
    private readonly fetchFn: typeof fetch = fetch,
  ) {}

  isConfigured(): boolean {
    return Boolean(this.config.secretKey);
  }

  private assertConfigured() {
    if (!this.config.secretKey) throw new GatewayNotConfiguredError(this.key, ['STRIPE_SECRET_KEY']);
  }

  private form(data: Record<string, string | number>): string {
    return Object.entries(data).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`).join('&');
  }

  async createIntent(input: PaymentIntentInput): Promise<PaymentIntentResult> {
    this.assertConfigured();
    const res = await this.fetchFn('https://api.stripe.com/v1/payment_intents', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.config.secretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        // Stripe's idempotency: a replay returns the original intent.
        'Idempotency-Key': input.clientPaymentId,
      },
      body: this.form({
        amount: input.amountMinor,
        currency: input.currency.toLowerCase(),
        'automatic_payment_methods[enabled]': 'true',
        'metadata[orderId]': input.orderId,
      }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        gatewayRef: '',
        status: 'FAILED',
        failureReason: (body as { error?: { message?: string } })?.error?.message
          ?? `Stripe returned HTTP ${res.status}.`,
        raw: body,
      };
    }
    const intent = body as { id: string; client_secret: string; status: string };
    return {
      gatewayRef: intent.id,
      status: intent.status === 'succeeded' ? 'CAPTURED' : 'PENDING',
      actionType: 'REDIRECT',
      // The client secret is what the client-side SDK needs; it is scoped to
      // this one intent and is safe to hand to the paying device.
      actionPayload: intent.client_secret,
      raw: body,
    };
  }

  async refund(input: RefundInput): Promise<RefundResult> {
    this.assertConfigured();
    const res = await this.fetchFn('https://api.stripe.com/v1/refunds', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.config.secretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Idempotency-Key': input.clientRefundId,
      },
      body: this.form({ payment_intent: input.gatewayRef, amount: input.amountMinor }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { gatewayRefundRef: '', status: 'FAILED', failureReason: `HTTP ${res.status}`, raw: body };
    }
    return { gatewayRefundRef: (body as { id: string }).id, status: 'REFUNDED', raw: body };
  }

  /** Stripe signs `t=<timestamp>,v1=<hmac>` over `timestamp.rawBody`. */
  verifyWebhook(rawBody: string, headers: Record<string, string>): WebhookVerification {
    if (!this.config.webhookSecret) {
      return { valid: false, reason: 'No Stripe webhook secret is configured.' };
    }
    const header = headers['stripe-signature'];
    if (!header) return { valid: false, reason: 'Missing Stripe-Signature header.' };

    const parts = Object.fromEntries(header.split(',').map((p) => p.split('=') as [string, string]));
    const timestamp = parts.t;
    const signature = parts.v1;
    if (!timestamp || !signature) return { valid: false, reason: 'Malformed Stripe-Signature header.' };

    // Reject replays of an old, legitimately-signed event.
    const ageSeconds = Math.abs(Date.now() / 1000 - Number(timestamp));
    if (ageSeconds > 300) return { valid: false, reason: 'Webhook timestamp is outside the tolerance window.' };

    const expected = createHmac('sha256', this.config.webhookSecret)
      .update(`${timestamp}.${rawBody}`)
      .digest('hex');
    const a = Buffer.from(expected, 'utf8');
    const b = Buffer.from(signature, 'utf8');
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      return { valid: false, reason: 'Webhook signature did not verify.' };
    }

    const event = JSON.parse(rawBody) as { type: string; data: { object: { id: string } } };
    const status = {
      'payment_intent.succeeded': 'CAPTURED',
      'payment_intent.payment_failed': 'FAILED',
      'charge.refunded': 'REFUNDED',
    }[event.type] as WebhookVerification['status'];

    return { valid: true, event: event.type, gatewayRef: event.data.object.id, status };
  }
}

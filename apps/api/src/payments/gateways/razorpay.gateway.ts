import { createHmac, timingSafeEqual } from 'node:crypto';
import type {
  PaymentGateway, PaymentIntentInput, PaymentIntentResult, RefundInput, RefundResult, WebhookVerification,
} from './gateway.interface';
import { GatewayNotConfiguredError } from './gateway.interface';

/**
 * Razorpay — the default for the Indian market (UPI, cards, netbanking, wallets).
 *
 * Status: the signature verification and request/response shapes are real and
 * follow Razorpay's documented API. The HTTP calls are behind an injectable
 * `fetchFn` so the adapter is unit-testable, but it has NOT been exercised
 * against live Razorpay credentials — see docs/known-limitations.md. Before
 * going live, run the provider's test-mode suite end to end.
 */
export class RazorpayGateway implements PaymentGateway {
  readonly key = 'razorpay';
  readonly displayName = 'Razorpay';
  readonly supportedCurrencies = ['INR'];
  readonly supportedMethods = ['UPI', 'CARD', 'WALLET', 'ONLINE'];

  constructor(
    private readonly config: { keyId?: string; keySecret?: string; webhookSecret?: string },
    private readonly fetchFn: typeof fetch = fetch,
  ) {}

  isConfigured(): boolean {
    return Boolean(this.config.keyId && this.config.keySecret);
  }

  private assertConfigured() {
    const missing = [
      !this.config.keyId && 'RAZORPAY_KEY_ID',
      !this.config.keySecret && 'RAZORPAY_KEY_SECRET',
    ].filter(Boolean) as string[];
    if (missing.length) throw new GatewayNotConfiguredError(this.key, missing);
  }

  private authHeader(): string {
    return 'Basic ' + Buffer.from(`${this.config.keyId}:${this.config.keySecret}`).toString('base64');
  }

  async createIntent(input: PaymentIntentInput): Promise<PaymentIntentResult> {
    this.assertConfigured();
    const res = await this.fetchFn('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: this.authHeader() },
      body: JSON.stringify({
        amount: input.amountMinor,
        currency: input.currency,
        // Razorpay's own idempotency handle — replaying our key returns the
        // existing order rather than creating a second one.
        receipt: input.clientPaymentId,
        notes: { orderId: input.orderId, ...(input.metadata ?? {}) },
      }),
    });

    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        gatewayRef: '',
        status: 'FAILED',
        failureReason: (body as { error?: { description?: string } })?.error?.description
          ?? `Razorpay returned HTTP ${res.status}.`,
        raw: body,
      };
    }

    const order = body as { id: string; status: string };
    return {
      gatewayRef: order.id,
      status: 'PENDING',
      actionType: 'QR',
      actionPayload: order.id,
      raw: body,
    };
  }

  async capture(gatewayRef: string, amountMinor: number): Promise<PaymentIntentResult> {
    this.assertConfigured();
    const res = await this.fetchFn(`https://api.razorpay.com/v1/payments/${gatewayRef}/capture`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: this.authHeader() },
      body: JSON.stringify({ amount: amountMinor, currency: 'INR' }),
    });
    const body = await res.json().catch(() => ({}));
    return {
      gatewayRef,
      status: res.ok ? 'CAPTURED' : 'FAILED',
      failureReason: res.ok ? undefined : `Capture failed with HTTP ${res.status}.`,
      raw: body,
    };
  }

  async refund(input: RefundInput): Promise<RefundResult> {
    this.assertConfigured();
    const res = await this.fetchFn(`https://api.razorpay.com/v1/payments/${input.gatewayRef}/refund`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: this.authHeader(),
        'X-Razorpay-Idempotency-Key': input.clientRefundId,
      },
      body: JSON.stringify({ amount: input.amountMinor, notes: { reason: input.reason ?? '' } }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        gatewayRefundRef: '',
        status: 'FAILED',
        failureReason: `Refund failed with HTTP ${res.status}.`,
        raw: body,
      };
    }
    return { gatewayRefundRef: (body as { id: string }).id, status: 'REFUNDED', raw: body };
  }

  /**
   * HMAC-SHA256 over the raw body, compared in constant time.
   *
   * The raw body matters: re-serialising the parsed JSON changes key order and
   * whitespace and the signature will never match. The controller therefore
   * keeps the raw buffer for this route.
   */
  verifyWebhook(rawBody: string, headers: Record<string, string>): WebhookVerification {
    if (!this.config.webhookSecret) {
      return { valid: false, reason: 'No Razorpay webhook secret is configured.' };
    }
    const signature = headers['x-razorpay-signature'];
    if (!signature) return { valid: false, reason: 'Missing X-Razorpay-Signature header.' };

    const expected = createHmac('sha256', this.config.webhookSecret).update(rawBody).digest('hex');
    const a = Buffer.from(expected, 'utf8');
    const b = Buffer.from(signature, 'utf8');
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      return { valid: false, reason: 'Webhook signature did not verify.' };
    }

    const event = JSON.parse(rawBody) as {
      event: string;
      payload?: { payment?: { entity?: { id: string; status: string } } };
    };
    const entity = event.payload?.payment?.entity;
    const status = {
      captured: 'CAPTURED', authorized: 'AUTHORIZED', failed: 'FAILED', refunded: 'REFUNDED',
    }[entity?.status ?? ''] as WebhookVerification['status'];

    return { valid: true, event: event.event, gatewayRef: entity?.id, status };
  }
}

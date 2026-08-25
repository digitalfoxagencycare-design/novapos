/**
 * Payment gateway abstraction.
 *
 * Every gateway — Razorpay, Stripe, a cash drawer, a card terminal — sits
 * behind this one interface, so switching provider or adding a market is a new
 * adapter plus a config row, never a change to the order or payment services.
 *
 * The rule that keeps this honest: nothing above this interface may reference
 * a provider by name. If order code needs to know it is talking to Razorpay,
 * the abstraction has leaked.
 *
 * Card data never passes through NovaPOS. Adapters either hand off to the
 * provider's own hosted flow or talk to a certified terminal; we store the
 * provider's reference and the last four digits at most. That is what keeps
 * this system out of PCI-DSS scope beyond SAQ-A.
 */

export interface PaymentIntentInput {
  orderId: string;
  amountMinor: number;
  currency: string;
  /** Idempotency key from the device — the same key must never double-charge. */
  clientPaymentId: string;
  customer?: { name?: string | null; email?: string | null; phone?: string | null } | null;
  /** Where the provider should send the customer back to, for hosted flows. */
  returnUrl?: string;
  metadata?: Record<string, string>;
}

export interface PaymentIntentResult {
  /** The provider's id for this attempt. */
  gatewayRef: string;
  status: 'PENDING' | 'AUTHORIZED' | 'CAPTURED' | 'FAILED';
  /** Where to send the customer (hosted checkout) or what to render (UPI QR). */
  actionType?: 'REDIRECT' | 'QR' | 'TERMINAL' | 'NONE';
  actionPayload?: string;
  failureReason?: string;
  raw?: unknown;
}

export interface RefundInput {
  gatewayRef: string;
  amountMinor: number;
  currency: string;
  reason?: string;
  clientRefundId: string;
}

export interface RefundResult {
  gatewayRefundRef: string;
  status: 'PENDING' | 'REFUNDED' | 'FAILED';
  failureReason?: string;
  raw?: unknown;
}

export interface WebhookVerification {
  valid: boolean;
  event?: string;
  gatewayRef?: string;
  status?: 'AUTHORIZED' | 'CAPTURED' | 'FAILED' | 'REFUNDED';
  reason?: string;
}

export interface PaymentGateway {
  /** Stable key stored on the payment row, e.g. "razorpay". */
  readonly key: string;
  readonly displayName: string;
  /** Currencies this adapter can settle, or '*' for any. */
  readonly supportedCurrencies: string[] | '*';
  /** Methods this adapter can fulfil. */
  readonly supportedMethods: string[];

  /**
   * Whether this adapter has the credentials it needs to actually transact.
   *
   * The registry checks this before routing a payment. Without it, a tenant
   * who has not finished setting up their provider would have every card
   * payment fail at the till, when the right behaviour is to fall back to
   * recording it as a manual tender — the card was almost certainly swiped on
   * a standalone terminal, which is how most of this market still works.
   */
  isConfigured(): boolean;

  createIntent(input: PaymentIntentInput): Promise<PaymentIntentResult>;
  capture?(gatewayRef: string, amountMinor: number): Promise<PaymentIntentResult>;
  refund(input: RefundInput): Promise<RefundResult>;
  /**
   * Verify a webhook signature. Must be constant-time and must fail closed —
   * an unverified webhook that flips an order to PAID is free food.
   */
  verifyWebhook(rawBody: string, headers: Record<string, string>): WebhookVerification;
}

export class GatewayNotConfiguredError extends Error {
  constructor(key: string, missing: string[]) {
    super(
      `Payment gateway "${key}" is selected but not configured. Missing: ${missing.join(', ')}. ` +
      'Set these in the tenant settings or the environment before taking payments.',
    );
  }
}

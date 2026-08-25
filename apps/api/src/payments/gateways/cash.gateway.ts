import type {
  PaymentGateway, PaymentIntentInput, PaymentIntentResult, RefundInput, RefundResult, WebhookVerification,
} from './gateway.interface';

/**
 * Cash and other in-person tenders that settle instantly with no provider.
 *
 * Implemented as a gateway rather than special-cased in the payment service so
 * that every payment in the system has the same shape — one code path for
 * recording, reconciling and refunding, whether or not money moved over a wire.
 */
export class CashGateway implements PaymentGateway {
  readonly key = 'cash';
  readonly displayName = 'Cash / manual tender';
  readonly supportedCurrencies = '*' as const;
  readonly supportedMethods = ['CASH', 'CARD', 'UPI', 'WALLET', 'VOUCHER', 'CREDIT'];

  /** Cash needs no credentials; it is always available. */
  isConfigured(): boolean {
    return true;
  }

  async createIntent(input: PaymentIntentInput): Promise<PaymentIntentResult> {
    // The cashier has already taken the money; there is nothing to authorise.
    return {
      gatewayRef: `cash_${input.clientPaymentId}`,
      status: 'CAPTURED',
      actionType: 'NONE',
    };
  }

  async refund(input: RefundInput): Promise<RefundResult> {
    return { gatewayRefundRef: `cashrf_${input.clientRefundId}`, status: 'REFUNDED' };
  }

  verifyWebhook(): WebhookVerification {
    return { valid: false, reason: 'The cash gateway does not receive webhooks.' };
  }
}

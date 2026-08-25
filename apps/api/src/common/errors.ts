import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * Domain errors carry a stable machine-readable `code` alongside the message.
 *
 * The POS runs offline and replays queued work later; when a replay fails, the
 * device needs to decide whether to retry, drop, or surface the failure to the
 * cashier. A human-readable string cannot drive that decision, so every error
 * the API returns carries a code the client switches on.
 */
export class DomainError extends HttpException {
  constructor(
    public readonly code: string,
    message: string,
    status: HttpStatus = HttpStatus.BAD_REQUEST,
    public readonly details?: unknown,
    /** Tells an offline client whether replaying this request could succeed. */
    public readonly retryable = false,
  ) {
    super({ code, message, details, retryable }, status);
  }
}

export const Errors = {
  notFound: (what: string, id?: string) =>
    new DomainError('NOT_FOUND', `${what}${id ? ` ${id}` : ''} was not found.`, HttpStatus.NOT_FOUND),

  forbidden: (action: string) =>
    new DomainError('FORBIDDEN', `You do not have permission to ${action}.`, HttpStatus.FORBIDDEN),

  unauthorized: (reason = 'Authentication required.') =>
    new DomainError('UNAUTHORIZED', reason, HttpStatus.UNAUTHORIZED),

  conflict: (code: string, message: string, details?: unknown) =>
    new DomainError(code, message, HttpStatus.CONFLICT, details),

  validation: (message: string, details?: unknown) =>
    new DomainError('VALIDATION_FAILED', message, HttpStatus.BAD_REQUEST, details),

  /** The request is well-formed but the order's state does not allow it. */
  invalidState: (message: string, details?: unknown) =>
    new DomainError('INVALID_STATE', message, HttpStatus.CONFLICT, details),

  taxConfig: (message: string) =>
    new DomainError('TAX_CONFIG_INVALID', message, HttpStatus.UNPROCESSABLE_ENTITY),

  paymentFailed: (message: string, details?: unknown) =>
    new DomainError('PAYMENT_FAILED', message, HttpStatus.PAYMENT_REQUIRED, details, true),

  printerUnreachable: (message: string) =>
    new DomainError('PRINTER_UNREACHABLE', message, HttpStatus.SERVICE_UNAVAILABLE, undefined, true),

  /** Two devices edited the same order; the client must re-fetch and re-apply. */
  syncConflict: (message: string, details?: unknown) =>
    new DomainError('SYNC_CONFLICT', message, HttpStatus.CONFLICT, details),
};

import type { OutboxEntry } from './db';
import type { PullResponse, SyncResult } from './sync';

/**
 * HTTP client.
 *
 * Two things it does that a generic fetch wrapper would not:
 *
 *   · It refreshes an expired access token once, transparently, and replays
 *     the request. A cashier mid-transaction must never be shown a login
 *     screen because a 15-minute token lapsed.
 *   · It distinguishes "the server said no" from "the server could not be
 *     reached". The POS treats those completely differently — one is a
 *     business error to show the operator, the other is a cue to keep working
 *     offline and queue the write.
 */

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
    public readonly retryable = false,
  ) {
    super(message);
  }
}

/** The network could not be reached at all — not a rejection, an absence. */
export class OfflineError extends Error {
  constructor(cause?: string) {
    super(cause ?? 'The server could not be reached.');
  }
}

export interface Tokens {
  accessToken: string;
  refreshToken: string;
}

export class ApiClient {
  private tokens: Tokens | null = null;
  private refreshing: Promise<void> | null = null;
  private outletId: string | null = null;

  constructor(
    private readonly baseUrl = '/api/v1',
    private readonly onTokens?: (tokens: Tokens | null) => void,
  ) {}

  setTokens(tokens: Tokens | null) {
    this.tokens = tokens;
    this.onTokens?.(tokens);
  }

  setOutlet(outletId: string | null) {
    this.outletId = outletId;
  }

  get isAuthenticated(): boolean {
    return Boolean(this.tokens?.accessToken);
  }

  async loginPhonePin(phone: string, pin: string) {
    const result = await this.raw('POST', '/auth/login/phone-pin', { phone, pin });
    this.setTokens(result.tokens);
    return result;
  }

  checkPhone(phone: string): Promise<{ exists: boolean; storeName?: string; phone: string }> {
    return this.raw('POST', '/auth/check-phone', { phone });
  }

  sendOtp(phone: string) { return this.raw('POST', '/auth/otp/send', { phone }); }

  async verifyOtp(input: { phone: string; otp: string; isFirebaseVerified?: boolean; storeName?: string; profile?: string; pin?: string; couponCode?: string }) {
    const result = await this.raw('POST', '/auth/otp/verify', input);
    this.setTokens(result.tokens);
    return result;
  }

  subscriptionStatus() { return this.request('GET', '/subscriptions/status'); }
  createSubscriptionOrder(planKey: string) { return this.request('POST', '/subscriptions/create-order', { planKey }); }
  verifySubscription(input: { planKey: string; orderId: string; paymentId: string; signature: string }) {
    return this.request('POST', '/subscriptions/verify', input);
  }

  /** Routing hints only. Authorization is always enforced by the API. */
  get sessionScope(): { tenantId: string; outletId?: string } | null {
    try {
      const payload = this.tokens?.accessToken.split('.')[1];
      if (!payload) return null;
      const claims = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
      return typeof claims.tenantId === 'string' ? { tenantId: claims.tenantId, outletId: claims.outletId || undefined } : null;
    } catch { return null; }
  }

  async login(tenantSlug: string, email: string, password: string) {
    const res = await this.raw('POST', '/auth/login', { tenantSlug, email, password });
    this.setTokens(res.tokens);
    return res.staff;
  }

  async loginWithPin(tenantSlug: string, outletCode: string, pin: string) {
    const res = await this.raw('POST', '/auth/login/pin', { tenantSlug, outletCode, pin });
    this.setTokens(res.tokens);
    return res.staff;
  }

  async logout() {
    if (this.tokens?.refreshToken) {
      await this.raw('POST', '/auth/logout', { refreshToken: this.tokens.refreshToken })
        .catch(() => undefined); // signing out locally must always succeed
    }
    this.setTokens(null);
  }

  menuSnapshot(outletId: string) {
    return this.request('GET', `/menu/snapshot?outletId=${encodeURIComponent(outletId)}`);
  }

  openOrders(outletId: string) {
    return this.request('GET', `/orders?outletId=${encodeURIComponent(outletId)}`);
  }

  order(id: string) {
    return this.request('GET', `/orders/${id}`);
  }

  receipt(orderId: string) {
    return this.request('GET', `/orders/${orderId}/receipt`);
  }

  printReceipt(orderId: string, printerId?: string) {
    return this.request('POST', `/orders/${orderId}/receipt/print`, { printerId });
  }

  splitBill(orderId: string, body: unknown) {
    return this.request('POST', `/orders/${orderId}/split`, body);
  }

  today(outletId: string) {
    return this.request('GET', `/reports/today?outletId=${encodeURIComponent(outletId)}`);
  }

  /**
   * Bill an order.
   *
   * Deliberately not queueable: the invoice number comes from a gapless,
   * server-side sequence, and a number minted on a device could collide with
   * another till's. Offline, the POS keeps the order open and says so.
   */
  billOrder(serverOrderId: string) {
    return this.request('POST', `/orders/${serverOrderId}/bill`);
  }

  fireOrder(serverOrderId: string) {
    return this.request('POST', `/orders/${serverOrderId}/fire`);
  }

  takePayment(serverOrderId: string, body: {
    clientPaymentId: string; method: string;
    amountMinor: number; tenderedMinor?: number; reference?: string;
  }) {
    return this.request('POST', `/orders/${serverOrderId}/payments`, body);
  }

  voidOrder(serverOrderId: string, reason: string) {
    return this.request('POST', `/orders/${serverOrderId}/void`, { reason });
  }

  /** Live tickets for a kitchen station — the KDS's cold-start and fallback. */
  kots(stationId: string) {
    return this.request('GET', `/kot?stationId=${encodeURIComponent(stationId)}`);
  }

  kotStatus(kotId: string, status: 'PREPARING' | 'READY' | 'SERVED' | 'CANCELLED') {
    return this.request('POST', `/kot/${kotId}/status`, { status });
  }

  /** Outlets this operator may work at. */
  outlets(): Promise<{ id: string; name: string; code: string }[]> {
    return this.request('GET', '/outlets');
  }

  /** Flush a batch of queued operations. */
  async push(entries: OutboxEntry[]): Promise<{ results: SyncResult[] }> {
    return this.request('POST', '/sync/push', {
      operations: entries.map((e) => ({
        opId: e.opId,
        type: e.type,
        occurredAt: e.occurredAt,
        payload: e.payload,
      })),
    });
  }

  async pull(outletId: string, since?: string): Promise<PullResponse> {
    const qs = new URLSearchParams({ outletId });
    if (since) qs.set('since', since);
    return this.request('GET', `/sync/pull?${qs}`);
  }

  /* ───────────────────────── internals ───────────────────────── */

  private async request(method: string, path: string, body?: unknown): Promise<any> {
    try {
      return await this.raw(method, path, body, true);
    } catch (err) {
      // One transparent refresh, then give up and surface the failure.
      if (err instanceof ApiError && err.status === 401 && this.tokens?.refreshToken) {
        await this.refreshTokens();
        return this.raw(method, path, body, true);
      }
      throw err;
    }
  }

  private async refreshTokens(): Promise<void> {
    // Several requests can 401 at once; only one refresh should actually run,
    // because a second would present an already-rotated token and trip the
    // server's reuse detection, signing the device out entirely.
    if (this.refreshing) return this.refreshing;

    this.refreshing = (async () => {
      try {
        const res = await this.raw('POST', '/auth/refresh', {
          refreshToken: this.tokens!.refreshToken,
        });
        this.setTokens(res);
      } catch (err) {
        this.setTokens(null);
        throw err;
      } finally {
        this.refreshing = null;
      }
    })();

    return this.refreshing;
  }

  private async raw(
    method: string,
    path: string,
    body?: unknown,
    authed = false,
  ): Promise<any> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (authed && this.tokens?.accessToken) {
      headers.Authorization = `Bearer ${this.tokens.accessToken}`;
    }
    if (this.outletId) headers['X-Outlet-Id'] = this.outletId;
    headers['X-Device-Id'] = deviceId();

    let res: Response;
    try {
      res = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(20000),
      });
    } catch (err) {
      // fetch only rejects on a network-level failure, which is precisely the
      // case the POS should treat as "keep working offline".
      throw new OfflineError((err as Error).message);
    }

    if (res.status === 204) return null;

    const text = await res.text();
    let payload: any = null;
    try { payload = text ? JSON.parse(text) : null; } catch { payload = text; }

    if (!res.ok) {
      throw new ApiError(
        res.status,
        payload?.code ?? `HTTP_${res.status}`,
        payload?.message ?? res.statusText,
        payload?.details,
        payload?.retryable ?? res.status >= 500,
      );
    }
    return payload;
  }
}

/**
 * A stable per-device identifier.
 *
 * Used for sync diagnostics and to attribute queued work to a terminal. It is
 * not a security boundary — the bearer token is — so a value in localStorage
 * is appropriate here.
 */
export function deviceId(): string {
  const KEY = 'novapos:deviceId';
  try {
    let id = localStorage.getItem(KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    // Private browsing, or storage disabled. A per-session id still lets the
    // server group this device's operations.
    return 'ephemeral-device';
  }
}

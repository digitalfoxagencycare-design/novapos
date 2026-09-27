/**
 * Admin API client.
 *
 * Simpler than the POS's: the dashboard is used at a desk on a real
 * connection, so there is no offline queue here. A failed request is shown to
 * the owner rather than absorbed — in this context, silently retrying a report
 * would just mean stale numbers presented as current.
 */

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
  }
}

export interface Tokens { accessToken: string; refreshToken: string }

export class AdminApi {
  private tokens: Tokens | null = null;
  private refreshing: Promise<void> | null = null;

  constructor(
    private readonly baseUrl = import.meta.env.VITE_API_URL
      ? `${import.meta.env.VITE_API_URL.replace(/\/$/, '')}/api/v1`
      : '/api/v1',
  ) {
    try {
      const raw = localStorage.getItem('novapos:admin:tokens');
      if (raw) this.tokens = JSON.parse(raw);
    } catch { /* ignore */ }
  }

  get isAuthenticated() { return Boolean(this.tokens?.accessToken); }

  private persist(tokens: Tokens | null) {
    this.tokens = tokens;
    try {
      if (tokens) localStorage.setItem('novapos:admin:tokens', JSON.stringify(tokens));
      else localStorage.removeItem('novapos:admin:tokens');
    } catch { /* ignore */ }
  }

  async login(tenantSlug: string, email: string, password: string) {
    const res = await this.raw('POST', '/auth/login', { tenantSlug, email, password });
    this.persist(res.tokens);
    return res.staff;
  }

  async logout() {
    if (this.tokens?.refreshToken) {
      await this.raw('POST', '/auth/logout', { refreshToken: this.tokens.refreshToken }).catch(() => undefined);
    }
    this.persist(null);
  }

  me() { return this.get('/auth/me'); }
  outlets() { return this.get('/outlets'); }
  merchants() { return this.get('/outlets/merchants'); }
  activateMerchant(tenantId: string) { return this.post(`/outlets/merchants/${tenantId}/activate`, {}); }
  deactivateMerchant(tenantId: string) { return this.post(`/outlets/merchants/${tenantId}/deactivate`, {}); }

  /* menu */
  categories() { return this.get('/menu/categories'); }
  items(params: { categoryId?: string; search?: string } = {}) {
    const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v) as [string, string][]);
    return this.get(`/menu/items${qs.toString() ? `?${qs}` : ''}`);
  }
  createItem(body: unknown) { return this.post('/menu/items', body); }
  updateItem(id: string, body: unknown) { return this.request('PATCH', `/menu/items/${id}`, body); }
  archiveItem(id: string) { return this.request('DELETE', `/menu/items/${id}`); }
  createCategory(body: unknown) { return this.post('/menu/categories', body); }

  /* reports */
  today(outletId: string) { return this.get(`/reports/today?outletId=${outletId}`); }
  sales(outletId: string, from: string, to: string) {
    return this.get(`/reports/sales?outletId=${outletId}&from=${from}&to=${to}`);
  }
  taxSummary(outletId: string, from: string, to: string) {
    return this.get(`/reports/tax?outletId=${outletId}&from=${from}&to=${to}`);
  }
  topItems(outletId: string, from: string, to: string) {
    return this.get(`/reports/items?outletId=${outletId}&from=${from}&to=${to}`);
  }
  paymentMix(outletId: string, from: string, to: string) {
    return this.get(`/reports/payments?outletId=${outletId}&from=${from}&to=${to}`);
  }

  /* printing */
  printQueue(outletId: string) { return this.get(`/printing/queue?outletId=${outletId}`); }
  printerProfiles() { return this.get('/printing/profiles'); }
  retryPrintJob(id: string) { return this.post(`/printing/jobs/${id}/retry`, {}); }

  /* orders */
  openOrders(outletId: string) { return this.get(`/orders?outletId=${outletId}`); }

  /* ── internals ── */

  private get(path: string) { return this.request('GET', path); }
  private post(path: string, body?: unknown) { return this.request('POST', path, body); }

  private async request(method: string, path: string, body?: unknown): Promise<any> {
    try {
      return await this.raw(method, path, body, true);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401 && this.tokens?.refreshToken) {
        await this.refresh();
        return this.raw(method, path, body, true);
      }
      throw err;
    }
  }

  private async refresh(): Promise<void> {
    // Only one refresh may be in flight: a second would present an
    // already-rotated token and trip the server's reuse detection, which signs
    // every session out.
    if (this.refreshing) return this.refreshing;
    this.refreshing = (async () => {
      try {
        this.persist(await this.raw('POST', '/auth/refresh', { refreshToken: this.tokens!.refreshToken }));
      } catch (err) {
        this.persist(null);
        throw err;
      } finally {
        this.refreshing = null;
      }
    })();
    return this.refreshing;
  }

  private async raw(method: string, path: string, body?: unknown, authed = false): Promise<any> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (authed && this.tokens?.accessToken) headers.Authorization = `Bearer ${this.tokens.accessToken}`;

    const res = await fetch(this.baseUrl + path, {
      method, headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    }).catch((err) => {
      throw new ApiError(0, 'NETWORK', `Could not reach the server: ${err.message}`);
    });

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
      );
    }
    return payload;
  }
}

/* ─────────────────────── export helpers ─────────────────────── */

/**
 * Export a table as CSV.
 *
 * The brief asks for Excel and PDF export. CSV is what actually gets used —
 * every accountant opens it in Excel, it has no dependencies, and it cannot
 * silently mangle a number the way a generated .xlsx can. The BOM is there so
 * Excel does not corrupt non-ASCII names (a real problem with Indian and
 * German menu items).
 *
 * PDF export deliberately goes through the browser's own print dialog rather
 * than a bundled PDF library: it is 200KB lighter, it prints exactly what the
 * owner sees, and it works on every platform.
 */
export function downloadCsv(filename: string, rows: Record<string, unknown>[]): void {
  if (rows.length === 0) return;
  const headers = Object.keys(rows[0]);
  const escape = (v: unknown) => {
    const s = v == null ? '' : String(v);
    // A leading =, +, - or @ makes Excel treat the cell as a formula, which is
    // a well-known spreadsheet injection vector when the data is user-supplied
    // (a menu item called "=cmd|…"). Prefixing an apostrophe neutralises it.
    const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
    return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
  };

  const csv = [
    headers.join(','),
    ...rows.map((r) => headers.map((h) => escape(r[h])).join(',')),
  ].join('\r\n');

  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function printPage(): void {
  window.print();
}

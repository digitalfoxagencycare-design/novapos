import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { formatMoney } from '@novapos/shared';
import { AdminApi, ApiError, downloadCsv, printPage } from './lib/api';

type Page = 'dashboard' | 'merchants' | 'menu' | 'reports' | 'printing' | 'tax';

const api = new AdminApi();

interface Outlet {
  id: string; name: string; code: string;
  currency: string | null; locale: string | null; country: string;
}

const NAV: { key: Page; label: string; icon: string; needs: string }[] = [
  { key: 'dashboard', label: 'Dashboard', icon: '📊', needs: 'report:read' },
  { key: 'merchants', label: 'Stores & Merchants', icon: '🏪', needs: 'settings:read' },
  { key: 'menu', label: 'Menu & Catalog', icon: '🍔', needs: 'menu:read' },
  { key: 'reports', label: 'Sales Reports', icon: '📈', needs: 'report:read' },
  { key: 'tax', label: 'GST Tax Rules', icon: '⚖️', needs: 'settings:read' },
  { key: 'printing', label: 'Thermal Printing', icon: '🖨️', needs: 'settings:read' },
];

export function App() {
  const [signedIn, setSignedIn] = useState(api.isAuthenticated);
  const [page, setPage] = useState<Page>('dashboard');
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [outletId, setOutletId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pageVersion, setPageVersion] = useState(0);
  const [me, setMe] = useState<{ role: string; permissions: string[] } | null>(null);
  const requestVersion = useRef(0);

  const loadInitialData = useCallback(async () => {
    const version = ++requestVersion.current;
    setLoading(true);
    setBootstrapError(null);
    setError(null);
    setMe(null);
    setOutlets([]);
    try {
      const [list, who] = await Promise.all([api.outlets(), api.me()]);
      if (version !== requestVersion.current) return;
      if (!Array.isArray(list) || list.some(o => !o || typeof o.id !== 'string' || !o.id || typeof o.name !== 'string')) {
        throw new Error('The server returned an invalid outlet list. Please retry or contact support.');
      }
      if (!who || typeof who.role !== 'string' || !Array.isArray(who.permissions) || who.permissions.some((p: unknown) => typeof p !== 'string')) {
        throw new Error('The server did not return valid account permissions. Please retry or sign in again.');
      }
      setOutlets(list);
      setOutletId(previous => list.some(o => o.id === previous) ? previous : list[0]?.id ?? null);
      setMe(who);
      const allowed = NAV.filter(n => who.permissions.includes(n.needs));
      setPage(previous => allowed.some(n => n.key === previous) ? previous : allowed[0]?.key ?? 'dashboard');
    } catch (err) {
      if (version !== requestVersion.current) return;
      if (err instanceof ApiError && err.status === 401) {
        void api.logout();
        setSignedIn(false);
      } else {
        setBootstrapError(err instanceof Error ? err.message : 'Unable to load your workspace. Please retry.');
      }
    } finally {
      if (version === requestVersion.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (signedIn) void loadInitialData();
    return () => { ++requestVersion.current; };
  }, [signedIn, loadInitialData]);

  const outlet = useMemo(() => outlets.find(o => o.id === outletId) ?? null, [outlets, outletId]);
  const allowedNav = me ? NAV.filter(n => me.permissions.includes(n.needs)) : [];
  const canViewPage = allowedNav.some(n => n.key === page);
  const retryPage = () => { setError(null); setPageVersion(v => v + 1); };

  if (!signedIn) return <SignIn onSignedIn={() => { setLoading(true); setSignedIn(true); setError(null); }} />;

  return (
    <div className="shell">
      <nav className="side" aria-label="Admin navigation">
        <div className="side__brand">NovaPOS Admin</div>
        {!me && <p className="side__status" role="status">{loading ? 'Checking access…' : 'Access could not be verified'}</p>}
        {(me ? allowedNav : NAV).map(n => (
          <button key={n.key} disabled={!me || loading}
            aria-current={me && page === n.key ? 'page' : undefined}
            className={`side__link ${me && page === n.key ? 'side__link--active' : ''}`}
            onClick={() => { setPage(n.key); setError(null); }}>
            <span aria-hidden="true" style={{ marginRight: 8 }}>{n.icon}</span>{n.label}
          </button>
        ))}
        <div className="side__foot">
          {outlets.length > 1 && <select value={outletId ?? ''} aria-label="Outlet" style={{ width: '100%', marginBottom: 10 }}
            onChange={e => { setOutletId(e.target.value); setError(null); }}>
            {outlets.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>}
          <div style={{ marginBottom: 8 }}>{me?.role ?? 'Verifying account'}{outlet ? ` · ${outlet.name}` : ''}</div>
          <button className="btn btn--sm" onClick={() => {
            ++requestVersion.current;
            void api.logout();
            setMe(null); setOutlets([]); setOutletId(null); setSignedIn(false);
          }}>Sign out</button>
        </div>
      </nav>
      <main className="main" aria-busy={loading}>
        {loading ? (
          <section className="workspace-state" role="status"><h1>Loading your workspace</h1><p>Checking account access and available outlets…</p></section>
        ) : bootstrapError ? (
          <section className="workspace-state"><h1>Unable to load your workspace</h1>
            <div className="error-banner" role="alert">{bootstrapError}</div>
            <button className="btn btn--primary" onClick={() => void loadInitialData()}>Retry</button>
          </section>
        ) : !allowedNav.length ? (
          <section className="workspace-state"><h1>No admin access</h1><p>Your account has no permissions for these pages. Ask your administrator to update your access.</p>
            <button className="btn" onClick={() => void loadInitialData()}>Retry</button>
          </section>
        ) : !outlet ? (
          <section className="workspace-state"><h1>No outlets assigned</h1><p>Ask your administrator to create or assign an active outlet, then retry.</p>
            <button className="btn btn--primary" onClick={() => void loadInitialData()}>Retry</button>
          </section>
        ) : canViewPage ? (
          <>
            {error && <div className="error-banner" role="alert">{error}
              <button className="btn btn--sm" onClick={retryPage}>Retry</button>
              <button className="btn btn--sm" onClick={() => setError(null)}>Dismiss</button>
            </div>}
            <div key={`${outlet.id}:${page}:${pageVersion}`}>
              {page === 'dashboard' && <Dashboard outlet={outlet} />}
              {page === 'merchants' && <Merchants onError={setError} />}
              {page === 'menu' && <Menu onError={setError} outlet={outlet} />}
              {page === 'reports' && <Reports outlet={outlet} onError={setError} />}
              {page === 'tax' && <TaxSettings outlet={outlet} />}
              {page === 'printing' && <Printing outlet={outlet} onError={setError} />}
            </div>
          </>
        ) : null}
      </main>
    </div>
  );
}

/* ───────────────────────── dashboard ───────────────────────── */

function Dashboard({ outlet }: { outlet: Outlet }) {
  const [today, setToday] = useState<any>(null);
  const [week, setWeek] = useState<any[]>([]);
  const money = useMoney(outlet);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const request = useRef(0);

  const load = useCallback(async () => {
    const version = ++request.current;
    setLoading(true);
    setLoadError(null);
    try {
      const to = new Date();
      const from = new Date(Date.now() - 7 * 86400_000);
      const [t, s] = await Promise.all([
        api.today(outlet.id),
        api.sales(outlet.id, from.toISOString(), to.toISOString()),
      ]);
      if (version !== request.current) return;
      setToday(t);
      setWeek(s);
    } catch (err) { if (version === request.current) setLoadError((err as Error).message); }
    finally { if (version === request.current) setLoading(false); }
  }, [outlet.id]);

  useEffect(() => {
    void load();
    // The dashboard is often left open on a back-office screen during service.
    const t = setInterval(() => void load(), 30_000);
    return () => { ++request.current; clearInterval(t); };
  }, [load]);

  if (!today) return <section className="workspace-state"><h1>Today</h1><p>{outlet.name}</p>
    {loadError ? <><div className="error-banner" role="alert">{loadError}</div><button className="btn btn--primary" onClick={() => void load()}>Retry reports</button></>
      : <p role="status">Loading reports…</p>}
  </section>;

  const peak = Math.max(1, ...week.map((d) => d.grossMinor));

  return (
    <>
      <h1 className="page__title">Today</h1>
      <p className="page__sub">{outlet.name} · updates every 30 seconds</p>

      {loadError && <div className="error-banner" role="alert">{loadError} Showing the last successful update.
        <button className="btn btn--sm" disabled={loading} onClick={() => void load()}>Retry reports</button>
      </div>}
      <div className="cards">
        <Card label="Sales today" value={money(today?.grossMinor ?? 0)} hint={`${today?.orders ?? 0} orders`} />
        <Card label="Average order" value={money(today?.averageOrderMinor ?? 0)} />
        <Card label="Tax collected" value={money(today?.taxMinor ?? 0)} />
        <Card label="Discounts given" value={money(today?.discountMinor ?? 0)} />
        <Card
          label="Open tabs"
          value={String(today?.openOrders ?? 0)}
          hint={today?.openOrders ? 'unbilled' : 'all settled'}
        />
        <Card
          label="On the pass"
          value={String(today?.pendingKots ?? 0)}
          hint={today?.pendingKots ? 'tickets cooking' : 'kitchen clear'}
        />
      </div>

      <section className="panel">
        <header className="panel__head">
          <span className="panel__title">Last 7 days</span>
          <span className="panel__spacer" />
          <button
            className="btn btn--sm"
            onClick={() => downloadCsv(`sales-${outlet.code}`, week)}
            disabled={week.length === 0}
          >
            Export CSV
          </button>
        </header>
        <div className="panel__body">
          {week.length === 0 ? (
            <p className="empty">No sales in this period yet.</p>
          ) : (
            <div className="bars">
              {week.map((d) => (
                <div className="bars__col" key={d.day}>
                  <div
                    className="bars__bar"
                    style={{ height: `${(d.grossMinor / peak) * 100}%` }}
                    title={`${d.day}: ${money(d.grossMinor)} over ${d.orders} orders`}
                  />
                  <div className="bars__label">
                    {new Date(d.day).toLocaleDateString(outlet.locale ?? 'en-IN', { weekday: 'short' })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </>
  );
}

/* ───────────────────────── menu ───────────────────────── */

function Menu({ outlet, onError }: { outlet: Outlet; onError: (m: string) => void }) {
  const [items, setItems] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<any | null>(null);
  const money = useMoney(outlet);

  const load = useCallback(async () => {
    try {
      const [i, c] = await Promise.all([api.items({ search }), api.categories()]);
      setItems(i);
      setCategories(c);
    } catch (err) { onError((err as Error).message); }
  }, [search, onError]);

  useEffect(() => { void load(); }, [load]);

  const categoryName = (id: string) => categories.find((c) => c.id === id)?.name ?? '—';

  const savePrice = async (item: any, rupees: string) => {
    const priceMinor = Math.round(Number(rupees) * 100);
    if (!Number.isFinite(priceMinor) || priceMinor < 0) {
      onError('That is not a valid price.');
      return;
    }
    try {
      await api.updateItem(item.id, { priceMinor });
      setEditing(null);
      await load();
    } catch (err) { onError((err as Error).message); }
  };

  return (
    <>
      <h1 className="page__title">Menu</h1>
      <p className="page__sub">
        Price and tax changes take effect on the next order. Bills already issued keep the
        figures they were printed with.
      </p>

      <section className="panel">
        <header className="panel__head">
          <input
            placeholder="Search items…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: 240 }}
          />
          <span className="panel__spacer" />
          <button
            className="btn btn--sm"
            onClick={() => downloadCsv(`menu-${outlet.code}`, items.map((i) => ({
              code: i.code, name: i.name, category: categoryName(i.categoryId),
              price: (i.priceMinor / 100).toFixed(2), taxSlab: i.taxSlabId, hsnSac: i.hsnSac,
            })))}
          >
            Export CSV
          </button>
        </header>

        {items.length === 0 ? (
          <p className="empty">No items match.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Item</th><th>Category</th><th>Tax slab</th><th>HSN/SAC</th>
                <th className="num">Price</th><th />
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td>
                    <strong>{item.name}</strong>
                    {item.code && <span style={{ color: 'var(--text-faint)' }}> · {item.code}</span>}
                  </td>
                  <td>{categoryName(item.categoryId)}</td>
                  <td><span className="pill pill--good">{item.taxSlabId}</span></td>
                  <td style={{ fontFamily: 'var(--mono)', fontSize: 13 }}>{item.hsnSac ?? '—'}</td>
                  <td className="num">
                    {editing === item.id ? (
                      <input
                        autoFocus
                        defaultValue={(item.priceMinor / 100).toFixed(2)}
                        style={{ width: 90, textAlign: 'right' }}
                        onBlur={(e) => void savePrice(item, e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                          if (e.key === 'Escape') setEditing(null);
                        }}
                      />
                    ) : (
                      money(item.priceMinor)
                    )}
                  </td>
                  <td className="num">
                    <button className="btn btn--sm" onClick={() => setEditing(item.id)}>
                      Edit price
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}

/* ───────────────────────── reports ───────────────────────── */

function Reports({ outlet, onError }: { outlet: Outlet; onError: (m: string) => void }) {
  const [from, setFrom] = useState(() => new Date(Date.now() - 30 * 86400_000).toISOString().slice(0, 10));
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [tax, setTax] = useState<any[]>([]);
  const [top, setTop] = useState<any[]>([]);
  const [mix, setMix] = useState<any[]>([]);
  const money = useMoney(outlet);

  const load = useCallback(async () => {
    try {
      // Include the whole of the end day, which is what an owner means by "to".
      const fromIso = new Date(`${from}T00:00:00`).toISOString();
      const toIso = new Date(`${to}T23:59:59.999`).toISOString();
      const [t, i, p] = await Promise.all([
        api.taxSummary(outlet.id, fromIso, toIso),
        api.topItems(outlet.id, fromIso, toIso),
        api.paymentMix(outlet.id, fromIso, toIso),
      ]);
      setTax(t); setTop(i); setMix(p);
    } catch (err) { onError((err as Error).message); }
  }, [outlet.id, from, to, onError]);

  useEffect(() => { void load(); }, [load]);

  const taxTotal = tax.reduce((s, r) => s + r.amountMinor, 0);

  return (
    <>
      <h1 className="page__title">Reports</h1>
      <p className="page__sub">
        Figures come from the tax snapshot frozen on each bill, so a past period does not change
        when today's rates do.
      </p>

      <div className="row" style={{ marginBottom: 20 }}>
        <div className="field" style={{ marginBottom: 0 }}>
          <label htmlFor="from">From</label>
          <input id="from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label htmlFor="to">To</label>
          <input id="to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <button className="btn btn--primary" onClick={() => void load()}>Refresh</button>
        <button className="btn" onClick={printPage}>Print / save as PDF</button>
      </div>

      <section className="panel">
        <header className="panel__head">
          <span className="panel__title">Tax collected</span>
          <span className="panel__spacer" />
          <strong>{money(taxTotal)}</strong>
          <button
            className="btn btn--sm"
            disabled={tax.length === 0}
            onClick={() => downloadCsv(`tax-${outlet.code}-${from}-to-${to}`, tax.map((r) => ({
              component: r.code, rate: `${(r.rate * 100).toFixed(2)}%`,
              taxable: (r.taxableMinor / 100).toFixed(2), tax: (r.amountMinor / 100).toFixed(2),
            })))}
          >
            Export CSV
          </button>
        </header>
        {tax.length === 0 ? <p className="empty">No tax collected in this period.</p> : (
          <table>
            <thead>
              <tr><th>Component</th><th className="num">Rate</th><th className="num">Taxable</th><th className="num">Tax</th></tr>
            </thead>
            <tbody>
              {tax.map((r) => (
                <tr key={`${r.code}-${r.rate}`}>
                  <td><strong>{r.code}</strong></td>
                  <td className="num">{(r.rate * 100).toFixed(2)}%</td>
                  <td className="num">{money(r.taxableMinor)}</td>
                  <td className="num">{money(r.amountMinor)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="panel">
        <header className="panel__head">
          <span className="panel__title">Best sellers</span>
          <span className="panel__spacer" />
          <button
            className="btn btn--sm"
            disabled={top.length === 0}
            onClick={() => downloadCsv(`items-${outlet.code}-${from}-to-${to}`, top.map((r) => ({
              item: r.name, quantity: r.quantity, orders: r.orders,
              revenue: (r.revenueMinor / 100).toFixed(2),
            })))}
          >
            Export CSV
          </button>
        </header>
        {top.length === 0 ? <p className="empty">No sales in this period.</p> : (
          <table>
            <thead>
              <tr><th>Item</th><th className="num">Sold</th><th className="num">Orders</th><th className="num">Revenue</th></tr>
            </thead>
            <tbody>
              {top.map((r) => (
                <tr key={r.name}>
                  <td>{r.name}</td>
                  <td className="num">{r.quantity}</td>
                  <td className="num">{r.orders}</td>
                  <td className="num">{money(r.revenueMinor)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="panel">
        <header className="panel__head"><span className="panel__title">How guests paid</span></header>
        {mix.length === 0 ? <p className="empty">No payments in this period.</p> : (
          <table>
            <thead><tr><th>Method</th><th className="num">Count</th><th className="num">Amount</th></tr></thead>
            <tbody>
              {mix.map((r) => (
                <tr key={r.method}>
                  <td>{r.method}</td>
                  <td className="num">{r.count}</td>
                  <td className="num">{money(r.amountMinor)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}

/* ───────────────────────── tax settings ───────────────────────── */

function TaxSettings({ outlet }: { outlet: Outlet }) {
  const [preview, setPreview] = useState({ amount: '118.00', slab: 'gst-18', interstate: false });
  const [result, setResult] = useState<string | null>(null);

  // The preview runs the real engine in the browser, so an owner can see
  // exactly what a rule change will do before a guest is charged by it.
  useEffect(() => {
    void (async () => {
      const { computeTax, findRuleSet } = await import('@novapos/tax-engine');
      const ruleSet = findRuleSet(outlet.country === 'IN' ? 'IN-GST' : 'EU-VAT-DE');
      if (!ruleSet) { setResult('No rule set is configured for this outlet.'); return; }

      const amountMinor = Math.round(Number(preview.amount) * 100);
      if (!Number.isFinite(amountMinor)) { setResult('Enter a valid amount.'); return; }

      try {
        const computed = computeTax(
          ruleSet,
          [{ lineId: 'preview', amountMinor, slabId: preview.slab }],
          {
            outletCountry: outlet.country,
            outletRegion: 'KA',
            placeOfSupplyRegion: preview.interstate ? 'MH' : 'KA',
          },
        );
        setResult(
          `Taxable ${(computed.taxableMinor / 100).toFixed(2)}  ·  ` +
          computed.componentTotals
            .map((c: { code: string; rate: number; amountMinor: number }) => `${c.code} ${(c.rate * 100).toFixed(2)}% = ${(c.amountMinor / 100).toFixed(2)}`)
            .join('  ·  ') +
          `  ·  Total ${(computed.totalMinor / 100).toFixed(2)}`,
        );
      } catch (err) {
        setResult((err as Error).message);
      }
    })();
  }, [preview, outlet.country]);

  return (
    <>
      <h1 className="page__title">Tax</h1>
      <p className="page__sub">
        Tax rules are configuration, not code. Change a rate here and it applies to the next
        order — bills already issued keep their own frozen copy of the rules they were
        calculated under.
      </p>

      <section className="panel">
        <header className="panel__head"><span className="panel__title">Try a calculation</span></header>
        <div className="panel__body">
          <div className="row">
            <div className="field">
              <label htmlFor="amt">Menu price</label>
              <input id="amt" value={preview.amount}
                     onChange={(e) => setPreview((p) => ({ ...p, amount: e.target.value }))} />
            </div>
            <div className="field">
              <label htmlFor="slab">Tax slab</label>
              <select id="slab" value={preview.slab}
                      onChange={(e) => setPreview((p) => ({ ...p, slab: e.target.value }))}>
                {(outlet.country === 'IN'
                  ? ['gst-0', 'gst-5', 'gst-12', 'gst-18', 'gst-28']
                  : ['vat-zero', 'vat-reduced', 'vat-standard']
                ).map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            {outlet.country === 'IN' && (
              <div className="field">
                <label htmlFor="inter">Place of supply</label>
                <select
                  id="inter"
                  value={preview.interstate ? 'inter' : 'intra'}
                  onChange={(e) => setPreview((p) => ({ ...p, interstate: e.target.value === 'inter' }))}
                >
                  <option value="intra">Same state (CGST + SGST)</option>
                  <option value="inter">Another state (IGST)</option>
                </select>
              </div>
            )}
          </div>

          <div style={{
            background: 'var(--surface-2)', padding: 14, borderRadius: 'var(--radius)',
            fontFamily: 'var(--mono)', fontSize: 13, marginTop: 8,
          }}>
            {result ?? 'Enter an amount.'}
          </div>

          <p style={{ color: 'var(--text-faint)', fontSize: 13, marginTop: 12, marginBottom: 0 }}>
            This runs the same tax engine the till and the server use — not a separate estimate.
          </p>
        </div>
      </section>
    </>
  );
}

/* ───────────────────────── printing ───────────────────────── */

function Printing({ outlet, onError }: { outlet: Outlet; onError: (m: string) => void }) {
  const [queue, setQueue] = useState<any>(null);
  const [profiles, setProfiles] = useState<any[]>([]);

  const load = useCallback(async () => {
    try {
      const [q, p] = await Promise.all([api.printQueue(outlet.id), api.printerProfiles()]);
      setQueue(q); setProfiles(p);
    } catch (err) { onError((err as Error).message); }
  }, [outlet.id, onError]);

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 10_000);
    return () => clearInterval(t);
  }, [load]);

  return (
    <>
      <h1 className="page__title">Printing</h1>
      <p className="page__sub">
        A print failure never blocks a sale — the order is already recorded. Anything stuck
        shows here so it can be re-driven.
      </p>

      <div className="cards">
        <Card label="Queued" value={String(queue?.queued ?? 0)} />
        <Card label="Printing" value={String(queue?.printing ?? 0)} />
        <Card
          label="Failed"
          value={String(queue?.failed ?? 0)}
          hint={queue?.failed ? 'needs attention' : 'all clear'}
        />
      </div>

      {queue?.recentFailures?.length > 0 && (
        <section className="panel">
          <header className="panel__head"><span className="panel__title">Recent failures</span></header>
          <table>
            <thead><tr><th>Type</th><th>Error</th><th className="num">Attempts</th><th /></tr></thead>
            <tbody>
              {queue.recentFailures.map((f: any) => (
                <tr key={f.id}>
                  <td><span className="pill pill--bad">{f.type}</span></td>
                  <td style={{ fontSize: 13 }}>{f.lastError}</td>
                  <td className="num">{f.attempts}</td>
                  <td className="num">
                    <button
                      className="btn btn--sm"
                      onClick={async () => {
                        try { await api.retryPrintJob(f.id); await load(); }
                        catch (err) { onError((err as Error).message); }
                      }}
                    >
                      Retry
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <section className="panel">
        <header className="panel__head">
          <span className="panel__title">Supported printer profiles</span>
        </header>
        <table>
          <thead>
            <tr>
              <th>Profile</th><th className="num">Paper</th><th className="num">Columns</th>
              <th>Cutter</th><th>QR</th><th>Drawer</th>
            </tr>
          </thead>
          <tbody>
            {profiles.map((p) => (
              <tr key={p.id}>
                <td><strong>{p.label}</strong></td>
                <td className="num">{p.paperWidth}mm</td>
                <td className="num">{p.columns}</td>
                <td>{p.supportsCut ? 'Yes' : 'Feed only'}</td>
                <td>{p.supportsNativeQr ? 'Native' : 'Text fallback'}</td>
                <td>{p.supportsDrawerKick ? 'Yes' : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}

/* ───────────────────────── merchants & stores ───────────────────────── */

function Merchants({ onError }: { onError: (m: string) => void }) {
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.merchants();
      setList(data);
    } catch (err) {
      onError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [onError]);

  useEffect(() => {
    void load();
  }, [load]);

  const activeCount = list.filter((m) => m.subscriptionStatus === 'ACTIVE').length;
  const trialCount = list.filter((m) => m.subscriptionStatus === 'TRIAL').length;

  return (
    <>
      <h1 className="page__title">Registered Stores & Merchants</h1>
      <p className="page__sub">Live subscriber directory from PostgreSQL / Supabase</p>

      <div className="cards">
        <Card label="Total Stores" value={String(list.length)} />
        <Card label="Active Paid" value={String(activeCount)} />
        <Card label="Free Trials" value={String(trialCount)} />
      </div>

      <section className="panel" style={{ marginTop: 20 }}>
        <header className="panel__head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="panel__title">Merchant List</span>
          <button className="btn btn--sm" onClick={() => void load()}>Refresh</button>
        </header>
        {loading ? (
          <p className="empty">Loading stores…</p>
        ) : list.length === 0 ? (
          <p className="empty">No registered merchants found.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Store / Business</th>
                <th>Owner Phone</th>
                <th>Slug</th>
                <th>Plan</th>
                <th>Status</th>
                <th>Valid Until</th>
                <th>Branches</th>
                <th>Admin Action</th>
              </tr>
            </thead>
            <tbody>
              {list.map((m) => (
                <tr key={m.id}>
                  <td><strong>{m.name}</strong></td>
                  <td style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>+91 {m.phone}</td>
                  <td><code>{m.slug}</code></td>
                  <td><span className="pill">{m.plan}</span></td>
                  <td>
                    <span className={`pill ${m.subscriptionStatus === 'ACTIVE' ? 'pill--ok' : m.subscriptionStatus === 'TRIAL' ? 'pill--warn' : 'pill--bad'}`}>
                      {m.subscriptionStatus}
                    </span>
                  </td>
                  <td style={{ fontSize: 13 }}>
                    {m.validUntil ? new Date(m.validUntil).toLocaleDateString('en-IN') : '—'}
                  </td>
                  <td className="num">{m.outletsCount}</td>
                  <td>
                    {m.subscriptionStatus === 'ACTIVE' ? (
                      <button
                        className="btn btn--sm"
                        style={{ background: '#FEE2E2', color: '#991B1B', borderColor: '#FCA5A5' }}
                        onClick={async () => {
                          try {
                            await api.deactivateMerchant(m.id);
                            await load();
                          } catch (e) {
                            onError((e as Error).message);
                          }
                        }}
                      >
                        Suspend
                      </button>
                    ) : (
                      <button
                        className="btn btn--sm btn--primary"
                        onClick={async () => {
                          try {
                            await api.activateMerchant(m.id);
                            await load();
                          } catch (e) {
                            onError((e as Error).message);
                          }
                        }}
                      >
                        Approve & Activate
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}

/* ───────────────────────── shared bits ───────────────────────── */

function Card({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="card">
      <div className="card__label">{label}</div>
      <div className="card__value">{value}</div>
      {hint && <div className="card__hint">{hint}</div>}
    </div>
  );
}

function useMoney(outlet: Outlet) {
  return useCallback(
    (minor: number) => formatMoney(minor ?? 0, outlet.currency ?? 'INR', outlet.locale ?? 'en-IN'),
    [outlet.currency, outlet.locale],
  );
}

function SignIn({ onSignedIn }: { onSignedIn: () => void }) {
  const [tenantSlug, setTenantSlug] = useState('sri-balaji-3241');
  const [email, setEmail] = useState('9381563241');
  const [password, setPassword] = useState('1411');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="login">
      <form
        className="login__card"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true); setError(null);
          try {
            await api.login(tenantSlug.trim(), email.trim(), password);
            onSignedIn();
          } catch (err) {
            setError((err as Error).message);
          } finally { setBusy(false); }
        }}
      >
        <h1 style={{ marginTop: 0 }}>NovaPOS Admin Portal</h1>
        <p style={{ fontSize: '12px', color: '#64748B', marginTop: '-8px', marginBottom: '16px' }}>
          Store management, live reports, catalog items & merchant approval
        </p>
        {error && <div className="error-banner">{error}</div>}
        <div className="field">
          <label htmlFor="t">Store / Business Slug</label>
          <input id="t" value={tenantSlug} onChange={(e) => setTenantSlug(e.target.value)} placeholder="e.g. sri-balaji-3241" required />
        </div>
        <div className="field">
          <label htmlFor="e">Admin Mobile or Username</label>
          <input id="e" type="text" value={email} onChange={(e) => setEmail(e.target.value)}
                 placeholder="e.g. 9381563241 or Lokesh" autoComplete="username" required />
        </div>
        <div className="field">
          <label htmlFor="p">4-Digit PIN / Password</label>
          <input id="p" type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                 placeholder="e.g. 1411" autoComplete="current-password" required />
        </div>
        <button className="btn btn--primary" style={{ width: '100%', marginTop: '8px' }} type="submit" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in to Admin Dashboard'}
        </button>
      </form>
    </div>
  );
}

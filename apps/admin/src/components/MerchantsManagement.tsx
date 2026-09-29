import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { platformApi as api, type Actor, type ImpersonationAccess } from '../lib/platformApi';
import { DealerDetailDrawer } from './DealerDetailDrawer';
import { MerchantDetailDrawer, type MerchantDetail } from './MerchantDetailDrawer';
import { PlatformTelemetryView } from './PlatformTelemetryView';

interface Merchant extends MerchantDetail {}

interface Dealer {
  id: string;
  name: string;
  email: string;
  phone: string;
  dealerCode: string;
  status: string;
  commissionPercent: number;
  tier: 'silver' | 'gold' | 'platinum';
  territory: string | null;
  city: string | null;
  merchantCount: number;
  activationVolume: number;
  quotaGranted: number;
  quotaConsumed: number;
}

interface TelemetryOverview {
  landingVisits: number;
  trialSignups: number;
  trialConversions: number;
  conversionRate: number;
}

interface CreatedMerchant {
  tenant: { name: string; slug: string; status: string; validUntil: string };
  owner: { phone: string; initialPin: string };
  plan: string;
}

const money = (minor: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(minor / 100);

export function MerchantsManagement({
  actor,
  onLogout,
  onImpersonate,
}: {
  actor: Actor;
  onLogout: () => void;
  onImpersonate: (access: ImpersonationAccess) => void;
}) {
  const superAdmin = actor.role === 'SUPER_ADMIN';
  const [tab, setTab] = useState<'merchants' | 'dealers' | 'telemetry'>('merchants');
  const [filterPill, setFilterPill] = useState<'all' | 'active' | 'trial' | 'expiring' | 'at_risk'>('all');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [plan, setPlan] = useState('');
  const [health, setHealth] = useState('');
  const [page, setPage] = useState(1);
  const [dealerCodeFilter, setDealerCodeFilter] = useState('');
  const [data, setData] = useState<{ items: Merchant[]; total: number }>({ items: [], total: 0 });
  const [metrics, setMetrics] = useState<Record<string, number> | null>(null);
  const [dealers, setDealers] = useState<Dealer[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [creatingDealer, setCreatingDealer] = useState(false);
  const [impersonatingMerchant, setImpersonatingMerchant] = useState<Merchant | null>(null);
  const [selectedMerchant, setSelectedMerchant] = useState<Merchant | null>(null);
  const [onboarding, setOnboarding] = useState(false);
  const [createdMerchant, setCreatedMerchant] = useState<CreatedMerchant | null>(null);
  const [changingPassword, setChangingPassword] = useState(false);
  const [version, setVersion] = useState(0);
  const generation = useRef(0);
  const [selectedDealerId, setSelectedDealerId] = useState<string | null>(null);
  const [telemetry, setTelemetry] = useState<TelemetryOverview | null>(null);
  const [telemetrySeries, setTelemetrySeries] = useState<{ day: string; landingVisits: number; trialSignups: number; trialConversions: number }[]>([]);
  const [storePulse, setStorePulse] = useState<{
    tenantId: string;
    name: string;
    lastBillAt: string | null;
    billsLast24h: number;
    billsLast72h: number;
    healthStatus: string;
    churnWarning: boolean;
  }[]>([]);

  const load = useCallback(async () => {
    const current = ++generation.current;
    setLoading(true);
    setError('');
    try {
      const q = new URLSearchParams({
        page: String(page),
        limit: '50',
        ...(search ? { search } : {}),
        ...(status ? { status } : {}),
        ...(plan ? { plan } : {}),
        ...(health ? { health } : {}),
        ...(dealerCodeFilter ? { dealerCode: dealerCodeFilter } : {}),
      });
      const [m, list, ds, pulse] = await Promise.all([
        api.request(superAdmin ? '/admin/super/metrics' : '/admin/dealer/stats'),
        api.request(`${superAdmin ? '/admin/super/tenants' : '/admin/dealer/my-merchants'}?${q}`),
        superAdmin ? api.request('/admin/super/dealers') : Promise.resolve([]),
        superAdmin ? api.request('/admin/super/store-pulse').catch(() => []) : Promise.resolve([]),
      ]);
      if (current === generation.current) {
        setMetrics(m);
        setData(list);
        setDealers(ds);
        if (Array.isArray(pulse)) setStorePulse(pulse);
      }
    } catch (e) {
      if (current === generation.current) setError((e as Error).message);
    } finally {
      if (current === generation.current) setLoading(false);
    }
  }, [superAdmin, page, search, status, plan, health, dealerCodeFilter, version]);

  useEffect(() => {
    const timer = setTimeout(() => void load(), 250);
    return () => {
      clearTimeout(timer);
      ++generation.current;
    };
  }, [load]);

  useEffect(() => {
    if (tab !== 'telemetry' || !superAdmin) return;
    let active = true;
    const to = new Date();
    const from = new Date(to.getTime() - 30 * 86400_000);
    const q = `?from=${encodeURIComponent(from.toISOString())}&to=${encodeURIComponent(to.toISOString())}`;
    void Promise.all([
      api.request(`/admin/super/telemetry/overview${q}`),
      api.request(`/admin/super/telemetry/timeseries${q}`),
      api.request('/admin/super/store-pulse'),
    ])
      .then(([summary, series, pulse]) => {
        if (!active) return;
        setTelemetry(summary as TelemetryOverview);
        setTelemetrySeries(series);
        if (Array.isArray(pulse)) setStorePulse(pulse);
      })
      .catch((e: unknown) => {
        if (active) setError((e as Error).message);
      });
    return () => {
      active = false;
    };
  }, [tab, superAdmin, version]);

  const reportError = useCallback((message: string) => setError(message), []);

  const mutate = async (path: string, body: unknown, method = 'POST') => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await api.request(path, method, body);
      setCreatingDealer(false);
      setVersion(v => v + 1);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const submitOnboarding = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError('');
    setCreatedMerchant(null);
    try {
      const result = (await api.request('/admin/dealer/merchants', 'POST', {
        storeName: form.get('storeName'),
        ownerPhone: form.get('ownerPhone'),
        businessProfile: form.get('businessProfile'),
        initialPlan: form.get('initialPlan'),
      })) as CreatedMerchant;
      setCreatedMerchant(result);
      setVersion(v => v + 1);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const change = (merchant: Merchant, action: 'ACTIVATE' | 'EXTEND' | 'SUSPEND' | 'REACTIVATE', days?: number, targetPlan = 'pro_yearly') => {
    if (!window.confirm(`${action === 'ACTIVATE' ? `Activate ${targetPlan}` : action} for ${merchant.name}${days ? ` by ${days} days` : ''}?`)) return;
    void mutate(
      superAdmin ? `/admin/super/tenants/${merchant.id}/subscription` : '/admin/dealer/activate-merchant',
      superAdmin
        ? { action, ...(action === 'ACTIVATE' ? { plan: targetPlan } : {}), ...(days ? { days } : {}) }
        : { tenantId: merchant.id, plan: targetPlan },
    );
  };

  const exportCsv = () => {
    if (!data.items.length) return;
    const headers = ['Merchant Name', 'Slug', 'Phone', 'Business Type', 'Dealer Code', 'Plan', 'Status', 'Health', 'Valid Until', 'Days Remaining'];
    const rows = data.items.map(t => [
      `"${t.name.replace(/"/g, '""')}"`,
      `"${(t.slug || '').replace(/"/g, '""')}"`,
      `"${t.phone || ''}"`,
      `"${t.businessType || ''}"`,
      `"${t.dealerCode || 'Direct'}"`,
      `"${t.plan || ''}"`,
      `"${t.status || ''}"`,
      `"${t.health || ''}"`,
      `"${t.validUntil ? new Date(t.validUntil).toLocaleDateString('en-IN') : ''}"`,
      t.daysRemaining ?? '',
    ]);
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `novapos-merchants-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Filter items by quick pill
  const filteredMerchants = data.items.filter(m => {
    if (filterPill === 'active') return m.status === 'ACTIVE';
    if (filterPill === 'trial') return m.status === 'TRIAL';
    if (filterPill === 'expiring') return m.daysRemaining <= 7 && m.status !== 'EXPIRED';
    if (filterPill === 'at_risk') return m.health === 'at_risk' || m.health === 'churned';
    return true;
  });

  const totalBills24h = storePulse.reduce((sum, p) => sum + (p.billsLast24h || 0), 0);

  return (
    <div className="platform-shell">
      <aside className="platform-side">
        <strong>NovaPOS</strong>
        <p>Platform Command Center</p>
        <button aria-current={tab === 'merchants' ? 'page' : undefined} onClick={() => setTab('merchants')}>
          🏪 Merchants ({data.total})
        </button>
        {superAdmin && (
          <button aria-current={tab === 'dealers' ? 'page' : undefined} onClick={() => setTab('dealers')}>
            🤝 Partners & Dealers ({dealers.length})
          </button>
        )}
        {superAdmin && (
          <button aria-current={tab === 'telemetry' ? 'page' : undefined} onClick={() => setTab('telemetry')}>
            📊 Store Pulse & Telemetry
          </button>
        )}
        {!superAdmin && <button onClick={() => setOnboarding(true)}>+ Onboard Merchant</button>}
        <button onClick={onLogout} style={{ marginTop: 'auto' }}>
          Sign out
        </button>
      </aside>

      <main className="platform-main">
        <header>
          <div>
            <small style={{ color: '#58665d', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>
              {superAdmin ? 'Super Admin · Executive Suite' : `Dealer Portal · ${actor.name}`}
            </small>
            <h1 style={{ margin: '6px 0 0' }}>{superAdmin ? 'Platform Control & Merchant 360°' : 'My Merchant Network'}</h1>
            <p style={{ margin: '4px 0 0', color: '#58665d', fontSize: 13 }}>
              Real-time merchant billing activity, partner commission distribution, and license lifecycle.
            </p>
          </div>
          <div className="platform-header-actions">
            <button onClick={exportCsv} disabled={!data.items.length}>
              📥 Export CSV
            </button>
            <button onClick={() => setChangingPassword(true)}>Change Password</button>
            <button onClick={() => setVersion(v => v + 1)}>↻ Refresh</button>
            {!superAdmin && <button className="platform-primary" onClick={() => setOnboarding(true)}>+ Onboard Store</button>}
          </div>
        </header>

        {error && (
          <div className="error-banner" role="alert">
            {error} <button onClick={() => setVersion(v => v + 1)}>Retry</button>
            <button onClick={onLogout}>Sign in again</button>
          </div>
        )}

        {/* Executive KPI Bar */}
        {metrics && (
          <div className="platform-kpis" style={{ gridTemplateColumns: superAdmin ? 'repeat(5, minmax(0, 1fr))' : 'repeat(4, minmax(0, 1fr))' }}>
            <article>
              <small>Total Stores Onboarded</small>
              <strong>{metrics.totalStores}</strong>
            </article>
            <article>
              <small>{superAdmin ? 'Active Subscriptions' : 'Pro Merchants'}</small>
              <strong style={{ color: '#059669' }}>{metrics.proTenants ?? metrics.totalStores - (metrics.activeTrials || 0)}</strong>
            </article>
            <article>
              <small>Active Trials</small>
              <strong style={{ color: '#d97706' }}>{metrics.activeTrials}</strong>
            </article>
            <article>
              <small>{superAdmin ? 'Monthly Recurring Revenue' : 'Commission Earned'}</small>
              <strong>{money(superAdmin ? metrics.mrrMinor : metrics.estimatedCommissionMinor)}</strong>
            </article>
            {superAdmin && (
              <article>
                <small>Bills Punched (Last 24h)</small>
                <strong style={{ color: '#2563eb' }}>{totalBills24h}</strong>
              </article>
            )}
          </div>
        )}

        {loading && <p role="status">Refreshing real-time platform data…</p>}

        {tab === 'merchants' ? (
          <section>
            {/* Quick Filter Pills */}
            <div style={{ display: 'flex', gap: 8, margin: '14px 0', flexWrap: 'wrap' }}>
              <button
                style={{
                  background: filterPill === 'all' ? '#172924' : '#fff',
                  color: filterPill === 'all' ? '#fff' : '#17212b',
                  minHeight: 34,
                  padding: '6px 14px',
                  borderRadius: 20,
                  fontSize: 12,
                  fontWeight: 600,
                }}
                onClick={() => setFilterPill('all')}
              >
                All Merchants ({data.items.length})
              </button>
              <button
                style={{
                  background: filterPill === 'active' ? '#172924' : '#fff',
                  color: filterPill === 'active' ? '#fff' : '#17212b',
                  minHeight: 34,
                  padding: '6px 14px',
                  borderRadius: 20,
                  fontSize: 12,
                  fontWeight: 600,
                }}
                onClick={() => setFilterPill('active')}
              >
                ✓ Active Paid ({data.items.filter(m => m.status === 'ACTIVE').length})
              </button>
              <button
                style={{
                  background: filterPill === 'trial' ? '#172924' : '#fff',
                  color: filterPill === 'trial' ? '#fff' : '#17212b',
                  minHeight: 34,
                  padding: '6px 14px',
                  borderRadius: 20,
                  fontSize: 12,
                  fontWeight: 600,
                }}
                onClick={() => setFilterPill('trial')}
              >
                ⏳ In Trial ({data.items.filter(m => m.status === 'TRIAL').length})
              </button>
              <button
                style={{
                  background: filterPill === 'expiring' ? '#b91c1c' : '#fff',
                  color: filterPill === 'expiring' ? '#fff' : '#b91c1c',
                  borderColor: '#fca5a5',
                  minHeight: 34,
                  padding: '6px 14px',
                  borderRadius: 20,
                  fontSize: 12,
                  fontWeight: 600,
                }}
                onClick={() => setFilterPill('expiring')}
              >
                ⚠ Expiring Soon ({data.items.filter(m => m.daysRemaining <= 7 && m.status !== 'EXPIRED').length})
              </button>
              <button
                style={{
                  background: filterPill === 'at_risk' ? '#ea580c' : '#fff',
                  color: filterPill === 'at_risk' ? '#fff' : '#ea580c',
                  minHeight: 34,
                  padding: '6px 14px',
                  borderRadius: 20,
                  fontSize: 12,
                  fontWeight: 600,
                }}
                onClick={() => setFilterPill('at_risk')}
              >
                ⚡ Churn Risk ({data.items.filter(m => m.health === 'at_risk' || m.health === 'churned').length})
              </button>
            </div>

            {dealerCodeFilter && (
              <p>
                Showing merchants for <strong>{dealerCodeFilter}</strong>.{' '}
                <button onClick={() => setDealerCodeFilter('')}>Clear dealer filter</button>
              </p>
            )}

            <div className="platform-filters">
              <input
                aria-label="Search merchants"
                placeholder="Search by store name, phone, slug or dealer..."
                value={search}
                onChange={e => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
              />
              <select
                aria-label="License status"
                value={status}
                onChange={e => {
                  setStatus(e.target.value);
                  setPage(1);
                }}
              >
                {['', 'TRIAL', 'ACTIVE', 'EXPIRED', 'SUSPENDED'].map(s => (
                  <option key={s} value={s}>
                    {s || 'All statuses'}
                  </option>
                ))}
              </select>
              <select
                aria-label="Merchant plan"
                value={plan}
                onChange={e => {
                  setPlan(e.target.value);
                  setPage(1);
                }}
              >
                {['', 'starter_monthly', 'pro_yearly', 'enterprise_yearly'].map(value => (
                  <option key={value} value={value}>
                    {value ? value.replace('_', ' ') : 'All plans'}
                  </option>
                ))}
              </select>
              <select
                aria-label="Store health"
                value={health}
                onChange={e => {
                  setHealth(e.target.value);
                  setPage(1);
                }}
              >
                {['', 'healthy', 'idle', 'at_risk', 'churned'].map(value => (
                  <option key={value} value={value}>
                    {value ? value.replace('_', ' ') : 'All health states'}
                  </option>
                ))}
              </select>
            </div>

            <div className="platform-table">
              <table>
                <thead>
                  <tr>
                    <th>Merchant & Profile</th>
                    <th>Owner Contact</th>
                    <th>Partner</th>
                    <th>Plan & Validity</th>
                    <th>Health</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMerchants.map(t => {
                    const cleanPhone = (t.phone || '').replace(/\D/g, '');
                    const waUrl = cleanPhone
                      ? `https://wa.me/91${cleanPhone}?text=Hello%20${encodeURIComponent(t.name)}%2C%20regarding%20your%20NovaPOS%20account...`
                      : null;

                    return (
                      <tr
                        key={t.id}
                        role="button"
                        tabIndex={0}
                        style={{ cursor: 'pointer' }}
                        onClick={() => setSelectedMerchant(t)}
                        onKeyDown={e => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            setSelectedMerchant(t);
                          }
                        }}
                      >
                        <td>
                          <strong>{t.name}</strong>
                          <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 4 }}>
                            <span style={{ fontSize: 11, background: '#e2e8f0', padding: '2px 6px', borderRadius: 4 }}>
                              {t.businessType || 'Retail'}
                            </span>
                            <code style={{ fontSize: 11, color: '#64748b' }}>{t.slug || t.id.slice(0, 8)}</code>
                          </div>
                        </td>
                        <td onClick={e => e.stopPropagation()}>
                          <div style={{ fontWeight: 600 }}>{t.phone || 'No phone recorded'}</div>
                          {cleanPhone && (
                            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                              {waUrl && (
                                <a
                                  href={waUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  style={{ color: '#16a34a', fontSize: 12, fontWeight: 700, textDecoration: 'none' }}
                                  title="Chat on WhatsApp"
                                >
                                  💬 WhatsApp
                                </a>
                              )}
                              <a
                                href={`tel:${cleanPhone}`}
                                style={{ color: '#0f766e', fontSize: 12, fontWeight: 700, textDecoration: 'none' }}
                                title="Call Owner"
                              >
                                📞 Call
                              </a>
                            </div>
                          )}
                        </td>
                        <td>
                          <span style={{ fontSize: 12, fontWeight: 600 }}>{t.dealerCode ? `Partner: ${t.dealerCode}` : 'Direct'}</span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span className={`license-tag ${t.status.toLowerCase()}`}>{t.status}</span>
                            <span style={{ fontSize: 12, fontWeight: 700, color: t.daysRemaining <= 7 ? '#dc2626' : '#16a34a' }}>
                              {t.daysRemaining}d left
                            </span>
                          </div>
                          <div style={{ fontSize: 11, color: '#58665d', marginTop: 3 }}>
                            {t.plan.replace('_', ' ')} · Until {new Date(t.validUntil).toLocaleDateString('en-IN')}
                          </div>
                        </td>
                        <td>
                          <span className={`license-tag ${(t.health || 'healthy').toLowerCase()}`}>
                            {(t.health || 'healthy').replace('_', ' ')}
                          </span>
                        </td>
                        <td onClick={e => e.stopPropagation()}>
                          <div className="platform-actions">
                            <button
                              style={{ background: '#172924', color: '#fff', fontWeight: 700, fontSize: 12 }}
                              onClick={() => setSelectedMerchant(t)}
                            >
                              🔍 View 360°
                            </button>
                            <button disabled={busy || loading} onClick={() => change(t, 'ACTIVATE', undefined, 'pro_yearly')}>
                              Activate 1Y
                            </button>
                            {superAdmin && (
                              <>
                                <button disabled={busy || loading} onClick={() => change(t, 'EXTEND', 30)}>
                                  +30D
                                </button>
                                <button
                                  disabled={busy || loading || t.status === 'SUSPENDED'}
                                  onClick={() => {
                                    setError('');
                                    setImpersonatingMerchant(t);
                                  }}
                                  title="Enter merchant backoffice as owner"
                                >
                                  Support View
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {!loading && !filteredMerchants.length && (
              <p style={{ textAlign: 'center', padding: 24, color: '#64748b' }}>No merchants match this filter.</p>
            )}

            <div className="platform-actions">
              <button disabled={page === 1 || loading} onClick={() => setPage(p => p - 1)}>
                Previous
              </button>
              <span>
                Page {page} · {data.total} total stores
              </span>
              <button disabled={page * 50 >= data.total || loading} onClick={() => setPage(p => p + 1)}>
                Next
              </button>
            </div>
          </section>
        ) : tab === 'dealers' ? (
          <section>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h2 style={{ margin: 0 }}>Registered Channel Partners</h2>
              <button className="platform-primary" onClick={() => setCreatingDealer(true)}>
                + Add Official Dealer
              </button>
            </div>
            <div className="platform-table">
              <table>
                <thead>
                  <tr>
                    <th>Dealer Name & Code</th>
                    <th>Territory / City</th>
                    <th>Tier</th>
                    <th>Licenses Quota</th>
                    <th>Merchants</th>
                    <th>Total Activations</th>
                    <th>Commission %</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {dealers.map(d => (
                    <tr
                      key={d.id}
                      tabIndex={0}
                      role="button"
                      aria-label={`Open ${d.name} dealer details`}
                      onClick={() => setSelectedDealerId(d.id)}
                      onKeyDown={e => {
                        if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
                          e.preventDefault();
                          setSelectedDealerId(d.id);
                        }
                      }}
                    >
                      <td>
                        <strong>{d.name}</strong>
                        <div>
                          {d.dealerCode} · {d.phone} · {d.email}
                        </div>
                      </td>
                      <td>{[d.city, d.territory].filter(Boolean).join(', ') || '—'}</td>
                      <td>
                        <span className="license-tag active" style={{ textTransform: 'capitalize' }}>
                          {d.tier}
                        </span>
                      </td>
                      <td>
                        <strong>{d.quotaConsumed}</strong> / {d.quotaGranted}
                      </td>
                      <td>{d.merchantCount} stores</td>
                      <td>{d.activationVolume}</td>
                      <td>
                        {d.commissionPercent}%{' '}
                        <button
                          disabled={busy}
                          onClick={e => {
                            e.stopPropagation();
                            const value = window.prompt('Commission percentage (0–100)', String(d.commissionPercent));
                            if (
                              value !== null &&
                              value.trim() &&
                              Number.isInteger(Number(value)) &&
                              Number(value) >= 0 &&
                              Number(value) <= 100
                            ) {
                              void mutate(`/admin/super/dealers/${d.id}`, { commissionPercent: Number(value) }, 'PATCH');
                            }
                          }}
                        >
                          Edit
                        </button>
                      </td>
                      <td onClick={e => e.stopPropagation()}>
                        <div className="platform-actions">
                          <button onClick={() => setSelectedDealerId(d.id)}>Inspect 360°</button>
                          <button
                            disabled={busy}
                            onClick={() =>
                              void mutate(`/admin/super/dealers/${d.id}`, { status: d.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE' }, 'PATCH')
                            }
                          >
                            {d.status === 'ACTIVE' ? 'Suspend' : 'Reactivate'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : (
          <PlatformTelemetryView overview={telemetry} series={telemetrySeries} pulse={storePulse} />
        )}

        {/* Merchant 360 Drawer */}
        <MerchantDetailDrawer
          merchant={selectedMerchant}
          pulseData={storePulse.find(p => p.tenantId === selectedMerchant?.id)}
          superAdmin={superAdmin}
          busy={busy}
          onClose={() => setSelectedMerchant(null)}
          onChangeLicense={(m, action, days, targetPlan) => {
            change(m, action, days, targetPlan);
            setSelectedMerchant(null);
          }}
          onStartImpersonate={m => {
            setSelectedMerchant(null);
            setError('');
            setImpersonatingMerchant(m);
          }}
        />

        {/* Dealer 360 Drawer */}
        <DealerDetailDrawer
          dealerId={selectedDealerId}
          refreshVersion={version}
          onClose={() => setSelectedDealerId(null)}
          onChanged={() => setVersion(v => v + 1)}
          onError={reportError}
        />

        {/* Dealer Creation Modal */}
        {creatingDealer && (
          <div className="platform-modal" role="dialog" aria-modal="true" aria-label="Create dealer">
            <form
              onSubmit={e => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                void mutate('/admin/super/dealers', {
                  name: f.get('name'),
                  phone: f.get('phone'),
                  email: f.get('email'),
                  password: f.get('password'),
                  dealerCode: f.get('dealerCode'),
                  commissionPercent: Number(f.get('commissionPercent')),
                  tier: f.get('tier'),
                  territory: f.get('territory'),
                  city: f.get('city'),
                });
              }}
            >
              <h2>Register New Channel Partner / Dealer</h2>
              {[
                ['name', 'Dealer / Company Name', 'text'],
                ['phone', 'Mobile Number (10 digits)', 'tel'],
                ['email', 'Email Address', 'email'],
                ['password', 'Portal Login Password', 'password'],
                ['dealerCode', 'Dealer Referral Code (e.g. DLR-101)', 'text'],
                ['commissionPercent', 'Commission Percentage (e.g. 25)', 'number'],
                ['territory', 'Territory / Region', 'text'],
                ['city', 'City', 'text'],
              ].map(([name, label, type]) => (
                <label key={name}>
                  {label}
                  <input
                    required={!['territory', 'city'].includes(name)}
                    name={name}
                    type={type}
                    min={type === 'number' ? 0 : undefined}
                    max={type === 'number' ? 100 : undefined}
                    minLength={name === 'password' ? 8 : undefined}
                    defaultValue={name === 'commissionPercent' ? 25 : undefined}
                  />
                </label>
              ))}
              <label>
                Partner Tier
                <select name="tier" defaultValue="silver">
                  <option value="silver">Silver Partner (Basic)</option>
                  <option value="gold">Gold Partner (High Volume)</option>
                  <option value="platinum">Platinum Partner (Enterprise)</option>
                </select>
              </label>
              {error && <p role="alert">{error}</p>}
              <button disabled={busy} className="platform-primary">
                Create Dealer Account
              </button>
              <button type="button" disabled={busy} onClick={() => setCreatingDealer(false)}>
                Cancel
              </button>
            </form>
          </div>
        )}

        {/* Impersonation Modal */}
        {impersonatingMerchant && (
          <div className="platform-modal" role="dialog" aria-modal="true" aria-label="Start support session">
            <form
              onSubmit={async e => {
                e.preventDefault();
                if (busy) return;
                const reason = String(new FormData(e.currentTarget).get('reason') ?? '').trim();
                setBusy(true);
                setError('');
                try {
                  const access = (await api.request(
                    `/admin/super/tenants/${impersonatingMerchant.id}/impersonate`,
                    'POST',
                    { reason },
                  )) as ImpersonationAccess;
                  setImpersonatingMerchant(null);
                  onImpersonate(access);
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              <h2>Start Audited Support Session</h2>
              <p>
                You are entering <strong>{impersonatingMerchant.name}</strong> as its store owner. All modifications to menu items, taxes, and settings will be logged in the security audit ledger.
              </p>
              <label>
                Reason for Store Access (Required for Compliance)
                <textarea
                  name="reason"
                  required
                  minLength={10}
                  maxLength={500}
                  rows={4}
                  placeholder="E.g.: Customer requested help configuring 58mm Bluetooth thermal printer profile."
                />
              </label>
              {error && <p role="alert">{error}</p>}
              <button disabled={busy} className="platform-primary">
                {busy ? 'Starting session…' : 'Enter Merchant Backoffice'}
              </button>
              <button type="button" disabled={busy} onClick={() => setImpersonatingMerchant(null)}>
                Cancel
              </button>
            </form>
          </div>
        )}

        {/* Merchant Onboarding Modal */}
        {onboarding && (
          <div className="platform-modal" role="dialog" aria-modal="true" aria-label="Onboard new merchant">
            <form onSubmit={submitOnboarding}>
              {createdMerchant ? (
                <>
                  <h2>Store Onboarded Successfully!</h2>
                  <p>
                    <strong>{createdMerchant.tenant.name}</strong> is now live on the{' '}
                    {createdMerchant.plan === 'trial' ? '14-day free trial' : createdMerchant.plan.replace('_', ' ')} plan.
                  </p>
                  <p>
                    Store ID: <code>{createdMerchant.tenant.slug}</code>
                  </p>
                  <p>
                    Owner Mobile: <code>{createdMerchant.owner.phone}</code>
                  </p>
                  <p>
                    Initial Owner PIN (Share with store owner): <strong>{createdMerchant.owner.initialPin}</strong>
                  </p>
                  <button
                    type="button"
                    className="platform-primary"
                    onClick={() => {
                      setOnboarding(false);
                      setCreatedMerchant(null);
                    }}
                  >
                    Done
                  </button>
                </>
              ) : (
                <>
                  <h2>Onboard New Merchant</h2>
                  <label>
                    Store Name
                    <input name="storeName" required minLength={2} maxLength={120} placeholder="Sri Krishna Mess & Bakery" />
                  </label>
                  <label>
                    Owner 10-Digit Mobile Number
                    <input
                      name="ownerPhone"
                      type="tel"
                      inputMode="numeric"
                      pattern="[0-9]{10}"
                      minLength={10}
                      maxLength={10}
                      required
                      placeholder="9848012345"
                    />
                  </label>
                  <label>
                    Business Profile
                    <select name="businessProfile" defaultValue="restaurant">
                      <option value="restaurant">Restaurant / Mess / Tiffins / Cafe</option>
                      <option value="retail">Kirana / Retail / Supermarket</option>
                    </select>
                  </label>
                  <label>
                    Initial Subscription Tier
                    <select name="initialPlan" defaultValue="trial">
                      <option value="trial">14-Day Full Free Trial</option>
                      <option value="starter_monthly">Immediate Activation — Starter Monthly (₹499)</option>
                      <option value="pro_yearly">Immediate Activation — Pro Yearly (₹3,999)</option>
                    </select>
                  </label>
                  <p style={{ fontSize: 12, color: '#58665d' }}>
                    An initial 4-digit PIN will be generated and displayed once the store is created.
                  </p>
                  {error && <p role="alert">{error}</p>}
                  <button disabled={busy} className="platform-primary">
                    {busy ? 'Creating store…' : 'Create Merchant Account'}
                  </button>
                  <button type="button" disabled={busy} onClick={() => setOnboarding(false)}>
                    Cancel
                  </button>
                </>
              )}
            </form>
          </div>
        )}

        {/* Change Password Modal */}
        {changingPassword && (
          <div className="platform-modal" role="dialog" aria-modal="true" aria-label="Change platform password">
            <form
              onSubmit={async e => {
                e.preventDefault();
                if (busy) return;
                const f = new FormData(e.currentTarget);
                setBusy(true);
                setError('');
                try {
                  if (f.get('newPassword') !== f.get('confirmPassword')) {
                    throw new Error('The new password entries do not match.');
                  }
                  await api.changePassword(String(f.get('currentPassword')), String(f.get('newPassword')));
                  setChangingPassword(false);
                  alert('Password updated successfully.');
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              <h2>Change Portal Password</h2>
              <label>
                Current Password
                <input name="currentPassword" type="password" autoComplete="current-password" required maxLength={128} />
              </label>
              <label>
                New Password (Min 8 Characters)
                <input name="newPassword" type="password" autoComplete="new-password" required minLength={8} maxLength={128} />
              </label>
              <label>
                Confirm New Password
                <input name="confirmPassword" type="password" autoComplete="new-password" required minLength={8} maxLength={128} />
              </label>
              {error && <p role="alert">{error}</p>}
              <button disabled={busy} className="platform-primary">
                Update Password
              </button>
              <button type="button" disabled={busy} onClick={() => setChangingPassword(false)}>
                Cancel
              </button>
            </form>
          </div>
        )}
      </main>
    </div>
  );
}

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { platformApi as api, type Actor, type ImpersonationAccess } from '../lib/platformApi';
import { DealerDetailDrawer } from './DealerDetailDrawer';
import { PlatformTelemetryView } from './PlatformTelemetryView';

interface Merchant {
  id: string;
  name: string;
  phone: string;
  dealerCode: string;
  businessType: string;
  plan: string;
  health: string;
  status: string;
  validUntil: string;
  daysRemaining: number;
}
interface Dealer {
  id: string;
  name: string;
  email: string;
  phone: string;
  dealerCode: string;
  status: string;
  commissionPercent: number;
  tier: 'silver'|'gold'|'platinum';
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
const money = (minor: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(minor / 100);

export function MerchantsManagement({ actor, onLogout, onImpersonate }: { actor: Actor; onLogout: () => void; onImpersonate: (access: ImpersonationAccess) => void }) {
  const superAdmin = actor.role === 'SUPER_ADMIN';
  const [tab, setTab] = useState<'merchants'|'dealers'|'telemetry'>('merchants');
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
  const [onboarding, setOnboarding] = useState(false);
  const [createdMerchant, setCreatedMerchant] = useState<CreatedMerchant | null>(null);
  const [changingPassword, setChangingPassword] = useState(false);
  const [version, setVersion] = useState(0);
  const generation = useRef(0);
  const [selectedDealerId, setSelectedDealerId] = useState<string | null>(null);
  const [telemetry, setTelemetry] = useState<TelemetryOverview | null>(null);
  const [telemetrySeries, setTelemetrySeries] = useState<{day:string;landingVisits:number;trialSignups:number;trialConversions:number}[]>([]);
  const [storePulse, setStorePulse] = useState<{tenantId:string;name:string;lastBillAt:string|null;billsLast24h:number;billsLast72h:number;healthStatus:string;churnWarning:boolean}[]>([]);

  const load = useCallback(async () => {
    const current = ++generation.current;
    setLoading(true);
    setError('');
    try {
      const q = new URLSearchParams({
        page: String(page),
        limit: '25',
        ...(search ? { search } : {}),
        ...(status ? { status } : {}),
        ...(plan ? { plan } : {}),
        ...(health ? { health } : {}),
        ...(dealerCodeFilter ? { dealerCode: dealerCodeFilter } : {}),
      });
      const [m, list, ds] = await Promise.all([
        api.request(superAdmin ? '/admin/super/metrics' : '/admin/dealer/stats'),
        api.request(`${superAdmin ? '/admin/super/tenants' : '/admin/dealer/my-merchants'}?${q}`),
        superAdmin ? api.request('/admin/super/dealers') : Promise.resolve([]),
      ]);
      if (current === generation.current) {
        setMetrics(m);
        setData(list);
        setDealers(ds);
      }
    } catch (e) {
      if (current === generation.current) setError((e as Error).message);
    } finally {
      if (current === generation.current) setLoading(false);
    }
  }, [superAdmin, page, search, status, plan, health, dealerCodeFilter, version]);

  useEffect(() => {
    const timer = setTimeout(() => void load(), 250);
    return () => { clearTimeout(timer); ++generation.current; };
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
    ]).then(([summary, series, pulse]) => {
      if (!active) return;
      setTelemetry(summary as TelemetryOverview);
      setTelemetrySeries(series);
      setStorePulse(pulse);
    }).catch((e: unknown) => {
      if (active) setError((e as Error).message);
    });
    return () => { active = false; };
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
      const result = await api.request('/admin/dealer/merchants', 'POST', {
        storeName: form.get('storeName'),
        ownerPhone: form.get('ownerPhone'),
        businessProfile: form.get('businessProfile'),
        initialPlan: form.get('initialPlan'),
      }) as CreatedMerchant;
      setCreatedMerchant(result);
      setVersion(v => v + 1);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const change = (merchant: Merchant, action: string, days?: number, plan = 'pro_yearly') => {
    if (!window.confirm(`${action === 'ACTIVATE' ? `Activate ${plan}` : action} for ${merchant.name}${days ? ` by ${days} days` : ''}?`)) return;
    void mutate(
      superAdmin ? `/admin/super/tenants/${merchant.id}/subscription` : '/admin/dealer/activate-merchant',
      superAdmin ? { action, ...(action === 'ACTIVATE' ? { plan } : {}), ...(days ? { days } : {}) } : { tenantId: merchant.id, plan },
    );
  };

  return (
    <div className="platform-shell">
      <aside className="platform-side">
        <strong>NovaPOS</strong>
        <p>{superAdmin ? 'Platform control' : 'Dealer workspace'}</p>
        <button onClick={() => { setSelectedDealerId(null); setTab('merchants'); setDealerCodeFilter(''); }}>Merchants</button>
        {superAdmin && <><button onClick={() => { setSelectedDealerId(null); setTab('dealers'); }}>Dealers</button><button onClick={() => { setSelectedDealerId(null); setTab('telemetry'); }}>Telemetry</button></>}
        <button onClick={onLogout}>Sign out</button>
      </aside>
      <main className="platform-main">
        <header>
          <div>
            <small>{actor.role.replace('_', ' ')}</small>
            <h1>{actor.name}</h1>
            <p>{actor.dealerCode ? `Dealer code · ${actor.dealerCode}` : 'Merchant licenses and partner operations'}</p>
          </div>
          <div className="platform-header-actions">
            <button onClick={() => setChangingPassword(true)}>Change Password</button>
            {actor.role === 'DEALER' && <button className="platform-primary platform-onboard-button" onClick={() => { setCreatedMerchant(null); setError(''); setOnboarding(true); }}>+ Onboard New Merchant</button>}
            <button onClick={() => setVersion(v => v + 1)} disabled={loading}>Refresh</button>
          </div>
        </header>
        {error && <div className="error-banner" role="alert">{error} <button onClick={() => setVersion(v => v + 1)}>Retry</button><button onClick={onLogout}>Sign in again</button></div>}
        {metrics && <div className="platform-kpis">
          <article><small>Total stores onboarded</small><strong>{metrics.totalStores}</strong></article>
          <article><small>{superAdmin ? 'Active trials' : 'Active subscriptions'}</small><strong>{superAdmin ? metrics.activeTrials : metrics.proTenants}</strong></article>
          <article><small>{superAdmin ? 'Expired trials' : 'Expiring soon (48h)'}</small><strong>{superAdmin ? metrics.expiredTrials : metrics.expiring48h}</strong></article>
          <article><small>{superAdmin ? 'Registered dealers' : 'Paid activations this month'}</small><strong>{superAdmin ? metrics.totalDealers : metrics.monthlyActivations}</strong></article>
          <article><small>{superAdmin ? 'Monthly recurring revenue' : 'Monthly commission earned'}</small><strong>{money(superAdmin ? metrics.mrrMinor : metrics.estimatedCommissionMinor)}</strong></article>
        </div>}
        <p className="platform-note">Revenue and commission are estimates from license activations, not confirmation of payment collection.</p>
        {loading && <p role="status">Refreshing records…</p>}
        {tab === 'merchants' ? (
          <section>
            {dealerCodeFilter && <p>Showing merchants for {dealerCodeFilter}. <button onClick={() => setDealerCodeFilter('')}>Clear dealer filter</button></p>}
            <div className="platform-filters">
              <input aria-label="Search merchants" placeholder="Store name, phone or dealer code" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
              <select aria-label="License status" value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}>
                {['', 'TRIAL', 'ACTIVE', 'EXPIRED', 'SUSPENDED'].map(s => <option key={s} value={s}>{s || 'All statuses'}</option>)}
              </select>
              <select aria-label="Merchant plan" value={plan} onChange={e => { setPlan(e.target.value); setPage(1); }}>
                {['', 'starter_monthly', 'pro_yearly', 'enterprise_yearly'].map(value => <option key={value} value={value}>{value || 'All plans'}</option>)}
              </select>
              <select aria-label="Store health" value={health} onChange={e => { setHealth(e.target.value); setPage(1); }}>
                {['', 'healthy', 'idle', 'at_risk', 'churned'].map(value => <option key={value} value={value}>{value ? value.replace('_',' ') : 'All health states'}</option>)}
              </select>
            </div>
            <div className="platform-table"><table><thead><tr><th>Merchant</th><th>Dealer</th><th>Plan</th><th>License</th><th>Health</th><th>Valid until</th><th>Actions</th></tr></thead>
              <tbody>{data.items.map(t => <tr key={t.id}>
                <td><strong>{t.name}</strong><div>{t.phone || 'Phone not recorded'} · {t.businessType}</div></td>
                <td>{t.dealerCode || 'Direct'}</td>
                <td>{t.plan.replace('_',' ')}</td>
                <td><span className={`license-tag ${t.status.toLowerCase()}`}>{t.status}</span><div>{t.daysRemaining} days left</div></td>
                <td>{t.health.replace('_',' ')}</td>
                <td>{new Date(t.validUntil).toLocaleDateString('en-IN')}</td>
                <td><div className="platform-actions">
                  <button disabled={busy || loading} onClick={() => change(t, 'ACTIVATE')}>Activate 1-Year Pro</button>
                  <button disabled={busy || loading} onClick={() => change(t, 'ACTIVATE', undefined, 'starter_monthly')}>Activate Monthly</button>
                  {superAdmin && <>{[30, 90, 365].map(days => <button key={days} disabled={busy || loading} onClick={() => change(t, 'EXTEND', days)}>+{days} Days</button>)}
                    <button disabled={busy || loading} onClick={() => change(t, t.status === 'SUSPENDED' ? 'REACTIVATE' : 'SUSPEND')}>{t.status === 'SUSPENDED' ? 'Reactivate' : 'Suspend'}</button>
                    <button disabled={busy || loading || t.status === 'SUSPENDED'} onClick={() => { setError(''); setImpersonatingMerchant(t); }}>Support view</button></>}
                </div></td>
              </tr>)}</tbody>
            </table></div>
            {!loading && !data.items.length && <p>No merchants match this filter.</p>}
            <div className="platform-actions"><button disabled={page === 1 || loading} onClick={() => setPage(p => p - 1)}>Previous</button><span>Page {page} · {data.total} stores</span><button disabled={page * 25 >= data.total || loading} onClick={() => setPage(p => p + 1)}>Next</button></div>
          </section>
        ) : tab === 'dealers' ? (
          <section>
            <button onClick={() => setCreatingDealer(true)}>+ New Dealer</button>
            <div className="platform-table"><table><thead><tr><th>Dealer</th><th>Territory</th><th>Tier</th><th>Quota</th><th>Stores</th><th>Activations</th><th>Commission</th><th>Status</th></tr></thead>
              <tbody>{dealers.map(d => <tr key={d.id} tabIndex={0} role="button" aria-label={`Open ${d.name} dealer details`}
                onClick={() => setSelectedDealerId(d.id)}
                onKeyDown={e => { if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); setSelectedDealerId(d.id); } }}>
                <td>{d.name}<div>{d.email} · {d.phone}</div></td><td>{[d.city,d.territory].filter(Boolean).join(', ') || '—'}</td>
                <td>{d.tier}</td><td>{d.quotaConsumed}/{d.quotaGranted}</td><td>{d.merchantCount}</td><td>{d.activationVolume}</td>
                <td>{d.commissionPercent}% <button disabled={busy} onClick={e => { e.stopPropagation(); const value = window.prompt('Commission percentage (0–100)', String(d.commissionPercent)); if (value !== null && value.trim() && Number.isInteger(Number(value)) && Number(value) >= 0 && Number(value) <= 100) void mutate(`/admin/super/dealers/${d.id}`, { commissionPercent: Number(value) }, 'PATCH'); }}>Edit</button></td>
                <td><button disabled={busy} onClick={e => { e.stopPropagation(); void mutate(`/admin/super/dealers/${d.id}`, { status: d.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE' }, 'PATCH'); }}>{d.status === 'ACTIVE' ? 'Suspend' : 'Reactivate'}</button></td>
              </tr>)}</tbody>
            </table></div>
          </section>
        ) : (
          <PlatformTelemetryView overview={telemetry} series={telemetrySeries} pulse={storePulse} />
        )}
        {creatingDealer && <div className="platform-modal" role="dialog" aria-modal="true" aria-label="Create dealer"><form onSubmit={e => { e.preventDefault(); const f = new FormData(e.currentTarget); void mutate('/admin/super/dealers', { name: f.get('name'), phone: f.get('phone'), email: f.get('email'), password: f.get('password'), dealerCode: f.get('dealerCode'), commissionPercent: Number(f.get('commissionPercent')), tier:f.get('tier'), territory:f.get('territory'), city:f.get('city') }); }}>
          <h2>New dealer</h2>{[['name', 'Name', 'text'], ['phone', 'Phone', 'tel'], ['email', 'Email', 'email'], ['password', 'Password', 'password'], ['dealerCode', 'Dealer code', 'text'], ['commissionPercent', 'Commission %', 'number'], ['territory', 'Territory', 'text'], ['city', 'City', 'text']].map(([name, label, type]) => <label key={name}>{label}<input required={!['territory','city'].includes(name)} name={name} type={type} min={type === 'number' ? 0 : undefined} max={type === 'number' ? 100 : undefined} minLength={name === 'password' ? 8 : undefined} defaultValue={name === 'commissionPercent' ? 20 : undefined} /></label>)}
          <label>Tier<select name="tier" defaultValue="silver"><option value="silver">Silver</option><option value="gold">Gold</option><option value="platinum">Platinum</option></select></label>
          {error && <p role="alert">{error}</p>}<button disabled={busy}>Create dealer</button><button type="button" disabled={busy} onClick={() => setCreatingDealer(false)}>Cancel</button>
        </form></div>}
        {impersonatingMerchant && <div className="platform-modal" role="dialog" aria-modal="true" aria-label="Start support session"><form onSubmit={async e => {
          e.preventDefault();
          if (busy) return;
          const reason = String(new FormData(e.currentTarget).get('reason') ?? '').trim();
          setBusy(true);
          setError('');
          try {
            const access = await api.request(`/admin/super/tenants/${impersonatingMerchant.id}/impersonate`, 'POST', { reason }) as ImpersonationAccess;
            setImpersonatingMerchant(null);
            onImpersonate(access);
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}>
          <h2>Start support session</h2>
          <p>You will enter {impersonatingMerchant.name} as its owner. All actions are audited. Access expires after 10 minutes.</p>
          <label>Reason for access<textarea name="reason" required minLength={10} maxLength={500} rows={4} placeholder="Describe the support request and why owner-level access is needed." /></label>
          {error && <p role="alert">{error}</p>}
          <button disabled={busy}>{busy ? 'Starting support session…' : 'Start audited support session'}</button>
          <button type="button" disabled={busy} onClick={() => setImpersonatingMerchant(null)}>Cancel</button>
        </form></div>}
        {onboarding && <div className="platform-modal" role="dialog" aria-modal="true" aria-label="Onboard new merchant"><form onSubmit={submitOnboarding}>
          {createdMerchant ? <>
            <h2>Merchant onboarded</h2>
            <p><strong>{createdMerchant.tenant.name}</strong> is ready on the {createdMerchant.plan === 'trial' ? '14-day free trial' : createdMerchant.plan.replace('_', ' ')} plan.</p>
            <p>Store ID: <code>{createdMerchant.tenant.slug}</code></p>
            <p>Owner mobile: <code>{createdMerchant.owner.phone}</code></p>
            <p>Initial owner PIN (share securely, shown once): <strong>{createdMerchant.owner.initialPin}</strong></p>
            <button type="button" onClick={() => { setOnboarding(false); setCreatedMerchant(null); }}>Done</button>
          </> : <>
            <h2>Onboard New Merchant</h2>
            <label>Store name<input name="storeName" required minLength={2} maxLength={120} placeholder="Sri Krishna Bakery" /></label>
            <label>Merchant owner mobile number<input name="ownerPhone" type="tel" inputMode="numeric" pattern="[0-9]{10}" minLength={10} maxLength={10} required placeholder="10-digit mobile number" /></label>
            <label>Business profile<select name="businessProfile" defaultValue="restaurant"><option value="restaurant">Restaurant (QSR / Dine-in)</option><option value="retail">Retail / Grocery</option></select></label>
            <label>Initial plan<select name="initialPlan" defaultValue="trial"><option value="trial">14-Day Free Trial</option><option value="starter_monthly">Immediate Paid Activation — Starter Monthly</option><option value="pro_yearly">Immediate Paid Activation — Pro Yearly</option></select></label>
            <p>The initial owner PIN will be generated securely and shown once after creation.</p>
            {error && <p role="alert">{error}</p>}
            <button disabled={busy}>{busy ? 'Creating merchant…' : 'Create merchant'}</button><button type="button" disabled={busy} onClick={() => setOnboarding(false)}>Cancel</button>
          </>}
        </form></div>}
        {changingPassword && <div className="platform-modal" role="dialog" aria-modal="true" aria-label="Change platform password"><form onSubmit={async e => {
          e.preventDefault();
          if (busy) return;
          const f = new FormData(e.currentTarget);
          setBusy(true);
          setError('');
          try {
            if (f.get('newPassword') !== f.get('confirmPassword')) throw new Error('The new password entries do not match.');
            await api.changePassword(String(f.get('currentPassword')), String(f.get('newPassword')));
            setChangingPassword(false);
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}>
          <h2>Change Password</h2>
          <label>Current password<input name="currentPassword" type="password" autoComplete="current-password" required maxLength={128} /></label>
          <label>New password<input name="newPassword" type="password" autoComplete="new-password" required minLength={8} maxLength={128} /></label>
          <label>Confirm new password<input name="confirmPassword" type="password" autoComplete="new-password" required minLength={8} maxLength={128} /></label>
          {error && <p role="alert">{error}</p>}
          <button disabled={busy}>Update password</button><button type="button" disabled={busy} onClick={() => setChangingPassword(false)}>Cancel</button>
        </form></div>}
        <DealerDetailDrawer dealerId={selectedDealerId} refreshVersion={version} onClose={() => setSelectedDealerId(null)}
          onChanged={() => setVersion(v => v + 1)} onError={reportError} />
      </main>
    </div>
  );
}

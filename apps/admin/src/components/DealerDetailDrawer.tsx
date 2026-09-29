import { useEffect, useState } from 'react';
import { platformApi } from '../lib/platformApi';

interface Dealer360 {
  dealer: {
    id: string; name: string; email: string; phone: string; dealerCode: string; status: string;
    tier: string; territory: string | null; city: string | null; onboardingDate: string; commissionPercent: number;
  };
  allocations: { id: string; grantedSeats: number; consumedSeats: number; remainingSeats: number; status: string; grantedAt: string; expiresAt: string | null; note: string | null }[];
  quota: { granted: number; consumed: number; remaining: number };
  tenants: { tenantId: string; name: string; slug: string; status: string; onboardedAt: string; convertedAt: string | null; isActivePaid: boolean; trialEndsAt: string | null }[];
  cohorts: { month: string; onboarded: number; converted: number; conversionRate: number }[];
  payouts: { id: string; periodStart: string; periodEnd: string; grossCommissionMinor: number; netPayableMinor: number; status: string; utrReference: string | null }[];
  commissionLedger: { id: string; periodMonth: string; grossAmountMinor: number; commissionRate: string; commissionAmountMinor: number; status: string }[];
  lifetimeEarningsMinor: number;
}

type Tab = 'overview' | 'tenants' | 'cohorts' | 'payouts' | 'ledger';
const tabs: { id: Tab; label: string }[] = [
  { id: 'overview', label: 'Overview' }, { id: 'tenants', label: 'Tenants' },
  { id: 'cohorts', label: 'Cohorts' }, { id: 'payouts', label: 'Payouts' }, { id: 'ledger', label: 'Ledger' },
];
const money = (minor: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(minor / 100);

export function DealerDetailDrawer({ dealerId, refreshVersion, onClose, onChanged, onError }: {
  dealerId: string | null; refreshVersion: number; onClose: () => void; onChanged: () => void; onError: (message: string) => void;
}) {
  const [data, setData] = useState<Dealer360 | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<Tab>('overview');

  useEffect(() => {
    if (!dealerId) return;
    let active = true;
    setLoading(true);
    setData(null);
    setLoadError('');
    void platformApi.request(`/admin/super/dealers/${dealerId}/360`)
      .then((result: Dealer360) => { if (active) setData(result); })
      .catch((error: unknown) => {
        if (!active) return;
        const message=error instanceof Error ? error.message : 'Unable to load dealer details.';
        setLoadError(message);
        onError(message);
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [dealerId, refreshVersion, onError]);

  useEffect(() => {
    if (!dealerId) return;
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [dealerId, onClose]);

  const submit = async (path: string, body: unknown) => {
    if (busy) return;
    setBusy(true);
    try {
      await platformApi.request(path, 'POST', body);
      onChanged();
    } catch (error) {
      onError(error instanceof Error ? error.message : 'The dealer operation failed.');
    } finally {
      setBusy(false);
    }
  };

  if (!dealerId) return null;
  const dealer = data?.dealer;
  return (
    <div className="platform-drawer-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
      <aside className="platform-drawer" role="dialog" aria-modal="true" aria-label={dealer ? `${dealer.name} dealer details` : 'Dealer details'}>
        <header className="platform-drawer-header">
          <div>
            <h2>{dealer?.name ?? 'Dealer details'}</h2>
            {dealer && <p>{dealer.email} · {dealer.phone} · {dealer.dealerCode}</p>}
          </div>
          <button onClick={onClose} aria-label="Close dealer details">Close</button>
        </header>
        <nav className="platform-drawer-tabs" aria-label="Dealer details sections">
          {tabs.map(item => <button key={item.id} aria-current={tab === item.id ? 'page' : undefined} onClick={() => setTab(item.id)}>{item.label}</button>)}
        </nav>
        <div className="platform-drawer-content">
          {loading ? <p role="status">Loading dealer records…</p> : loadError ? <section className="error-banner" role="alert">
            {loadError}<button onClick={onChanged}>Retry</button>
          </section> : !data ? <p>No dealer data available.</p> : <>
            {tab === 'overview' && <>
              <div className="platform-kpis">
                <article><small>Stores onboarded</small><strong>{data.tenants.length}</strong></article>
                <article><small>Active paid stores</small><strong>{data.tenants.filter(store => store.isActivePaid).length}</strong></article>
                <article><small>Available quota</small><strong>{data.quota.remaining} / {data.quota.granted}</strong></article>
                <article><small>Accrued commission</small><strong>{money(data.lifetimeEarningsMinor)}</strong></article>
              </div>
              <section className="platform-drawer-section">
                <div className="platform-drawer-section-heading">
                  <h3>License quota pool</h3>
                  <button disabled={busy} onClick={() => {
                    const raw = window.prompt('Number of merchant seats to grant');
                    if (raw === null || !raw.trim()) return;
                    const seats = Number(raw);
                    if (!Number.isInteger(seats) || seats < 1 || seats > 100000) { onError('Enter a whole number from 1 to 100000.'); return; }
                    void submit(`/admin/super/dealers/${dealerId}/allocations`, { seats });
                  }}>Top up quota</button>
                </div>
                <QuotaGauge granted={data.quota.granted} consumed={data.quota.consumed} />
                <div className="platform-table"><table><thead><tr><th>Grant</th><th>Used</th><th>Remaining</th><th>Status</th><th>Expires</th></tr></thead>
                  <tbody>{data.allocations.map(allocation => <tr key={allocation.id}>
                    <td>{allocation.grantedSeats}</td><td>{allocation.consumedSeats}</td><td>{allocation.remainingSeats}</td>
                    <td>{allocation.status}</td><td>{allocation.expiresAt ? new Date(allocation.expiresAt).toLocaleDateString('en-IN') : 'Never'}</td>
                  </tr>)}</tbody></table>{!data.allocations.length && <p>No quota grants yet.</p>}</div>
              </section>
              <section className="platform-drawer-section">
                <h3>Monthly onboarding and conversion</h3>
                <CohortBars cohorts={data.cohorts} />
              </section>
            </>}
            {tab === 'tenants' && <div className="platform-table"><table><thead><tr><th>Store</th><th>Onboarded</th><th>Subscription</th><th>Trial end</th></tr></thead>
              <tbody>{data.tenants.map(store => <tr key={store.tenantId}><td><strong>{store.name}</strong><div>{store.slug}</div></td>
                <td>{new Date(store.onboardedAt).toLocaleDateString('en-IN')}</td><td>{store.isActivePaid ? 'Paid' : store.status}</td>
                <td>{store.trialEndsAt ? new Date(store.trialEndsAt).toLocaleDateString('en-IN') : '—'}</td></tr>)}</tbody></table>
              {!data.tenants.length && <p>No attributed stores yet.</p>}</div>}
            {tab === 'cohorts' && <CohortBars cohorts={data.cohorts} detailed />}
            {tab === 'payouts' && <>
              <button disabled={busy} onClick={() => {
                const previous = new Date();
                previous.setMonth(previous.getMonth() - 1);
                const month = window.prompt('Commission period (YYYY-MM)', previous.toISOString().slice(0, 7));
                if (month) void submit(`/admin/super/dealers/${dealerId}/payouts`, { periodMonth: month });
              }}>Create payout from accrued ledger</button>
              <p className="platform-note">Payouts are manual settlements recorded by a Super Admin. Confirm funds were transferred before recording a UTR.</p>
              <div className="platform-table"><table><thead><tr><th>Period</th><th>Commission</th><th>Status</th><th>Settlement</th></tr></thead>
                <tbody>{data.payouts.map(payout => <tr key={payout.id}><td>{new Date(payout.periodStart).toLocaleDateString('en-IN')} – {new Date(payout.periodEnd).toLocaleDateString('en-IN')}</td>
                  <td>{money(payout.netPayableMinor)}</td><td>{payout.status}</td><td>{payout.status === 'pending'
                    ? <button disabled={busy} onClick={() => { const utrReference = window.prompt('Enter the bank UTR after verifying payment'); if (utrReference) void submit(`/admin/super/dealers/${dealerId}/payouts/${payout.id}/settle`, { utrReference }); }}
                    >Record settlement</button> : payout.utrReference ?? '—'}</td></tr>)}</tbody></table>
                {!data.payouts.length && <p>No payouts recorded.</p>}</div>
            </>}
            {tab === 'ledger' && <div className="platform-table"><table><thead><tr><th>Period</th><th>Gross</th><th>Rate</th><th>Commission</th><th>Status</th></tr></thead>
              <tbody>{data.commissionLedger.map(entry => <tr key={entry.id}><td>{entry.periodMonth}</td><td>{money(entry.grossAmountMinor)}</td>
                <td>{(Number(entry.commissionRate) * 100).toFixed(2)}%</td><td>{money(entry.commissionAmountMinor)}</td><td>{entry.status}</td></tr>)}</tbody>
            </table>{!data.commissionLedger.length && <p>No commission entries recorded.</p>}</div>}
          </>}
        </div>
      </aside>
    </div>
  );
}

function QuotaGauge({ granted, consumed }: { granted: number; consumed: number }) {
  const percent = granted > 0 ? Math.min(100, Math.round(consumed / granted * 100)) : 0;
  return <div className="platform-quota">
    <div className="platform-quota-track"><div style={{ width: `${percent}%` }} /></div>
    <span>{consumed} used · {Math.max(0, granted - consumed)} remaining · {percent}%</span>
  </div>;
}

function CohortBars({ cohorts, detailed = false }: { cohorts: Dealer360['cohorts']; detailed?: boolean }) {
  const max = Math.max(1, ...cohorts.map(cohort => cohort.onboarded));
  if (!cohorts.length) return <p>No cohort data yet.</p>;
  return <div className="platform-cohorts">{cohorts.map(cohort => <div key={cohort.month}>
    <div className="platform-cohort-bar"><span style={{ height: `${Math.max(2, cohort.converted / max * 100)}%` }} title={`${cohort.converted} converted`} />
      <i style={{ height: `${Math.max(2, (cohort.onboarded - cohort.converted) / max * 100)}%` }} title={`${cohort.onboarded - cohort.converted} not converted`} /></div>
    <small>{cohort.month}</small>{detailed && <small>{Math.round(cohort.conversionRate * 100)}% converted</small>}
  </div>)}</div>;
}

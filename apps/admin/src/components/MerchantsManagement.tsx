import React, { useState, useEffect, useCallback } from 'react';
import { AdminApi } from '../lib/api';

const api = new AdminApi();

function Card({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="card">
      <div className="card__label">{label}</div>
      <div className="card__value">{value}</div>
      {hint && <div className="card__hint">{hint}</div>}
    </div>
  );
}

export function MerchantsManagement({ onError }: { onError: (m: string) => void }) {
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'ACTIVE' | 'TRIAL' | 'EXPIRED'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [newStoreName, setNewStoreName] = useState('');
  const [newOwnerPhone, setNewOwnerPhone] = useState('');
  const [newPlan, setNewPlan] = useState('7_day_trial');
  const [newCity, setNewCity] = useState('Hyderabad');
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

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
  const expiredCount = list.filter((m) => m.subscriptionStatus === 'CANCELLED' || m.subscriptionStatus === 'SUSPENDED').length;

  const filteredList = list.filter((m) => {
    if (filterStatus === 'ACTIVE' && m.subscriptionStatus !== 'ACTIVE') return false;
    if (filterStatus === 'TRIAL' && m.subscriptionStatus !== 'TRIAL') return false;
    if (filterStatus === 'EXPIRED' && m.subscriptionStatus === 'ACTIVE') return false;
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      m.name?.toLowerCase().includes(q) ||
      m.phone?.includes(q) ||
      m.slug?.toLowerCase().includes(q)
    );
  });

  const handleCreateMerchant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStoreName.trim() || !newOwnerPhone.trim()) return;

    try {
      const slug = newStoreName.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').slice(0, 30) + '-' + newOwnerPhone.slice(-4);
      const days = newPlan === '7_day_trial' ? 7 : newPlan === '1_month' ? 30 : newPlan === '1_year' ? 365 : 3650;
      const validUntil = new Date(Date.now() + days * 86400000).toISOString();

      const newMerchant = {
        id: `tenant-${Date.now()}`,
        name: newStoreName.trim(),
        slug,
        phone: newOwnerPhone.trim(),
        city: newCity.trim(),
        plan: newPlan === '7_day_trial' ? '7-Day Free Trial' : newPlan === '1_month' ? 'Pro (1 Month)' : 'Pro (Yearly)',
        subscriptionStatus: newPlan === '7_day_trial' ? 'TRIAL' : 'ACTIVE',
        validUntil,
        outletsCount: 1,
      };

      setList((prev) => [newMerchant, ...prev]);
      setAddModalOpen(false);
      setNewStoreName('');
      setNewOwnerPhone('');
      setActionSuccess(`Merchant ${newMerchant.name} onboarded successfully!`);
      setTimeout(() => setActionSuccess(null), 4000);
    } catch (e) {
      onError((e as Error).message);
    }
  };

  const handleExtendValidity = async (merchantId: string, daysToAdd: number) => {
    try {
      setList((prev) =>
        prev.map((m) => {
          if (m.id !== merchantId) return m;
          const currentValid = m.validUntil ? new Date(m.validUntil).getTime() : Date.now();
          const baseTime = Math.max(Date.now(), currentValid);
          const newValid = new Date(baseTime + daysToAdd * 86400000).toISOString();
          return {
            ...m,
            validUntil: newValid,
            subscriptionStatus: 'ACTIVE',
          };
        })
      );
      setActionSuccess(`Subscription extended by ${daysToAdd} days!`);
      setTimeout(() => setActionSuccess(null), 3000);
    } catch (e) {
      onError((e as Error).message);
    }
  };

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 className="page__title">Stores & Merchants</h1>
          <p className="page__sub">Super Admin & Marketing Merchant Lifecycle Management</p>
        </div>
        <button
          className="btn btn--primary"
          onClick={() => setAddModalOpen(true)}
          style={{ display: 'flex', alignItems: 'center', gap: 6 }}
        >
          <span>➕ Onboard New Merchant</span>
        </button>
      </div>

      {actionSuccess && (
        <div style={{ padding: '10px 14px', background: '#DCFCE7', color: '#166534', borderRadius: 'var(--radius)', fontSize: 13, marginBottom: 16, fontWeight: 'bold' }}>
          ✅ {actionSuccess}
        </div>
      )}

      {/* Marketing KPI Cards */}
      <div className="cards">
        <Card label="Total Stores" value={String(list.length)} />
        <Card label="Active Paid" value={String(activeCount)} hint="recurring license" />
        <Card label="Free Trials (7-Day)" value={String(trialCount)} hint="leads in trial" />
        <Card label="Due / Suspended" value={String(expiredCount)} hint="follow up needed" />
      </div>

      {/* Merchant Listing Panel */}
      <section className="panel" style={{ marginTop: 20 }}>
        <header className="panel__head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              placeholder="Search store, phone, slug…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ width: 220 }}
            />
            <div style={{ display: 'flex', gap: 4 }}>
              {(['ALL', 'ACTIVE', 'TRIAL', 'EXPIRED'] as const).map((st) => (
                <button
                  key={st}
                  onClick={() => setFilterStatus(st)}
                  className={`btn btn--sm ${filterStatus === st ? 'btn--primary' : ''}`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>
          <button className="btn btn--sm" onClick={() => void load()}>Refresh</button>
        </header>

        {loading ? (
          <p className="empty">Loading stores…</p>
        ) : filteredList.length === 0 ? (
          <p className="empty">No merchants match filter.</p>
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
                <th>Quick Extend</th>
                <th>Admin Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredList.map((m) => (
                <tr key={m.id}>
                  <td>
                    <strong>{m.name}</strong>
                    {m.city && <span style={{ color: 'var(--text-faint)', fontSize: 12, display: 'block' }}>📍 {m.city}</span>}
                  </td>
                  <td style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>+91 {m.phone}</td>
                  <td><code>{m.slug}</code></td>
                  <td><span className="pill">{m.plan}</span></td>
                  <td>
                    <span className={`pill ${m.subscriptionStatus === 'ACTIVE' ? 'pill--ok' : m.subscriptionStatus === 'TRIAL' ? 'pill--warn' : 'pill--bad'}`}>
                      {m.subscriptionStatus}
                    </span>
                  </td>
                  <td style={{ fontSize: 13 }}>
                    {m.validUntil ? new Date(m.validUntil).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button
                        className="btn btn--sm"
                        title="Add 7 Days Trial"
                        onClick={() => handleExtendValidity(m.id, 7)}
                      >
                        +7D
                      </button>
                      <button
                        className="btn btn--sm"
                        title="Add 30 Days (1 Month)"
                        onClick={() => handleExtendValidity(m.id, 30)}
                      >
                        +1M
                      </button>
                      <button
                        className="btn btn--sm"
                        title="Add 365 Days (1 Year)"
                        onClick={() => handleExtendValidity(m.id, 365)}
                      >
                        +1Y
                      </button>
                    </div>
                  </td>
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

      {/* Onboard New Merchant Modal */}
      {addModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 'var(--radius)', maxWidth: 460, width: '100%', padding: 24, boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)' }}>
            <h2 style={{ marginTop: 0, fontSize: 18 }}>Onboard New Merchant</h2>
            <p style={{ fontSize: 12, color: '#64748B', marginTop: -6 }}>Register store & assign initial subscription access</p>

            <form onSubmit={handleCreateMerchant} style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 16 }}>
              <div className="field">
                <label>Store / Business Name *</label>
                <input
                  required
                  placeholder="e.g. Sri Lakshmi Supermarket"
                  value={newStoreName}
                  onChange={(e) => setNewStoreName(e.target.value)}
                />
              </div>

              <div className="field">
                <label>Owner Mobile Number (10 Digits) *</label>
                <input
                  required
                  type="tel"
                  placeholder="e.g. 9848787308"
                  value={newOwnerPhone}
                  onChange={(e) => setNewOwnerPhone(e.target.value)}
                />
              </div>

              <div className="field">
                <label>City / Location</label>
                <input
                  placeholder="e.g. Hyderabad / Vijayawada"
                  value={newCity}
                  onChange={(e) => setNewCity(e.target.value)}
                />
              </div>

              <div className="field">
                <label>Initial License Plan</label>
                <select value={newPlan} onChange={(e) => setNewPlan(e.target.value)}>
                  <option value="7_day_trial">7-Day Free Trial</option>
                  <option value="1_month">Pro Plan (1 Month)</option>
                  <option value="1_year">Pro Plan (1 Year)</option>
                  <option value="lifetime">Lifetime License</option>
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
                <button type="button" className="btn" onClick={() => setAddModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn--primary">
                  Create & Activate Store
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

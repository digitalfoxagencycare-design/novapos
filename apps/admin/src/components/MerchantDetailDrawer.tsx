import { useEffect, useState } from 'react';
import type { ImpersonationAccess } from '../lib/platformApi';

export interface MerchantDetail {
  id: string;
  name: string;
  slug?: string;
  phone: string;
  dealerCode?: string;
  businessType: string;
  plan: string;
  health: string;
  status: string;
  validUntil: string;
  daysRemaining: number;
}

interface StorePulse {
  tenantId: string;
  name: string;
  lastBillAt: string | null;
  billsLast24h: number;
  billsLast72h: number;
  healthStatus: string;
  churnWarning: boolean;
}

type DrawerTab = 'overview' | 'license' | 'activity' | 'support';

interface Props {
  merchant: MerchantDetail | null;
  pulseData?: StorePulse | null;
  superAdmin: boolean;
  busy: boolean;
  onClose: () => void;
  onChangeLicense: (merchant: MerchantDetail, action: 'ACTIVATE' | 'EXTEND' | 'SUSPEND' | 'REACTIVATE', days?: number, plan?: string) => void;
  onStartImpersonate: (merchant: MerchantDetail) => void;
}

export function MerchantDetailDrawer({
  merchant,
  pulseData,
  superAdmin,
  busy,
  onClose,
  onChangeLicense,
  onStartImpersonate,
}: Props) {
  const [tab, setTab] = useState<DrawerTab>('overview');

  useEffect(() => {
    if (!merchant) return;
    setTab('overview');
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [merchant, onClose]);

  if (!merchant) return null;

  const cleanPhone = (merchant.phone || '').replace(/\D/g, '');
  const waUrl = cleanPhone ? `https://wa.me/91${cleanPhone}?text=Hello%20${encodeURIComponent(merchant.name)}%2C%20regarding%20your%20NovaPOS%20store...` : null;

  return (
    <div
      className="platform-drawer-backdrop"
      onMouseDown={e => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <aside
        className="platform-drawer"
        role="dialog"
        aria-modal="true"
        aria-label={`${merchant.name} 360° details`}
      >
        <header className="platform-drawer-header">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <h2 style={{ margin: 0 }}>{merchant.name}</h2>
              <span className={`license-tag ${merchant.status.toLowerCase()}`}>
                {merchant.status}
              </span>
              <span className={`license-tag ${(merchant.health || '').toLowerCase()}`}>
                {(merchant.health || 'healthy').replace('_', ' ')}
              </span>
            </div>
            <p style={{ margin: '6px 0 0', color: '#58665d', fontSize: 13 }}>
              Store ID: <code>{merchant.slug || merchant.id}</code> · {merchant.businessType || 'Retail/POS'} · {merchant.dealerCode ? `Dealer: ${merchant.dealerCode}` : 'Direct Merchant'}
            </p>
          </div>
          <button onClick={onClose} aria-label="Close merchant drawer">✕ Close</button>
        </header>

        <nav className="platform-drawer-tabs" aria-label="Merchant details tabs">
          <button aria-current={tab === 'overview' ? 'page' : undefined} onClick={() => setTab('overview')}>
            Store Overview
          </button>
          <button aria-current={tab === 'license' ? 'page' : undefined} onClick={() => setTab('license')}>
            Subscription & License
          </button>
          <button aria-current={tab === 'activity' ? 'page' : undefined} onClick={() => setTab('activity')}>
            Live POS Activity
          </button>
          {superAdmin && (
            <button aria-current={tab === 'support' ? 'page' : undefined} onClick={() => setTab('support')}>
              Support & Audit
            </button>
          )}
        </nav>

        <div className="platform-drawer-content">
          {tab === 'overview' && (
            <div>
              <div className="platform-kpis" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
                <article>
                  <small>Plan Tier</small>
                  <strong style={{ fontSize: 20 }}>{(merchant.plan || 'starter_monthly').replace('_', ' ').toUpperCase()}</strong>
                </article>
                <article>
                  <small>Days Remaining</small>
                  <strong style={{ fontSize: 20, color: merchant.daysRemaining <= 7 ? '#dc2626' : '#16a34a' }}>
                    {merchant.daysRemaining} Days
                  </strong>
                </article>
                <article>
                  <small>Renewal Date</small>
                  <strong style={{ fontSize: 18 }}>
                    {new Date(merchant.validUntil).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </strong>
                </article>
              </div>

              <section className="platform-drawer-section">
                <h3>Merchant Contact & Actions</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, margin: '14px 0' }}>
                  <div>
                    <label style={{ fontSize: 11, color: '#58665d', textTransform: 'uppercase', fontWeight: 600 }}>Registered Phone</label>
                    <div style={{ fontSize: 16, fontWeight: 700, marginTop: 4 }}>
                      {cleanPhone ? `+91 ${cleanPhone}` : 'No phone recorded'}
                    </div>
                  </div>
                  <div>
                    <label style={{ fontSize: 11, color: '#58665d', textTransform: 'uppercase', fontWeight: 600 }}>Business Profile</label>
                    <div style={{ fontSize: 16, fontWeight: 700, marginTop: 4, textTransform: 'capitalize' }}>
                      {merchant.businessType || 'General Retail'}
                    </div>
                  </div>
                </div>

                {cleanPhone && (
                  <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
                    {waUrl && (
                      <a
                        href={waUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          padding: '10px 16px',
                          background: '#25D366',
                          color: '#fff',
                          borderRadius: 7,
                          fontWeight: 700,
                          fontSize: 13,
                          textDecoration: 'none',
                        }}
                      >
                        💬 Contact on WhatsApp
                      </a>
                    )}
                    <a
                      href={`tel:${cleanPhone}`}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '10px 16px',
                        background: '#172924',
                        color: '#fff',
                        borderRadius: 7,
                        fontWeight: 700,
                        fontSize: 13,
                        textDecoration: 'none',
                      }}
                    >
                      📞 Call Merchant
                    </a>
                  </div>
                )}
              </section>

              <section className="platform-drawer-section">
                <h3>Store Attribution</h3>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <tbody>
                    <tr style={{ borderBottom: '1px solid #e3e7e2' }}>
                      <td style={{ padding: '8px 0', color: '#58665d' }}>Dealer Channel</td>
                      <td style={{ padding: '8px 0', fontWeight: 600 }}>{merchant.dealerCode ? `Official Partner (${merchant.dealerCode})` : 'Direct Digital Acquisition'}</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid #e3e7e2' }}>
                      <td style={{ padding: '8px 0', color: '#58665d' }}>Tenant UUID</td>
                      <td style={{ padding: '8px 0', fontFamily: 'monospace' }}>{merchant.id}</td>
                    </tr>
                    <tr>
                      <td style={{ padding: '8px 0', color: '#58665d' }}>Store Slug</td>
                      <td style={{ padding: '8px 0', fontWeight: 600 }}>{merchant.slug || '—'}</td>
                    </tr>
                  </tbody>
                </table>
              </section>
            </div>
          )}

          {tab === 'license' && (
            <div>
              <div className="platform-drawer-section">
                <h3>Quick License Extension</h3>
                <p style={{ color: '#58665d', fontSize: 13, margin: '8px 0 16px' }}>
                  Extend validity immediately or switch license tier without merchant downtime.
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                  <button
                    disabled={busy}
                    className="platform-primary"
                    onClick={() => onChangeLicense(merchant, 'ACTIVATE', undefined, 'pro_yearly')}
                  >
                    Activate 1-Year Pro (₹3,999)
                  </button>
                  <button
                    disabled={busy}
                    onClick={() => onChangeLicense(merchant, 'ACTIVATE', undefined, 'starter_monthly')}
                  >
                    Activate Starter Monthly (₹499)
                  </button>
                  {superAdmin && (
                    <>
                      <button disabled={busy} onClick={() => onChangeLicense(merchant, 'EXTEND', 30)}>
                        +30 Days Free Grace
                      </button>
                      <button disabled={busy} onClick={() => onChangeLicense(merchant, 'EXTEND', 90)}>
                        +90 Days Grace
                      </button>
                      <button disabled={busy} onClick={() => onChangeLicense(merchant, 'EXTEND', 365)}>
                        +365 Days
                      </button>
                    </>
                  )}
                </div>
              </div>

              <div className="platform-drawer-section">
                <h3>Store Access Control</h3>
                <p style={{ color: '#58665d', fontSize: 13 }}>
                  Suspended stores cannot bill orders or sync offline data until reactivated.
                </p>
                <button
                  disabled={busy}
                  style={{
                    background: merchant.status === 'SUSPENDED' ? '#16a34a' : '#dc2626',
                    color: '#fff',
                    borderColor: 'transparent',
                    fontWeight: 700,
                  }}
                  onClick={() => onChangeLicense(merchant, merchant.status === 'SUSPENDED' ? 'REACTIVATE' : 'SUSPEND')}
                >
                  {merchant.status === 'SUSPENDED' ? '✓ Reactivate Store Immediately' : '⚠ Suspend Store Access'}
                </button>
              </div>
            </div>
          )}

          {tab === 'activity' && (
            <div>
              <div className="platform-kpis">
                <article>
                  <small>Bills (Last 24 Hours)</small>
                  <strong>{pulseData?.billsLast24h ?? 0}</strong>
                </article>
                <article>
                  <small>Bills (Last 72 Hours)</small>
                  <strong>{pulseData?.billsLast72h ?? 0}</strong>
                </article>
              </div>

              <section className="platform-drawer-section">
                <h3>Live Billing Health</h3>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <tbody>
                    <tr style={{ borderBottom: '1px solid #e3e7e2' }}>
                      <td style={{ padding: '10px 0', color: '#58665d' }}>Latest Bill Generated At</td>
                      <td style={{ padding: '10px 0', fontWeight: 600 }}>
                        {pulseData?.lastBillAt ? new Date(pulseData.lastBillAt).toLocaleString('en-IN') : 'No bills punched yet'}
                      </td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid #e3e7e2' }}>
                      <td style={{ padding: '10px 0', color: '#58665d' }}>Platform Health Status</td>
                      <td style={{ padding: '10px 0', fontWeight: 700, textTransform: 'capitalize' }}>
                        <span className={`license-tag ${(pulseData?.healthStatus || merchant.health || 'idle').toLowerCase()}`}>
                          {(pulseData?.healthStatus || merchant.health || 'idle').replace('_', ' ')}
                        </span>
                      </td>
                    </tr>
                    <tr>
                      <td style={{ padding: '10px 0', color: '#58665d' }}>Churn Risk Alert</td>
                      <td style={{ padding: '10px 0', fontWeight: 600, color: pulseData?.churnWarning ? '#dc2626' : '#16a34a' }}>
                        {pulseData?.churnWarning ? '⚠ At Risk: No billing activity detected recently' : '✓ Normal Active Usage'}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </section>
            </div>
          )}

          {tab === 'support' && superAdmin && (
            <div>
              <section className="platform-drawer-section">
                <h3>Tenant Backoffice Impersonation</h3>
                <p style={{ color: '#58665d', fontSize: 13, lineHeight: 1.5 }}>
                  Temporarily enter this merchant's backoffice workspace as the owner to assist with menu items, thermal printer configuration, or audit reports.
                </p>
                <div style={{ background: '#fef3c7', border: '1px solid #fde68a', borderRadius: 8, padding: 14, margin: '14px 0', fontSize: 13, color: '#92400e' }}>
                  <strong>Security Policy:</strong> Every support session is audited with your Admin ID, client IP, timestamp, and required justification. Sessions auto-expire in 10 minutes.
                </div>
                <button
                  disabled={busy || merchant.status === 'SUSPENDED'}
                  className="platform-primary"
                  onClick={() => onStartImpersonate(merchant)}
                >
                  🚀 Open Audited Support Session
                </button>
              </section>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}

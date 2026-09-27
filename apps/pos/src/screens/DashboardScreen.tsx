import { useBackHandler } from '../lib/navigation';
import React, { useState, useEffect } from 'react';
import {
  Menu,
  RotateCw,
  Headphones,
  Calendar,
  ChevronRight,
  TrendingUp,
  Receipt,
  Printer,
  Plus,
  Mail,
  CheckCircle2,
  Clock,
  ShieldCheck,
  Calculator,
  Users,
  Package,
  ShoppingBag,
  Sparkles,
  Scale,
} from 'lucide-react';
import { type BusinessProfile, PROFILES } from '../lib/business';
import { loadDayBookEntries, filterEntriesByPeriod, type DayBookEntry } from '../lib/dayBook';
import { useSubscriptionDetails } from '../lib/subscription';
import { ComplianceModal } from '../components/ComplianceModal';

interface Props {
  profile: BusinessProfile;
  profileName: string;
  phone: string;
  onOpenMenu: () => void;
  onNavigate: (screen: string) => void;
  onOpenPrinterModal: () => void;
}

export const DashboardScreen: React.FC<Props> = ({
  profile,
  profileName,
  phone,
  onOpenMenu,
  onNavigate,
  onOpenPrinterModal,
}) => {
  const [hideDateBanner, setHideDateBanner] = useState(false);
  const [emailReportEnabled, setEmailReportEnabled] = useState(false);
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [emailInput, setEmailInput] = useState('');
  const [supportModalOpen, setSupportModalOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncToast, setSyncToast] = useState(false);
  const subDetails = useSubscriptionDetails();
  const [complianceModalOpen, setComplianceModalOpen] = useState(false);

  useBackHandler(emailModalOpen || supportModalOpen || complianceModalOpen, () => {
    if (complianceModalOpen) setComplianceModalOpen(false);
    else if (supportModalOpen) setSupportModalOpen(false);
    else setEmailModalOpen(false);
  });

  // Live clock: DD/MM/YY HH:MM:SS AM/PM
  const [currentTime, setCurrentTime] = useState<string>(() => formatDateTime(new Date()));

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(formatDateTime(new Date()));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  function formatDateTime(d: Date): string {
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = String(d.getFullYear()).slice(-2);
    let hours = d.getHours();
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const seconds = String(d.getSeconds()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    const hoursStr = String(hours).padStart(2, '0');
    return `${day}/${month}/${year} ${hoursStr}:${minutes}:${seconds} ${ampm}`;
  }

  // Load today's sales
  const [todaySales, setTodaySales] = useState<DayBookEntry[]>([]);
  const [todayTotal, setTodayTotal] = useState<number>(0);

  const refreshTodaySales = () => {
    const entries = loadDayBookEntries();
    
    const salesToday = filterEntriesByPeriod(entries, 'today').filter(entry => entry.type === 'sale');
    setTodaySales(salesToday);
    const total = salesToday.reduce((sum, e) => sum + e.amount, 0);
    setTodayTotal(total);
  };

  useEffect(() => {
    refreshTodaySales();
  }, []);

  const handleSync = () => {
    setIsSyncing(true);
    refreshTodaySales();
    setTimeout(() => {
      setIsSyncing(false);
      setSyncToast(true);
      setTimeout(() => setSyncToast(false), 2000);
    }, 600);
  };

  return (
    <div className="ezo-dashboard-container">
      {/* 1. Purple Top App Bar with Notch / Status Bar Safe-Area Support */}
      <header className="ezo-dash-header">
        <div className="ezo-dash-header-left">
          <button
            onClick={onOpenMenu}
            className="ezo-icon-btn ezo-hamburger-btn"
            title="Open Navigation Menu"
            aria-label="Open Navigation Menu"
          >
            <Menu className="w-6 h-6 text-white stroke-[2.5]" />
          </button>
          <div className="ezo-dash-title-wrap">
            <h1 className="ezo-dash-store-name">{profileName || 'My Store'}</h1>
            <span className="ezo-dash-store-sub">
              FAST v39.31 {phone ? `| +91 ${phone}` : ''}
            </span>
          </div>
        </div>

        <div className="ezo-dash-header-right">
          <button
            onClick={handleSync}
            className={`ezo-icon-btn ${isSyncing ? 'spinning' : ''}`}
            title="Sync Data"
            aria-label="Sync"
          >
            <RotateCw className="w-5 h-5 text-white" />
          </button>
          <button
            onClick={() => setSupportModalOpen(true)}
            className="ezo-icon-btn"
            title="Helpline & Support"
            aria-label="Support"
          >
            <Headphones className="w-5 h-5 text-white" />
          </button>
        </div>
      </header>

      {/* Sync Toast Feedback */}
      {syncToast && (
        <div className="ezo-sync-toast">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 mr-1.5" />
          Data Synced Successfully
        </div>
      )}

      {/* 2. Date-Time Ribbon with Working Hide Toggle */}
      {!hideDateBanner && (
        <div className="ezo-datetime-banner">
          <div className="ezo-datetime-text">
            <Calendar className="w-3.5 h-3.5 text-slate-500 mr-1.5 inline" />
            <span>{currentTime}</span>
          </div>
          <button
            onClick={() => setHideDateBanner(true)}
            className="ezo-hide-btn"
            title="Hide date ribbon"
          >
            Hide
          </button>
        </div>
      )}

      {/* Scrollable Dashboard Body */}
      <div className="ezo-dash-scroll-body">
        {/* 3. Top KPI Cards: Reports, Sale (TDY), & Invoices */}
        <div className="ezo-kpi-grid">
          {/* Card 1: Reports */}
          <div
            onClick={() => onNavigate('reports')}
            className="ezo-kpi-card ezo-kpi-reports"
          >
            <span className="ezo-kpi-title">Reports</span>
            <div className="ezo-kpi-action-row">
              <span className="ezo-kpi-action-text">Check 18 Reports</span>
              <ChevronRight className="w-4 h-4 text-slate-700" />
            </div>
          </div>

          {/* Card 2: Sale (TDY) */}
          <div
            onClick={() => onNavigate('reports')}
            className="ezo-kpi-card ezo-kpi-sale"
          >
            <span className="ezo-kpi-title">Sale (TDY)</span>
            <div className="ezo-kpi-amount">₹ {todayTotal.toFixed(0)}</div>
          </div>
        </div>

        {/* 4. Dynamic 3-Day Free Trial / SaaS License Status Card */}
        <div
          onClick={() => onNavigate('settings')}
          className="ezo-pro-status-banner cursor-pointer hover:shadow-md transition-all active:scale-98"
          title="Click to view subscription & upgrade"
        >
          <div className="flex items-center space-x-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center flex-shrink-0">
              <Sparkles className="w-4 h-4 text-indigo-600" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-black text-slate-900 tracking-wide uppercase truncate">
                {subDetails.plan === 'PRO'
                  ? 'Pro Annual License Active'
                  : subDetails.plan === 'STARTER'
                  ? 'Starter Monthly Active'
                  : subDetails.isExpired
                  ? 'Subscription Inactive / Expired'
                  : 'Merchant License Active'}
              </div>
              <div className="text-[11px] text-slate-500 truncate">
                {!subDetails.isExpired ? (
                  <>
                    <b className="text-indigo-600 font-bold">Valid until {subDetails.formattedExpiresAt}</b>
                  </>
                ) : (
                  <span className="text-rose-600 font-bold">License expired · Contact for Premium</span>
                )}
              </div>
            </div>
          </div>
          <span
            style={{
              backgroundColor: subDetails.isExpired ? '#EF4444' : '#10B981',
              color: '#FFFFFF',
            }}
            className="text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider shadow-xs flex-shrink-0"
          >
            {subDetails.isExpired ? 'Expired' : 'Active'}
          </span>
        </div>

        {/* 5. Quick POS Shortcuts Grid */}
        <div className="ezo-quick-shortcuts-grid">
          <button
            onClick={() => onNavigate('billing')}
            className="ezo-shortcut-btn"
          >
            <div className="ezo-shortcut-icon bg-indigo-50 text-indigo-600">
              <Receipt className="w-5 h-5" />
            </div>
            <span className="ezo-shortcut-label">Sale Invoice</span>
          </button>

          <button
            onClick={() => onNavigate('calculator')}
            className="ezo-shortcut-btn"
          >
            <div className="ezo-shortcut-icon bg-amber-50 text-amber-600">
              <Calculator className="w-5 h-5" />
            </div>
            <span className="ezo-shortcut-label">Calculator</span>
          </button>

          <button
            onClick={() => onNavigate('party')}
            className="ezo-shortcut-btn"
          >
            <div className="ezo-shortcut-icon bg-blue-50 text-blue-600">
              <Users className="w-5 h-5" />
            </div>
            <span className="ezo-shortcut-label">Party / Khata</span>
          </button>

          <button
            onClick={() => onNavigate('inventory')}
            className="ezo-shortcut-btn"
          >
            <div className="ezo-shortcut-icon bg-purple-50 text-purple-600">
              <Package className="w-5 h-5" />
            </div>
            <span className="ezo-shortcut-label">Item Catalog</span>
          </button>
        </div>

        {/* 6. Section: Recent Sale Transactions */}
        <div className="ezo-section-card">
          <div className="flex items-center justify-between mb-2">
            <h2 className="ezo-section-heading">RECENT SALE TRANSACTIONS</h2>
            <span className="text-[11px] text-indigo-600 font-bold">
              {todaySales.length} {todaySales.length === 1 ? 'Sale' : 'Sales'} Today
            </span>
          </div>

          {todaySales.length === 0 ? (
            <div className="ezo-empty-transactions">
              <Receipt className="w-9 h-9 text-slate-300 mx-auto mb-1.5" />
              <p className="ezo-empty-text">No Recent Sale Transactions For Today</p>
              <button
                onClick={() => onNavigate('billing')}
                className="mt-3 px-4 py-1.5 bg-indigo-50 text-indigo-600 text-xs font-bold rounded-full hover:bg-indigo-100 inline-flex items-center"
              >
                <Plus className="w-3.5 h-3.5 mr-1" />
                Create First Bill
              </button>
            </div>
          ) : (
            <div className="ezo-transactions-list">
              {todaySales.slice(0, 6).map((sale) => (
                <div key={sale.id} className="ezo-sale-item">
                  <div className="ezo-sale-item-left">
                    <span className="ezo-sale-bill-no">
                      {sale.referenceNo || 'Invoice'}
                    </span>
                    <span className="ezo-sale-time">
                      <Clock className="w-3 h-3 inline mr-1" />
                      {new Date(sale.timestamp).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                      {' · '}
                      <span className="uppercase text-[10px] font-bold text-indigo-600">
                        {sale.paymentMode}
                      </span>
                    </span>
                  </div>
                  <div className="ezo-sale-item-right">
                    <span className="ezo-sale-amount">
                      ₹{sale.amount.toFixed(2)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 7. Receive Daily Report On Email-Id Card with Toggle */}
        <div className="ezo-email-report-card">
          <div className="ezo-email-report-info">
            <span className="ezo-email-report-title">
              Receive Daily Report On Email-Id
            </span>
            <span className="ezo-email-report-status">
              {emailReportEnabled ? (emailInput || 'Enabled') : 'Disabled'}
            </span>
          </div>

          <label className="ezo-switch-label">
            <input
              type="checkbox"
              checked={emailReportEnabled}
              onChange={(e) => {
                const checked = e.target.checked;
                setEmailReportEnabled(checked);
                if (checked && !emailInput) {
                  setEmailModalOpen(true);
                }
              }}
              className="ezo-switch-input"
            />
            <span className="ezo-switch-slider" />
          </label>
        </div>

        <div className="ezo-dash-bottom-spacer" />
      </div>

      {/* 8. Floating Bottom Actions (Elevated Safely Above Bottom Navigation Bar) */}
      <div className="ezo-floating-actions-bar">
        {/* Connect Printer Pill */}
        <button
          onClick={onOpenPrinterModal}
          className="ezo-btn-connect-printer"
        >
          <span className="ezo-printer-top-line">👆 CONNECT PRINTER 👆</span>
          <span className="ezo-printer-sub-line">
            PERMISSION | BLUETOOTH | LOCATION
          </span>
        </button>

        {/* Main Action Row: + SALE INVOICE & Circular + FAB */}
        <div className="ezo-action-buttons-row">
          <button
            onClick={() => onNavigate('billing')}
            className="ezo-btn-sale-invoice"
          >
            <Plus className="w-5 h-5 mr-2 inline" />
            <span>SALE INVOICE</span>
          </button>

          <button
            onClick={() => onNavigate('calculator')}
            className="ezo-btn-quick-fab"
            title="Quick Calculator Bill"
          >
            <Plus className="w-6 h-6 text-white stroke-[2.5]" />
          </button>
        </div>
      </div>

      {/* Support Modal */}
      {supportModalOpen && (
        <div className="ezo-modal-overlay" onClick={() => setSupportModalOpen(false)}>
          <div className="ezo-modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="ezo-modal-hero">
              <Headphones className="w-10 h-10 text-indigo-600 mx-auto mb-2" />
              <h3 className="text-lg font-bold text-slate-900">NovaPOS Help & Support</h3>
              <p className="text-xs text-slate-500">24/7 Merchant Customer Care</p>
            </div>
            <div className="p-4 space-y-3">
              <a
                href="https://wa.me/919381563241?text=Hello%20NovaPOS%20Support%2C%20I%20need%20assistance%20with%20my%20POS%20system."
                target="_blank"
                rel="noreferrer"
                className="ezo-support-link wa"
              >
                WhatsApp Live Support (+91 9381563241)
              </a>
              <a
                href="tel:9381563241"
                className="ezo-support-link call"
              >
                <Headphones className="w-4 h-4 mr-2" />
                Direct Helpline (+91 9381563241)
              </a>
              <button
                type="button"
                onClick={() => {
                  setSupportModalOpen(false);
                  setComplianceModalOpen(true);
                }}
                className="w-full py-2 px-3 text-xs font-bold text-slate-700 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-center gap-1.5 hover:bg-slate-100 transition-colors"
              >
                <Scale className="w-3.5 h-3.5 text-indigo-600" />
                <span>Privacy Policy, Terms & Legal Compliance</span>
              </button>

              <button
                onClick={() => setSupportModalOpen(false)}
                className="w-full py-2 text-xs font-semibold text-slate-600 bg-slate-100 rounded-lg mt-1"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Legal & Play Store Compliance Modal */}
      <ComplianceModal
        isOpen={complianceModalOpen}
        onClose={() => setComplianceModalOpen(false)}
      />

      {/* Email Report Setup Modal */}
      {emailModalOpen && (
        <div className="ezo-modal-overlay" onClick={() => setEmailModalOpen(false)}>
          <div className="ezo-modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="p-4">
              <Mail className="w-8 h-8 text-indigo-600 mx-auto mb-1.5" />
              <h3 className="text-base font-bold text-slate-900 text-center">
                Configure Daily Email Reports
              </h3>
              <p className="text-xs text-slate-500 text-center mb-3">
                Receive an automatic daily end-of-day sales, daybook, and tax summary at 9:00 PM.
              </p>
              <input
                type="email"
                placeholder="storeowner@gmail.com"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                className="w-full p-2 border border-slate-300 rounded-lg text-sm mb-3"
                autoFocus
              />
              <button
                onClick={() => {
                  if (!emailInput.includes('@')) {
                    alert('Please enter a valid email address');
                    return;
                  }
                  setEmailReportEnabled(true);
                  setEmailModalOpen(false);
                }}
                className="w-full py-2 bg-indigo-600 text-white font-bold rounded-lg text-xs"
              >
                Save & Enable Daily Reports
              </button>
              <button
                onClick={() => {
                  setEmailReportEnabled(false);
                  setEmailModalOpen(false);
                }}
                className="w-full py-1.5 text-xs text-slate-500 mt-1"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

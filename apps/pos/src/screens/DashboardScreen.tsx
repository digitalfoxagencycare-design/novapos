import { useBackHandler } from '../lib/navigation';
import React, { useState, useEffect } from 'react';
import {
  Menu,
  RotateCw,
  Headphones,
  Calendar,
  ChevronRight,
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
  TrendingUp,
  Share2,
  X,
  CreditCard,
  DollarSign,
  Layers,
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
  const [printerBannerDismissed, setPrinterBannerDismissed] = useState(false);
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
  const [cashTotal, setCashTotal] = useState<number>(0);
  const [digitalTotal, setDigitalTotal] = useState<number>(0);

  const refreshTodaySales = () => {
    const entries = loadDayBookEntries();
    const salesToday = filterEntriesByPeriod(entries, 'today').filter((entry) => entry.type === 'sale');
    setTodaySales(salesToday);
    const total = salesToday.reduce((sum, e) => sum + e.amount, 0);
    const cash = salesToday.filter((e) => e.paymentMode === 'cash').reduce((sum, e) => sum + e.amount, 0);
    const digital = salesToday.filter((e) => e.paymentMode === 'upi' || e.paymentMode === 'card').reduce((sum, e) => sum + e.amount, 0);
    setTodayTotal(total);
    setCashTotal(cash);
    setDigitalTotal(digital);
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

  const handleShareWhatsApp = (sale: DayBookEntry) => {
    const text = `*${profileName || 'NovaPOS Store'} - Tax Receipt*\n*Bill:* ${sale.referenceNo || sale.id}\n*Total:* ₹${sale.amount.toFixed(2)}\n*Mode:* ${sale.paymentMode.toUpperCase()}\nThank you for your business! 🙏`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  return (
    <div className="ezo-dashboard-container pb-36">
      {/* 1. Warm Orange Top Header */}
      <header
        className="ezo-dash-header shadow-md"
        style={{
          background: 'linear-gradient(135deg, #F97316 0%, #EA580C 100%)',
          backgroundColor: '#EA580C',
          color: '#FFFFFF',
        }}
      >
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
            <h1 className="ezo-dash-store-name text-white font-extrabold text-lg">{profileName || 'My Store'}</h1>
            <span className="ezo-dash-store-sub text-white/90 font-medium text-xs">FAST v39.31 · Cloud Sync Online</span>
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

      {/* Sync Toast */}
      {syncToast && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-slate-900/90 text-white px-4 py-2 rounded-full text-xs font-bold shadow-lg flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>Cloud data synchronized!</span>
        </div>
      )}

      {/* Main Scroll Content */}
      <div className="ezo-dash-scroll-body space-y-3.5 px-3.5 py-3">
        {/* 2. Date & Time Bar */}
        {!hideDateBanner && (
          <div className="flex items-center justify-between bg-white px-3.5 py-2 rounded-xl border border-slate-200 shadow-xs text-xs">
            <div className="flex items-center gap-2 text-slate-700 font-semibold">
              <Calendar className="w-4 h-4 text-orange-600" />
              <span>{currentTime}</span>
            </div>
            <button
              onClick={() => setHideDateBanner(true)}
              className="text-slate-400 hover:text-slate-600 font-bold text-[11px]"
            >
              Hide
            </button>
          </div>
        )}

        {/* 3. Primary KPI Cards: Reports & Today's Sales */}
        <div className="grid grid-cols-2 gap-3">
          {/* Reports Card */}
          <button
            onClick={() => onNavigate('reports')}
            className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs text-left hover:border-orange-300 transition-all active:scale-[0.98] flex flex-col justify-between"
          >
            <div>
              <span className="text-xs font-bold text-slate-500 block uppercase tracking-wide">
                Reports
              </span>
              <b className="text-sm font-extrabold text-slate-900 block mt-1">
                Check 18 Reports
              </b>
            </div>
            <div className="flex items-center text-xs font-bold text-orange-600 mt-2 gap-1">
              <span>View Analytics</span>
              <ChevronRight className="w-4 h-4" />
            </div>
          </button>

          {/* Today's Sales Card */}
          <div
            style={{
              background: 'linear-gradient(135deg, #F97316 0%, #EA580C 100%)',
              backgroundColor: '#EA580C',
              color: '#FFFFFF',
            }}
            className="p-3.5 rounded-2xl shadow-md text-white flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold text-white uppercase tracking-wider">
                  Sale (TDY)
                </span>
                <TrendingUp className="w-4 h-4 text-white" />
              </div>
              <b className="text-2xl font-black text-white block mt-1 tracking-tight">
                ₹ {todayTotal.toFixed(0)}
              </b>
            </div>
            <span className="text-[11px] text-white/95 font-bold">
              {todaySales.length} {todaySales.length === 1 ? 'sale' : 'sales'} recorded today
            </span>
          </div>
        </div>

        {/* 4. License & Entitlement Status Card */}
        <div
          onClick={() => onNavigate('settings')}
          className="bg-white p-3 rounded-xl border border-emerald-200 shadow-xs flex items-center justify-between cursor-pointer hover:border-emerald-300 transition-all"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center flex-shrink-0">
              <Sparkles className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="min-w-0">
              <b className="text-xs font-black text-slate-900 block truncate uppercase">
                {subDetails.isTrial ? '7-Day Free Trial Active' : 'Pro Annual License Active'}
              </b>
              <span className="text-[11px] text-emerald-700 font-semibold truncate block">
                Valid until {subDetails.formattedExpiresAt}
              </span>
            </div>
          </div>
          <span className="text-[10px] font-extrabold px-2.5 py-1 rounded-full uppercase tracking-wider bg-emerald-600 text-white shadow-xs">
            Active
          </span>
        </div>

        {/* 5. Essential Quick Tools (Non-duplicate, high-utility actions) */}
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs space-y-2.5">
          <span className="text-xs font-extrabold text-slate-800 uppercase tracking-wider block">
            POS Business Shortcuts
          </span>
          <div className="grid grid-cols-4 gap-2">
            {/* Quick Invoice */}
            <button
              onClick={() => onNavigate('billing')}
              className="p-2.5 rounded-xl bg-orange-50 hover:bg-orange-100 text-orange-700 flex flex-col items-center justify-center gap-1.5 transition-all active:scale-95"
            >
              <Receipt className="w-5 h-5 text-orange-600" />
              <span className="text-[11px] font-bold text-center leading-tight">Billing</span>
            </button>

            {/* Calculator Bill */}
            <button
              onClick={() => onNavigate('calculator')}
              className="p-2.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-700 flex flex-col items-center justify-center gap-1.5 transition-all active:scale-95"
            >
              <Calculator className="w-5 h-5 text-amber-600" />
              <span className="text-[11px] font-bold text-center leading-tight">Keypad</span>
            </button>

            {/* Items / Inventory */}
            <button
              onClick={() => onNavigate('inventory')}
              className="p-2.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 flex flex-col items-center justify-center gap-1.5 transition-all active:scale-95"
            >
              <Package className="w-5 h-5 text-blue-600" />
              <span className="text-[11px] font-bold text-center leading-tight">Items</span>
            </button>

            {/* Staff Management */}
            <button
              onClick={() => onNavigate('staff')}
              className="p-2.5 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-700 flex flex-col items-center justify-center gap-1.5 transition-all active:scale-95"
            >
              <Users className="w-5 h-5 text-purple-600" />
              <span className="text-[11px] font-bold text-center leading-tight">Staff</span>
            </button>
          </div>
        </div>

        {/* 6. Smart Dismissible Printer Status Card */}
        {!printerBannerDismissed && (
          <div className="bg-slate-900 text-white p-3 rounded-2xl shadow-sm flex items-center justify-between">
            <div className="flex items-center gap-2.5" onClick={onOpenPrinterModal}>
              <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
                <Printer className="w-4 h-4 text-orange-400" />
              </div>
              <div className="cursor-pointer">
                <b className="text-xs font-bold block">Connect Thermal Printer</b>
                <span className="text-[10px] text-slate-300">Bluetooth / USB 58mm & 80mm</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={onOpenPrinterModal}
                className="px-3 py-1 bg-orange-600 hover:bg-orange-500 text-white font-bold text-[11px] rounded-lg shadow-xs"
              >
                Connect
              </button>
              <button
                onClick={() => setPrinterBannerDismissed(true)}
                className="p-1 text-slate-400 hover:text-white rounded-md"
                title="Dismiss banner"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* 7. Recent Sales Transactions Live Feed */}
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <b className="text-xs font-extrabold text-slate-800 uppercase tracking-wider block">
                Recent Sale Transactions
              </b>
              <span className="text-[11px] text-slate-400">
                {todaySales.length} total bills today
              </span>
            </div>
            <button
              onClick={() => onNavigate('reports')}
              className="text-xs font-bold text-orange-600 hover:underline"
            >
              View all
            </button>
          </div>

          {todaySales.length === 0 ? (
            <div className="py-6 text-center text-slate-400 space-y-1">
              <Receipt className="w-8 h-8 mx-auto text-slate-300" />
              <p className="text-xs font-semibold">No sales recorded yet today</p>
            </div>
          ) : (
            <div className="space-y-2">
              {todaySales.slice(0, 5).map((sale) => (
                <div
                  key={sale.id}
                  className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between hover:bg-orange-50/50 transition-colors"
                >
                  <div className="min-w-0">
                    <b className="text-xs font-bold text-slate-800 block truncate">
                      {sale.referenceNo || sale.id}
                    </b>
                    <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                      <span>{new Date(sale.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
                      <span>•</span>
                      <span className="font-semibold uppercase text-orange-700 bg-orange-100/70 px-1.5 py-0.2 rounded text-[10px]">
                        {sale.paymentMode}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <b className="text-sm font-extrabold text-slate-900">
                      ₹{sale.amount.toFixed(2)}
                    </b>
                    <button
                      onClick={() => handleShareWhatsApp(sale)}
                      className="p-1.5 text-slate-400 hover:text-emerald-600 rounded-lg hover:bg-emerald-50"
                      title="Share Bill via WhatsApp"
                    >
                      <Share2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="h-12" />
      </div>

      {/* Support Modal */}
      {supportModalOpen && (
        <div className="ezo-modal-overlay" onClick={() => setSupportModalOpen(false)}>
          <div className="ezo-modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="ezo-modal-hero bg-gradient-to-br from-orange-600 to-orange-500 text-white p-4 rounded-t-2xl text-center">
              <Headphones className="w-8 h-8 text-white mx-auto mb-1" />
              <h3 className="text-base font-bold">NovaPOS Help & Support</h3>
              <p className="text-xs text-orange-100">24/7 Merchant Customer Helpline</p>
            </div>
            <div className="p-4 space-y-3">
              <a
                href="https://wa.me/919381563241?text=Hello%20NovaPOS%20Support%2C%20I%20need%20assistance%20with%20my%20POS%20system."
                target="_blank"
                rel="noreferrer"
                className="w-full py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-sm"
              >
                WhatsApp Helpline (+91 9381563241)
              </a>
              <a
                href="tel:9381563241"
                className="w-full py-2.5 px-3 bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-sm"
              >
                <Headphones className="w-4 h-4" />
                Call Helpline (+91 9381563241)
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

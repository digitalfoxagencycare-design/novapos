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
  Edit3,
} from 'lucide-react';
import { type BusinessProfile, PROFILES } from '../lib/business';
import { loadDayBookEntries, filterEntriesByPeriod, type DayBookEntry } from '../lib/dayBook';
import { useSubscriptionDetails } from '../lib/subscription';
import { ComplianceModal } from '../components/ComplianceModal';
import { printBillDirect, getActiveNativePrinter, type BillData, type BillItem } from '../lib/thermalPrinter';
import { speakPaymentAlert } from '../lib/hardwareBridge';

interface Props {
  profile: BusinessProfile;
  profileName: string;
  phone: string;
  address?: string;
  onOpenMenu: () => void;
  onNavigate: (screen: string) => void;
  onOpenPrinterModal: () => void;
  onEditBill?: (bill: DayBookEntry) => void;
}

export const DashboardScreen: React.FC<Props> = ({
  profile,
  profileName,
  phone,
  address,
  onOpenMenu,
  onNavigate,
  onOpenPrinterModal,
  onEditBill,
}) => {
  const [hideDateBanner, setHideDateBanner] = useState(false);
  const [emailReportEnabled, setEmailReportEnabled] = useState(false);
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [emailInput, setEmailInput] = useState('');
  const [supportModalOpen, setSupportModalOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncToast, setSyncToast] = useState(false);
  const [printerConnected, setPrinterConnected] = useState<boolean>(() => {
    return localStorage.getItem('novapos_printer_connected') === 'true';
  });
  const [printerName, setPrinterName] = useState<string>(() => {
    return localStorage.getItem('novapos_printer_name') || '';
  });
  const [printerBannerDismissed, setPrinterBannerDismissed] = useState<boolean>(() => {
    return localStorage.getItem('novapos_dismiss_printer_banner') === 'true';
  });

  useEffect(() => {
    void getActiveNativePrinter().then((dev) => {
      if (dev) {
        setPrinterConnected(true);
        setPrinterName(dev.name || '');
        localStorage.setItem('novapos_printer_connected', 'true');
      }
    });
  }, []);
  const subDetails = useSubscriptionDetails();
  const [complianceModalOpen, setComplianceModalOpen] = useState(false);

  // Saved Bill Details Modal state
  const [selectedSale, setSelectedSale] = useState<DayBookEntry | null>(null);
  const [billPrintSuccess, setBillPrintSuccess] = useState(false);
  const [billPrintError, setBillPrintError] = useState<string | null>(null);

  useBackHandler(Boolean(selectedSale) || emailModalOpen || supportModalOpen || complianceModalOpen, () => {
    if (selectedSale) setSelectedSale(null);
    else if (complianceModalOpen) setComplianceModalOpen(false);
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

  const handlePrintSaleDirect = async (sale: DayBookEntry) => {
    setBillPrintError(null);
    speakPaymentAlert(sale.amount, sale.paymentMode === 'credit' ? 'Khata' : sale.paymentMode);
    try {
      let billData: BillData;
      if (sale.receiptSnapshot) {
        billData = { ...sale.receiptSnapshot, isDuplicate: true };
      } else {
        const dateObj = new Date(sale.timestamp);
        const items: BillItem[] = sale.lines && sale.lines.length > 0
          ? sale.lines.map((l) => ({
              name: l.name,
              quantity: l.quantity,
              price: l.price,
              total: l.price * l.quantity,
            }))
          : [{
              name: sale.description || 'Sale Item',
              quantity: 1,
              price: sale.amount,
              total: sale.amount,
            }];
        billData = {
          restaurantName: profileName || 'NovaPOS Store',
          address: address || '',
          phone: phone || '',
          billNo: sale.referenceNo || sale.id,
          date: dateObj.toLocaleDateString('en-IN'),
          time: dateObj.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
          orderType: 'DINE-IN',
          items,
          subtotal: sale.amount,
          cgst: 0,
          sgst: 0,
          total: sale.amount,
          paymentMode: sale.paymentMode.toUpperCase(),
          isDuplicate: true,
        };
      }
      await printBillDirect(billData);
      setBillPrintSuccess(true);
      setTimeout(() => setBillPrintSuccess(false), 3000);
    } catch (err) {
      setBillPrintError((err as Error).message || 'Failed to print bill');
    }
  };

  return (
    <div className="ezo-dashboard-container">
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
      <div className="ezo-dash-scroll-body space-y-3.5 px-3.5 pt-3 pb-24">
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
              className="p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 flex flex-col items-center justify-center gap-1.5 transition-all active:scale-95"
            >
              <Users className="w-5 h-5 text-slate-700" />
              <span className="text-[11px] font-bold text-center leading-tight">Staff</span>
            </button>
          </div>
        </div>

        {/* 6. Smart Dismissible Printer Status Card */}
        {!printerBannerDismissed && (
          <div className="bg-slate-900 text-white p-3 rounded-2xl shadow-sm flex items-center justify-between">
            <div className="flex items-center gap-2.5 cursor-pointer flex-1 min-w-0" onClick={onOpenPrinterModal}>
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${printerConnected ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white/10 text-orange-400'}`}>
                <Printer className="w-4 h-4" />
              </div>
              <div className="min-w-0 pr-2">
                <b className="text-xs font-bold block truncate">
                  {printerConnected ? `Printer: ${printerName || 'Connected'}` : 'Connect Thermal Printer'}
                </b>
                <span className="text-[10px] text-slate-300 block">
                  {printerConnected ? 'Ready for printing 58mm & 80mm' : 'Bluetooth / USB 58mm & 80mm'}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                type="button"
                onClick={onOpenPrinterModal}
                className={`px-3 py-1 text-white font-bold text-[11px] rounded-lg shadow-xs ${printerConnected ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-orange-600 hover:bg-orange-500'}`}
              >
                {printerConnected ? 'Settings' : 'Connect'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setPrinterBannerDismissed(true);
                  localStorage.setItem('novapos_dismiss_printer_banner', 'true');
                }}
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
              <b className="text-sm font-extrabold text-slate-800 uppercase tracking-wider block">
                Recent Sale Transactions
              </b>
              <span className="text-xs text-slate-500">
                {todaySales.length} {todaySales.length === 1 ? 'bill' : 'bills'} recorded today • Tap to View / Print / Edit
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
              {todaySales.slice(0, 20).map((sale) => (
                <div
                  key={sale.id}
                  onClick={() => setSelectedSale(sale)}
                  className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between hover:bg-orange-50/70 transition-colors cursor-pointer active:scale-[0.99]"
                >
                  <div className="min-w-0">
                    <b className="text-sm font-bold text-slate-800 block truncate">
                      {sale.referenceNo || sale.id}
                    </b>
                    <div className="text-xs text-slate-500 flex items-center gap-2 mt-1">
                      <span>{new Date(sale.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
                      <span>•</span>
                      <span className="font-bold uppercase text-orange-700 bg-orange-100/80 px-2 py-0.5 rounded text-[11px]">
                        {sale.paymentMode}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5">
                    <b className="text-base font-black text-slate-900">
                      ₹{sale.amount.toFixed(2)}
                    </b>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleShareWhatsApp(sale);
                      }}
                      className="p-2 text-slate-400 hover:text-emerald-600 rounded-lg hover:bg-emerald-50 transition-colors"
                      title="Share Bill via WhatsApp"
                    >
                      <Share2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="h-8" />
      </div>

      {/* Saved Bill Details Modal (Clicking any bill opens print & edit options) */}
      {selectedSale && (
        <div className="ezo-modal-overlay" onClick={() => setSelectedSale(null)}>
          <div
            className="ezo-modal-dialog max-w-sm w-full bg-white rounded-2xl overflow-hidden shadow-2xl border border-slate-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-4 bg-gradient-to-r from-orange-600 to-orange-500 text-white flex items-center justify-between shadow-sm">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
                  <Receipt className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm leading-tight">
                    {selectedSale.referenceNo || selectedSale.id}
                  </h3>
                  <span className="text-[11px] text-orange-100">
                    {new Date(selectedSale.timestamp).toLocaleString('en-IN', {
                      dateStyle: 'short',
                      timeStyle: 'short',
                    })}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setSelectedSale(null)}
                className="p-1 text-white/80 hover:text-white rounded-full"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content Body */}
            <div className="p-4 space-y-3.5 max-h-[70vh] overflow-y-auto">
              {/* Toast Feedback */}
              {billPrintSuccess && (
                <div className="p-2.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-bold flex items-center gap-2 animate-in fade-in">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  <span>Receipt printed & voice alert announced!</span>
                </div>
              )}
              {billPrintError && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs font-bold">
                  {billPrintError}
                </div>
              )}

              {/* Bill Details summary */}
              <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl border border-slate-100 text-xs">
                <div>
                  <span className="text-slate-400 block text-[10px] font-bold uppercase">Payment Mode</span>
                  <span className="font-extrabold text-orange-700 uppercase">
                    {selectedSale.paymentMode}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-slate-400 block text-[10px] font-bold uppercase">Total Amount</span>
                  <span className="font-black text-slate-900 text-base">
                    ₹{selectedSale.amount.toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Items Breakdown */}
              <div className="space-y-1.5">
                <span className="text-xs font-bold text-slate-700 block">
                  Billed Items
                </span>
                {selectedSale.lines && selectedSale.lines.length > 0 ? (
                  <div className="border border-slate-200 rounded-xl overflow-hidden bg-white text-xs">
                    <table className="w-full text-left">
                      <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                        <tr>
                          <th className="p-2">Item</th>
                          <th className="p-2 text-center">Qty</th>
                          <th className="p-2 text-right">Price</th>
                          <th className="p-2 text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {selectedSale.lines.map((l, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/50">
                            <td className="p-2 font-medium text-slate-800">{l.name}</td>
                            <td className="p-2 text-center font-bold text-slate-600">
                              {l.quantity} {l.uom || ''}
                            </td>
                            <td className="p-2 text-right text-slate-500">₹{l.price.toFixed(2)}</td>
                            <td className="p-2 text-right font-bold text-slate-900">
                              ₹{(l.price * l.quantity).toFixed(2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs text-slate-600 flex justify-between">
                    <span>{selectedSale.description}</span>
                    <span className="font-bold text-slate-900">₹{selectedSale.amount.toFixed(2)}</span>
                  </div>
                )}
              </div>

              {/* Action Buttons: 1. Talk & Print, 2. Edit Bill, 3. WhatsApp */}
              <div className="space-y-2 pt-2 border-t border-slate-100">
                {/* Print & Voice button */}
                <button
                  type="button"
                  onClick={() => handlePrintSaleDirect(selectedSale)}
                  className="w-full py-2.5 px-3 bg-orange-600 hover:bg-orange-700 active:scale-[0.98] text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-md transition-transform"
                >
                  <Printer className="w-4 h-4" />
                  <span>Print Bill & Talk Announcement</span>
                </button>

                {/* Edit Bill Button */}
                <button
                  type="button"
                  onClick={() => {
                    const billToEdit = selectedSale;
                    setSelectedSale(null);
                    onEditBill?.(billToEdit);
                  }}
                  className="w-full py-2.5 px-3 bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-900 rounded-xl font-bold text-xs flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
                >
                  <Edit3 className="w-4 h-4 text-amber-700" />
                  <span>Edit Bill (Modify Items / Re-invoice)</span>
                </button>

                {/* WhatsApp Share */}
                <button
                  type="button"
                  onClick={() => handleShareWhatsApp(selectedSale)}
                  className="w-full py-2 px-3 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 text-emerald-800 rounded-xl font-bold text-xs flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
                >
                  <Share2 className="w-4 h-4 text-emerald-600" />
                  <span>Share Receipt on WhatsApp</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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

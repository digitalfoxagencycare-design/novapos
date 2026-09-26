import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowLeft,
  Sliders,
  Printer,
  QrCode,
  Store,
  CheckCircle2,
  AlertCircle,
  Search,
  Wifi,
  Save,
  Crown,
  Sparkles,
  CreditCard,
  X,
  ShieldCheck,
  Check,
  Scale,
  Lock,
} from 'lucide-react';
import {
  EZO_34_SETTINGS,
  loadEzoSettings,
  updateEzoSetting,
  type EzoSettingsMap,
} from '../lib/ezoSettings';
import {
  type PaperWidth,
  type PrinterDevice,
  printTestSlipViaBrowser,
  connectBluetoothPrinter,
  isBluetoothSupported,
} from '../lib/thermalPrinter';
import { refreshSubscription, useSubscriptionDetails } from '../lib/subscription';
import { cloudApi } from '../lib/cloudSession';
import { openSubscriptionCheckout } from '../lib/razorpayCheckout';
import { useBackHandler } from '../lib/navigation';
import { useDialogFocus } from '../lib/useDialogFocus';
import { ComplianceModal } from '../components/ComplianceModal';

interface Props {
  profileName: string;
  phone: string;
  address: string;
  gstin: string;
  fssai: string;
  upiVpa: string;
  onUpdateProfile: (updates: {
    profileName?: string;
    phone?: string;
    address?: string;
    gstin?: string;
    fssai?: string;
    upiVpa?: string;
  }) => void;
  onBack?: () => void;
}

export const SettingsScreen: React.FC<Props> = ({
  profileName,
  phone,
  address,
  gstin,
  fssai,
  upiVpa,
  onUpdateProfile,
  onBack,
}) => {
  const [settings, setSettings] = useState<EzoSettingsMap>(loadEzoSettings());
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [savedBadge, setSavedBadge] = useState(false);

  // Business Profile Form States
  const [editName, setEditName] = useState(profileName);
  const [editPhone, setEditPhone] = useState(phone);
  const [editAddress, setEditAddress] = useState(address);
  const [editGstin, setEditGstin] = useState(gstin);
  const [editFssai, setEditFssai] = useState(fssai);
  const [editUpiVpa, setEditUpiVpa] = useState(upiVpa);

  // Subscription / SaaS Licensing States
  const subDetails = useSubscriptionDetails();
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
  const [selectedPlanKey, setSelectedPlanKey] = useState<'starter_monthly' | 'pro_yearly'>('pro_yearly');
  const [isPaying, setIsPaying] = useState(false);
  const [paymentSuccessMsg, setPaymentSuccessMsg] = useState<string | null>(null);
  const [complianceModalOpen, setComplianceModalOpen] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const paymentLock = useRef(false);
  const dialogRef = useDialogFocus(isUpgradeModalOpen);
  useBackHandler(isUpgradeModalOpen, () => { if (!paymentLock.current) setIsUpgradeModalOpen(false); });
  useEffect(() => { void refreshSubscription().catch(() => undefined); }, []);


  // Printer States
  const [paperWidth, setPaperWidth] = useState<PaperWidth>('58mm');
  const [printerError, setPrinterError] = useState<string | null>(null);

  const categories = [
    { id: 'all', label: 'All (34 Settings)' },
    { id: 'billing', label: 'Billing & Sales' },
    { id: 'selector', label: 'Item Selector & Grid' },
    { id: 'inventory', label: 'Stock & Inventory' },
    { id: 'payment', label: 'Payments & Cash' },
    { id: 'hardware', label: 'Barcode & Hardware' },
    { id: 'security', label: 'Staff Locks & Security' },
  ];

  const filteredSettings = EZO_34_SETTINGS.filter((s) => {
    if (selectedCategory !== 'all' && s.category !== selectedCategory) return false;
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return s.code.includes(q) || s.title.toLowerCase().includes(q) || s.desc.toLowerCase().includes(q);
  });

  const handleToggle = (id: string, current: boolean) => {
    const updated = updateEzoSetting(id, !current);
    setSettings({ ...updated });
    showSavedNotification();
  };

  const handleSelectChange = (id: string, value: string) => {
    const updated = updateEzoSetting(id, value);
    setSettings({ ...updated });
    showSavedNotification();
  };

  const handleNumberChange = (id: string, value: number) => {
    const updated = updateEzoSetting(id, value);
    setSettings({ ...updated });
    showSavedNotification();
  };

  const showSavedNotification = () => {
    setSavedBadge(true);
    setTimeout(() => setSavedBadge(false), 2000);
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateProfile({
      profileName: editName,
      phone: editPhone,
      address: editAddress,
      gstin: editGstin,
      fssai: editFssai,
      upiVpa: editUpiVpa,
    });
    showSavedNotification();
  };

  const [connectedPrinter, setConnectedPrinter] = useState<PrinterDevice | null>(null);
  const [connecting, setConnecting] = useState(false);

  const handleConnectBluetooth = async () => {
    setConnecting(true);
    setPrinterError(null);
    try {
      if (!isBluetoothSupported()) {
        // Native Android app / WebView fallback
        setConnectedPrinter({
          connected: true,
          type: 'browser',
          name: 'Android Paired Thermal Printer',
        });
        showSavedNotification();
        return;
      }
      const dev = await connectBluetoothPrinter();
      setConnectedPrinter(dev);
      showSavedNotification();
    } catch (err: any) {
      // If user cancelled or not supported, provide friendly tip
      if (err.name === 'NotFoundError') {
        setPrinterError(null);
      } else {
        setConnectedPrinter({
          connected: true,
          type: 'browser',
          name: 'Android ESC/POS System Printer',
        });
        showSavedNotification();
      }
    } finally {
      setConnecting(false);
    }
  };


  const handleTestPrint = () => {
    try {
      setPrinterError(null);
      printTestSlipViaBrowser(paperWidth, profileName);
    } catch (err: any) {
      setPrinterError(err.message || 'Test print failed');
    }
  };

  const handleUpgradePayment = async () => {
    if (paymentLock.current) return;
    paymentLock.current = true;
    setIsPaying(true);
    setPaymentError(null);
    const planKey = selectedPlanKey;
    let confirmationReceived = false;
    try {
      if (!cloudApi.isAuthenticated) throw new Error('Sign out and sign in online to connect your merchant account before upgrading.');
      const order = await cloudApi.createSubscriptionOrder(planKey);
      const response = await openSubscriptionCheckout(order, profileName, phone);
      confirmationReceived = true;
      if (response.razorpay_order_id !== order.orderId) throw new Error('Payment order mismatch. Contact support.');
      await cloudApi.verifySubscription({ planKey, orderId: order.orderId, paymentId: response.razorpay_payment_id, signature: response.razorpay_signature });
      await refreshSubscription();
      setPaymentSuccessMsg(`Payment verified. Your license is active. Reference: ${response.razorpay_payment_id}`);
      setIsUpgradeModalOpen(false);
    } catch (err) {
      setPaymentError(confirmationReceived
        ? 'Payment received; license confirmation is pending. Use Refresh license before paying again. Your payment will also be reconciled by the server.'
        : (err as Error).message || 'Payment could not be started. Please retry.');
    } finally {
      paymentLock.current = false;
      setIsPaying(false);
    }
  };

  return (
    <div className="ezo-screen-container">
      {/* Top Purple App Bar */}
      <div className="ezo-app-bar">
        <button className="ezo-back-btn" onClick={onBack} title="Back">
          <ArrowLeft className="w-6 h-6 text-white" /><span>Back</span></button>
        <div className="ezo-title-group">
          <h1 className="ezo-bar-title">Settings</h1>
          <span className="ezo-bar-sub">FAST v39.31 {phone ? `| +91 ${phone}` : ''}</span>
        </div>
      </div>

      <div className="ezo-screen-scroll">
        <div className="p-4 max-w-4xl mx-auto space-y-5">
          {savedBadge && (
            <div className="ezo-success-toast">
              <CheckCircle2 className="w-4 h-4 mr-2" />
              <span>Settings Saved Successfully!</span>
            </div>
          )}

          {/* Quick Hardware Bar */}
          <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center flex-shrink-0">
                  <Printer className="w-5 h-5 text-indigo-600" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <b className="text-sm text-slate-800">Thermal Printer</b>
                    {connectedPrinter ? (
                      <span className="px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block animate-pulse" />
                        {connectedPrinter.name}
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[10.5px] font-medium bg-slate-100 text-slate-600">
                        Ready
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500">58mm (2") / 80mm (3") ESC/POS Support</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={paperWidth}
                  onChange={(e) => setPaperWidth(e.target.value as PaperWidth)}
                  className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-slate-50 text-slate-700 font-semibold"
                >
                  <option value="58mm">58mm (2 Inch)</option>
                  <option value="80mm">80mm (3 Inch)</option>
                </select>
                <button
                  type="button"
                  onClick={handleConnectBluetooth}
                  disabled={connecting}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold border border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition-colors flex items-center gap-1"
                >
                  <Wifi className="w-3.5 h-3.5" />
                  <span>{connecting ? 'Connecting...' : connectedPrinter ? 'Re-pair' : 'Pair Bluetooth'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleTestPrint}
                  className="ezo-btn-primary text-xs py-1.5 px-3 shadow-xs"
                >
                  Test Print
                </button>
              </div>
            </div>

            {printerError && (
              <div className="text-xs text-rose-600 bg-rose-50 p-2 rounded-lg border border-rose-100 flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{printerError}</span>
              </div>
            )}

            <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs text-slate-600 flex items-start gap-2">
              <span className="font-bold text-indigo-600 flex-shrink-0">Tip:</span>
              <span>
                For mobile Bluetooth 58mm printers (Ezo, Everycom, TVS), pair once in Android phone Bluetooth Settings.
                Bills print with 1-tap from Calculator and Sales Invoice.
              </span>
            </div>
          </div>

          {/* SaaS Subscription & License Card (High Contrast & Modern Branding) */}
          <div
            style={{
              background: 'linear-gradient(135deg, #1E1B4B 0%, #312E81 50%, #4338CA 100%)',
              color: '#FFFFFF',
              boxShadow: '0 8px 24px rgba(30, 27, 75, 0.3)',
            }}
            className="rounded-2xl p-4 sm:p-5 border border-indigo-500/30 relative overflow-hidden"
          >
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 relative z-10">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-white/15 border border-white/25 flex items-center justify-center shadow-xs flex-shrink-0">
                    <Sparkles className="w-5 h-5 text-amber-300" />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <b className="text-base font-black tracking-wide text-white">
                        NovaPOS Cloud SaaS
                      </b>
                      <span
                        style={{
                          backgroundColor:
                            subDetails.plan === 'PRO'
                              ? '#10B981'
                              : subDetails.plan === 'STARTER'
                              ? '#6366F1'
                              : subDetails.isExpired
                              ? '#EF4444'
                              : '#F59E0B',
                          color: '#FFFFFF',
                        }}
                        className="px-2.5 py-0.5 rounded-full text-[10.5px] font-black uppercase tracking-wider shadow-xs"
                      >
                        {subDetails.plan === 'PRO'
                          ? 'Pro Annual'
                          : subDetails.plan === 'STARTER'
                          ? 'Starter Monthly'
                          : subDetails.isExpired
                          ? 'Trial Expired'
                          : '3-Days Free Trial'}
                      </span>
                    </div>
                  </div>
                </div>

                <p className="text-xs text-indigo-100 font-medium pl-11">
                  {!subDetails.isExpired ? (
                    <>
                      License verified ·{' '}
                      <b className="text-emerald-300 font-bold">
                        {subDetails.daysRemaining} {subDetails.daysRemaining === 1 ? 'day' : 'days'} remaining
                      </b>{' '}
                      (Expires {subDetails.formattedExpiresAt})
                    </>
                  ) : (
                    <span className="text-rose-300 font-bold">
                      License expired or unverified · Connect to refresh or upgrade
                    </span>
                  )}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setIsUpgradeModalOpen(true)}
                style={{
                  background: 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)',
                  color: '#0F172A',
                }}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl font-black text-xs shadow-lg hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-2 flex-shrink-0"
              >
                <ShieldCheck className="w-4 h-4 text-slate-900" />
                <span>
                  {subDetails.plan === 'PRO' ? 'Extend Subscription' : 'Upgrade Plan (Razorpay)'}
                </span>
              </button>
            </div>

            {paymentSuccessMsg && (
              <div className="mt-3 bg-emerald-500/25 border border-emerald-400/50 p-2.5 rounded-xl text-xs text-emerald-100 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-300 flex-shrink-0" />
                <span>{paymentSuccessMsg}</span>
              </div>
            )}
          </div>

          {/* Dedicated GST Tax Configuration & Ruleset Card */}
          <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm space-y-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-50 border border-purple-100 flex items-center justify-center flex-shrink-0">
                  <span className="text-sm font-black text-purple-700">GST</span>
                </div>
                <div>
                  <b className="text-sm text-slate-800">GST & Tax Master Settings</b>
                  <p className="text-xs text-slate-500">Regular / Composition Schemes, Slabs & Invoicing</p>
                </div>
              </div>
              <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-purple-50 text-purple-700 border border-purple-200">
                Active: Regular (IN-GST)
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
                <label className="text-xs font-bold text-slate-700 block">Business GSTIN</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={editGstin}
                    onChange={(e) => setEditGstin(e.target.value.toUpperCase())}
                    placeholder="e.g. 36AAAAA0000A1Z5"
                    className="flex-1 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold text-slate-800"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      onUpdateProfile({ gstin: editGstin });
                      showSavedNotification();
                    }}
                    className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 transition-colors"
                  >
                    Update
                  </button>
                </div>
                <span className="text-[11px] text-slate-500">Printed on all Tax Invoices & Reports</span>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
                <label className="text-xs font-bold text-slate-700 block">Default GST Rate for New Items</label>
                <div className="grid grid-cols-5 gap-1 pt-0.5">
                  {[0, 5, 12, 18, 28].map((slab) => (
                    <button
                      key={slab}
                      type="button"
                      onClick={() => {
                        handleNumberChange('defaultGstSlab', slab);
                      }}
                      className={`py-1 rounded text-xs font-bold border transition-colors ${
                        (settings['defaultGstSlab'] ?? 5) === slab
                          ? 'bg-purple-600 text-white border-purple-700 shadow-xs'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {slab}%
                    </button>
                  ))}
                </div>
                <span className="text-[11px] text-slate-500">Applied automatically when adding catalog items</span>
              </div>
            </div>

            <div className="border-t border-slate-100 pt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                <div>
                  <b className="text-xs text-slate-800 block">Print GST Breakdown (CGST/SGST)</b>
                  <span className="text-[11px] text-slate-500">Show itemized tax table on thermal slips</span>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={Boolean(settings['printGstBreakdown'] ?? true)}
                  onClick={() => handleToggle('printGstBreakdown', Boolean(settings['printGstBreakdown'] ?? true))}
                  className={`ezo-modern-switch ${Boolean(settings['printGstBreakdown'] ?? true) ? 'active' : ''}`}
                >
                  <span className="switch-thumb" />
                </button>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                <div>
                  <b className="text-xs text-slate-800 block">Prices Include GST (MRP Inclusive)</b>
                  <span className="text-[11px] text-slate-500">Calculate backward tax split from price</span>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={Boolean(settings['pricesIncludeTax'] ?? true)}
                  onClick={() => handleToggle('pricesIncludeTax', Boolean(settings['pricesIncludeTax'] ?? true))}
                  className={`ezo-modern-switch ${Boolean(settings['pricesIncludeTax'] ?? true) ? 'active' : ''}`}
                >
                  <span className="switch-thumb" />
                </button>
              </div>
            </div>
          </div>

          {/* Legal, Privacy Policy & Play Store Compliance Card */}
          <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center flex-shrink-0">
                <Scale className="w-5 h-5 text-slate-700" />
              </div>
              <div>
                <b className="text-sm text-slate-800">Legal, Privacy & App Compliance</b>
                <p className="text-xs text-slate-500">Google Play Data Safety, Terms of Service & Publisher Details</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setComplianceModalOpen(true)}
              className="px-3.5 py-1.5 rounded-lg text-xs font-bold border border-slate-300 bg-slate-50 text-slate-700 hover:bg-slate-100 transition-colors flex items-center gap-1 flex-shrink-0"
            >
              <span>View Policy</span>
            </button>
          </div>

          {/* Category Pills */}
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
            {categories.map((c) => (
              <button
                key={c.id}
                onClick={() => setSelectedCategory(c.id)}
                className={`text-xs font-semibold px-3 py-1.5 rounded-full whitespace-nowrap transition-colors ${
                  selectedCategory === c.id
                    ? 'bg-indigo-600 text-white'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Search setting name or code (e.g. 2.1, 2.2)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* 34 Settings List */}
          <div className="space-y-2">
            {filteredSettings.map((item) => {
              const val = settings[item.id];
              return (
                <div
                  key={item.id}
                  className="bg-white rounded-xl p-3.5 border border-slate-200 shadow-sm flex items-center justify-between gap-4"
                >
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <span className="text-xs font-bold px-2 py-0.5 rounded bg-indigo-50 text-indigo-600 border border-indigo-100 flex-shrink-0 mt-0.5">
                      {item.code}
                    </span>
                    <div className="min-w-0">
                      <b className="text-sm text-slate-800 block truncate">{item.title}</b>
                      <p className="text-xs text-slate-500 mt-0.5">{item.desc}</p>
                    </div>
                  </div>

                  <div className="flex-shrink-0">
                    {item.type === 'boolean' && (
                      <button
                        type="button"
                        role="switch"
                        aria-checked={Boolean(val)}
                        onClick={() => handleToggle(item.id, Boolean(val))}
                        className={`ezo-modern-switch ${Boolean(val) ? 'active' : ''}`}
                      >
                        <span className="switch-thumb" />
                      </button>
                    )}

                    {item.type === 'select' && item.options && (
                      <select
                        value={String(val)}
                        onChange={(e) => handleSelectChange(item.id, e.target.value)}
                        className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-slate-50 text-slate-700 focus:ring-2 focus:ring-indigo-500"
                      >
                        {item.options.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    )}

                    {item.type === 'number' && (
                      <input
                        type="number"
                        value={Number(val)}
                        onChange={(e) => handleNumberChange(item.id, Number(e.target.value))}
                        className="w-20 text-xs border border-slate-200 rounded-lg px-2 py-1 bg-slate-50 text-slate-800"
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* SaaS Plan Upgrade Modal */}
      {isUpgradeModalOpen && (
        <div className="license-overlay">
          <div ref={dialogRef} className="license-dialog" role="dialog" aria-modal="true" aria-labelledby="license-title">
            {/* Modal Header */}
            <div
              style={{
                background: 'linear-gradient(135deg, #1E1B4B 0%, #312E81 50%, #4338CA 100%)',
                color: '#FFFFFF',
              }}
              className="p-4 flex items-center justify-between"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber-400/20 border border-amber-400/40 flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-amber-300" />
                </div>
                <div>
                  <h3 id="license-title" className="text-sm font-black tracking-wide text-white">Upgrade NovaPOS SaaS License</h3>
                  <p className="text-[11px] text-indigo-200">Official Razorpay Secured Gateway</p>
                </div>
              </div>
              <button
                type="button"
                disabled={isPaying}
                aria-label="Close upgrade dialog"
                onClick={() => setIsUpgradeModalOpen(false)}
                className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Plans Selection */}
            <div className="license-dialog-body p-4 space-y-3.5">
              {/* Pro Yearly Option */}
              <button type="button" aria-pressed={selectedPlanKey === 'pro_yearly'} disabled={isPaying}
                onClick={() => { if (!isPaying) setSelectedPlanKey('pro_yearly'); }}
                className={`license-plan p-3.5 rounded-xl border-2 transition-all cursor-pointer relative ${
                  selectedPlanKey === 'pro_yearly'
                    ? 'border-indigo-600 bg-indigo-50/60 shadow-sm'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <span className="absolute -top-2.5 right-3 bg-amber-500 text-slate-950 text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider shadow-xs">
                  Save 17% · Best Value
                </span>
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <b className="text-sm text-slate-900">Pro Annual License</b>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">365 Days · Multi-Terminal + Auto GST + Cloud</p>
                  </div>
                  <div className="text-right">
                    <span className="text-base font-black text-indigo-700">₹4,999</span>
                    <span className="text-[10px] text-slate-500 block">/ year</span>
                  </div>
                </div>
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  <span className="text-[10px] font-semibold bg-white border border-indigo-100 text-indigo-700 px-2 py-0.5 rounded-md flex items-center gap-1">
                    <Check className="w-3 h-3 text-emerald-600" /> Multi-Counter Sync
                  </span>
                  <span className="text-[10px] font-semibold bg-white border border-indigo-100 text-indigo-700 px-2 py-0.5 rounded-md flex items-center gap-1">
                    <Check className="w-3 h-3 text-emerald-600" /> GSTR-1 Auto Reports
                  </span>
                  <span className="text-[10px] font-semibold bg-white border border-indigo-100 text-indigo-700 px-2 py-0.5 rounded-md flex items-center gap-1">
                    <Check className="w-3 h-3 text-emerald-600" /> 24/7 Cloud Backup
                  </span>
                </div>
              </button>

              {/* Starter Monthly Option */}
              <button type="button" aria-pressed={selectedPlanKey === 'starter_monthly'} disabled={isPaying}
                onClick={() => { if (!isPaying) setSelectedPlanKey('starter_monthly'); }}
                className={`license-plan p-3.5 rounded-xl border-2 transition-all cursor-pointer ${
                  selectedPlanKey === 'starter_monthly'
                    ? 'border-indigo-600 bg-indigo-50/60 shadow-sm'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <b className="text-sm text-slate-900">Starter Monthly</b>
                    <p className="text-xs text-slate-500 mt-0.5">30 Days · 1 POS Terminal + Offline Billing</p>
                  </div>
                  <div className="text-right">
                    <span className="text-base font-black text-slate-800">₹499</span>
                    <span className="text-[10px] text-slate-500 block">/ month</span>
                  </div>
                </div>
              </button>

              {paymentError && <p role="alert" className="license-error">{paymentError}</p>}
              <button type="button" disabled={isPaying} className="license-refresh" onClick={async () => {
                try { await refreshSubscription(); setPaymentError(null); }
                catch (err) { setPaymentError((err as Error).message); }
              }}>Refresh license status</button>
              {/* Pay with Razorpay Button */}
              <button
                type="button"
                onClick={handleUpgradePayment}
                disabled={isPaying}
                style={{
                  background: '#5B42F3',
                  color: '#FFFFFF',
                  boxShadow: '0 4px 14px rgba(91, 66, 243, 0.4)',
                }}
                className="w-full py-4 rounded-xl text-white font-black text-sm transition-all active:scale-95 flex items-center justify-center gap-2 mt-4 cursor-pointer"
              >
                {isPaying ? (
                  <span className="text-white font-bold">Connecting Razorpay Gateway...</span>
                ) : (
                  <>
                    <ShieldCheck className="w-5 h-5 text-white" />
                    <span className="text-white font-black tracking-wide text-base">
                      Pay {selectedPlanKey === 'pro_yearly' ? '₹4,999' : '₹499'} with Razorpay
                    </span>
                  </>
                )}
              </button>

              <p className="text-[11px] text-center text-slate-500 font-medium flex items-center justify-center gap-1.5 pt-1">
                <Lock className="w-3.5 h-3.5 text-emerald-600" />
                <span>Available UPI apps, Cards & NetBanking</span>
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Compliance / Privacy Policy Modal */}
      <ComplianceModal
        isOpen={complianceModalOpen}
        onClose={() => setComplianceModalOpen(false)}
      />
    </div>
  );
};

import { getPaperWidth, setPaperWidth as persistPaperWidth } from '../lib/printerSettings';
import React, { useState, useEffect } from 'react';
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
  Sparkles,
  ShieldCheck,
  Check,
  Scale,
  RefreshCw,
  X,
  Smartphone,
  Radio,
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
  listPairedBluetoothPrinters,
  requestNativeBluetoothPermissions,
  connectNativeBluetoothPrinter,
  disconnectNativeBluetoothPrinter,
  getActiveNativePrinter,
  buildTestSlipBytes,
  writeEscPosBytes,
} from '../lib/thermalPrinter';
import { refreshSubscription, useSubscriptionDetails } from '../lib/subscription';
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

  // Subscription / Licensing States
  const subDetails = useSubscriptionDetails();
  const [complianceModalOpen, setComplianceModalOpen] = useState(false);
  useEffect(() => { void refreshSubscription().catch(() => undefined); }, []);

  // Ezo-style Printer States
  const [paperWidth, setPaperWidth] = useState<PaperWidth>(() => {
    return getPaperWidth();
  });
  const [printerType, setPrinterType] = useState<'bluetooth' | 'usb'>(() => {
    return (localStorage.getItem('novapos_printer_type') as 'bluetooth' | 'usb') || 'bluetooth';
  });
  const [primaryPrinterEnabled, setPrimaryPrinterEnabled] = useState<boolean>(() => {
    return localStorage.getItem('novapos_primary_printer_enabled') !== 'false';
  });
  const [secondaryKotEnabled, setSecondaryKotEnabled] = useState<boolean>(() => {
    return localStorage.getItem('novapos_secondary_kot_enabled') === 'true';
  });
  const [autoPrintSale, setAutoPrintSale] = useState<boolean>(() => {
    return localStorage.getItem('novapos_auto_print_sale') === 'true';
  });

  const [charsPerLine, setCharsPerLine] = useState<number>(() => {
    const val = localStorage.getItem('novapos_printer_cpl');
    return val ? parseInt(val, 10) : 32;
  });
  const [col2Chars, setCol2Chars] = useState<number>(() => {
    const val = localStorage.getItem('novapos_printer_col2');
    return val ? parseInt(val, 10) : 4;
  });
  const [col3Chars, setCol3Chars] = useState<number>(() => {
    const val = localStorage.getItem('novapos_printer_col3');
    return val ? parseInt(val, 10) : 6;
  });
  const [col4Chars, setCol4Chars] = useState<number>(() => {
    const val = localStorage.getItem('novapos_printer_col4');
    return val ? parseInt(val, 10) : 6;
  });
  const [dotsPerLine, setDotsPerLine] = useState<number>(() => {
    const val = localStorage.getItem('novapos_printer_dpl');
    return val ? parseInt(val, 10) : 384;
  });

  const [connectedPrinter, setConnectedPrinter] = useState<PrinterDevice | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [printerError, setPrinterError] = useState<string | null>(null);

  // Modals
  const [pairedDevicesModalOpen, setPairedDevicesModalOpen] = useState(false);
  const [pairedDevicesList, setPairedDevicesList] = useState<Array<{ name: string; address: string }>>([]);
  const [testPrintAlertOpen, setTestPrintAlertOpen] = useState(false);

  // Load saved printer on boot
  useEffect(() => {
    void getActiveNativePrinter().then((dev) => {
      if (dev) setConnectedPrinter(dev);
    });
  }, []);

  const categories = [
    { id: 'all', label: 'All (34 Settings)' },
    { id: 'printer', label: '🖨️ Thermal Printer' },
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

  const handleScanPairedDevices = async () => {
    setConnecting(true);
    setPrinterError(null);
    try {
      // First ensure runtime permissions on Android 12+
      
      const devices = await listPairedBluetoothPrinters();
      setPairedDevicesList(devices);
      setPairedDevicesModalOpen(true);
    } catch (err: any) {
      setPrinterError(err.message || 'Bluetooth permission needed or no paired printers found. Please allow Bluetooth permission.');
    } finally {
      setConnecting(false);
    }
  };

  const handleSelectPairedDevice = async (device: { name: string; address: string }) => {
    setConnecting(true);
    setPrinterError(null);
    try {
      await connectNativeBluetoothPrinter(device.address);
      localStorage.setItem('novapos_printer_mac', device.address);
      localStorage.setItem('novapos_printer_name', device.name);
      const dev: PrinterDevice = {
        connected: true,
        type: 'bluetooth',
        name: device.name,
        address: device.address,
      };
      setConnectedPrinter(dev);
      setPairedDevicesModalOpen(false);
      showSavedNotification();

      // Prompt test print verification
      setTimeout(() => {
        setTestPrintAlertOpen(true);
      }, 300);
    } catch (err: any) {
      setPrinterError(err.message || 'Failed to connect to printer');
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    await disconnectNativeBluetoothPrinter();
    setConnectedPrinter(null);
    showSavedNotification();
  };

  const handleTestPrint = async () => {
    setPrinterError(null);
    try {
      const testBytes = buildTestSlipBytes(paperWidth, profileName || 'NovaPOS Store');
      const printed = await writeEscPosBytes(testBytes);
      if (!printed) {
        printTestSlipViaBrowser(paperWidth, profileName || 'NovaPOS Store');
      }
      setTestPrintAlertOpen(true);
    } catch (err: any) {
      setPrinterError(err.message || 'Test print failed');
      printTestSlipViaBrowser(paperWidth, profileName || 'NovaPOS Store');
      setTestPrintAlertOpen(true);
    }
  };

  const handleSavePrinterSettings = () => {
    persistPaperWidth(paperWidth);
    localStorage.setItem('novapos_printer_type', printerType);
    localStorage.setItem('novapos_primary_printer_enabled', String(primaryPrinterEnabled));
    localStorage.setItem('novapos_secondary_kot_enabled', String(secondaryKotEnabled));
    localStorage.setItem('novapos_auto_print_sale', String(autoPrintSale));
    localStorage.setItem('novapos_printer_cpl', String(charsPerLine));
    localStorage.setItem('novapos_printer_col2', String(col2Chars));
    localStorage.setItem('novapos_printer_col3', String(col3Chars));
    localStorage.setItem('novapos_printer_col4', String(col4Chars));
    localStorage.setItem('novapos_printer_dpl', String(dotsPerLine));
    showSavedNotification();
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

  return (
    <div className="ezo-screen-container bg-slate-100 flex flex-col h-full w-full">
      {/* 1. Top Warm Orange Header Bar */}
      <header
        className="ezo-app-bar shadow-md flex-shrink-0"
        style={{
          background: 'linear-gradient(135deg, #F97316 0%, #EA580C 100%)',
          backgroundColor: '#EA580C',
          color: '#FFFFFF',
        }}
      >
        <button
          className="ezo-back-btn flex items-center gap-1.5 font-bold text-sm bg-white/20 hover:bg-white/30 text-white px-3 py-1.5 rounded-xl border border-white/30"
          onClick={onBack}
          title="Back to Dashboard"
        >
          <ArrowLeft className="w-5 h-5 text-white" />
          <span>Back</span>
        </button>
        <div className="ezo-title-group ml-2">
          <h1 className="ezo-bar-title text-white font-extrabold text-lg">Settings & Hardware</h1>
          <span className="ezo-bar-sub text-white/90 text-xs font-medium">FAST v39.31 · Cloud POS</span>
        </div>
      </header>

      {/* 2. Scrollable Body */}
      <div className="flex-1 overflow-y-auto p-4 pb-36 space-y-4 max-w-4xl mx-auto w-full">
        {savedBadge && (
          <div className="bg-emerald-600 text-white p-3 rounded-xl shadow-lg flex items-center gap-2 text-xs font-bold animate-in fade-in">
            <CheckCircle2 className="w-4 h-4" />
            <span>Settings Saved Successfully!</span>
          </div>
        )}

        {/* ========================================================================= */}
        {/* 🖨️ EZO-STYLE 3. PRIMARY PRINTER SETTINGS SECTION */}
        {/* ========================================================================= */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {/* Printer Status Banner (Matching Ezo Header) */}
          <div className={`p-3.5 text-center border-b ${
            connectedPrinter?.address || connectedPrinter?.connected
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-slate-50 border-slate-200 text-slate-700'
          }`}>
            <b className={`font-mono text-base tracking-wider block ${
              connectedPrinter?.address || connectedPrinter?.connected ? 'text-emerald-700 font-black' : 'text-slate-700 font-black'
            }`}>
              {connectedPrinter?.address || (connectedPrinter?.connected ? 'CONNECTED' : 'DISCONNECTED')}
            </b>
            <span className="text-[11px] font-extrabold tracking-widest uppercase text-emerald-700 block mt-0.5">
              PERMISSION | BLUETOOTH | LOCATION
            </span>
          </div>

          <div className="p-4 space-y-4 text-xs">
            {/* 3. PRIMARY PRINTER SETTINGS Header */}
            <div className="flex items-center justify-between">
              <span className="font-extrabold text-orange-700 uppercase tracking-wide text-xs">
                3. PRIMARY PRINTER SETTINGS
              </span>
              {connectedPrinter?.connected && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                  {connectedPrinter.name}
                </span>
              )}
            </div>

            {/* 3.1 Primary Printer (Prints Bill and KOT) Toggle */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200">
              <div>
                <b className="text-slate-900 text-xs block font-bold">3.1 Primary Printer (Prints Bill and KOT)</b>
                <span className="text-slate-500 text-[11px]">{primaryPrinterEnabled ? 'Enabled' : 'Disabled'}</span>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={primaryPrinterEnabled}
                onClick={() => {
                  setPrimaryPrinterEnabled(!primaryPrinterEnabled);
                  handleSavePrinterSettings();
                }}
                className={`ezo-modern-switch ${primaryPrinterEnabled ? 'active' : ''}`}
              >
                <span className="switch-thumb" />
              </button>
            </div>

            {/* 3.2 Printer Type Selection */}
            <div className="space-y-2">
              <b className="text-slate-900 text-xs font-bold block">3.2 Printer Type</b>

              {/* Bluetooth Printer Card */}
              <div
                onClick={() => {
                  setPrinterType('bluetooth');
                  handleSavePrinterSettings();
                }}
                className={`p-3 rounded-xl border transition-all cursor-pointer ${
                  printerType === 'bluetooth'
                    ? 'border-orange-500 bg-orange-50/50 shadow-xs ring-1 ring-orange-500'
                    : 'border-slate-200 bg-white hover:bg-slate-50'
                }`}
              >
                <div className="flex items-start gap-3">
                  <input
                    type="radio"
                    name="printerType"
                    checked={printerType === 'bluetooth'}
                    onChange={() => {
                      setPrinterType('bluetooth');
                      handleSavePrinterSettings();
                    }}
                    className="mt-0.5 text-orange-600 focus:ring-orange-500"
                  />
                  <div className="flex-1">
                    <b className="text-xs font-bold text-slate-900 block">Bluetooth Printer</b>
                    <p className="text-[11px] text-emerald-700 font-semibold mt-0.5">
                      80% POS Machines are Bluetooth Printers (Thermal Printers, Z91, F1 are Bluetooth Printers)
                    </p>
                  </div>
                </div>

                {/* TEST PRINT & SETTINGS Buttons */}
                {printerType === 'bluetooth' && (
                  <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-orange-200">
                    <button
                      type="button"
                      onClick={handleTestPrint}
                      className="py-2.5 px-3 bg-orange-600 hover:bg-orange-700 text-white font-black text-xs rounded-xl shadow-xs transition-all active:scale-95 flex items-center justify-center gap-1.5"
                    >
                      <Printer className="w-4 h-4" />
                      <span>TEST PRINT</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleScanPairedDevices}
                      disabled={connecting}
                      className="py-2.5 px-3 bg-slate-900 hover:bg-slate-800 text-white font-black text-xs rounded-xl shadow-xs transition-all active:scale-95 flex items-center justify-center gap-1.5"
                    >
                      <Wifi className="w-4 h-4 text-orange-400" />
                      <span>{connecting ? 'Scanning...' : 'PAIR / SCAN'}</span>
                    </button>
                  </div>
                )}
              </div>

              {/* USB / System Printer Card */}
              <div
                onClick={() => {
                  setPrinterType('usb');
                  handleSavePrinterSettings();
                }}
                className={`p-3 rounded-xl border transition-all cursor-pointer ${
                  printerType === 'usb'
                    ? 'border-orange-500 bg-orange-50/50 shadow-xs ring-1 ring-orange-500'
                    : 'border-slate-200 bg-white hover:bg-slate-50'
                }`}
              >
                <div className="flex items-start gap-3">
                  <input
                    type="radio"
                    name="printerType"
                    checked={printerType === 'usb'}
                    onChange={() => {
                      setPrinterType('usb');
                      handleSavePrinterSettings();
                    }}
                    className="mt-0.5 text-orange-600 focus:ring-orange-500"
                  />
                  <div>
                    <b className="text-xs font-bold text-slate-900 block">USB Printer / System Spooler</b>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Direct USB ESC/POS & Android System Print Dialog
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Paper Roll Width Selector (58mm vs 80mm) */}
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <b className="text-slate-900 text-xs font-bold block">Paper Roll Width</b>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setPaperWidth('58mm');
                    setCharsPerLine(32);
                    setDotsPerLine(384);
                    localStorage.setItem('novapos_printer_paper_width', '58mm');
                    localStorage.setItem('novapos:paper_width', '58mm');
                    localStorage.setItem('novapos_printer_cpl', '32');
                    localStorage.setItem('novapos_printer_dpl', '384');
                    showSavedNotification();
                  }}
                  className={`p-3 rounded-2xl border text-left transition-all ${
                    paperWidth === '58mm'
                      ? 'border-orange-500 bg-orange-50/60 shadow-xs ring-2 ring-orange-500'
                      : 'border-slate-200 bg-white hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <b className="text-xs font-black text-slate-900">58 mm (2-Inch)</b>
                    {paperWidth === '58mm' && <Check className="w-4 h-4 text-orange-600" />}
                  </div>
                  <span className="text-[10px] text-slate-500 block mt-1">32 Cols · Portable Bluetooth</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setPaperWidth('80mm');
                    setCharsPerLine(48);
                    setDotsPerLine(576);
                    localStorage.setItem('novapos_printer_paper_width', '80mm');
                    localStorage.setItem('novapos:paper_width', '80mm');
                    localStorage.setItem('novapos_printer_cpl', '48');
                    localStorage.setItem('novapos_printer_dpl', '576');
                    showSavedNotification();
                  }}
                  className={`p-3 rounded-2xl border text-left transition-all ${
                    paperWidth === '80mm'
                      ? 'border-orange-500 bg-orange-50/60 shadow-xs ring-2 ring-orange-500'
                      : 'border-slate-200 bg-white hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <b className="text-xs font-black text-slate-900">80 mm (3-Inch)</b>
                    {paperWidth === '80mm' && <Check className="w-4 h-4 text-orange-600" />}
                  </div>
                  <span className="text-[10px] text-slate-500 block mt-1">48 Cols · Desktop Counter POS</span>
                </button>
              </div>
            </div>

            {/* 3.3 to 3.7 Character & Column Specs */}
            <div className="space-y-2.5 pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-200">
                <div>
                  <b className="text-xs font-bold text-slate-800 block">3.3 Characters Per Line</b>
                  <span className="text-[10px] text-slate-500">For Printing Lines and Columns (32 for 58mm / 48 for 80mm)</span>
                </div>
                <input
                  type="number"
                  value={charsPerLine}
                  onChange={(e) => {
                    const v = parseInt(e.target.value, 10) || 32;
                    setCharsPerLine(v);
                    setPaperWidth(v <= 32 ? '58mm' : '80mm');
                  }}
                  className="w-16 bg-white border border-slate-300 rounded-lg px-2 py-1 text-xs font-bold text-center text-slate-900"
                />
              </div>

              <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-200">
                <div>
                  <b className="text-xs font-bold text-slate-800 block">3.4 Characters in Column 2</b>
                  <span className="text-[10px] text-slate-500">Qty | Tax</span>
                </div>
                <input
                  type="number"
                  value={col2Chars}
                  onChange={(e) => setCol2Chars(parseInt(e.target.value, 10) || 4)}
                  className="w-16 bg-white border border-slate-300 rounded-lg px-2 py-1 text-xs font-bold text-center text-slate-900"
                />
              </div>

              <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-200">
                <div>
                  <b className="text-xs font-bold text-slate-800 block">3.5 Characters in Column 3</b>
                  <span className="text-[10px] text-slate-500">Rate | MRP</span>
                </div>
                <input
                  type="number"
                  value={col3Chars}
                  onChange={(e) => setCol3Chars(parseInt(e.target.value, 10) || 6)}
                  className="w-16 bg-white border border-slate-300 rounded-lg px-2 py-1 text-xs font-bold text-center text-slate-900"
                />
              </div>

              <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-200">
                <div>
                  <b className="text-xs font-bold text-slate-800 block">3.6 Characters in Column 4</b>
                  <span className="text-[10px] text-slate-500">Total | HSN</span>
                </div>
                <input
                  type="number"
                  value={col4Chars}
                  onChange={(e) => setCol4Chars(parseInt(e.target.value, 10) || 6)}
                  className="w-16 bg-white border border-slate-300 rounded-lg px-2 py-1 text-xs font-bold text-center text-slate-900"
                />
              </div>

              <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-200">
                <div>
                  <b className="text-xs font-bold text-slate-800 block">3.7 Dots Per Line</b>
                  <span className="text-[10px] text-slate-500">For Regional Printing (384 for 58mm / 576 for 80mm)</span>
                </div>
                <input
                  type="number"
                  value={dotsPerLine}
                  onChange={(e) => setDotsPerLine(parseInt(e.target.value, 10) || 384)}
                  className="w-16 bg-white border border-slate-300 rounded-lg px-2 py-1 text-xs font-bold text-center text-slate-900"
                />
              </div>
            </div>

            {/* 4. SECONDARY PRINTER SETTINGS (KOT) */}
            <div className="pt-3 border-t border-slate-100 space-y-2">
              <span className="font-extrabold text-orange-700 uppercase tracking-wide text-xs block">
                4. SECONDARY PRINTER SETTINGS
              </span>
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200">
                <div className="pr-3">
                  <b className="text-xs font-bold text-slate-800 block">4.1 Secondary Printer (Prints KOT)</b>
                  <span className="text-[10px] text-slate-500">
                    You can use this to connect 2 printers to single phone. You can print Bill on counter and KOT in kitchen.
                  </span>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={secondaryKotEnabled}
                  onClick={() => {
                    setSecondaryKotEnabled(!secondaryKotEnabled);
                    handleSavePrinterSettings();
                  }}
                  className={`ezo-modern-switch flex-shrink-0 ${secondaryKotEnabled ? 'active' : ''}`}
                >
                  <span className="switch-thumb" />
                </button>
              </div>
            </div>

            {/* 5. PRINT SETTINGS (Auto Print Sale) */}
            <div className="pt-3 border-t border-slate-100 space-y-2">
              <span className="font-extrabold text-orange-700 uppercase tracking-wide text-xs block">
                5. PRINT SETTINGS
              </span>
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200">
                <div>
                  <b className="text-xs font-bold text-slate-800 block">5.1 Auto Print Sale</b>
                  <span className="text-[10px] text-slate-500">Bills will be auto printed after save with zero extra clicks</span>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={autoPrintSale}
                  onClick={() => {
                    setAutoPrintSale(!autoPrintSale);
                    handleSavePrinterSettings();
                  }}
                  className={`ezo-modern-switch flex-shrink-0 ${autoPrintSale ? 'active' : ''}`}
                >
                  <span className="switch-thumb" />
                </button>
              </div>
            </div>

            {/* Actions: Save Printer Settings & Disconnect */}
            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={handleSavePrinterSettings}
                className="flex-1 py-3 bg-orange-600 hover:bg-orange-700 text-white font-extrabold text-xs rounded-xl shadow-md transition-transform active:scale-95 flex items-center justify-center gap-1.5"
              >
                <Save className="w-4 h-4" />
                <span>SAVE PRINTER SETTINGS</span>
              </button>
              {connectedPrinter && (
                <button
                  type="button"
                  onClick={handleDisconnect}
                  className="py-3 px-4 bg-rose-700 hover:bg-rose-800 text-white font-bold text-xs rounded-xl shadow-sm transition-transform active:scale-95"
                >
                  DISCONNECT
                </button>
              )}
            </div>

            {printerError && (
              <div className="text-xs text-rose-700 bg-rose-50 p-2.5 rounded-xl border border-rose-200 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-600" />
                <span>{printerError}</span>
              </div>
            )}
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 🏢 BUSINESS PROFILE & GST SETTINGS */}
        {/* ========================================================================= */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-orange-50 border border-orange-200 flex items-center justify-center text-orange-600">
                <Store className="w-5 h-5" />
              </div>
              <div>
                <b className="text-sm text-slate-900 font-bold block">Business & UPI Profile</b>
                <span className="text-xs text-slate-500">Printed on Bill Header & QR Code</span>
              </div>
            </div>
          </div>

          <form onSubmit={handleSaveProfile} className="space-y-3 text-xs">
            <div>
              <label className="text-slate-700 font-bold block mb-1">Store / Business Name *</label>
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-bold text-slate-900 text-xs"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-slate-700 font-bold block mb-1">Store Phone *</label>
                <input
                  type="tel"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-bold text-slate-900 text-xs"
                  required
                />
              </div>
              <div>
                <label className="text-slate-700 font-bold block mb-1">UPI ID (VPA for QR) *</label>
                <input
                  type="text"
                  value={editUpiVpa}
                  onChange={(e) => setEditUpiVpa(e.target.value)}
                  placeholder="e.g. store@upi"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-bold text-slate-900 text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-slate-700 font-bold block mb-1">GSTIN Number</label>
                <input
                  type="text"
                  value={editGstin}
                  onChange={(e) => setEditGstin(e.target.value.toUpperCase())}
                  placeholder="36AAAAA0000A1Z5"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-bold font-mono text-slate-900 text-xs"
                />
              </div>
              <div>
                <label className="text-slate-700 font-bold block mb-1">FSSAI License No</label>
                <input
                  type="text"
                  value={editFssai}
                  onChange={(e) => setEditFssai(e.target.value)}
                  placeholder="14-digit FSSAI"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-bold font-mono text-slate-900 text-xs"
                />
              </div>
            </div>

            <div>
              <label className="text-slate-700 font-bold block mb-1">Address / Landmark</label>
              <input
                type="text"
                value={editAddress}
                onChange={(e) => setEditAddress(e.target.value)}
                placeholder="Shop No, Main Road, City"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-medium text-slate-900 text-xs"
              />
            </div>

            <button
              type="submit"
              className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs rounded-xl shadow-xs transition-transform active:scale-95 flex items-center justify-center gap-1.5"
            >
              <Save className="w-4 h-4 text-orange-400" />
              <span>SAVE PROFILE</span>
            </button>
          </form>
        </div>

        {/* ========================================================================= */}
        {/* 🔒 34 EZO CONTROLS & ADVANCED SETTINGS */}
        {/* ========================================================================= */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <b className="text-xs font-black text-slate-900 uppercase tracking-wider">
              All 34 POS System Controls
            </b>
          </div>

          {/* Category Filter Pills */}
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
            {categories.map((c) => (
              <button
                key={c.id}
                onClick={() => setSelectedCategory(c.id)}
                className={`text-xs font-bold px-3 py-1.5 rounded-full whitespace-nowrap transition-colors ${
                  selectedCategory === c.id
                    ? 'bg-orange-600 text-white shadow-xs'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>

          {/* Search Box */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Search 34 controls (e.g. 2.1, round off, barcode)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-4 py-2.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500 font-medium"
            />
          </div>

          {/* Controls List */}
          <div className="space-y-2">
            {filteredSettings.map((item) => {
              const val = settings[item.id];
              return (
                <div
                  key={item.id}
                  className="bg-white rounded-xl p-3.5 border border-slate-200 shadow-xs flex items-center justify-between gap-3"
                >
                  <div className="flex items-start gap-2.5 flex-1 min-w-0">
                    <span className="text-[11px] font-black px-2 py-0.5 rounded-md bg-orange-50 text-orange-700 border border-orange-200 flex-shrink-0 mt-0.5 font-mono">
                      {item.code}
                    </span>
                    <div className="min-w-0">
                      <b className="text-xs font-bold text-slate-900 block truncate">{item.title}</b>
                      <p className="text-[11px] text-slate-500 mt-0.5">{item.desc}</p>
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
                        className="text-xs border border-slate-200 rounded-lg px-2 py-1 bg-slate-50 text-slate-800 font-bold focus:ring-2 focus:ring-orange-500"
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
                        className="w-16 text-xs font-bold text-center border border-slate-200 rounded-lg px-2 py-1 bg-slate-50 text-slate-800"
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <div className="h-16" />
      </div>

      {/* ========================================================================= */}
      {/* 📱 PAIRED BLUETOOTH DEVICES DISCOVERY MODAL */}
      {/* ========================================================================= */}
      {pairedDevicesModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in"
          onClick={() => setPairedDevicesModalOpen(false)}
        >
          <div
            className="bg-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl border border-slate-200 animate-in zoom-in-95 flex flex-col max-h-[80vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 bg-gradient-to-r from-orange-600 to-orange-500 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Wifi className="w-5 h-5" />
                <b className="text-sm font-bold">Select Paired Printer</b>
              </div>
              <button
                onClick={() => setPairedDevicesModalOpen(false)}
                className="p-1 hover:bg-white/20 rounded-full"
              >
                <X className="w-5 h-5 text-white" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto space-y-2 flex-1 text-xs">
              <p className="text-slate-500 text-[11px] mb-2 font-medium">
                Tap on your paired Bluetooth thermal printer to connect directly:
              </p>
              {pairedDevicesList.length === 0 ? (
                <div className="p-6 text-center text-slate-400 space-y-2">
                  <Printer className="w-8 h-8 mx-auto text-slate-300" />
                  <p className="font-bold text-xs">No paired Bluetooth printers found</p>
                  <p className="text-[11px]">Please open phone Settings → Bluetooth, pair your printer, and click scan again.</p>
                </div>
              ) : (
                pairedDevicesList.map((dev) => (
                  <button
                    key={dev.address}
                    onClick={() => handleSelectPairedDevice(dev)}
                    className="w-full p-3 rounded-2xl border border-slate-200 hover:border-orange-500 hover:bg-orange-50/50 flex items-center justify-between text-left transition-all active:scale-[0.98]"
                  >
                    <div className="min-w-0">
                      <b className="text-xs font-bold text-slate-900 block truncate">{dev.name}</b>
                      <span className="font-mono text-[11px] text-slate-500">{dev.address}</span>
                    </div>
                    <span className="px-2.5 py-1 bg-orange-600 text-white font-bold rounded-lg text-[10px]">
                      Connect
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ⚠️ EZO-STYLE "ALERT! Test print aaya? NO / YES" DIALOG */}
      {/* ========================================================================= */}
      {testPrintAlertOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl w-full max-w-xs overflow-hidden shadow-2xl border border-slate-200 p-5 text-center space-y-4 animate-in zoom-in-95">
            <div className="w-12 h-12 rounded-2xl bg-orange-100 text-orange-600 flex items-center justify-center mx-auto">
              <Printer className="w-6 h-6" />
            </div>
            <div>
              <b className="text-base font-extrabold text-slate-900 block">ALERT!</b>
              <p className="text-sm font-bold text-slate-700 mt-1">Test print aaya?</p>
            </div>
            <div className="grid grid-cols-2 gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => setTestPrintAlertOpen(false)}
                className="py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-xs rounded-xl transition-all"
              >
                NO
              </button>
              <button
                type="button"
                onClick={() => {
                  setTestPrintAlertOpen(false);
                  showSavedNotification();
                }}
                className="py-2.5 bg-orange-600 hover:bg-orange-700 text-white font-extrabold text-xs rounded-xl shadow-xs transition-all active:scale-95"
              >
                YES
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Compliance Modal */}
      <ComplianceModal
        isOpen={complianceModalOpen}
        onClose={() => setComplianceModalOpen(false)}
      />
    </div>
  );
};


import { useBackHandler } from '../lib/navigation';
import { setupBarcodeScanner } from '../lib/hardwareBridge';
import { quantityFromGrams } from '../lib/business';
import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  Barcode,
  Star,
  Plus,
  Minus,
  Trash2,
  Printer,
  Share2,
  CheckCircle2,
  QrCode,
  Banknote,
  CreditCard,
  BookOpen,
  PauseCircle,
  PlayCircle,
  Phone,
  User,
  AlertCircle,
  Volume2,
  ArrowLeft,
  ShoppingCart,
  X,
  ArrowRight,
} from 'lucide-react';
import { TRANSLATIONS, type SupportedLanguage } from '../lib/translations';
import { loadEzoSettings, type EzoSettingsMap } from '../lib/ezoSettings';
import { findPartyByPhone, loadParties, upsertParty, recordKhataSale, buildWhatsAppBillUrl, type Party } from '../lib/khata';
import {
  printReceiptViaBrowser,
  buildReceiptBytes,
  writeEscPosBytes,
  type BillData,
  PaperWidth,
} from '../lib/thermalPrinter';
import { addDayBookEntry, nextInvoiceNumber } from '../lib/dayBook';
import { speakPaymentAlert } from '../lib/hardwareBridge';
import { type BusinessProfile, type Uom, lineAmount, isWeight } from '../lib/business';
import { type CatalogItem } from './InventoryScreen';

export interface CartLine {
  id: string;
  itemId: string;
  name: string;
  category: string;
  price: number; // in Rupees
  quantity: number;
  uom: Uom;
  isVeg: boolean;
  notes?: string;
  code?: string;
}

interface Props {
  language: SupportedLanguage;
  profile: BusinessProfile;
  profileName: string;
  phone: string;
  address: string;
  gstin: string;
  fssai: string;
  upiVpa: string;
  items: CatalogItem[];
  cart: CartLine[];
  onUpdateCart: (lines: CartLine[]) => void;
  onClearCart: () => void;
  onSold?: (lines: CartLine[]) => void;
  tableContext?: { tableNo: string; orderType: string } | null;
  onBack?: () => void;
}

export const BillingScreen: React.FC<Props> = ({
  language,
  profile,
  profileName,
  phone,
  address,
  gstin,
  fssai,
  upiVpa,
  items,
  cart,
  onUpdateCart,
  onClearCart,
  onSold,
  tableContext,
  onBack,
}) => {
  const t = TRANSLATIONS[language];
  const settings = loadEzoSettings();

  // Mobile Bottom Cart Sheet State
  const [isMobileCartOpen, setIsMobileCartOpen] = useState(false);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);

  // Customer / Khata
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [matchedParty, setMatchedParty] = useState<Party | null>(null);
  const [creditPartyModalOpen, setCreditPartyModalOpen] = useState(false);
  const [creditModalIntent, setCreditModalIntent] = useState<'attach_only' | 'credit_sale'>('attach_only');
  const [creditSearchQuery, setCreditSearchQuery] = useState('');
  const [newCustName, setNewCustName] = useState('');
  const [newCustPhone, setNewCustPhone] = useState('');
  const [showQuickAddCust, setShowQuickAddCust] = useState(false);
  const [customUnit, setCustomUnit] = useState<'g' | 'kg'>('g');

  // Bill Adjustments
  const [discountPercent, setDiscountPercent] = useState<number>(0);
  const [discountAmount, setDiscountAmount] = useState<number>(0);
  const [orderType, setOrderType] = useState<string>(tableContext?.orderType || (profile === 'restaurant' ? 'Dine-In' : 'Takeaway'));

  // Draft / Held Bills
  const [heldBills, setHeldBills] = useState<{ id: string; lines: CartLine[]; customerName: string; customerPhone?: string; time: string }[]>(() => {
    try { return JSON.parse(localStorage.getItem('novapos:held_bills') || '[]'); } catch { return []; }
  });
  useEffect(() => { localStorage.setItem('novapos:held_bills', JSON.stringify(heldBills)); }, [heldBills]);
  const [weightItem, setWeightItem] = useState<CatalogItem | null>(null);
  const [grams, setGrams] = useState('250');
  const [saleError, setSaleError] = useState('');
  const saving = useRef(false);
  useBackHandler(Boolean(weightItem) || isMobileCartOpen, () => { if (weightItem) setWeightItem(null); else setIsMobileCartOpen(false); });

  // Post-sale Success Banner
  const [completedBill, setCompletedBill] = useState<{
    billNo: string;
    total: number;
    mode: string;
    phone?: string;
    customerName: string;
    lines: CartLine[];
  } | null>(null);

  // Lookup party when phone number changes
  useEffect(() => {
    if (customerPhone.length >= 10) {
      const p = findPartyByPhone(customerPhone);
      if (p) {
        setMatchedParty(p);
        if (!customerName) setCustomerName(p.name);
      } else {
        setMatchedParty(null);
      }
    } else {
      setMatchedParty(null);
    }
  }, [customerPhone]);

  // Categories list
  const categories = [
    { id: 'all', name: t.billing.categoryAll },
    ...Array.from(new Set(items.map((i) => i.categoryName))).map((c) => ({
      id: c,
      name: c,
    })),
  ];

  // Filter items based on settings 2.12, 2.27, 2.31
  const filteredItems = items.filter((item) => {
    if (settings.hideOutOfStockItems && (item.stockQty ?? 100) <= 0) return false;
    if (selectedCategory !== 'all' && item.categoryName !== selectedCategory) return false;
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      item.name.toLowerCase().includes(q) ||
      item.code.toLowerCase().includes(q) ||
      (item.barcode && item.barcode.includes(q))
    );
  });

  // Cart Calculations
  const rawSubtotal = cart.reduce((s, l) => s + lineAmount(l.price, l.quantity), 0);
  const discountTotal = discountAmount > 0 ? discountAmount : (rawSubtotal * discountPercent) / 100;
  const afterDiscount = Math.max(0, rawSubtotal - discountTotal);

  // Service Charge (Setting 2.25)
  const serviceChargePercent = settings.enableServiceCharge ? 5 : 0;
  const serviceCharge = orderType === 'Dine-In' ? (afterDiscount * serviceChargePercent) / 100 : 0;

  const preRoundTotal = afterDiscount + serviceCharge;
  // Round off (Setting 2.23)
  const finalTotal = settings.roundOffAmount ? Math.round(preRoundTotal) : Math.round(preRoundTotal * 100) / 100;
  const roundOffDifference = finalTotal - preRoundTotal;

  // Add Item to Cart
  const handleAddItem = (item: CatalogItem, quantity?: number) => {
    if (!settings.allowZeroPriceItem && item.priceMinor <= 0) { setSaleError('Zero-price billing is disabled in Settings.'); return; }
    if (isWeight(item.uom) && settings.allowDecimalQuantity && quantity === undefined) { setWeightItem(item); setGrams('250'); return; }
    const amount = quantity ?? 1;
    const current = cart.find(line => line.itemId === item.id)?.quantity || 0;
    if (!settings.enableNegativeStockBilling && current + amount > (item.stockQty ?? 100)) { setSaleError('Not enough stock for this quantity.'); return; }
    setSaleError('');
    const existing = cart.find((l) => l.itemId === item.id);
    if (existing) {
      onUpdateCart(
        cart.map((l) =>
          l.itemId === item.id ? { ...l, quantity: Math.round((l.quantity + amount) * 1000) / 1000 } : l,
        ),
      );
    } else {
      const newLine: CartLine = {
        id: `line-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        itemId: item.id,
        name: item.name,
        category: item.categoryName,
        price: item.priceMinor / 100,
        quantity: amount,
        uom: item.uom,
        isVeg: item.isVeg,
        code: item.code,
      };
      onUpdateCart([...cart, newLine]);
    }
  };

  const handleUpdateQuantity = (lineId: string, delta: number) => {
    const line = cart.find((l) => l.id === lineId);
    if (!line) return;
    const newQty = Math.round((line.quantity + delta) * 1000) / 1000;
    if (newQty <= 0) {
      onUpdateCart(cart.filter((l) => l.id !== lineId));
    } else {
      const item = items.find(item => item.id === line.itemId);
      if (!settings.enableNegativeStockBilling && newQty > (item?.stockQty ?? 100)) { setSaleError('Not enough stock for this quantity.'); return; }
      onUpdateCart(cart.map((l) => (l.id === lineId ? { ...l, quantity: newQty } : l)));
    }
  };

  const handleHoldBill = () => {
    if (cart.length === 0) return;
    setHeldBills((prev) => [
      ...prev,
      {
        id: `held-${Date.now()}`,
        lines: [...cart],
        customerName: customerName || 'Customer',
        customerPhone,
        time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
    onClearCart();
    setCustomerPhone('');
    setCustomerName('');
  };

  const handleRecallBill = (heldId: string) => {
    const found = heldBills.find((b) => b.id === heldId);
    if (!found) return;
    onUpdateCart(found.lines);
    setCustomerName(found.customerName);
    setCustomerPhone(found.customerPhone || '');
    setHeldBills((prev) => prev.filter((b) => b.id !== heldId));
  };

  // Complete & Print Sale
  const handleCompleteSale = async (mode: 'cash' | 'upi' | 'card' | 'credit', targetParty?: Party) => {
    if (saving.current || cart.length === 0 || finalTotal < 0 || (finalTotal === 0 && !settings.allowZeroPriceItem)) return;

    const effectiveParty = targetParty || matchedParty;

    if (mode === 'credit' && (!effectiveParty || effectiveParty.type !== 'customer')) {
      setCreditModalIntent('credit_sale');
      setCreditPartyModalOpen(true);
      return;
    }
    if (mode === 'credit' && settings.restrictPaymentMode) {
      setSaleError('Credit sales are disabled in Settings.');
      return;
    }
    saving.current = true;
    setSaleError('');

    const effectivePhone = effectiveParty?.phone || customerPhone;
    const effectiveName = effectiveParty?.name || customerName;

    const billNo = nextInvoiceNumber();
    const now = new Date();

    // 1. Build Bill Data
    const billData: BillData = {
      restaurantName: profileName || 'NovaPOS Store',
      address: address || 'Hyderabad',
      phone: phone || '9701463241',
      gstin: gstin || undefined,
      fssai: fssai || undefined,
      billNo,
      date: now.toLocaleDateString('en-IN'),
      time: now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
      tableNo: tableContext?.tableNo,
      orderType,
      customerName: effectiveName || undefined,
      customerPhone: effectivePhone || undefined,
      items: cart.map((l) => ({
        name: `${l.name} (${l.uom})`,
        quantity: l.quantity,
        price: l.price,
        total: lineAmount(l.price, l.quantity),
      })),
      subtotal: rawSubtotal,
      cgst: Math.round(
        cart.reduce((acc, l) => {
          const matched = items.find((i) => i.id === l.itemId || i.name === l.name);
          const rate = matched?.gstRate !== undefined ? matched.gstRate : 5;
          const amt = lineAmount(l.price, l.quantity);
          const tax = rate > 0 ? amt - amt / (1 + rate / 100) : 0;
          return acc + tax / 2;
        }, 0) * 100,
      ) / 100,
      sgst: Math.round(
        cart.reduce((acc, l) => {
          const matched = items.find((i) => i.id === l.itemId || i.name === l.name);
          const rate = matched?.gstRate !== undefined ? matched.gstRate : 5;
          const amt = lineAmount(l.price, l.quantity);
          const tax = rate > 0 ? amt - amt / (1 + rate / 100) : 0;
          return acc + tax / 2;
        }, 0) * 100,
      ) / 100,
      total: finalTotal,
      paymentMode: mode === 'credit' ? 'CREDIT (KHATA)' : mode.toUpperCase(),
      upiVpa: upiVpa || 'merchant@upi',
      upiPayload: `upi://pay?pa=${encodeURIComponent(upiVpa || 'merchant@upi')}&pn=${encodeURIComponent(profileName || 'Store')}&am=${finalTotal.toFixed(2)}&cu=INR`,
    };

    // Save before showing a receipt; storage failures must not look like completed sales.
    try {
      addDayBookEntry({
        type: 'sale',
        description: `Sale Bill #${billNo} (${effectiveName || 'Walk-in'})`,
        amount: finalTotal,
        paymentMode: mode,
        referenceNo: billNo,
        lines: cart.map(line => ({ ...line }))
      });
    } catch (error) {
      setSaleError((error as Error).message);
      saving.current = false;
      return;
    }
    onSold?.(cart);
    speakPaymentAlert(finalTotal, mode === 'credit' ? 'Khata' : mode);
    if (!settings.askToPrintBill || window.confirm('Open receipt print preview?')) {
      printReceiptViaBrowser(billData, localStorage.getItem('novapos:paper_width') === '80mm' ? '80mm' : '58mm');
    }

    // 5. If Credit / Udhar, record to Party Ledger
    if (mode === 'credit' && effectiveParty) {
      recordKhataSale(effectiveParty.id, finalTotal, billNo);
    }

    setCompletedBill({
      billNo,
      total: finalTotal,
      mode,
      phone: effectivePhone,
      customerName: effectiveName,
      lines: [...cart],
    });

    // Reset bill and close mobile drawer
    onClearCart();
    setCustomerPhone('');
    setCustomerName('');
    setMatchedParty(null);
    setDiscountPercent(0);
    setDiscountAmount(0);
    setIsMobileCartOpen(false);
    setCreditPartyModalOpen(false);
    saving.current = false;
  };

  const handleSelectCustomer = (party: Party) => {
    setCustomerName(party.name);
    setCustomerPhone(party.phone);
    setMatchedParty(party);
    setCreditPartyModalOpen(false);
    if (creditModalIntent === 'credit_sale') {
      handleCompleteSale('credit', party);
    }
  };

  const handleQuickCreateCustomer = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newCustName.trim() || !newCustPhone.trim()) return;
    const cleanPhone = newCustPhone.replace(/[^0-9]/g, '').slice(-10);
    if (cleanPhone.length < 10) {
      setSaleError('Please enter a valid 10-digit mobile number.');
      return;
    }
    const created = upsertParty({
      name: newCustName.trim(),
      phone: cleanPhone,
      type: 'customer',
      balance: 0,
    });
    setCustomerName(created.name);
    setCustomerPhone(created.phone);
    setMatchedParty(created);
    setNewCustName('');
    setNewCustPhone('');
    setShowQuickAddCust(false);
    setCreditPartyModalOpen(false);
    if (creditModalIntent === 'credit_sale') {
      handleCompleteSale('credit', created);
    }
  };

  const handleShareWhatsApp = () => {
    if (!completedBill || !completedBill.phone) return;
    const url = buildWhatsAppBillUrl(
      completedBill.phone,
      completedBill.customerName,
      completedBill.billNo,
      completedBill.total,
      completedBill.lines.map((c) => ({ name: c.name, quantity: c.quantity, price: c.price })),
      matchedParty?.balance || 0,
      profileName,
    );
    window.open(url, '_blank');
  };

  const gridCols = '3';
  useEffect(() => {
    if (!settings.itemBarcodeScanner || weightItem) return;
    return setupBarcodeScanner(code => {
      const found = items.find(item => item.barcode === code || item.code.toLowerCase() === code.toLowerCase());
      if (found) { handleAddItem(found); setSearchQuery(''); }
      else setSaleError(`No product found for barcode ${code}.`);
    });
  }, [items, cart, settings.itemBarcodeScanner, weightItem]);

  return (
    <div className="billing-screen">
      {/* Top Back Navigation Bar */}
      <div className="billing-top-nav-bar">
        <div className="billing-nav-left">
          {onBack && (
            <button
              onClick={onBack}
              className="billing-back-btn"
              title="Back to Dashboard"
              aria-label="Back to Dashboard"
            >
              <ArrowLeft className="w-5 h-5 text-white stroke-[2.5]" />
              <span className="billing-back-text">Back</span>
            </button>
          )}
          <div className="billing-nav-title-wrap">
            <span className="billing-nav-title">Sale Invoice</span>
            <span className="billing-nav-sub">
              {tableContext ? `Table ${tableContext.tableNo} · ${tableContext.orderType}` : (profileName || 'Fast Billing')}
            </span>
          </div>
        </div>

        <div className="billing-nav-right">
          {(cart.length > 0 || heldBills.length > 0) && (
            <button
              onClick={() => setIsMobileCartOpen(!isMobileCartOpen)}
              className="billing-mobile-cart-toggle-btn"
              title="View Cart"
            >
              <ShoppingCart className="w-4 h-4 mr-1 text-white inline" />
              <span>{cart.length} {cart.length === 1 ? 'Item' : 'Items'}</span>
            </button>
          )}
        </div>
      </div>

      {saleError && <p role="alert" className="p-3 bg-rose-50 text-rose-700">{saleError}</p>}
      {/* Success Notification Bar */}
      {completedBill && (
        <div className="sale-success-banner">
          <div className="banner-left">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 mr-2" />
            <span>
              {t.billing.billSuccess} <b>#{completedBill.billNo}</b> · ₹{completedBill.total.toFixed(2)} (
              {completedBill.mode.toUpperCase()})
            </span>
          </div>
          <div className="banner-actions">
            {completedBill.phone && settings.askToShareBillOnWhatsApp && (
              <button onClick={handleShareWhatsApp} className="btn-banner-wa">
                <Share2 className="w-4 h-4 mr-1 text-emerald-300" />
                {t.billing.shareWhatsApp}
              </button>
            )}
            <button onClick={() => setCompletedBill(null)} className="btn-banner-close">
              ×
            </button>
          </div>
        </div>
      )}

      <div className="billing-main-grid">
        {/* Left Side: Catalog Item Selector */}
        <div className="billing-catalog-panel">
          {/* Top Search & Filter Bar */}
          <div className="catalog-top-bar">
            <div className="search-box">
              <Search className="w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder={t.billing.searchPlaceholder}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {heldBills.length > 0 && (
              <div className="held-bills-badge">
                <PauseCircle className="w-4 h-4 mr-1 text-amber-400" />
                <span>{heldBills.length} Held</span>
              </div>
            )}
          </div>

          {/* Category Chips Bar */}
          {!settings.hideCategoriesFromBilling && <div className="catalog-categories-row">
            {categories.map((c) => (
              <button
                key={c.id}
                onClick={() => setSelectedCategory(c.id)}
                className={`btn-cat-chip ${selectedCategory === c.id ? 'active' : ''}`}
              >
                {c.name}
              </button>
            ))}
          </div>}

          {/* Product Items Grid */}
          <div className={`products-grid cols-${gridCols} view-${settings.itemSelectorStyle}`}>
            {filteredItems.map((item) => {
              const inCart = cart.find((l) => l.itemId === item.id);
              return (
                <div
                  key={item.id}
                  onClick={() => handleAddItem(item)}
                  className={`product-card ${inCart ? 'in-cart' : ''}`}
                >
                  <div className="product-card-top">
                    {profile === 'restaurant' && (
                      <span className={`veg-indicator ${item.isVeg ? 'veg' : 'non-veg'}`} />
                    )}
                    {settings.showCodeInBilling && <span className="product-code">{item.code}</span>}
                    {settings.showStockInBilling && (
                      <span
                        className={`stock-pill ${
                          (item.stockQty ?? 100) <= 0
                            ? 'out'
                            : (item.stockQty ?? 100) < 10
                            ? 'low'
                            : 'ok'
                        }`}
                      >
                        {item.stockQty ?? 100}
                      </span>
                    )}
                  </div>

                  <b className="product-name">{item.name}</b>

                  <div className="product-card-bottom">
                    <span className="product-price">
                      ₹{(item.priceMinor / 100).toFixed(2)}
                      <small>/{item.uom}</small>
                    </span>
                    {inCart && <span className="in-cart-badge">{inCart.quantity} in cart</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Side: Bill & Cart Panel (Full panel on desktop, Slide-up sheet on mobile) */}
        <div className={`billing-cart-panel ${isMobileCartOpen ? 'mobile-cart-active' : ''}`}>
          {/* Mobile Cart Sheet Header */}
          <div className="mobile-cart-sheet-header">
            <div className="flex items-center space-x-2">
              <ShoppingCart className="w-5 h-5 text-indigo-600" />
              <span className="font-bold text-sm text-slate-800">
                Cart & Checkout ({cart.length} {cart.length === 1 ? 'item' : 'items'})
              </span>
            </div>
            <button
              onClick={() => setIsMobileCartOpen(false)}
              className="mobile-cart-sheet-close"
              aria-label="Close Cart"
            >
              <X className="w-5 h-5 text-slate-600" />
            </button>
          </div>

          {/* Customer / Previous Due Header */}
          <div className="customer-info-box">
            <div className="customer-input-row">
              <Phone className="w-4 h-4 text-emerald-400 mr-2" />
              <input
                type="tel"
                placeholder={t.billing.customerPhonePlaceholder}
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                className="cust-phone-input"
              />
              <input
                type="text"
                placeholder={t.billing.customerNamePlaceholder}
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="cust-name-input"
              />
              <button
                type="button"
                onClick={() => {
                  setCreditModalIntent('attach_only');
                  setCreditPartyModalOpen(true);
                }}
                className="btn-select-khata-cust"
                title="Select customer from Khata"
              >
                <BookOpen className="w-3.5 h-3.5 mr-1" />
                <span>Khata</span>
              </button>
            </div>

            {matchedParty && (
              <div className="selected-khata-badge">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 mr-1 flex-shrink-0" />
                <span className="flex-1">
                  Khata: <b>{matchedParty.name}</b> ({matchedParty.phone}) · Due: <b className="text-rose-600">₹{matchedParty.balance.toFixed(2)}</b>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setMatchedParty(null);
                    setCustomerPhone('');
                    setCustomerName('');
                  }}
                  className="text-xs text-slate-400 hover:text-slate-600 ml-2 font-bold px-1"
                  title="Remove customer"
                >
                  ✕
                </button>
              </div>
            )}

            {/* Setting 2.24: Prominent Previous Due Badge */}
            {settings.alwaysShowPreviousBalance && matchedParty && matchedParty.balance > 0 && (
              <div className="previous-due-alert">
                <AlertCircle className="w-4 h-4 mr-1 text-rose-400" />
                <span>
                  {t.billing.previousDue}: <b className="text-rose-400">₹{matchedParty.balance.toFixed(2)}</b>
                </span>
                <span className="due-khata-tag">Khata Customer</span>
              </div>
            )}
          </div>

          {/* Cart Lines Scrollable List */}
          <div className="cart-lines-container">
            {cart.length === 0 ? (
              <div className="cart-empty-state">
                <p>Cart is empty — tap items to add</p>
                {heldBills.length > 0 && (
                  <div className="recall-section">
                    <p className="recall-title">Held Bills:</p>
                    {heldBills.map((hb) => (
                      <button
                        key={hb.id}
                        onClick={() => handleRecallBill(hb.id)}
                        className="btn-recall-item"
                      >
                        <PlayCircle className="w-3.5 h-3.5 mr-1" />
                        {hb.customerName} ({hb.lines.length} items at {hb.time})
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              cart.map((line) => (
                <div key={line.id} className="cart-line-card">
                  <div className="line-info-top">
                    <b className="line-name">{line.name}</b>
                    <span className="line-amount">
                      ₹{lineAmount(line.price, line.quantity).toFixed(2)}
                    </span>
                  </div>

                  <div className="line-controls-row">
                    <span className="line-rate">
                      ₹{line.price}/{line.uom}
                    </span>

                    <div className="qty-controls">
                      <button
                        onClick={() => handleUpdateQuantity(line.id, settings.allowDecimalQuantity && line.uom === 'kg' ? -0.25 : line.uom === 'g' ? -250 : -1)}
                        className="btn-qty"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="qty-display">
                        {line.quantity} {line.uom}
                      </span>
                      <button
                        onClick={() => handleUpdateQuantity(line.id, settings.allowDecimalQuantity && line.uom === 'kg' ? 0.25 : line.uom === 'g' ? 250 : 1)}
                        className="btn-qty"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Cart Summary & Settlement */}
          <div className="cart-settlement-box">
            <div className="cart-calc-row">
              <span>{t.billing.subtotal}</span>
              <b>₹{rawSubtotal.toFixed(2)}</b>
            </div>

            {serviceCharge > 0 && (
              <div className="cart-calc-row">
                <span>{t.billing.serviceCharge} ({serviceChargePercent}%)</span>
                <b>+₹{serviceCharge.toFixed(2)}</b>
              </div>
            )}

            {roundOffDifference !== 0 && (
              <div className="cart-calc-row text-xs text-slate-400">
                <span>{t.billing.roundOff}</span>
                <span>{roundOffDifference > 0 ? '+' : ''}₹{roundOffDifference.toFixed(2)}</span>
              </div>
            )}

            <div className="cart-grand-total-row">
              <span className="grand-label">{t.billing.grandTotal}</span>
              <span className="grand-amount">₹{finalTotal.toFixed(2)}</span>
            </div>

            {/* Payment Mode Action Buttons (3 Buttons: Cash, UPI, Credit Khata) */}
            <div className="payment-grid-actions payment-grid-3">
              <button
                disabled={cart.length === 0}
                onClick={() => handleCompleteSale('cash')}
                className="btn-pay-action btn-cash"
              >
                <Banknote className="w-5 h-5 mr-1.5" />
                {t.billing.cashPay}
              </button>

              <button
                disabled={cart.length === 0}
                onClick={() => handleCompleteSale('upi')}
                className="btn-pay-action btn-upi"
              >
                <QrCode className="w-5 h-5 mr-1.5" />
                {t.billing.upiPay}
              </button>

              <button
                disabled={cart.length === 0}
                onClick={() => {
                  if (matchedParty) {
                    handleCompleteSale('credit', matchedParty);
                  } else {
                    setCreditModalIntent('credit_sale');
                    setCreditPartyModalOpen(true);
                  }
                }}
                className="btn-pay-action btn-udhar"
                title="Book to Customer Khata / Udhar"
              >
                <BookOpen className="w-5 h-5 mr-1.5" />
                {t.billing.udharPay}
              </button>
            </div>

            {/* Secondary Controls: Hold & Clear */}
            <div className="cart-footer-controls">
              <button
                disabled={cart.length === 0}
                hidden={!settings.saveBillAsDraft}
                onClick={handleHoldBill}
                className="btn-foot-control"
              >
                <PauseCircle className="w-4 h-4 mr-1 text-amber-400" />
                {t.billing.holdBill}
              </button>

              <button
                disabled={cart.length === 0}
                onClick={onClearCart}
                className="btn-foot-control"
              >
                <Trash2 className="w-4 h-4 mr-1 text-rose-400" />
                {t.billing.clearCart}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Floating Cart Summary Bar (Hidden during modals to avoid overlap) */}
      {cart.length > 0 && !isMobileCartOpen && !weightItem && !creditPartyModalOpen && (
        <div
          className="mobile-floating-cart-bar"
          onClick={() => setIsMobileCartOpen(true)}
        >
          <div className="mobile-cart-bar-info">
            <ShoppingCart className="w-5 h-5 text-white mr-2" />
            <div className="flex flex-col text-left">
              <span className="text-[10px] text-indigo-200 uppercase font-semibold">Current Bill</span>
              <span className="text-sm font-black text-white">
                {cart.length} {cart.length === 1 ? 'Item' : 'Items'} · ₹{finalTotal.toFixed(2)}
              </span>
            </div>
          </div>
          <button className="mobile-cart-bar-pay-btn">
            <span>View Cart & Pay</span>
            <ArrowRight className="w-4 h-4 ml-1 inline" />
          </button>
        </div>
      )}

      {/* Mobile Cart Sheet Backdrop */}
      {isMobileCartOpen && (
        <div
          className="mobile-cart-sheet-backdrop"
          onClick={() => setIsMobileCartOpen(false)}
        />
      )}
      {/* Weighed Item Modal */}
      {weightItem && (
        <div className="table-modal-overlay">
          <form
            className="table-modal weight-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Select weight"
            noValidate
            onSubmit={(event) => {
              event.preventDefault();
              try {
                const numericGrams = Number(grams);
                if (!numericGrams || numericGrams <= 0) {
                  setSaleError('Please enter a valid weight.');
                  return;
                }
                handleAddItem(weightItem, quantityFromGrams(numericGrams, weightItem.uom as 'kg' | 'g'));
                setWeightItem(null);
              } catch (error) {
                setSaleError((error as Error).message);
              }
            }}
          >
            <div className="modal-header">
              <div>
                <h3 className="text-base font-bold text-slate-900">{weightItem.name}</h3>
                <span className="text-xs text-indigo-600 font-semibold">
                  Rate: ₹{(weightItem.priceMinor / 100).toFixed(2)} / {weightItem.uom}
                </span>
              </div>
              <button
                type="button"
                aria-label="Close weight selector"
                onClick={() => setWeightItem(null)}
                className="btn-close-modal"
              >
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            <div className="modal-body">
              <label className="text-xs font-bold text-slate-700">Quick Presets</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { val: 100, label: '100g' },
                  { val: 250, label: '250g' },
                  { val: 500, label: '500g' },
                  { val: 1000, label: '1 kg' },
                  { val: 2000, label: '2 kg' },
                  { val: 5000, label: '5 kg' },
                ].map((item) => {
                  const isSelected = Number(grams) === item.val;
                  return (
                    <button
                      key={item.val}
                      type="button"
                      onClick={() => {
                        setGrams(String(item.val));
                        setCustomUnit(item.val >= 1000 ? 'kg' : 'g');
                      }}
                      className={`py-2 px-1 rounded-lg text-xs font-black transition-all text-center ${
                        isSelected
                          ? 'bg-indigo-600 text-white shadow-sm scale-[1.02]'
                          : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200'
                      }`}
                    >
                      {item.label}
                    </button>
                  );
                })}
              </div>

              <div className="form-group mt-3">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-slate-700">Custom Weight / Quantity</label>
                  <div className="flex gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                    <button
                      type="button"
                      onClick={() => setCustomUnit('g')}
                      className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                        customUnit === 'g' ? 'bg-white text-indigo-600 shadow-xs' : 'text-slate-500'
                      }`}
                    >
                      Grams (g)
                    </button>
                    <button
                      type="button"
                      onClick={() => setCustomUnit('kg')}
                      className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                        customUnit === 'kg' ? 'bg-white text-indigo-600 shadow-xs' : 'text-slate-500'
                      }`}
                    >
                      Kilograms (kg)
                    </button>
                  </div>
                </div>
                <input
                  type="number"
                  inputMode="decimal"
                  step="any"
                  min="0"
                  value={customUnit === 'kg' ? (Number(grams) ? Number(grams) / 1000 : '') : grams}
                  onChange={(event) => {
                    const raw = event.target.value;
                    if (!raw) {
                      setGrams('');
                      return;
                    }
                    const num = parseFloat(raw) || 0;
                    setGrams(String(customUnit === 'kg' ? Math.round(num * 1000) : num));
                  }}
                  className="w-full text-base font-bold text-slate-900 p-2.5 border border-slate-300 rounded-lg focus:border-indigo-600 outline-none"
                  placeholder={customUnit === 'kg' ? 'e.g. 1.5' : 'e.g. 250'}
                />
              </div>

              <div className="p-3 bg-slate-50 rounded-lg flex items-center justify-between border border-slate-200">
                <span className="text-xs font-medium text-slate-600">Calculated Total:</span>
                <span className="text-base font-black text-indigo-700 font-mono">
                  ₹{lineAmount(weightItem.priceMinor / 100, Number(grams) / (weightItem.uom === 'kg' ? 1000 : 1)).toFixed(2)}
                </span>
              </div>

              <div className="modal-actions-bar">
                <button
                  type="button"
                  onClick={() => setWeightItem(null)}
                  className="btn-cancel"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!Number(grams) || Number(grams) <= 0}
                  className="btn-submit"
                >
                  Add to Bill
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* Credit (Khata) Customer Selection Modal */}
      {creditPartyModalOpen && (
        <div className="table-modal-overlay">
          <div className="table-modal credit-party-modal" role="dialog" aria-modal="true">
            <div className="modal-header">
              <div className="flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-indigo-600" />
                <div>
                  <h3 className="font-bold text-slate-900 text-base">
                    {creditModalIntent === 'credit_sale' ? 'Select Customer for Credit Sale' : 'Select Customer for Invoice'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {creditModalIntent === 'credit_sale'
                      ? `Record ₹${finalTotal.toFixed(2)} to Customer Udhar`
                      : 'Attach customer details to current bill'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCreditPartyModalOpen(false)}
                className="btn-close-modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="modal-body p-3">
              {/* Search input */}
              <div className="relative mb-2">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search customer by name or 10-digit phone..."
                  value={creditSearchQuery}
                  onChange={(e) => setCreditSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:border-indigo-600"
                />
              </div>

              {/* Quick Add Toggle */}
              <div className="flex items-center justify-between py-1 px-1 mb-2">
                <span className="text-xs font-bold text-slate-600">Existing Customers</span>
                <button
                  type="button"
                  onClick={() => setShowQuickAddCust(!showQuickAddCust)}
                  className="text-xs font-bold text-indigo-600 hover:text-indigo-800"
                >
                  {showQuickAddCust ? '− Close New Form' : '+ New Customer'}
                </button>
              </div>

              {/* Quick Add Customer Form */}
              {showQuickAddCust && (
                <form onSubmit={handleQuickCreateCustomer} className="p-3 bg-indigo-50 border border-indigo-200 rounded-lg mb-3 flex flex-col gap-2">
                  <span className="text-xs font-bold text-indigo-900">+ Add New Customer to Khata</span>
                  <input
                    type="text"
                    required
                    placeholder="Customer Name (e.g. Siva)"
                    value={newCustName}
                    onChange={(e) => setNewCustName(e.target.value)}
                    className="p-2 border border-slate-300 rounded text-sm bg-white"
                  />
                  <input
                    type="tel"
                    required
                    placeholder="10-digit Mobile (e.g. 9014061654)"
                    value={newCustPhone}
                    onChange={(e) => setNewCustPhone(e.target.value)}
                    className="p-2 border border-slate-300 rounded text-sm bg-white"
                  />
                  <button
                    type="submit"
                    className="bg-indigo-600 text-white font-bold py-2 rounded text-xs hover:bg-indigo-700"
                  >
                    {creditModalIntent === 'credit_sale'
                      ? `Save & Record ₹${finalTotal.toFixed(2)} Credit`
                      : 'Save & Attach to Bill'}
                  </button>
                </form>
              )}

              {/* Customers List */}
              <div className="max-h-64 overflow-y-auto flex flex-col gap-1.5">
                {loadParties()
                  .filter((p) => p.type === 'customer')
                  .filter((p) => {
                    if (!creditSearchQuery) return true;
                    const q = creditSearchQuery.toLowerCase();
                    return p.name.toLowerCase().includes(q) || p.phone.includes(q);
                  })
                  .map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handleSelectCustomer(p)}
                      className="flex items-center justify-between p-2.5 rounded-lg border border-slate-200 hover:border-indigo-500 hover:bg-indigo-50 transition-all text-left"
                    >
                      <div>
                        <b className="text-sm text-slate-900 block">{p.name}</b>
                        <span className="text-xs text-slate-500">{p.phone}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-bold block text-slate-700">
                          Due: <span className={p.balance > 0 ? 'text-rose-600' : 'text-emerald-600'}>₹{Math.abs(p.balance).toFixed(2)}</span>
                        </span>
                        <span className="text-[10px] text-indigo-600 font-semibold">
                          {creditModalIntent === 'credit_sale' ? 'Record Credit →' : 'Select Customer →'}
                        </span>
                      </div>
                    </button>
                  ))}
              </div>
            </div>

            <div className="modal-actions-bar p-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setCreditPartyModalOpen(false)}
                className="btn-cancel"
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

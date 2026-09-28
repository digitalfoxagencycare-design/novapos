import { shouldPrintSale } from '../lib/printerSettings';
import { priceCounterSale } from '../lib/counterPricing';
import { itemBarcodes, findCatalogItemByCode } from '../lib/catalog';
import { useBackHandler } from '../lib/navigation';
import { setupBarcodeScanner } from '../lib/hardwareBridge';
import { quantityFromGrams } from '../lib/business';
import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
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
  ArrowLeft,
  ShoppingCart,
  X,
  Calculator,
  Grid,
  FileText,
  Utensils,
  CheckSquare,
  Square,
  Sparkles,
} from 'lucide-react';
import { TRANSLATIONS, type SupportedLanguage } from '../lib/translations';
import { loadEzoSettings } from '../lib/ezoSettings';
import { findPartyByPhone, loadParties, upsertParty, recordKhataSale, buildWhatsAppBillUrl, type Party } from '../lib/khata';
import {
  printBillDirect,
  printReceiptViaBrowser,
  type BillData,
  type PaperWidth,
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
  price: number; // in Rupees, tax-inclusive for local counter sales
  gstRate?: number;
  hsnSac?: string;
  quantity: number;
  uom: Uom;
  isVeg: boolean;
  notes?: string;
  code?: string;
  imageUrl?: string;
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
  onUpdateItems?: (items: CatalogItem[]) => void;
  onOpenCalculator?: () => void;
  onSold?: (lines: CartLine[]) => void;
  tableContext?: { tableNo: string; orderType: string } | null;
  onBack?: () => void;
}

// Curated default high-res thumbnails for popular Indian store categories
const CATEGORY_IMAGE_PRESETS: Record<string, string> = {
  'Agri Products': 'https://images.unsplash.com/photo-1592982537447-7440770cbfc9?w=300&auto=format&fit=crop&q=80',
  'Rice & Staples': 'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=300&auto=format&fit=crop&q=80',
  'Flour & Atta': 'https://images.unsplash.com/photo-1608686207856-001b95cf60ca?w=300&auto=format&fit=crop&q=80',
  'Sugar & Salt': 'https://images.unsplash.com/photo-1612198188060-c7c2a3b66eae?w=300&auto=format&fit=crop&q=80',
  'Edible Oils': 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=300&auto=format&fit=crop&q=80',
  'Dairy & Ghee': 'https://images.unsplash.com/photo-1550583724-b2692b85b150?w=300&auto=format&fit=crop&q=80',
  'Spices & Masala': 'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?w=300&auto=format&fit=crop&q=80',
  'Beverages': 'https://images.unsplash.com/photo-1544787219-7f47ccb76574?w=300&auto=format&fit=crop&q=80',
  'Snacks & Biscuits': 'https://images.unsplash.com/photo-1599490659213-e2b9527bd087?w=300&auto=format&fit=crop&q=80',
  'Personal & Home Care': 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=300&auto=format&fit=crop&q=80',
  'Dry Fruit Sweets': 'https://images.unsplash.com/photo-1541781774459-bb2af2f05b55?w=300&auto=format&fit=crop&q=80',
  'Cakes & Pastries': 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=300&auto=format&fit=crop&q=80',
  'Bajji': 'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=300&auto=format&fit=crop&q=80',
  'Cafe': 'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=300&auto=format&fit=crop&q=80',
  'Default': 'https://images.unsplash.com/photo-1583258292688-d0213dc5a3a8?w=300&auto=format&fit=crop&q=80',
};

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
  onUpdateItems,
  onOpenCalculator,
  onSold,
  tableContext,
  onBack,
}) => {
  const t = TRANSLATIONS[language];
  const settings = loadEzoSettings();

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchBar, setShowSearchBar] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

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

  // Modals
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [isAddItemModalOpen, setIsAddItemModalOpen] = useState(false);

  // New Item Quick Form State
  const [newItemName, setNewItemName] = useState('');
  const [newItemCategory, setNewItemCategory] = useState('Agri Products');
  const [newItemPrice, setNewItemPrice] = useState('');
  const [newItemStock, setNewItemStock] = useState('100');
  const [newItemUom, setNewItemUom] = useState<Uom>('pcs');
  const [newItemImageUrl, setNewItemImageUrl] = useState('');

  // Bill Adjustments
  const [discountPercent, setDiscountPercent] = useState<number>(0);
  const [discountAmount, setDiscountAmount] = useState<number>(0);
  const [orderType, setOrderType] = useState<string>(tableContext?.orderType || 'Parcel');
  const [selectedPaymentMode, setSelectedPaymentMode] = useState<'cash' | 'card' | 'upi' | 'credit'>('cash');
  const [isReceivedChecked, setIsReceivedChecked] = useState(true);

  // Draft / Held Bills
  const [heldBills, setHeldBills] = useState<{ id: string; lines: CartLine[]; customerName: string; customerPhone?: string; time: string; discountPercent?: number; discountAmount?: number; orderType?: string }[]>(() => {
    try { return JSON.parse(localStorage.getItem('novapos:held_bills') || '[]'); } catch { return []; }
  });
  useEffect(() => { localStorage.setItem('novapos:held_bills', JSON.stringify(heldBills)); }, [heldBills]);

  const [weightItem, setWeightItem] = useState<CatalogItem | null>(null);
  const [grams, setGrams] = useState('250');
  const [saleError, setSaleError] = useState('');
  const saving = useRef(false);

  useBackHandler(
    Boolean(weightItem) || isDetailsModalOpen || isAddItemModalOpen || creditPartyModalOpen,
    () => {
      if (weightItem) setWeightItem(null);
      else if (isDetailsModalOpen) setIsDetailsModalOpen(false);
      else if (isAddItemModalOpen) setIsAddItemModalOpen(false);
      else if (creditPartyModalOpen) setCreditPartyModalOpen(false);
    }
  );

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
  const existingCategories = Array.from(new Set(items.map((i) => i.categoryName).filter(Boolean)));
  const defaultCategoryPresets = [
    'Agri Products',
    'Bajji',
    'Beauty Parlour',
    'Bike & Car Wash',
    'Book Store',
    'Buttermilk',
    'Cafe',
    'Cement & Steel',
    'Chicken Shop',
    'Chinese',
    'Coffee Drinks',
    'Curry Point',
    'Dairy Products',
    'Dry Fruit Shop',
    'Electrical',
  ];
  const allUniqueCategories = existingCategories.length ? existingCategories : ['General'];

  // Count of items in cart per category
  const getCategoryCartCount = (catName: string) => {
    if (catName === 'all') return cart.length;
    if (catName === 'bestseller') return cart.length;
    return cart.filter((l) => l.category === catName).length;
  };

  // Filter items based on selected category and search query
  const filteredItems = items.filter((item) => {
    if (settings.hideOutOfStockItems && (item.stockQty ?? 0) <= 0) return false;
    if (selectedCategory !== 'all' && selectedCategory !== 'bestseller' && item.categoryName !== selectedCategory) return false;
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      item.name.toLowerCase().includes(q) ||
      item.code.toLowerCase().includes(q) ||
      itemBarcodes(item).some(code => code.toLowerCase().includes(q))
    );
  });

  // Cart Calculations
  const pricing = (() => {
    if (!cart.length) return { result: null, error: '' };
    try {
      return { result: priceCounterSale(cart, discountPercent, discountAmount, Boolean(settings.roundOffAmount),
        settings.enableServiceCharge && orderType === 'Dine-In' ? 5 : 0), error: '' };
    } catch (error) { return { result: null, error: (error as Error).message }; }
  })();
  const rawSubtotal = (pricing.result?.subtotalMinor ?? 0) / 100;
  const discountTotal = (pricing.result?.discountMinor ?? 0) / 100;
  const afterDiscount = rawSubtotal - discountTotal;
  const serviceCharge = (pricing.result?.serviceChargeMinor ?? 0) / 100;
  const finalTotal = (pricing.result?.totalMinor ?? 0) / 100;
  const roundOffDifference = (pricing.result?.roundingMinor ?? 0) / 100;
  const cgst = (pricing.result?.taxSnapshot.componentTotals.find(row => row.code === 'CGST')?.amountMinor ?? 0) / 100;
  const sgst = (pricing.result?.taxSnapshot.componentTotals.find(row => row.code === 'SGST')?.amountMinor ?? 0) / 100;

  // Add Item to Cart
  const handleAddItem = (item: CatalogItem, quantity?: number) => {
    if (!settings.allowZeroPriceItem && item.priceMinor <= 0) { setSaleError('Zero-price billing is disabled in Settings.'); return; }
    if (isWeight(item.uom) && settings.allowDecimalQuantity && quantity === undefined) { setWeightItem(item); setGrams('250'); return; }
    const amount = quantity ?? 1;
    const current = cart.find(line => line.itemId === item.id)?.quantity || 0;
    if (!settings.enableNegativeStockBilling && current + amount > (item.stockQty ?? 0)) { setSaleError('Not enough stock for this quantity.'); return; }
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
        gstRate: item.isGstApplicable === false ? 0 : item.gstRate ?? 0,
        hsnSac: item.hsnSac,
        quantity: amount,
        uom: item.uom,
        isVeg: item.isVeg,
        code: item.code,
        imageUrl: item.imageUrl,
      };
      onUpdateCart([...cart, newLine]);
    }
  };

  // Remove specific item completely from cart
  const handleRemoveItem = (itemId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    onUpdateCart(cart.filter((l) => l.itemId !== itemId));
  };

  // Update Item Quantity
  const handleSetQuantity = (itemId: string, newQty: number, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!Number.isFinite(newQty)) return;
    const item = items.find(value => value.id === itemId);
    if (newQty > 0 && (!item || (!settings.enableNegativeStockBilling && newQty > (item.stockQty ?? 0)))) {
      setSaleError('Not enough stock for this quantity.'); return;
    }
    setSaleError('');
    if (newQty <= 0) {
      onUpdateCart(cart.filter((l) => l.itemId !== itemId));
    } else {
      onUpdateCart(cart.map((l) => (l.itemId === itemId ? { ...l, quantity: newQty } : l)));
    }
  };

  const handleHoldBill = () => {
    if (cart.length === 0) return;
    setHeldBills((prev) => [
      ...prev,
      {
        id: `held-${Date.now()}`,
        lines: cart.map(line => ({ ...line })),
        discountPercent, discountAmount, orderType,
        customerName: customerName || 'Customer',
        customerPhone,
        time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
    onClearCart();
    setDiscountPercent(0); setDiscountAmount(0);
    setCustomerPhone('');
    setCustomerName('');
  };

  const handleRecallBill = (heldId: string) => {
    const found = heldBills.find((b) => b.id === heldId);
    if (!found) return;
    if (cart.length > 0) { setSaleError('Hold or finish the current bill before recalling another bill.'); return; }
    onUpdateCart(found.lines);
    setDiscountPercent(found.discountPercent ?? 0);
    setDiscountAmount(found.discountAmount ?? 0);
    setOrderType(found.orderType ?? 'Parcel');
    setCustomerName(found.customerName);
    setCustomerPhone(found.customerPhone || '');
    setHeldBills((prev) => prev.filter((b) => b.id !== heldId));
  };

  // Quick Add New Item to Catalog & Bill
  const handleCreateNewItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName.trim() || !newItemPrice) return;
    const priceNum = parseFloat(newItemPrice) || 0;
    const stockNum = Number(newItemStock);
    if (!Number.isFinite(priceNum) || priceNum < 0 || !Number.isFinite(stockNum) || stockNum < 0) { setSaleError('Enter valid price and stock.'); return; }
    const codeGen = String(items.length + 1001);

    const createdItem: CatalogItem = {
      id: `custom-${Date.now()}`,
      name: newItemName.trim(),
      categoryId: `cat-${newItemCategory.toLowerCase().replace(/\s+/g, '-')}`,
      categoryName: newItemCategory,
      priceMinor: Math.round(priceNum * 100),
      uom: newItemUom,
      isWeighed: newItemUom === 'kg' || newItemUom === 'g',
      isVeg: true,
      code: codeGen,
      stockQty: stockNum,
      imageUrl: newItemImageUrl.trim() || CATEGORY_IMAGE_PRESETS[newItemCategory] || CATEGORY_IMAGE_PRESETS['Default'],
      gstRate: 0,
      isGstApplicable: false,
    };

    if (onUpdateItems) {
      onUpdateItems([...items, createdItem]);
    }
    handleAddItem(createdItem, 1);
    setIsAddItemModalOpen(false);
    setNewItemName('');
    setNewItemPrice('');
    setNewItemStock('100');
    setNewItemImageUrl('');
  };

  // Complete & Save Sale
  const handleCompleteSale = async (mode: 'cash' | 'card' | 'upi' | 'credit' = selectedPaymentMode) => {
    if (saving.current || cart.length === 0) return;
    if (!pricing.result) { setSaleError(pricing.error); return; }
    if (cart.some(line => !Number.isFinite(line.quantity) || (!settings.enableNegativeStockBilling && line.quantity > (items.find(item => item.id === line.itemId)?.stockQty ?? 0)))) { setSaleError('Stock changed. Review item quantities before settling.'); return; }

    saving.current = true;
    setSaleError('');

    const effectivePhone = matchedParty?.phone || customerPhone;
    const effectiveName = matchedParty?.name || customerName;
    const billNo = nextInvoiceNumber();
    const now = new Date();

    const billData: BillData = {
      restaurantName: profileName || 'NovaPOS Store',
      address: address || '',
      phone: phone || '',
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
      subtotal: pricing.result.taxSnapshot.taxableMinor / 100,
      cgst,
      sgst,
      total: finalTotal,
      paymentMode: mode.toUpperCase(),
      upiVpa: upiVpa || undefined,
      upiPayload: upiVpa ? `upi://pay?pa=${encodeURIComponent(upiVpa)}&pn=${encodeURIComponent(profileName || 'Store')}&am=${finalTotal.toFixed(2)}&cu=INR` : undefined,
    };

    try {
      addDayBookEntry({
        type: 'sale',
        description: `Sale Bill #${billNo} (${effectiveName || 'Walk-in'})`,
        amount: finalTotal,
        paymentMode: mode,
        referenceNo: billNo,
        taxSnapshot: pricing.result.taxSnapshot,
        receiptSnapshot: billData,
        lines: cart.map(line => ({ ...line, netMinor: pricing.result!.lines.find(value => value.clientLineId === line.id)?.lineTotalMinor }))
      });
    } catch (error) {
      setSaleError((error as Error).message);
      saving.current = false;
      return;
    }

    onSold?.(cart);
    speakPaymentAlert(finalTotal, mode === 'credit' ? 'Khata' : mode);
    if (shouldPrintSale(Boolean(settings.askToPrintBill))) {
      void printBillDirect(billData).catch(error => setSaleError(`Sale saved. Printing failed: ${(error as Error).message}. Check the receipt before reprinting.`));
    }

    if (mode === 'credit' && matchedParty) {
      recordKhataSale(matchedParty.id, finalTotal, billNo);
    }

    setCompletedBill({
      billNo,
      total: finalTotal,
      mode,
      phone: effectivePhone,
      customerName: effectiveName,
      lines: [...cart],
    });

    onClearCart();
    setDiscountPercent(0); setDiscountAmount(0);
    setCustomerPhone('');
    setCustomerName('');
    setMatchedParty(null);
    setDiscountPercent(0);
    setDiscountAmount(0);
    setIsDetailsModalOpen(false);
    saving.current = false;
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

  useEffect(() => {
    if (!settings.itemBarcodeScanner || weightItem) return;
    return setupBarcodeScanner(code => {
      const found = findCatalogItemByCode(items, code);
      if (found) { handleAddItem(found); setSearchQuery(''); }
      else setSaleError(`No product found for barcode ${code}.`);
    });
  }, [items, cart, settings.itemBarcodeScanner, weightItem]);

  return (
    <div className="select-items-screen">
      {/* ────────────────── 1. Top Header Bar (Purple) ────────────────── */}
      <header className="select-items-top-bar">
        <div className="top-bar-left">
          {onBack && (
            <button onClick={onBack} className="top-bar-back-btn" title="Back">
              <ArrowLeft className="w-5 h-5 text-white" />
            </button>
          )}
          <div className="top-bar-title-wrap">
            <h1 className="top-bar-title">Select Items</h1>
            <span className="top-bar-subtitle">
              FAST v39.34 | {phone || '9848787308'} | {tableContext ? `Table ${tableContext.tableNo}` : '6231'}
            </span>
          </div>
        </div>

        <div className="top-bar-right">
          <button
            onClick={() => setShowSearchBar(!showSearchBar)}
            className={`top-bar-icon-btn ${showSearchBar ? 'active' : ''}`}
            title="Search products"
          >
            <Search className="w-5 h-5 text-white" />
          </button>
          <button
            onClick={() => {
              const code = prompt('Enter or scan barcode:');
              if (code) {
                const found = findCatalogItemByCode(items, code);
                if (found) handleAddItem(found);
                else setSaleError(`No item matching barcode "${code}"`);
              }
            }}
            className="top-bar-icon-btn"
            title="Barcode QR Scanner"
          >
            <QrCode className="w-5 h-5 text-white" />
          </button>
          {onOpenCalculator && (
            <button
              onClick={onOpenCalculator}
              className="top-bar-icon-btn"
              title="Calculator Fast Billing"
            >
              <Calculator className="w-5 h-5 text-white" />
            </button>
          )}
        </div>
      </header>

      {/* Optional Top Search Field */}
      {showSearchBar && (
        <div className="select-items-search-row">
          <Search className="w-4 h-4 text-slate-400 mr-2" />
          <input
            type="text"
            placeholder="Search items by name or code..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            autoFocus
            className="select-items-search-input"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="text-slate-400 hover:text-slate-600 font-bold px-2">
              ×
            </button>
          )}
        </div>
      )}

      {/* ────────────────── 2. Top Action Toolbar ────────────────── */}
      <div className="select-items-action-toolbar">
        <button
          onClick={() => setIsAddItemModalOpen(true)}
          className="toolbar-btn toolbar-btn-add"
          title="Add New Item"
        >
          <Plus className="w-4 h-4 mr-1 text-slate-700" />
          <span>Item</span>
        </button>

        <button
          onClick={handleHoldBill}
          className="toolbar-btn toolbar-btn-hold"
          title="Hold current bill"
          disabled={cart.length === 0}
        >
          <span>HOLD</span>
          {heldBills.length > 0 && <span className="toolbar-pill-badge">{heldBills.length}</span>}
        </button>

        <button
          onClick={() => {
            const next = orderType === 'Parcel' ? 'Dine-In' : orderType === 'Dine-In' ? 'Delivery' : 'Parcel';
            setOrderType(next);
          }}
          className="toolbar-btn toolbar-btn-parcel"
          title="Toggle Order Type"
        >
          <span>{orderType}</span>
        </button>

        <button
          onClick={() => {
            if (cart.length === 0) return;
            if (window.confirm('Clear all items from this bill?')) {
              onClearCart();
            }
          }}
          className="toolbar-btn toolbar-btn-clear"
          title="Clear all selected items"
          disabled={cart.length === 0}
        >
          <Grid className="w-4 h-4 text-slate-500" />
          <span className="clear-strike-line">/</span>
        </button>
      </div>

      {/* Sale error alert if any */}
      {saleError && (
        <div className="select-items-error-banner">
          <span>{saleError}</span>
          <button onClick={() => setSaleError('')} className="ml-2 font-bold">×</button>
        </div>
      )}

      {/* Completed Sale Success Banner */}
      {completedBill && (
        <div className="sale-success-banner">
          <div className="banner-left">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 mr-2" />
            <span>
              Bill <b>#{completedBill.billNo}</b> Saved · ₹{completedBill.total.toFixed(2)} ({completedBill.mode.toUpperCase()})
            </span>
          </div>
          <div className="banner-actions">
            {completedBill.phone && (
              <button onClick={handleShareWhatsApp} className="btn-banner-wa">
                <Share2 className="w-4 h-4 mr-1" />
                WhatsApp
              </button>
            )}
            <button onClick={() => setCompletedBill(null)} className="btn-banner-close">×</button>
          </div>
        </div>
      )}

      {/* ────────────────── 3. Main Split View (Categories Sidebar + Product Grid) ────────────────── */}
      <div className="select-items-body">
        {/* Left Categories Sidebar */}
        <aside className="select-items-sidebar">
          {/* Best Seller Items button */}
          <button
            onClick={() => setSelectedCategory('all')}
            className={`cat-sidebar-item cat-bestseller ${selectedCategory === 'all' ? 'active' : ''}`}
          >
            <span className="cat-sidebar-name">All Items</span>
            <span className="cat-sidebar-count">({items.length})</span>
          </button>

          {/* All unique categories */}
          {allUniqueCategories.map((cat) => {
            const count = items.filter(item => item.categoryName === cat).length;
            const isSelected = selectedCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`cat-sidebar-item ${isSelected ? 'active' : ''}`}
              >
                <span className="cat-sidebar-name">{cat}</span>
                <span className="cat-sidebar-count">({count})</span>
              </button>
            );
          })}
        </aside>

        {/* Right Product Cards Grid */}
        <main className="select-items-grid-container">
          {/* Breadcrumb / Category header */}
          <div className="grid-category-header">
            <span className="grid-sub-label">CATALOG</span>
            <h2 className="grid-category-title">
              {selectedCategory === 'all' || selectedCategory === 'bestseller' ? 'ALL ITEMS' : selectedCategory.toUpperCase()}
            </h2>
          </div>

          <div className="select-items-products-grid">
            {filteredItems.map((item) => {
              const inCart = cart.find((l) => l.itemId === item.id);
              const qty = inCart ? inCart.quantity : 0;
              const stock = item.stockQty ?? 0;
              const imgUrl = item.imageUrl || CATEGORY_IMAGE_PRESETS[item.categoryName] || CATEGORY_IMAGE_PRESETS['Agri Products'];

              return (
                <div
                  key={item.id}
                  onClick={() => handleAddItem(item)}
                  className={`item-pos-card ${qty > 0 ? 'selected' : ''}`}
                >
                  {/* Image Container with Red ❌ button if selected */}
                  <div className="item-card-image-wrap">
                    <img
                      src={imgUrl}
                      alt={item.name}
                      className="item-card-image"
                      loading="lazy"
                    />
                    {qty > 0 && (
                      <button
                        onClick={(e) => handleRemoveItem(item.id, e)}
                        className="item-card-remove-badge"
                        title="Remove item from bill"
                        aria-label="Remove item"
                      >
                        <X className="w-3.5 h-3.5 text-white stroke-[3]" />
                      </button>
                    )}
                  </div>

                  {/* Product Code & Name */}
                  <div className="item-card-info">
                    <h3 className="item-card-name" title={item.name}>
                      <span className="item-code-prefix">{item.code} | </span>
                      {item.name}
                    </h3>

                    {/* Stock Indicator */}
                    <div className="item-card-stock">
                      <span className={`stock-text ${stock <= 0 ? 'negative' : 'positive'}`}>
                        Available: {stock - qty}
                      </span>
                    </div>
                  </div>

                  {/* Bottom Row: Quantity Box & Price Box */}
                  <div className="item-card-bottom-row" onClick={(e) => e.stopPropagation()}>
                    <div className="item-card-qty-box">
                      {qty > 0 ? (
                        <div className="qty-stepper-wrap">
                          <button
                            onClick={(e) => handleSetQuantity(item.id, qty - 1, e)}
                            className="qty-btn-minus"
                          >
                            −
                          </button>
                          <span className="qty-value">{qty}</span>
                          <button
                            onClick={(e) => handleSetQuantity(item.id, qty + 1, e)}
                            className="qty-btn-plus"
                          >
                            +
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAddItem(item, 1);
                          }}
                          className="qty-zero-btn"
                        >
                          0
                        </button>
                      )}
                    </div>

                    <div className="item-card-price-box">
                      <span>{(item.priceMinor / 100).toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </main>
      </div>

      {/* ────────────────── 4. Bottom Fixed Settlement & Billing Bar ────────────────── */}
      <footer className="select-items-bottom-bar">
        {pricing.error && <p role="alert" className="text-red-700">{pricing.error}</p>}
        <div className="flex flex-wrap gap-3 p-2 text-xs">
          <span>Items: {cart.reduce((sum, line) => sum + line.quantity, 0)}</span>
          <span>Subtotal: ₹{rawSubtotal.toFixed(2)}</span>
          <span>Discount: {discountPercent}% / ₹{discountTotal.toFixed(2)}</span>
          <span>CGST: ₹{cgst.toFixed(2)}</span><span>SGST: ₹{sgst.toFixed(2)}</span>
        </div>
        {/* Row 1: Total & Received Amount */}
        <div className="bottom-total-row">
          <div className="total-amount-display">
            <span className="total-label">Total:</span>
            <span className="total-num">{finalTotal.toFixed(2)}</span>
          </div>

          <div
            className="received-amount-display"
            onClick={() => setIsReceivedChecked(!isReceivedChecked)}
          >
            {isReceivedChecked ? (
              <CheckSquare className="w-5 h-5 text-orange-600 mr-1.5" />
            ) : (
              <Square className="w-5 h-5 text-slate-400 mr-1.5" />
            )}
            <span className="received-label">Received:</span>
            <span className="received-num">{finalTotal.toFixed(2)}</span>
          </div>
        </div>

        {/* Row 2: Payment Mode Toggle Buttons (Bank, Cash, Cheque) */}
        <div className="bottom-payment-modes-row">
          <button
            onClick={() => setSelectedPaymentMode('card')}
            className={`pay-mode-btn ${selectedPaymentMode === 'card' ? 'active' : ''}`}
          >
            Card
          </button>
          <button
            onClick={() => setSelectedPaymentMode('cash')}
            className={`pay-mode-btn ${selectedPaymentMode === 'cash' ? 'active' : ''}`}
          >
            Cash
          </button>
          <button
            onClick={() => setSelectedPaymentMode('upi')}
            className={`pay-mode-btn ${selectedPaymentMode === 'upi' ? 'active' : ''}`}
          >
            UPI
          </button>
        </div>

        {/* Row 3: Action Buttons (DETAILS, KOT, SAVE) */}
        <div className="bottom-action-buttons-row">
          <button
            onClick={() => setIsDetailsModalOpen(true)}
            className="btn-bottom-details"
          >
            DETAILS
          </button>

          <button
            onClick={() => {
              if (cart.length === 0) return;
              setSaleError('KOT is not connected on this screen. Use the restaurant table workflow to send a kitchen ticket.');
            }}
            disabled={cart.length === 0}
            className="btn-bottom-kot"
          >
            KOT
          </button>

          <button
            onClick={() => handleCompleteSale(selectedPaymentMode)}
            disabled={cart.length === 0}
            className="btn-bottom-save"
          >
            SAVE (₹ {finalTotal.toFixed(2)})
          </button>
        </div>
      </footer>

      {/* ────────────────── Modals ────────────────── */}

      {/* 1. Quick Add Item Modal */}
      {isAddItemModalOpen && (
        <div className="table-modal-overlay">
          <form onSubmit={handleCreateNewItem} className="table-modal quick-add-item-modal">
            <div className="modal-header">
              <h3 className="font-bold text-slate-900 text-base">Add New Item to Catalog</h3>
              <button type="button" onClick={() => setIsAddItemModalOpen(false)} className="btn-close-modal">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="modal-body p-4 flex flex-col gap-3">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Item Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Zinc Sulphate 1Kg"
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  className="w-full p-2.5 border border-slate-300 rounded-lg text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Category</label>
                  <select
                    value={newItemCategory}
                    onChange={(e) => setNewItemCategory(e.target.value)}
                    className="w-full p-2.5 border border-slate-300 rounded-lg text-sm bg-white"
                  >
                    {allUniqueCategories.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Unit</label>
                  <select
                    value={newItemUom}
                    onChange={(e) => setNewItemUom(e.target.value as Uom)}
                    className="w-full p-2.5 border border-slate-300 rounded-lg text-sm bg-white"
                  >
                    <option value="pcs">Pieces (pcs)</option>
                    <option value="kg">Kilogram (kg)</option>
                    <option value="g">Grams (g)</option>
                    <option value="pack">Pack</option>
                    <option value="box">Box</option>
                    <option value="litre">Litre</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Sale Price (₹) *</label>
                  <input
                    type="number"
                    step="any"
                    required
                    placeholder="e.g. 180"
                    value={newItemPrice}
                    onChange={(e) => setNewItemPrice(e.target.value)}
                    className="w-full p-2.5 border border-slate-300 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Initial Stock</label>
                  <input
                    type="number"
                    placeholder="e.g. 50"
                    value={newItemStock}
                    onChange={(e) => setNewItemStock(e.target.value)}
                    className="w-full p-2.5 border border-slate-300 rounded-lg text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Image URL (Optional)</label>
                <input
                  type="url"
                  placeholder="https://..."
                  value={newItemImageUrl}
                  onChange={(e) => setNewItemImageUrl(e.target.value)}
                  className="w-full p-2.5 border border-slate-300 rounded-lg text-sm"
                />
              </div>

              <div className="modal-actions-bar mt-2">
                <button type="button" onClick={() => setIsAddItemModalOpen(false)} className="btn-cancel">
                  Cancel
                </button>
                <button type="submit" className="btn-submit">
                  Save & Add to Bill
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* 2. Bill Details Modal */}
      {isDetailsModalOpen && (
        <div className="table-modal-overlay">
          <div className="table-modal bill-details-modal">
            <div className="modal-header">
              <h3 className="font-bold text-slate-900 text-base">Invoice & Customer Details</h3>
              <button onClick={() => setIsDetailsModalOpen(false)} className="btn-close-modal">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="modal-body p-4 flex flex-col gap-3">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Customer Mobile Number</label>
                <input
                  type="tel"
                  placeholder="10-digit mobile number..."
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  className="w-full p-2.5 border border-slate-300 rounded-lg text-sm"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Customer Name</label>
                <input
                  type="text"
                  placeholder="Customer Name..."
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full p-2.5 border border-slate-300 rounded-lg text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Discount (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    placeholder="0%"
                    value={discountPercent || ''}
                    onChange={(e) => setDiscountPercent(parseFloat(e.target.value) || 0)}
                    className="w-full p-2.5 border border-slate-300 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Discount (₹)</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="₹0.00"
                    value={discountAmount || ''}
                    onChange={(e) => setDiscountAmount(parseFloat(e.target.value) || 0)}
                    className="w-full p-2.5 border border-slate-300 rounded-lg text-sm"
                  />
                </div>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex flex-col gap-1 text-xs">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <b>₹{rawSubtotal.toFixed(2)}</b>
                </div>
                {discountTotal > 0 && (
                  <div className="flex justify-between text-rose-600">
                    <span>Discount:</span>
                    <b>−₹{discountTotal.toFixed(2)}</b>
                  </div>
                )}
                <div className="flex justify-between font-bold text-sm text-slate-900 pt-1 border-t border-slate-200">
                  <span>Payable Total:</span>
                  <span>₹{finalTotal.toFixed(2)}</span>
                </div>
              </div>

              <div className="modal-actions-bar mt-2">
                <button type="button" onClick={() => setIsDetailsModalOpen(false)} className="btn-cancel">
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => setIsDetailsModalOpen(false)}
                  className="btn-submit"
                >
                  Apply Details
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. Weighed Item Modal */}
      {weightItem && (
        <div className="table-modal-overlay">
          <form
            className="table-modal weight-modal"
            onSubmit={(e) => {
              e.preventDefault();
              const numGrams = Number(grams);
              if (!numGrams || numGrams <= 0) return;
              handleAddItem(weightItem, quantityFromGrams(numGrams, weightItem.uom as 'kg' | 'g'));
              setWeightItem(null);
            }}
          >
            <div className="modal-header">
              <div>
                <h3 className="text-base font-bold text-slate-900">{weightItem.name}</h3>
                <span className="text-xs text-orange-600 font-semibold">
                  Rate: ₹{(weightItem.priceMinor / 100).toFixed(2)} / {weightItem.uom}
                </span>
              </div>
              <button type="button" onClick={() => setWeightItem(null)} className="btn-close-modal">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            <div className="modal-body p-4 flex flex-col gap-3">
              <label className="text-xs font-bold text-slate-700">Quick Presets</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { val: 100, label: '100g' },
                  { val: 250, label: '250g' },
                  { val: 500, label: '500g' },
                  { val: 1000, label: '1 kg' },
                  { val: 2000, label: '2 kg' },
                  { val: 5000, label: '5 kg' },
                ].map((preset) => (
                  <button
                    key={preset.val}
                    type="button"
                    onClick={() => {
                      setGrams(String(preset.val));
                      setCustomUnit(preset.val >= 1000 ? 'kg' : 'g');
                    }}
                    className={`py-2 px-1 rounded-lg text-xs font-black text-center ${
                      Number(grams) === preset.val
                        ? 'bg-orange-600 text-white shadow-sm'
                        : 'bg-orange-50 text-orange-700 border border-orange-200'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>

              <div className="form-group mt-2">
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  value={grams}
                  onChange={(e) => setGrams(e.target.value)}
                  className="w-full text-base font-bold text-slate-900 p-2.5 border border-slate-300 rounded-lg outline-none"
                  placeholder="Weight in grams..."
                />
              </div>

              <div className="modal-actions-bar mt-2">
                <button type="button" onClick={() => setWeightItem(null)} className="btn-cancel">
                  Cancel
                </button>
                <button type="submit" className="btn-submit">
                  Add to Bill
                </button>
              </div>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};



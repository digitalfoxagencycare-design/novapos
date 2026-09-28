import { mergeCatalog, barcodeConflict, itemBarcodes } from '../lib/catalog';
import { useBackHandler } from '../lib/navigation';
import React, { useState, useEffect } from 'react';
import {
  Package,
  Search,
  Plus,
  Edit2,
  Trash2,
  AlertTriangle,
  Barcode as BarcodeIcon,
  CheckCircle2,
  X,
  ArrowLeft,
  ArrowUpDown,
  TrendingUp,
  TrendingDown,
  Camera,
  QrCode,
  Tag,
  Percent,
} from 'lucide-react';
import {
  UNITS,
  presetCatalog,
  type BusinessProfile,
  type Uom,
  isWeight,
} from '../lib/business';
import { TRANSLATIONS, type SupportedLanguage } from '../lib/translations';
import { CameraBarcodeScanner } from '../components/CameraBarcodeScanner';

export interface CatalogItem {
  id: string;
  name: string;
  categoryId: string;
  categoryName: string;
  priceMinor: number;
  mrpMinor?: number;
  purchasePriceMinor?: number;
  uom: Uom;
  isWeighed: boolean;
  isVeg: boolean;
  code: string;
  stockQty?: number;
  barcode?: string;
  barcode2?: string;
  barcode3?: string;
  barcode4?: string;
  barcode5?: string;
  imageUrl?: string;
  gstRate?: number; // 0, 5, 12, 18, 28
  hsnSac?: string;
  isGstApplicable?: boolean;
  archived?: boolean;
  businessProfile?: BusinessProfile;
}

interface Props {
  language: SupportedLanguage;
  profile: BusinessProfile;
  onProfileChange?: (p: BusinessProfile) => void;
  customItems: CatalogItem[];
  onUpdateItems: (items: CatalogItem[]) => void;
  onBack?: () => void;
  phone?: string;
}

export const InventoryScreen: React.FC<Props> = ({
  language,
  profile,
  customItems,
  onUpdateItems,
  onBack,
  phone = '9848787308',
}) => {
  const t = TRANSLATIONS[language];
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [formError, setFormError] = useState('');
  const [editingItem, setEditingItem] = useState<CatalogItem | null>(null);

  // Stock Adjustment Modal States
  const [adjustStockModalOpen, setAdjustStockModalOpen] = useState(false);
  const [adjustStockItem, setAdjustStockItem] = useState<CatalogItem | null>(null);
  const [adjustStockMode, setAdjustStockMode] = useState<'add' | 'reduce'>('add');
  const [adjustStockQty, setAdjustStockQty] = useState('');
  const [adjustStockReason, setAdjustStockReason] = useState('New Purchase / Stock Received');

  // Barcode Scanner Modal State
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scanningField, setScanningField] = useState<'1' | '2' | '3' | '4' | '5'>('1');

  // Form states matching Screenshots 1 & 3
  const [formName, setFormName] = useState('');
  const [formTaxType, setFormTaxType] = useState<'exempt' | 'taxable'>('exempt'); // default exempt (0%)
  const [formGstRate, setFormGstRate] = useState<number>(5);
  const [formCategory, setFormCategory] = useState('General');
  const [isAddingNewCat, setIsAddingNewCat] = useState(false);
  const [newCatInput, setNewCatInput] = useState('');
  const [formPrice, setFormPrice] = useState('');
  const [formMrp, setFormMrp] = useState('');
  const [formPurchasePrice, setFormPurchasePrice] = useState('');
  const [formStock, setFormStock] = useState('0');
  const [formHsnSac, setFormHsnSac] = useState('');
  const [formUom, setFormUom] = useState<Uom>('pcs');
  const [formCode, setFormCode] = useState('');
  const [formBarcode1, setFormBarcode1] = useState('');
  const [formBarcode2, setFormBarcode2] = useState('');
  const [formBarcode3, setFormBarcode3] = useState('');
  const [formBarcode4, setFormBarcode4] = useState('');
  const [formBarcode5, setFormBarcode5] = useState('');

  useBackHandler(modalOpen || adjustStockModalOpen || scannerOpen, () => {
    if (scannerOpen) setScannerOpen(false);
    else if (adjustStockModalOpen) setAdjustStockModalOpen(false);
    else if (modalOpen) setModalOpen(false);
  });

  // Combine presets with user custom items
  const preset = presetCatalog(profile);
  const allItems = mergeCatalog<CatalogItem>(preset.items, customItems, profile);
  useEffect(() => {
    setSelectedCategory('all');
    setSearchQuery('');
  }, [profile]);

  const categories = [
    { id: 'all', name: 'All Categories' },
    ...Array.from(new Set(allItems.map((i) => i.categoryName))).map((c) => ({
      id: c,
      name: c,
    })),
  ];

  const uniqueCategoryNames = Array.from(
    new Set(['General', 'Groceries', 'Dairy', 'Snacks', 'Beverages', 'Bakery', ...allItems.map((i) => i.categoryName)])
  );

  const filteredItems = allItems.filter((item) => {
    if (selectedCategory !== 'all' && item.categoryName !== selectedCategory) return false;
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      item.name.toLowerCase().includes(q) ||
      item.code.toLowerCase().includes(q) ||
      (item.hsnSac && item.hsnSac.includes(q)) ||
      itemBarcodes(item).some(code => code.toLowerCase().includes(q))
    );
  });

  const handleOpenAddModal = () => {
    setFormError('');
    setEditingItem(null);
    setFormName('');
    setFormTaxType('exempt'); // default exempt (0%)
    setFormGstRate(5);
    setFormCategory('General');
    setIsAddingNewCat(false);
    setNewCatInput('');
    setFormPrice('');
    setFormMrp('');
    setFormPurchasePrice('');
    setFormStock('0');
    setFormHsnSac('');
    setFormUom('pcs');
    setFormCode(`ITEM-${Date.now().toString().slice(-4)}`);
    setFormBarcode1('');
    setFormBarcode2('');
    setFormBarcode3('');
    setFormBarcode4('');
    setFormBarcode5('');
    setModalOpen(true);
  };

  const handleOpenEditModal = (item: CatalogItem) => {
    setFormError('');
    setEditingItem(item);
    setFormName(item.name);
    const isTaxable = (item.gstRate ?? 0) > 0 || item.isGstApplicable === true;
    setFormTaxType(isTaxable ? 'taxable' : 'exempt');
    setFormGstRate(item.gstRate ?? 0);
    setFormCategory(item.categoryName || 'General');
    setIsAddingNewCat(false);
    setNewCatInput('');
    setFormPrice(String(item.priceMinor / 100));
    setFormMrp(item.mrpMinor ? String(item.mrpMinor / 100) : '');
    setFormPurchasePrice(item.purchasePriceMinor ? String(item.purchasePriceMinor / 100) : '');
    setFormStock(String(item.stockQty ?? 0));
    setFormHsnSac(item.hsnSac || '');
    setFormUom(item.uom);
    setFormCode(item.code);
    setFormBarcode1(item.barcode || '');
    setFormBarcode2(item.barcode2 || '');
    setFormBarcode3(item.barcode3 || '');
    setFormBarcode4(item.barcode4 || '');
    setFormBarcode5(item.barcode5 || '');
    setModalOpen(true);
  };

  const handleOpenScanner = (fieldNumber: '1' | '2' | '3' | '4' | '5') => {
    setScanningField(fieldNumber);
    setScannerOpen(true);
  };

  const handleBarcodeScanned = (code: string) => {
    if (scanningField === '1') setFormBarcode1(code);
    else if (scanningField === '2') setFormBarcode2(code);
    else if (scanningField === '3') setFormBarcode3(code);
    else if (scanningField === '4') setFormBarcode4(code);
    else if (scanningField === '5') setFormBarcode5(code);
    setScannerOpen(false);
  };

  const handleOpenAdjustStock = (item: CatalogItem, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setAdjustStockItem(item);
    setAdjustStockMode('add');
    setAdjustStockQty('');
    setAdjustStockReason('New Purchase / Stock Received');
    setAdjustStockModalOpen(true);
  };

  const handleSaveStockAdjustment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustStockItem) return;
    const adjustment = parseFloat(adjustStockQty) || 0;
    if (!Number.isFinite(adjustment) || adjustment <= 0) return;

    const currentStock = adjustStockItem.stockQty ?? 0;
    const newStock =
      adjustStockMode === 'add' ? currentStock + adjustment : Math.max(0, currentStock - adjustment);

    const updatedItem: CatalogItem = {
      ...adjustStockItem,
      stockQty: newStock,
    };

    onUpdateItems([...customItems.filter((i) => i.id !== adjustStockItem.id), updatedItem]);

    setAdjustStockModalOpen(false);
    setAdjustStockItem(null);
  };

  const handleSaveItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formPrice) return;

    const price = Number(formPrice);
    const mrp = formMrp ? parseFloat(formMrp) : undefined;
    const purchase = formPurchasePrice ? parseFloat(formPurchasePrice) : undefined;
    const stock = Number(formStock);
    if (!Number.isFinite(price) || price < 0 || !Number.isSafeInteger(Math.round(price * 100)) ||
        !Number.isFinite(stock) || stock < 0 ||
        [mrp, purchase].some(value => value !== undefined && (!Number.isFinite(value) || value < 0))) {
      setFormError('Enter valid non-negative prices and stock.'); return;
    }
    const conflict = barcodeConflict([...allItems, ...customItems],
      [formBarcode1, formBarcode2, formBarcode3, formBarcode4, formBarcode5, formCode], editingItem?.id);
    if (conflict) { setFormError(conflict); return; }
    if (isAddingNewCat && !newCatInput.trim()) { setFormError('Enter a category name.'); return; }
    setFormError('');

    const effectiveCategory = isAddingNewCat && newCatInput.trim() ? newCatInput.trim() : formCategory;
    const effectiveGstRate = formTaxType === 'taxable' ? Number(formGstRate) : 0;
    const isGstApplicable = formTaxType === 'taxable';

    if (editingItem) {
      const updated: CatalogItem = {
        ...editingItem,
        name: formName.trim(),
        categoryName: effectiveCategory,
        categoryId: `cat-${effectiveCategory.toLowerCase().replace(/\s+/g, '-')}`,
        priceMinor: Math.round(price * 100),
        mrpMinor: mrp !== undefined ? Math.round(mrp * 100) : undefined,
        purchasePriceMinor: purchase !== undefined ? Math.round(purchase * 100) : undefined,
        uom: formUom,
        isWeighed: isWeight(formUom),
        code: formCode || editingItem.code,
        barcode: formBarcode1.trim() || undefined,
        barcode2: formBarcode2.trim() || undefined,
        barcode3: formBarcode3.trim() || undefined,
        barcode4: formBarcode4.trim() || undefined,
        barcode5: formBarcode5.trim() || undefined,
        stockQty: stock,
        gstRate: effectiveGstRate,
        isGstApplicable,
        hsnSac: formHsnSac.trim() || undefined,
      };
      onUpdateItems([...customItems.filter((item) => item.id !== editingItem.id), updated]);
    } else {
      const newItem: CatalogItem = {
        id: `custom-${Date.now()}`,
        businessProfile: profile,
        name: formName.trim(),
        categoryName: effectiveCategory,
        categoryId: `cat-${effectiveCategory.toLowerCase().replace(/\s+/g, '-')}`,
        priceMinor: Math.round(price * 100),
        mrpMinor: mrp !== undefined ? Math.round(mrp * 100) : undefined,
        purchasePriceMinor: purchase !== undefined ? Math.round(purchase * 100) : undefined,
        uom: formUom,
        isWeighed: isWeight(formUom),
        code: formCode || `ITM-${Date.now().toString().slice(-4)}`,
        barcode: formBarcode1.trim() || undefined,
        barcode2: formBarcode2.trim() || undefined,
        barcode3: formBarcode3.trim() || undefined,
        barcode4: formBarcode4.trim() || undefined,
        barcode5: formBarcode5.trim() || undefined,
        stockQty: stock,
        isVeg: true,
        gstRate: effectiveGstRate,
        isGstApplicable,
        hsnSac: formHsnSac.trim() || undefined,
      };
      onUpdateItems([newItem, ...customItems]);
    }

    setModalOpen(false);
  };

  const handleDeleteItem = (id: string) => {
    const item = allItems.find((value) => value.id === id);
    if (!item || !window.confirm(`Delete ${item.name} from the catalog?`)) return;
    onUpdateItems([...customItems.filter((value) => value.id !== id), { ...item, archived: true }]);
  };

  return (
    <div className="inventory-screen">
      {/* Header (Internal Profile Switcher Removed as Requested) */}
      <div className="inventory-header">
        <div className="inventory-title-group">
          {onBack && (
            <button
              onClick={onBack}
              className="ezo-back-btn mr-2"
              title="Back"
              aria-label="Back"
            >
              <ArrowLeft className="w-6 h-6 text-white stroke-[2.5]" />
              <span>Back</span>
            </button>
          )}
          <Package className="w-6 h-6 text-emerald-400" />
          <div>
            <h2>Items & Products</h2>
            <p className="inventory-sub">
              {allItems.length} active products & stock items
            </p>
          </div>
        </div>

        <div className="inventory-actions-row">
          <button onClick={handleOpenAddModal} className="btn-add-catalog-item">
            <Plus className="w-4 h-4 mr-1.5" />
            + Add Item
          </button>
        </div>
      </div>

      {/* Categories Bar */}
      <div className="inventory-cat-bar">
        {categories.map((c) => (
          <button
            key={c.id}
            onClick={() => setSelectedCategory(c.id)}
            className={`cat-chip ${selectedCategory === c.id ? 'active' : ''}`}
          >
            {c.name}
          </button>
        ))}
      </div>

      {/* Search Input */}
      <div className="inventory-search-wrap">
        <Search className="w-4 h-4 text-slate-400" />
        <input
          type="text"
          placeholder="Search item name, code or barcode..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Items Table / Grid */}
      <div className="inventory-table-container">
        {/* Mobile View Cards (< 768px) */}
        <div className="inventory-mobile-list">
          {filteredItems.length === 0 ? (
            <div className="p-8 text-center text-slate-400">
              <Package className="w-10 h-10 mx-auto mb-2 text-slate-300" />
              <p>No items match search</p>
            </div>
          ) : (
            filteredItems.map((item) => (
              <div key={item.id} className="inventory-mobile-card">
                <div className="inv-card-header">
                  <div className="item-name-cell">
                    <b className="inv-card-name">{item.name}</b>
                  </div>
                  <div className="inv-card-price">
                    <b className="price-text">₹{(item.priceMinor / 100).toFixed(2)}</b>
                    <span className="text-xs text-slate-500">/{item.uom}</span>
                  </div>
                </div>

                <div className="inv-card-meta">
                  <span className="cat-badge">{item.categoryName}</span>
                  <span className="code-badge">{item.code}</span>
                  <span
                    className={`text-[11px] font-bold px-2 py-0.5 rounded ${
                      (item.gstRate ?? 0) > 0
                        ? 'bg-purple-50 text-purple-700 border border-purple-200'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    GST {item.gstRate ?? 0}%
                  </span>
                  {item.hsnSac && (
                    <span className="text-[11px] font-mono text-slate-500 bg-slate-50 px-1.5 py-0.5 rounded border">
                      HSN:{item.hsnSac}
                    </span>
                  )}
                  {item.barcode && <span className="barcode-badge">{item.barcode}</span>}
                </div>

                <div className="inv-card-footer">
                  <div className="flex items-center gap-2">
                    <span
                      className={`stock-badge ${
                        (item.stockQty ?? 0) <= 0
                          ? 'out'
                          : (item.stockQty ?? 0) < 10
                          ? 'low'
                          : 'ok'
                      }`}
                    >
                      Stock: {item.stockQty ?? 0} {item.uom}
                    </span>
                    <button
                      onClick={(e) => handleOpenAdjustStock(item, e)}
                      className="px-2 py-1 bg-amber-50 text-amber-700 border border-amber-300 rounded text-xs font-bold flex items-center hover:bg-amber-100"
                      title="Adjust Stock Quantity (+ / -)"
                    >
                      <ArrowUpDown className="w-3 h-3 mr-1" />
                      Adjust Stock
                    </button>
                  </div>

                  <div className="row-actions">
                    <button
                      onClick={() => handleOpenEditModal(item)}
                      className="btn-action-edit-mobile"
                      title="Edit Item"
                    >
                      <Edit2 className="w-3.5 h-3.5 mr-1" />
                      <span>Edit</span>
                    </button>
                    <button
                      onClick={() => handleDeleteItem(item.id)}
                      className="btn-action-del"
                      title="Delete Item"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Desktop Table (>= 768px) */}
        <table className="inventory-table inventory-desktop-table">
          <thead>
            <tr>
              <th>{t.billing.item}</th>
              <th>Category</th>
              <th>GST / HSN</th>
              <th>Code / Barcode</th>
              <th>Unit</th>
              <th>{t.billing.price}</th>
              <th>Stock Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredItems.map((item) => (
              <tr key={item.id}>
                <td>
                  <div className="item-name-cell">
                    <b>{item.name}</b>
                  </div>
                </td>
                <td>
                  <span className="cat-badge">{item.categoryName}</span>
                </td>
                <td>
                  <div className="flex flex-col gap-0.5">
                    <span className="font-bold text-xs text-purple-700">GST {item.gstRate ?? 0}%</span>
                    {item.hsnSac && (
                      <span className="text-[10px] font-mono text-slate-500">HSN: {item.hsnSac}</span>
                    )}
                  </div>
                </td>
                <td>
                  <span className="code-badge">{item.code}</span>
                  {item.barcode && <span className="barcode-badge ml-1">{item.barcode}</span>}
                </td>
                <td>{item.uom}</td>
                <td>
                  <b className="price-text">₹{(item.priceMinor / 100).toFixed(2)}</b>
                </td>
                <td>
                  <div className="flex items-center gap-2">
                    <span
                      className={`stock-badge ${
                        (item.stockQty ?? 0) <= 0
                          ? 'out'
                          : (item.stockQty ?? 0) < 10
                          ? 'low'
                          : 'ok'
                      }`}
                    >
                      {item.stockQty ?? 0} {item.uom}
                    </span>
                    <button
                      onClick={(e) => handleOpenAdjustStock(item, e)}
                      className="px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-300 rounded text-xs font-bold hover:bg-amber-100 flex items-center"
                    >
                      <ArrowUpDown className="w-3 h-3 mr-1" />
                      Adjust
                    </button>
                  </div>
                </td>
                <td>
                  <div className="row-actions">
                    <button
                      onClick={() => handleOpenEditModal(item)}
                      className="btn-action-edit"
                      title="Edit Item"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteItem(item.id)}
                      className="btn-action-del"
                      title="Delete Item"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ────────────────── 1. Adjust Stock Modal ────────────────── */}
      {adjustStockModalOpen && adjustStockItem && (
        <div className="table-modal-overlay">
          <form
            onSubmit={handleSaveStockAdjustment}
            className="table-modal max-w-sm w-full bg-white rounded-2xl overflow-hidden shadow-2xl border border-slate-200"
          >
            <div className="p-4 bg-purple-700 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ArrowUpDown className="w-5 h-5" />
                <h3 className="font-bold text-sm">Adjust Stock ({adjustStockItem.name})</h3>
              </div>
              <button
                type="button"
                onClick={() => setAdjustStockModalOpen(false)}
                className="text-white/80 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex justify-between items-center text-xs">
                <span className="text-slate-500 font-medium">Current In Stock:</span>
                <span className="font-bold text-slate-800 text-sm">
                  {adjustStockItem.stockQty ?? 0} {adjustStockItem.uom}
                </span>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1.5">Adjustment Mode</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setAdjustStockMode('add')}
                    className={`py-2 px-3 rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 transition-all ${
                      adjustStockMode === 'add'
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    }`}
                  >
                    <TrendingUp className="w-4 h-4" />
                    <span>🟢 Add Stock (+)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setAdjustStockMode('reduce')}
                    className={`py-2 px-3 rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 transition-all ${
                      adjustStockMode === 'reduce'
                        ? 'bg-rose-600 text-white shadow-sm'
                        : 'bg-rose-50 text-rose-800 border border-rose-200'
                    }`}
                  >
                    <TrendingDown className="w-4 h-4" />
                    <span>🔴 Reduce Stock (−)</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  {adjustStockMode === 'add' ? 'Quantity to Add' : 'Quantity to Reduce'} ({adjustStockItem.uom}) *
                </label>
                <input
                  type="number"
                  step="any"
                  min="0.01"
                  required
                  autoFocus
                  placeholder="e.g. 50"
                  value={adjustStockQty}
                  onChange={(e) => setAdjustStockQty(e.target.value)}
                  className="w-full p-2.5 border border-slate-300 rounded-lg text-base font-bold text-slate-900 outline-none focus:border-purple-600"
                />
              </div>

              <div className="grid grid-cols-4 gap-1.5">
                {[5, 10, 50, 100].map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setAdjustStockQty(String(val))}
                    className="py-1.5 px-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-bold border border-slate-200"
                  >
                    {adjustStockMode === 'add' ? `+${val}` : `-${val}`}
                  </button>
                ))}
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Reason / Notes</label>
                <select
                  value={adjustStockReason}
                  onChange={(e) => setAdjustStockReason(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-lg text-xs bg-white text-slate-800"
                >
                  <option value="New Purchase / Stock Received">New Purchase / Stock Received</option>
                  <option value="Physical Stock Audit Correction">Physical Stock Audit Correction</option>
                  <option value="Damaged / Expired / Wastage">Damaged / Expired / Wastage</option>
                  <option value="Customer Return">Customer Return</option>
                  <option value="Internal Store Consumption">Internal Store Consumption</option>
                </select>
              </div>

              {adjustStockQty && (
                <div className="p-3 bg-emerald-50 rounded-lg flex items-center justify-between border border-emerald-200">
                  <span className="text-xs font-bold text-emerald-900">New Resulting Stock:</span>
                  <span className="text-base font-black text-emerald-700 font-mono">
                    {adjustStockMode === 'add'
                      ? (adjustStockItem.stockQty ?? 0) + (parseFloat(adjustStockQty) || 0)
                      : Math.max(0, (adjustStockItem.stockQty ?? 0) - (parseFloat(adjustStockQty) || 0))}{' '}
                    {adjustStockItem.uom}
                  </span>
                </div>
              )}

              <div className="modal-actions-bar mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setAdjustStockModalOpen(false)}
                  className="btn-cancel flex-1"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!adjustStockQty || parseFloat(adjustStockQty) <= 0}
                  className="btn-submit flex-1 bg-purple-700 hover:bg-purple-800"
                >
                  Update Stock
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* ────────────────── 2. Add / Edit Product Modal (Matching Screenshots 1 & 3) ────────────────── */}
      {modalOpen && (
        <div className="table-modal-overlay">
          <div className="table-modal max-w-lg w-full bg-white rounded-2xl overflow-hidden shadow-2xl border border-slate-200 max-h-[92vh] flex flex-col">
            {/* Top Purple App Bar matching Screenshot 1 & 3 */}
            <div className="p-3.5 bg-purple-700 text-white flex items-center justify-between shadow-md">
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="p-1 rounded-full text-white hover:bg-purple-800"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <div>
                  <h3 className="font-bold text-base leading-tight">
                    {editingItem ? 'Edit Item' : 'New Item'}
                  </h3>
                  <span className="text-[11px] text-purple-200">FAST v39.34 | {phone} | 6231</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="text-white/80 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveItem} className="p-4 space-y-4 overflow-y-auto flex-1">
              {formError && <p role="alert" className="text-red-700">{formError}</p>}
              {/* Field 1: Product / Item Name * */}
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Product / Item Name *
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder="e.g. Sona Masoori Rice, Milk, Biscuit"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full text-sm font-semibold text-slate-800 p-3 border border-purple-300 rounded-xl focus:border-purple-600 focus:ring-1 focus:ring-purple-600 outline-none"
                />
              </div>

              {/* Field 2: GST Tax Configuration (Taxable vs Exempt 0% - Default Exempt 0%) */}
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700">GST Tax Configuration</span>
                  <div className="flex rounded-lg bg-slate-200 p-0.5">
                    <button
                      type="button"
                      onClick={() => setFormTaxType('taxable')}
                      className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${
                        formTaxType === 'taxable'
                          ? 'bg-purple-700 text-white shadow-sm'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Taxable
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormTaxType('exempt')}
                      className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${
                        formTaxType === 'exempt'
                          ? 'bg-purple-700 text-white shadow-sm'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Exempt (0%)
                    </button>
                  </div>
                </div>

                {formTaxType === 'taxable' ? (
                  <div className="space-y-1.5 pt-1 border-t border-slate-200">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-600 font-medium">Select GST Slab Rate (%):</span>
                      <span className="font-bold text-purple-700">Active: {formGstRate}% GST</span>
                    </div>
                    <div className="grid grid-cols-5 gap-1.5">
                      {[0, 5, 12, 18, 28].map((rate) => (
                        <button
                          key={rate}
                          type="button"
                          onClick={() => setFormGstRate(rate)}
                          className={`py-1.5 rounded-lg text-xs font-bold border transition-all ${
                            formGstRate === rate
                              ? 'bg-purple-600 text-white border-purple-600'
                              : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                          }`}
                        >
                          {rate}%
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-[11px] text-slate-500 italic">
                    Product is tax exempt (0% GST applies on bills).
                  </p>
                )}
              </div>

              {/* Field 3: Category Selector (Single clean dropdown + inline add) */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs font-semibold text-slate-700">Category *</label>
                  {!isAddingNewCat ? (
                    <button
                      type="button"
                      onClick={() => setIsAddingNewCat(true)}
                      className="text-xs text-purple-700 font-bold hover:underline flex items-center gap-0.5"
                    >
                      <Plus className="w-3 h-3" /> Add Category
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setIsAddingNewCat(false)}
                      className="text-xs text-slate-500 hover:underline"
                    >
                      Use Existing
                    </button>
                  )}
                </div>

                {!isAddingNewCat ? (
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    className="w-full text-sm font-semibold text-slate-800 p-3 border border-slate-300 rounded-xl bg-white focus:border-purple-600 outline-none"
                  >
                    {uniqueCategoryNames.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Enter new category name..."
                      value={newCatInput}
                      onChange={(e) => setNewCatInput(e.target.value)}
                      className="flex-1 text-sm font-semibold text-slate-800 p-2.5 border border-purple-300 rounded-xl focus:border-purple-600 outline-none"
                    />
                  </div>
                )}
              </div>

              {/* Field 4: Price (₹) & Stock Quantity */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Price (₹) *</label>
                  <div className="relative">
                    <span className="absolute left-3 top-3 text-slate-400 font-bold text-sm">₹</span>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      required
                      placeholder="0.00"
                      value={formPrice}
                      onChange={(e) => setFormPrice(e.target.value)}
                      className="w-full text-sm font-bold text-slate-800 pl-7 pr-3 py-3 border border-slate-300 rounded-xl focus:border-purple-600 outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Stock Quantity</label>
                  <input
                    type="number"
                    value={formStock}
                    onChange={(e) => setFormStock(e.target.value)}
                    placeholder="0" step="any" min="0"
                    className="w-full text-sm font-bold text-slate-800 p-3 border border-slate-300 rounded-xl focus:border-purple-600 outline-none"
                  />
                </div>
              </div>

              {/* MRP & Purchase Price (Optional) */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-500 block mb-1">MRP: (Optional)</label>
                  <input
                    type="number"
                    step="any"
                    placeholder="MRP (₹)"
                    value={formMrp}
                    onChange={(e) => setFormMrp(e.target.value)}
                    className="w-full text-xs text-slate-700 p-2.5 border border-slate-200 rounded-xl outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 block mb-1">Purchase Price (Optional)</label>
                  <input
                    type="number"
                    step="any"
                    placeholder="Purchase Price (₹)"
                    value={formPurchasePrice}
                    onChange={(e) => setFormPurchasePrice(e.target.value)}
                    className="w-full text-xs text-slate-700 p-2.5 border border-slate-200 rounded-xl outline-none"
                  />
                </div>
              </div>

              {/* Field 5: HSN / SAC Code */}
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  HSN / SAC Code (Optional for GST Invoice)
                </label>
                <input
                  type="text"
                  placeholder="e.g. 1006 (Rice), 0401 (Milk)"
                  value={formHsnSac}
                  onChange={(e) => setFormHsnSac(e.target.value)}
                  className="w-full text-xs font-mono text-slate-800 p-2.5 border border-slate-300 rounded-xl focus:border-purple-600 outline-none"
                />
              </div>

              {/* Field 6: Unit of Measure (UOM) Selector */}
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1.5">
                  Unit of Measure (UOM) *
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {UNITS.map((u) => (
                    <button
                      key={u}
                      type="button"
                      onClick={() => setFormUom(u)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase transition-all ${
                        formUom === u
                          ? 'bg-purple-700 text-white shadow-sm'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      {u}
                    </button>
                  ))}
                </div>
              </div>

              {/* Field 7: Item Code / SKU */}
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Item Code / SKU</label>
                <input
                  type="text"
                  value={formCode}
                  onChange={(e) => setFormCode(e.target.value)}
                  placeholder="ITEM-5482"
                  className="w-full text-xs font-mono text-slate-800 p-2.5 border border-slate-300 rounded-xl focus:border-purple-600 outline-none"
                />
              </div>

              {/* Field 8: 5 Bar Code Fields with Google Lens / Camera Barcode Scanner (Matching Screenshot 1) */}
              <div className="space-y-3 pt-2 border-t border-slate-100">
                <span className="text-xs font-bold text-slate-800 block">
                  Product Barcodes & Scanners (Up to 5 Codes)
                </span>

                {/* Bar Code 1 */}
                <div>
                  <label className="text-[11px] font-semibold text-slate-600 block mb-1">Bar Code</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="Bar Code"
                      value={formBarcode1}
                      onChange={(e) => setFormBarcode1(e.target.value)}
                      className="flex-1 text-xs font-mono text-slate-800 p-2.5 border border-slate-300 rounded-xl focus:border-purple-600 outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => handleOpenScanner('1')}
                      className="p-2.5 bg-purple-50 text-purple-700 border border-purple-200 rounded-xl hover:bg-purple-100 transition-colors"
                      title="Scan Bar Code 1 with Camera"
                    >
                      <QrCode className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                {/* Bar Code 2 */}
                <div>
                  <label className="text-[11px] font-semibold text-slate-600 block mb-1">Bar Code 2</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="Bar Code 2"
                      value={formBarcode2}
                      onChange={(e) => setFormBarcode2(e.target.value)}
                      className="flex-1 text-xs font-mono text-slate-800 p-2.5 border border-slate-300 rounded-xl focus:border-purple-600 outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => handleOpenScanner('2')}
                      className="p-2.5 bg-purple-50 text-purple-700 border border-purple-200 rounded-xl hover:bg-purple-100 transition-colors"
                      title="Scan Bar Code 2 with Camera"
                    >
                      <QrCode className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                {/* Bar Code 3 */}
                <div>
                  <label className="text-[11px] font-semibold text-slate-600 block mb-1">Bar Code 3</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="Bar Code 3"
                      value={formBarcode3}
                      onChange={(e) => setFormBarcode3(e.target.value)}
                      className="flex-1 text-xs font-mono text-slate-800 p-2.5 border border-slate-300 rounded-xl focus:border-purple-600 outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => handleOpenScanner('3')}
                      className="p-2.5 bg-purple-50 text-purple-700 border border-purple-200 rounded-xl hover:bg-purple-100 transition-colors"
                      title="Scan Bar Code 3 with Camera"
                    >
                      <QrCode className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                {/* Bar Code 4 */}
                <div>
                  <label className="text-[11px] font-semibold text-slate-600 block mb-1">Bar Code 4</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="Bar Code 4"
                      value={formBarcode4}
                      onChange={(e) => setFormBarcode4(e.target.value)}
                      className="flex-1 text-xs font-mono text-slate-800 p-2.5 border border-slate-300 rounded-xl focus:border-purple-600 outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => handleOpenScanner('4')}
                      className="p-2.5 bg-purple-50 text-purple-700 border border-purple-200 rounded-xl hover:bg-purple-100 transition-colors"
                      title="Scan Bar Code 4 with Camera"
                    >
                      <QrCode className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                {/* Bar Code 5 */}
                <div>
                  <label className="text-[11px] font-semibold text-slate-600 block mb-1">Bar Code 5</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="Bar Code 5"
                      value={formBarcode5}
                      onChange={(e) => setFormBarcode5(e.target.value)}
                      className="flex-1 text-xs font-mono text-slate-800 p-2.5 border border-slate-300 rounded-xl focus:border-purple-600 outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => handleOpenScanner('5')}
                      className="p-2.5 bg-purple-50 text-purple-700 border border-purple-200 rounded-xl hover:bg-purple-100 transition-colors"
                      title="Scan Bar Code 5 with Camera"
                    >
                      <QrCode className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Bottom Save Button matching Screenshot 1 */}
              <div className="pt-4 sticky bottom-0 bg-white">
                <button
                  type="submit"
                  className="w-full py-3.5 bg-purple-700 hover:bg-purple-800 text-white font-bold text-sm rounded-full shadow-lg transition-transform active:scale-95 flex items-center justify-center gap-2"
                >
                  SAVE
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Camera Live Barcode Scanner Overlay */}
      <CameraBarcodeScanner
        isOpen={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScan={handleBarcodeScanned}
        title={`Scan Barcode for Bar Code ${scanningField}`}
      />
    </div>
  );
};

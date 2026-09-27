import { mergeCatalog } from '../lib/catalog';
import { useBackHandler } from '../lib/navigation';
import React, { useState, useEffect } from 'react';
import {
  Package,
  Search,
  Plus,
  Minus,
  Edit2,
  Trash2,
  AlertTriangle,
  Barcode,
  Layers,
  CheckCircle2,
  X,
  ChefHat,
  ArrowLeft,
  Boxes,
  ArrowUpDown,
  History,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';
import {
  PROFILES,
  UNITS,
  presetCatalog,
  type BusinessProfile,
  type Uom,
  isWeight,
} from '../lib/business';
import { TRANSLATIONS, type SupportedLanguage } from '../lib/translations';

export interface CatalogItem {
  id: string;
  name: string;
  categoryId: string;
  categoryName: string;
  priceMinor: number;
  uom: Uom;
  isWeighed: boolean;
  isVeg: boolean;
  code: string;
  stockQty?: number;
  barcode?: string;
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
  onProfileChange: (p: BusinessProfile) => void;
  customItems: CatalogItem[];
  onUpdateItems: (items: CatalogItem[]) => void;
  onBack?: () => void;
}

export const InventoryScreen: React.FC<Props> = ({
  language,
  profile,
  onProfileChange,
  customItems,
  onUpdateItems,
  onBack,
}) => {
  const t = TRANSLATIONS[language];
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<CatalogItem | null>(null);

  // Stock Adjustment Modal States
  const [adjustStockModalOpen, setAdjustStockModalOpen] = useState(false);
  const [adjustStockItem, setAdjustStockItem] = useState<CatalogItem | null>(null);
  const [adjustStockMode, setAdjustStockMode] = useState<'add' | 'reduce'>('add');
  const [adjustStockQty, setAdjustStockQty] = useState('');
  const [adjustStockReason, setAdjustStockReason] = useState('New Purchase / Stock Received');

  useBackHandler(modalOpen || adjustStockModalOpen, () => {
    if (adjustStockModalOpen) setAdjustStockModalOpen(false);
    else if (modalOpen) setModalOpen(false);
  });

  // Form states
  const [formName, setFormName] = useState('');
  const [formCategory, setFormCategory] = useState('');
  const [formPrice, setFormPrice] = useState('');
  const [formUom, setFormUom] = useState<Uom>('pcs');
  const [formCode, setFormCode] = useState('');
  const [formBarcode, setFormBarcode] = useState('');
  const [formStock, setFormStock] = useState('100');
  const [formImageUrl, setFormImageUrl] = useState('');
  const [formIsVeg, setFormIsVeg] = useState(true);
  const [formGstApplicable, setFormGstApplicable] = useState(true);
  const [formGstRate, setFormGstRate] = useState<number>(5);
  const [formHsnSac, setFormHsnSac] = useState('');

  // Combine presets with user custom items
  const preset = presetCatalog(profile);
  const allItems = mergeCatalog<CatalogItem>(preset.items, customItems, profile);
  useEffect(() => { setSelectedCategory('all'); setSearchQuery(''); }, [profile]);

  const categories = [
    { id: 'all', name: 'All Categories' },
    ...Array.from(new Set(allItems.map((i) => i.categoryName))).map((c) => ({
      id: c,
      name: c,
    })),
  ];

  const filteredItems = allItems.filter((item) => {
    if (selectedCategory !== 'all' && item.categoryName !== selectedCategory) return false;
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      item.name.toLowerCase().includes(q) ||
      item.code.toLowerCase().includes(q) ||
      (item.hsnSac && item.hsnSac.includes(q)) ||
      (item.barcode && item.barcode.includes(q))
    );
  });

  const handleOpenAddModal = () => {
    setEditingItem(null);
    setFormName('');
    setFormCategory('General');
    setFormPrice('');
    setFormUom('pcs');
    setFormCode(`ITEM-${Date.now().toString().slice(-4)}`);
    setFormBarcode('');
    setFormStock('100');
    setFormImageUrl('');
    setFormIsVeg(true);
    setFormGstApplicable(true);
    setFormGstRate(5);
    setFormHsnSac('');
    setModalOpen(true);
  };

  const handleOpenEditModal = (item: CatalogItem) => {
    setEditingItem(item);
    setFormName(item.name);
    setFormCategory(item.categoryName);
    setFormPrice(String(item.priceMinor / 100));
    setFormUom(item.uom);
    setFormCode(item.code);
    setFormBarcode(item.barcode || '');
    setFormStock(String(item.stockQty ?? 100));
    setFormImageUrl(item.imageUrl || '');
    setFormIsVeg(item.isVeg);
    const hasGst = (item.gstRate ?? 0) > 0 || item.isGstApplicable === true;
    setFormGstApplicable(hasGst);
    setFormGstRate(item.gstRate ?? (hasGst ? 5 : 0));
    setFormHsnSac(item.hsnSac || '');
    setModalOpen(true);
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
    if (adjustment <= 0) return;

    const currentStock = adjustStockItem.stockQty ?? 100;
    const newStock = adjustStockMode === 'add' ? currentStock + adjustment : Math.max(0, currentStock - adjustment);

    const updatedItem: CatalogItem = {
      ...adjustStockItem,
      stockQty: newStock,
    };

    onUpdateItems([
      ...customItems.filter((i) => i.id !== adjustStockItem.id),
      updatedItem,
    ]);

    setAdjustStockModalOpen(false);
    setAdjustStockItem(null);
  };

  const handleSaveItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formPrice) return;

    const price = parseFloat(formPrice) || 0;
    const stock = parseFloat(formStock) || 0;
    if (!Number.isFinite(price) || price < 0 || !Number.isFinite(stock)) return;

    const effectiveGstRate = formGstApplicable ? Number(formGstRate) : 0;

    if (editingItem) {
      const updated: CatalogItem = {
        ...editingItem,
        name: formName.trim(),
        categoryName: formCategory.trim() || 'General',
        categoryId: `cat-${formCategory.toLowerCase()}`,
        priceMinor: Math.round(price * 100),
        uom: formUom,
        isWeighed: isWeight(formUom),
        code: formCode || editingItem.code,
        barcode: formBarcode,
        imageUrl: formImageUrl.trim() || editingItem.imageUrl,
        stockQty: stock,
        isVeg: formIsVeg,
        gstRate: effectiveGstRate,
        isGstApplicable: formGstApplicable,
        hsnSac: formHsnSac.trim() || undefined,
      };
      onUpdateItems([...customItems.filter(item => item.id !== editingItem.id), updated]);
    } else {
      const newItem: CatalogItem = {
        id: `custom-${Date.now()}`,
        businessProfile: profile,
        name: formName.trim(),
        categoryName: formCategory.trim() || 'General',
        categoryId: `cat-${formCategory.toLowerCase()}`,
        priceMinor: Math.round(price * 100),
        uom: formUom,
        isWeighed: isWeight(formUom),
        code: formCode || `ITM-${Date.now().toString().slice(-4)}`,
        barcode: formBarcode,
        imageUrl: formImageUrl.trim() || undefined,
        stockQty: stock,
        isVeg: formIsVeg,
        gstRate: effectiveGstRate,
        isGstApplicable: formGstApplicable,
        hsnSac: formHsnSac.trim() || undefined,
      };
      onUpdateItems([newItem, ...customItems]);
    }

    setModalOpen(false);
  };

  const handleDeleteItem = (id: string) => {
    const item = allItems.find(value => value.id === id);
    if (!item || !window.confirm(`Delete ${item.name} from the catalog?`)) return;
    onUpdateItems([...customItems.filter(value => value.id !== id), { ...item, archived: true }]);
  };

  return (
    <div className="inventory-screen">
      {/* Header & Business Profile Switcher */}
      <div className="inventory-header">
        <div className="inventory-title-group">
          {onBack && (
            <button
              onClick={onBack}
              className="ezo-back-btn mr-2"
              title="Back to Dashboard"
              aria-label="Back to Dashboard"
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
          <div className="profile-selector-wrap">
            <span className="profile-sel-label">Profile:</span>
            <select
              value={profile}
              onChange={(e) => onProfileChange(e.target.value as BusinessProfile)}
              className="profile-dropdown"
            >
              {Object.entries(PROFILES).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </div>

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
                    {profile === 'restaurant' && (
                      <span className={`veg-dot ${item.isVeg ? 'veg' : 'non-veg'}`} />
                    )}
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
                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded ${
                    (item.gstRate ?? 0) > 0 ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' : 'bg-slate-100 text-slate-600'
                  }`}>
                    GST {item.gstRate ?? 0}%
                  </span>
                  {item.hsnSac && <span className="text-[11px] font-mono text-slate-500 bg-slate-50 px-1.5 py-0.5 rounded border">HSN:{item.hsnSac}</span>}
                  {item.barcode && <span className="barcode-badge">{item.barcode}</span>}
                </div>

                <div className="inv-card-footer">
                  <div className="flex items-center gap-2">
                    <span
                      className={`stock-badge ${
                        (item.stockQty ?? 100) <= 0
                          ? 'out'
                          : (item.stockQty ?? 100) < 10
                          ? 'low'
                          : 'ok'
                      }`}
                    >
                      Stock: {item.stockQty ?? 100} {item.uom}
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
                    {profile === 'restaurant' && (
                      <span className={`veg-dot ${item.isVeg ? 'veg' : 'non-veg'}`} />
                    )}
                    <b>{item.name}</b>
                  </div>
                </td>
                <td>
                  <span className="cat-badge">{item.categoryName}</span>
                </td>
                <td>
                  <div className="flex flex-col gap-0.5">
                    <span className="font-bold text-xs text-indigo-700">GST {item.gstRate ?? 0}%</span>
                    {item.hsnSac && <span className="text-[10px] font-mono text-slate-500">HSN: {item.hsnSac}</span>}
                  </div>
                </td>
                <td>
                  <span className="code-badge">{item.code}</span>
                  {item.barcode && <span className="barcode-badge ml-1">{item.barcode}</span>}
                </td>
                <td>{item.uom}</td>
                <td>
                  <b className="price-text">₹{(item.priceMinor / 100).toFixed(2)}</b>
                  <span className="text-xs text-slate-400">/{item.uom}</span>
                </td>
                <td>
                  <div className="flex items-center gap-2">
                    <span
                      className={`stock-badge ${
                        (item.stockQty ?? 100) <= 0
                          ? 'out'
                          : (item.stockQty ?? 100) < 10
                          ? 'low'
                          : 'ok'
                      }`}
                    >
                      {item.stockQty ?? 100} {item.uom}
                    </span>
                    <button
                      onClick={(e) => handleOpenAdjustStock(item, e)}
                      className="px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-300 rounded text-xs font-bold hover:bg-amber-100 flex items-center"
                      title="Adjust Stock"
                    >
                      <ArrowUpDown className="w-3 h-3 mr-0.5" />
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
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteItem(item.id)}
                      className="btn-action-del"
                      title="Delete Item"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ────────────────── 1. Stock Adjustment Modal (+ / -) ────────────────── */}
      {adjustStockModalOpen && adjustStockItem && (
        <div className="table-modal-overlay">
          <form onSubmit={handleSaveStockAdjustment} className="table-modal adjust-stock-modal">
            <div className="modal-header">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center">
                  <ArrowUpDown className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Adjust Stock Quantity</h3>
                  <p className="text-xs text-slate-500">{adjustStockItem.name}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAdjustStockModalOpen(false)}
                className="btn-close-modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="modal-body p-4 flex flex-col gap-3">
              {/* Current Stock Banner */}
              <div className="p-3 bg-slate-100 rounded-lg flex items-center justify-between border border-slate-200">
                <span className="text-xs font-bold text-slate-600">Current In-Stock:</span>
                <span className="text-base font-black text-slate-900 font-mono">
                  {adjustStockItem.stockQty ?? 100} {adjustStockItem.uom}
                </span>
              </div>

              {/* Mode Toggle: Add Stock vs Reduce Stock */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1.5">Adjustment Action</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setAdjustStockMode('add')}
                    className={`py-2.5 px-3 rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 transition-all ${
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
                    className={`py-2.5 px-3 rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 transition-all ${
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

              {/* Adjustment Quantity Input */}
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
                  className="w-full p-2.5 border border-slate-300 rounded-lg text-base font-bold text-slate-900 outline-none focus:border-indigo-600"
                />
              </div>

              {/* Quick Presets */}
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

              {/* Reason for Adjustment */}
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

              {/* Preview Result */}
              {adjustStockQty && (
                <div className="p-3 bg-emerald-50 rounded-lg flex items-center justify-between border border-emerald-200">
                  <span className="text-xs font-bold text-emerald-900">New Resulting Stock:</span>
                  <span className="text-base font-black text-emerald-700 font-mono">
                    {adjustStockMode === 'add'
                      ? (adjustStockItem.stockQty ?? 100) + (parseFloat(adjustStockQty) || 0)
                      : Math.max(0, (adjustStockItem.stockQty ?? 100) - (parseFloat(adjustStockQty) || 0))} {adjustStockItem.uom}
                  </span>
                </div>
              )}

              <div className="modal-actions-bar mt-2">
                <button
                  type="button"
                  onClick={() => setAdjustStockModalOpen(false)}
                  className="btn-cancel"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!adjustStockQty || parseFloat(adjustStockQty) <= 0}
                  className="btn-submit"
                >
                  Update Stock Now
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* ────────────────── 2. Add / Edit Product Modal ────────────────── */}
      {modalOpen && (
        <div className="table-modal-overlay">
          <div className="table-modal inv-modern-modal">
            <div className="modal-header inv-modal-header sticky top-0 bg-white z-10">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
                  <Package className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800">
                    {editingItem ? 'Edit Product Details' : 'Add New Product'}
                  </h3>
                  <p className="text-xs text-slate-500">Catalog Item, GST & Stock Info</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="btn-close-modal"
                aria-label="Close dialog"
              >
                <X className="w-5 h-5 text-slate-400 hover:text-slate-600" />
              </button>
            </div>

            <form onSubmit={handleSaveItem} className="p-4 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="form-group">
                  <label className="text-xs font-bold text-slate-700">Item Name *</label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="e.g. Sona Masoori Rice (1kg)"
                    className="w-full text-sm font-semibold text-slate-800 p-2.5 border border-slate-300 rounded-lg focus:border-indigo-600 outline-none"
                  />
                </div>

                <div className="form-group">
                  <label className="text-xs font-bold text-slate-700">Category Name *</label>
                  <input
                    type="text"
                    required
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    placeholder="e.g. Rice & Staples"
                    className="w-full text-sm font-semibold text-slate-800 p-2.5 border border-slate-300 rounded-lg focus:border-indigo-600 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="form-group">
                  <label className="text-xs font-bold text-slate-700">Price (₹) *</label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    required
                    value={formPrice}
                    onChange={(e) => setFormPrice(e.target.value)}
                    placeholder="0.00"
                    className="w-full text-sm font-bold text-slate-800 p-2.5 border border-slate-300 rounded-lg focus:border-indigo-600 outline-none"
                  />
                </div>

                <div className="form-group">
                  <label className="text-xs font-bold text-slate-700">Unit (UOM) *</label>
                  <select
                    value={formUom}
                    onChange={(e) => setFormUom(e.target.value as Uom)}
                    className="w-full text-sm font-semibold text-slate-800 p-2.5 border border-slate-300 rounded-lg bg-white focus:border-indigo-600 outline-none"
                  >
                    {UNITS.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="text-xs font-bold text-slate-700">Initial Stock</label>
                  <input
                    type="number"
                    value={formStock}
                    onChange={(e) => setFormStock(e.target.value)}
                    placeholder="100"
                    className="w-full text-sm font-bold text-slate-800 p-2.5 border border-slate-300 rounded-lg focus:border-indigo-600 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="form-group">
                  <label className="text-xs font-bold text-slate-700">Item Code</label>
                  <input
                    type="text"
                    value={formCode}
                    onChange={(e) => setFormCode(e.target.value)}
                    placeholder="e.g. 1086"
                    className="w-full text-sm font-semibold text-slate-800 p-2.5 border border-slate-300 rounded-lg focus:border-indigo-600 outline-none"
                  />
                </div>

                <div className="form-group">
                  <label className="text-xs font-bold text-slate-700">Barcode / EAN</label>
                  <input
                    type="text"
                    value={formBarcode}
                    onChange={(e) => setFormBarcode(e.target.value)}
                    placeholder="Scan or enter barcode"
                    className="w-full text-sm font-semibold text-slate-800 p-2.5 border border-slate-300 rounded-lg focus:border-indigo-600 outline-none"
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="text-xs font-bold text-slate-700">Product Image URL (Optional)</label>
                <input
                  type="url"
                  value={formImageUrl}
                  onChange={(e) => setFormImageUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full text-sm font-semibold text-slate-800 p-2.5 border border-slate-300 rounded-lg focus:border-indigo-600 outline-none"
                />
              </div>

              <div className="modal-actions-bar pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm"
                >
                  {editingItem ? 'Save Changes' : 'Create Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

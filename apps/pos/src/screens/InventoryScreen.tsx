import { mergeCatalog } from '../lib/catalog';
import { useBackHandler } from '../lib/navigation';
import React, { useState, useEffect } from 'react';
import {
  Package,
  Search,
  Plus,
  Edit2,
  Trash2,
  AlertTriangle,
  Barcode,
  Layers,
  CheckCircle2,
  X,
  ChefHat,
  ArrowLeft,
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

  useBackHandler(modalOpen, () => setModalOpen(false));

  // Form states
  const [formName, setFormName] = useState('');
  const [formCategory, setFormCategory] = useState('');
  const [formPrice, setFormPrice] = useState('');
  const [formUom, setFormUom] = useState<Uom>('pcs');
  const [formCode, setFormCode] = useState('');
  const [formBarcode, setFormBarcode] = useState('');
  const [formStock, setFormStock] = useState('100');
  const [formIsVeg, setFormIsVeg] = useState(true);
  const [formGstApplicable, setFormGstApplicable] = useState(true);
  const [formGstRate, setFormGstRate] = useState<number>(5);
  const [formHsnSac, setFormHsnSac] = useState('');

  // Combine presets with user custom items
  const preset = presetCatalog(profile);
  const allItems = mergeCatalog<CatalogItem>(preset.items, customItems, profile);
  useEffect(() => { setSelectedCategory('all'); setSearchQuery(''); }, [profile]);

  const categories = [
    { id: 'all', name: t.billing.categoryAll },
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
    setFormIsVeg(item.isVeg);
    const hasGst = (item.gstRate ?? 0) > 0 || item.isGstApplicable === true;
    setFormGstApplicable(hasGst);
    setFormGstRate(item.gstRate ?? (hasGst ? 5 : 0));
    setFormHsnSac(item.hsnSac || '');
    setModalOpen(true);
  };

  const handleSaveItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formPrice) return;

    const price = parseFloat(formPrice) || 0;
    const stock = parseFloat(formStock) || 0;
    if (!Number.isFinite(price) || price < 0 || !Number.isFinite(stock)) return;

    const effectiveGstRate = formGstApplicable ? Number(formGstRate) : 0;

    if (editingItem) {
      const updated = [editingItem].map((item) => {
        if (item.id === editingItem.id) {
          return {
            ...item,
            name: formName.trim(),
            categoryName: formCategory.trim() || 'General',
            categoryId: `cat-${formCategory.toLowerCase()}`,
            priceMinor: Math.round(price * 100),
            uom: formUom,
            isWeighed: isWeight(formUom),
            code: formCode || item.code,
            barcode: formBarcode,
            stockQty: stock,
            isVeg: formIsVeg,
            gstRate: effectiveGstRate,
            isGstApplicable: formGstApplicable,
            hsnSac: formHsnSac.trim() || undefined,
          };
        }
        return item;
      });
      onUpdateItems([...customItems.filter(item => item.id !== editingItem.id), ...updated]);
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
              <ArrowLeft className="w-6 h-6 text-white stroke-[2.5]" /><span>Back</span></button>
          )}
          <Package className="w-6 h-6 text-emerald-400" />
          <div>
            <h2>{t.tabs.inventory}</h2>
            <p className="inventory-sub">
              {allItems.length} catalog items
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
              <p>No inventory items match search</p>
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
              <th>{t.billing.stock}</th>
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

      {/* Add / Edit Modal */}
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

            <form onSubmit={handleSaveItem} className="modal-body inv-modal-body overflow-y-auto max-h-[75vh]">
              {/* Item Name */}
              <div className="form-group">
                <label className="text-xs font-bold text-slate-700">Product / Item Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Sona Masoori Rice, Milk, Biscuit"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="inv-modal-input font-medium"
                  autoFocus
                />
              </div>

              {/* Category with Quick Suggestion Chips */}
              <div className="form-group">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700">Category *</label>
                  <span className="text-[11px] text-slate-400">Quick Select:</span>
                </div>
                <input
                  type="text"
                  required
                  placeholder="e.g. Grocery, Dairy, Snacks"
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value)}
                  className="inv-modal-input"
                />
                <div className="flex gap-1.5 overflow-x-auto pt-1 scrollbar-none">
                  {['General', 'Grocery', 'Dairy', 'Snacks', 'Beverages', 'Flour & Atta', 'Spices & Masala', 'Personal & Home Care'].map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setFormCategory(cat)}
                      className={`px-2 py-0.5 rounded text-[11px] font-semibold border transition-colors whitespace-nowrap ${
                        formCategory.toLowerCase() === cat.toLowerCase()
                          ? 'bg-indigo-50 border-indigo-300 text-indigo-700'
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* Price & Stock Row */}
              <div className="grid grid-cols-2 gap-3">
                <div className="form-group">
                  <label className="text-xs font-bold text-slate-700">Price (₹) *</label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-sm font-bold text-slate-400">₹</span>
                    <input
                      type="number"
                      step="0.01"
                      required
                      placeholder="0.00"
                      value={formPrice}
                      onChange={(e) => setFormPrice(e.target.value)}
                      className="inv-modal-input pl-7 font-bold text-indigo-700 font-mono"
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="text-xs font-bold text-slate-700">Stock Quantity</label>
                  <input
                    type="number"
                    value={formStock}
                    onChange={(e) => setFormStock(e.target.value)}
                    className="inv-modal-input font-bold text-slate-800"
                  />
                </div>
              </div>

              {/* GST Configuration (GST Applicable, Slab Rates, HSN Code) */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <span>GST Tax Configuration</span>
                  </label>
                  <div className="flex items-center gap-1 bg-white p-0.5 rounded-lg border border-slate-200">
                    <button
                      type="button"
                      onClick={() => {
                        setFormGstApplicable(true);
                        if (formGstRate === 0) setFormGstRate(5);
                      }}
                      className={`px-2.5 py-1 rounded text-xs font-bold transition-colors ${
                        formGstApplicable ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600'
                      }`}
                    >
                      Taxable
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setFormGstApplicable(false);
                        setFormGstRate(0);
                      }}
                      className={`px-2.5 py-1 rounded text-xs font-bold transition-colors ${
                        !formGstApplicable ? 'bg-slate-700 text-white shadow-xs' : 'text-slate-600'
                      }`}
                    >
                      Exempt (0%)
                    </button>
                  </div>
                </div>

                {formGstApplicable && (
                  <>
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-[11px] font-bold text-slate-600">Select GST Slab Rate (%):</span>
                        <span className="text-[11px] font-bold text-indigo-600">Active: {formGstRate}% GST</span>
                      </div>
                      <div className="grid grid-cols-5 gap-1.5">
                        {[0, 5, 12, 18, 28].map((rate) => (
                          <button
                            key={rate}
                            type="button"
                            onClick={() => setFormGstRate(rate)}
                            className={`py-1.5 rounded-lg text-xs font-black border transition-all ${
                              formGstRate === rate
                                ? 'bg-indigo-600 border-indigo-700 text-white shadow-xs scale-[1.02]'
                                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                            }`}
                          >
                            {rate}%
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="pt-1">
                      <label className="text-[11px] font-bold text-slate-600 block mb-1">
                        HSN / SAC Code (Optional for GST Invoice)
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. 1006 (Rice), 0401 (Milk), 1905 (Bakery), 9963 (Food)"
                        value={formHsnSac}
                        onChange={(e) => setFormHsnSac(e.target.value)}
                        className="inv-modal-input bg-white text-xs font-mono"
                      />
                    </div>
                  </>
                )}
              </div>

              {/* Unit of Measure (UOM) Touch Pills */}
              <div className="form-group">
                <label className="text-xs font-bold text-slate-700">Unit of Measure (UOM) *</label>
                <div className="grid grid-cols-6 gap-1.5 pt-0.5">
                  {(['pcs', 'kg', 'gm', 'ltr', 'ml', 'box'] as Uom[]).map((u) => {
                    const isSelected = formUom === u;
                    return (
                      <button
                        key={u}
                        type="button"
                        onClick={() => setFormUom(u)}
                        className={`py-1.5 rounded-lg text-xs font-bold text-center border uppercase transition-all ${
                          isSelected
                            ? 'bg-indigo-600 border-indigo-700 text-white shadow-xs'
                            : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        {u}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Short Code & Barcode */}
              <div className="grid grid-cols-2 gap-3">
                <div className="form-group">
                  <label className="text-xs font-bold text-slate-700">Short Code</label>
                  <input
                    type="text"
                    placeholder="e.g. ITEM-1234"
                    value={formCode}
                    onChange={(e) => setFormCode(e.target.value)}
                    className="inv-modal-input text-xs font-mono"
                  />
                </div>
                <div className="form-group">
                  <label className="text-xs font-bold text-slate-700">Barcode (EAN/UPC)</label>
                  <input
                    type="text"
                    placeholder="Barcode..."
                    value={formBarcode}
                    onChange={(e) => setFormBarcode(e.target.value)}
                    className="inv-modal-input text-xs font-mono"
                  />
                </div>
              </div>

              {profile === 'restaurant' && (
                <div className="form-group pt-1">
                  <label className="checkbox-label flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formIsVeg}
                      onChange={(e) => setFormIsVeg(e.target.checked)}
                      className="w-4 h-4 text-emerald-600 rounded border-slate-300"
                    />
                    <span className="text-xs font-semibold text-slate-700">Vegetarian Item</span>
                  </label>
                </div>
              )}

              <div className="modal-actions-bar pt-2 sticky bottom-0 bg-white pb-1">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="btn-cancel px-4 py-2 text-xs font-bold"
                >
                  {t.common.cancel}
                </button>
                <button
                  type="submit"
                  className="btn-submit px-5 py-2 text-xs font-bold shadow-sm flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{editingItem ? 'Save Changes' : 'Save Product'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

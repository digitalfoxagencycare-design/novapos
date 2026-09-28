import React, { useState, useRef } from 'react';
import {
  X,
  Plus,
  Trash2,
  Sparkles,
  Camera,
  ArrowRight,
  ChevronDown,
  Check,
  AlertCircle,
  Layers,
} from 'lucide-react';
import type { CatalogItem, ItemPortion, ItemExtra, RawMaterialRequirement } from '../screens/InventoryScreen';
import { getCuratedPhotoForItem, POPULAR_FOOD_SUGGESTIONS } from '../lib/itemPhotos';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSave: (item: Partial<CatalogItem>) => void;
  editingItem?: CatalogItem | null;
  menus: string[];
  categories: string[];
  onOpenRawMaterials?: () => void;
}

export const AddEditMenuItemModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onSave,
  editingItem,
  menus,
  categories,
  onOpenRawMaterials,
}) => {
  const [selectedMenu, setSelectedMenu] = useState<string>(
    editingItem?.menuName || (menus[0] || 'Main Menu')
  );
  const [selectedCategory, setSelectedCategory] = useState<string>(
    editingItem?.categoryName || (categories[0] || 'Starter Demo')
  );
  const [itemName, setItemName] = useState(editingItem?.name || '');
  const [photoUrl, setPhotoUrl] = useState(editingItem?.imageUrl || '');
  const [price, setPrice] = useState(
    editingItem?.priceMinor ? String(editingItem.priceMinor / 100) : ''
  );

  // Portion-wise extras switch
  const [portionWiseExtras, setPortionWiseExtras] = useState(
    editingItem?.portionWiseExtras || false
  );

  // Portions
  const [portions, setPortions] = useState<ItemPortion[]>(
    editingItem?.portions || []
  );

  // Extras
  const [extras, setExtras] = useState<ItemExtra[]>(
    editingItem?.extras || []
  );
  const [singleChoiceExtras, setSingleChoiceExtras] = useState(
    editingItem?.singleChoiceExtras || false
  );

  // Stock Settings
  const [trackQuantity, setTrackQuantity] = useState(
    editingItem?.trackQuantity || false
  );
  const [stockQty, setStockQty] = useState(
    editingItem?.stockQty !== undefined ? String(editingItem.stockQty) : '100'
  );
  const [inStock, setInStock] = useState(
    editingItem?.inStock !== undefined ? editingItem.inStock : true
  );

  // Raw Materials
  const [rawMaterials, setRawMaterials] = useState<RawMaterialRequirement[]>(
    editingItem?.rawMaterials || []
  );

  // Advanced collapsible (GST, Barcode) to preserve compatibility
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [gstRate, setGstRate] = useState<number>(editingItem?.gstRate ?? 5);
  const [barcode, setBarcode] = useState(editingItem?.barcode || '');

  const [formError, setFormError] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // Add a new portion
  const handleAddPortion = () => {
    const isFirst = portions.length === 0;
    const defaultName = isFirst ? 'Half plate' : portions.length === 1 ? 'Full plate' : `Portion ${portions.length + 1}`;
    const defaultPrice = isFirst && price ? Number(price) : portions.length > 0 ? (portions[portions.length - 1].price * 1.5) : 100;
    const newPortion: ItemPortion = {
      id: `p-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      name: defaultName,
      price: Math.round(defaultPrice),
    };
    const updated = [...portions, newPortion];
    setPortions(updated);
    if (isFirst && (!price || Number(price) <= 0)) {
      setPrice(String(newPortion.price));
    }
  };

  const handleUpdatePortion = (id: string, field: 'name' | 'price', value: string) => {
    setPortions((prev) =>
      prev.map((p, idx) => {
        if (p.id !== id) return p;
        if (field === 'name') return { ...p, name: value };
        const num = value === '' ? 0 : isNaN(Number(value)) ? p.price : Number(value);
        // If first portion's price changes, update base price as well
        if (idx === 0) setPrice(value === '' ? '' : String(num));
        return { ...p, price: num };
      })
    );
  };

  const handleRemovePortion = (id: string) => {
    setPortions((prev) => prev.filter((p) => p.id !== id));
  };

  // Add a new extra
  const handleAddExtra = () => {
    const newExtra: ItemExtra = {
      id: `e-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      name: extras.length === 0 ? 'Extra gravy' : extras.length === 1 ? 'Salad' : `Add-on ${extras.length + 1}`,
      price: 30,
    };
    setExtras([...extras, newExtra]);
  };

  const handleUpdateExtra = (id: string, field: 'name' | 'price', value: string) => {
    setExtras((prev) =>
      prev.map((e) => {
        if (e.id !== id) return e;
        if (field === 'name') return { ...e, name: value };
        const num = value === '' ? 0 : isNaN(Number(value)) ? e.price : Number(value);
        return { ...e, price: num };
      })
    );
  };

  const handleRemoveExtra = (id: string) => {
    setExtras((prev) => prev.filter((e) => e.id !== id));
  };

  // Photo handling
  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setPhotoUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  // AI Photo Generation simulation using curated HD library
  const handleGeneratePhoto = () => {
    if (!itemName.trim()) {
      setFormError('Please enter an item name first to generate a matching photo.');
      return;
    }
    setFormError('');
    setIsGenerating(true);
    setTimeout(() => {
      const generated = getCuratedPhotoForItem(itemName);
      setPhotoUrl(generated);
      setIsGenerating(false);
    }, 600);
  };

  // Submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemName.trim()) {
      setFormError('Item name is required.');
      return;
    }

    const priceNum = portions.length > 0 ? portions[0].price : parseFloat(price);
    if (isNaN(priceNum) || priceNum < 0) {
      setFormError('Please enter a valid price.');
      return;
    }

    const payload: Partial<CatalogItem> = {
      name: itemName.trim(),
      menuName: selectedMenu,
      categoryName: selectedCategory,
      categoryId: `cat-${selectedCategory.toLowerCase().replace(/\s+/g, '-')}`,
      priceMinor: Math.round(priceNum * 100),
      imageUrl: photoUrl.trim() || undefined,
      portions: portions.length > 0 ? portions : undefined,
      portionWiseExtras,
      extras: extras.length > 0 ? extras : undefined,
      singleChoiceExtras,
      trackQuantity,
      stockQty: trackQuantity ? parseFloat(stockQty) || 0 : undefined,
      inStock,
      rawMaterials: rawMaterials.length > 0 ? rawMaterials : undefined,
      gstRate: showAdvanced ? gstRate : (editingItem?.gstRate ?? 5),
      barcode: showAdvanced ? (barcode.trim() || undefined) : editingItem?.barcode,
    };

    onSave(payload);
    onClose();
  };

  return (
    <div className="menu-modal-overlay">
      <div className="menu-modal-sheet max-w-lg w-full bg-[#F8FAFC] rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden border border-slate-200 animate-slide-up">
        {/* Header matching Screenshot 1 & 4 */}
        <div className="px-5 py-4 bg-white border-b border-slate-100 flex items-center justify-between sticky top-0 z-10">
          <h2 className="text-xl font-black text-slate-900 tracking-tight">
            {editingItem ? 'Edit Menu Item' : 'Add Menu Item'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-slate-100 text-slate-600 transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5 stroke-[2.5]" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4 flex-1">
          {formError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-rose-700 text-xs font-semibold">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          {/* 1. Menu * */}
          <div>
            <label className="text-xs font-bold text-slate-800 block mb-1.5">
              Menu <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <select
                value={selectedMenu}
                onChange={(e) => setSelectedMenu(e.target.value)}
                className="w-full text-sm font-bold text-slate-800 p-3.5 bg-white border border-slate-200 rounded-xl appearance-none outline-none focus:border-orange-500 shadow-sm pr-10"
              >
                {menus.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-slate-500 absolute right-3.5 top-4 pointer-events-none" />
            </div>
          </div>

          {/* 2. Category * */}
          <div>
            <label className="text-xs font-bold text-slate-800 block mb-1.5">
              Category <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full text-sm font-bold text-slate-800 p-3.5 bg-white border border-slate-200 rounded-xl appearance-none outline-none focus:border-orange-500 shadow-sm pr-10"
              >
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-slate-500 absolute right-3.5 top-4 pointer-events-none" />
            </div>
          </div>

          {/* 3. Item Name * */}
          <div>
            <input
              type="text"
              required
              placeholder="Item Name *"
              value={itemName}
              onChange={(e) => setItemName(e.target.value)}
              className="w-full text-sm font-semibold text-slate-800 p-3.5 bg-white border border-slate-200 rounded-xl outline-none focus:border-orange-500 shadow-sm placeholder:text-slate-400"
            />
          </div>

          {/* 4. Item Photo Box + Generate Photo */}
          <div>
            <label className="text-xs font-bold text-slate-800 block mb-1.5">
              Item Photo
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handlePhotoSelect}
            />

            <div
              onClick={() => fileInputRef.current?.click()}
              className="w-full h-44 rounded-2xl border-2 border-dashed border-slate-300 hover:border-orange-400 bg-white flex flex-col items-center justify-center cursor-pointer overflow-hidden transition-all shadow-sm relative group"
            >
              {photoUrl ? (
                <>
                  <img
                    src={photoUrl}
                    alt={itemName || 'Item preview'}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                    <span className="px-3 py-1.5 bg-white text-slate-900 rounded-lg text-xs font-bold shadow">
                      Change Photo
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setPhotoUrl('');
                      }}
                      className="p-1.5 bg-rose-600 text-white rounded-lg hover:bg-rose-700 shadow"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center text-slate-400 group-hover:text-orange-500 transition-colors">
                  <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center mb-1.5 group-hover:bg-orange-50">
                    <Plus className="w-5 h-5 text-slate-500 group-hover:text-orange-600" />
                  </div>
                  <span className="text-xs font-bold text-slate-600">Add Photo</span>
                </div>
              )}
            </div>

            {/* Photo Action Row & Quick Suggestions */}
            <div className="mt-2 space-y-2">
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={handleGeneratePhoto}
                  disabled={isGenerating}
                  className="text-xs font-bold text-orange-600 hover:text-orange-700 flex items-center gap-1.5 py-1.5 px-3 rounded-lg bg-orange-50 hover:bg-orange-100 transition-colors"
                >
                  <Sparkles className="w-3.5 h-3.5 text-orange-500 animate-pulse" />
                  <span>{isGenerating ? 'Matching dish photo...' : '✨ Match Dish Photo'}</span>
                </button>
                {photoUrl && (
                  <button
                    type="button"
                    onClick={() => setPhotoUrl('')}
                    className="text-[11px] font-bold text-rose-500 hover:text-rose-700"
                  >
                    Remove Photo
                  </button>
                )}
              </div>

              {/* Quick dish photo suggestions */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex-shrink-0">
                  Quick:
                </span>
                {POPULAR_FOOD_SUGGESTIONS.slice(0, 6).map((sug) => (
                  <button
                    key={sug.name}
                    type="button"
                    onClick={() => {
                      setPhotoUrl(sug.url);
                      if (!itemName) setItemName(sug.name.split('/')[0].trim());
                    }}
                    className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-slate-100 hover:bg-orange-100 text-slate-700 hover:text-orange-700 flex-shrink-0 border border-slate-200 transition-colors"
                  >
                    {sug.name}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 5. Price (₹) * */}
          <div>
            <div className="relative">
              <input
                type="number"
                step="any"
                min="0"
                required
                placeholder="Price (₹) *"
                value={price}
                onChange={(e) => {
                  setPrice(e.target.value);
                  // Update first portion price if portions exist
                  if (portions.length > 0) {
                    setPortions((prev) =>
                      prev.map((p, idx) => (idx === 0 ? { ...p, price: parseFloat(e.target.value) || 0 } : p))
                    );
                  }
                }}
                className="w-full text-sm font-bold text-slate-800 p-3.5 bg-white border border-slate-200 rounded-xl outline-none focus:border-orange-500 shadow-sm placeholder:text-slate-400"
              />
            </div>
          </div>

          {/* 6. Portion-wise Extras Toggle */}
          <div className="p-3.5 bg-white rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between gap-3">
            <div>
              <b className="text-xs font-bold text-slate-900 block leading-tight">
                Portion-wise Extras
              </b>
              <p className="text-[11px] text-slate-500 leading-snug mt-0.5">
                Each portion gets its own add-ons with their own prices (e.g. Extra Cheese: R +₹30, M +₹50).
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
              <input
                type="checkbox"
                checked={portionWiseExtras}
                onChange={(e) => setPortionWiseExtras(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-600"></div>
            </label>
          </div>

          {/* 7. Portions (optional) */}
          <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm space-y-3">
            <div>
              <b className="text-xs font-bold text-slate-900 block">
                Portions (optional)
              </b>
              <p className="text-[11px] text-slate-500 leading-snug mt-0.5">
                e.g. Half plate ₹100 / Full plate ₹200. Customers must pick one. The first portion&apos;s price becomes the item&apos;s base price.
              </p>
            </div>

            {/* List of Portions */}
            {portions.length > 0 && (
              <div className="space-y-2.5 pt-1">
                {portions.map((portion, idx) => (
                  <div
                    key={portion.id}
                    className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 flex items-center gap-2.5 shadow-2xs"
                  >
                    <span className="text-xs font-black text-slate-400 w-5 flex-shrink-0">
                      #{idx + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <input
                        type="text"
                        placeholder="e.g. Half plate"
                        value={portion.name}
                        onChange={(e) => handleUpdatePortion(portion.id, 'name', e.target.value)}
                        className="w-full text-xs font-bold text-slate-800 px-3 py-2 bg-white border border-slate-200 rounded-lg outline-none focus:border-orange-500 min-w-0"
                      />
                    </div>
                    <div className="w-28 flex-shrink-0 flex items-center bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 focus-within:border-orange-500 focus-within:ring-1 focus-within:ring-orange-500">
                      <span className="text-xs font-extrabold text-slate-500 mr-1 flex-shrink-0">₹</span>
                      <input
                        type="number"
                        inputMode="decimal"
                        step="any"
                        placeholder="Price"
                        value={portion.price === 0 ? '' : portion.price}
                        onChange={(e) => handleUpdatePortion(portion.id, 'price', e.target.value)}
                        className="w-full text-xs font-black text-slate-900 outline-none min-w-0 bg-transparent"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemovePortion(portion.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg flex-shrink-0 transition-colors"
                      title="Remove Portion"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <button
              type="button"
              onClick={handleAddPortion}
              className="w-full py-2.5 px-4 rounded-xl border-2 border-slate-300 hover:border-orange-500 text-slate-700 hover:text-orange-600 font-bold text-xs flex items-center justify-center gap-1.5 transition-all bg-slate-50 hover:bg-orange-50"
            >
              <Plus className="w-4 h-4" />
              <span>Add Portion</span>
            </button>
          </div>

          {/* 8. Extras (optional) */}
          <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm space-y-3">
            <div>
              <b className="text-xs font-bold text-slate-900 block">
                Extras (optional)
              </b>
              <p className="text-[11px] text-slate-500 leading-snug mt-0.5">
                Priced add-ons customers can pick, e.g. Extra gravy +₹30, Salad +₹20.
              </p>
            </div>

            {/* Single-choice Extras Toggle */}
            <div className="flex items-center justify-between py-1 border-t border-slate-100">
              <span className="text-xs font-bold text-slate-700">
                Single-choice Extras
              </span>
              <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                <input
                  type="checkbox"
                  checked={singleChoiceExtras}
                  onChange={(e) => setSingleChoiceExtras(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-orange-600"></div>
              </label>
            </div>

            {/* List of Extras */}
            {extras.length > 0 && (
              <div className="space-y-2.5">
                {extras.map((extra, idx) => (
                  <div
                    key={extra.id}
                    className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 flex items-center gap-2.5 shadow-2xs"
                  >
                    <span className="text-xs font-black text-slate-400 w-5 flex-shrink-0">
                      #{idx + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <input
                        type="text"
                        placeholder="e.g. Extra Gravy"
                        value={extra.name}
                        onChange={(e) => handleUpdateExtra(extra.id, 'name', e.target.value)}
                        className="w-full text-xs font-bold text-slate-800 px-3 py-2 bg-white border border-slate-200 rounded-lg outline-none focus:border-orange-500 min-w-0"
                      />
                    </div>
                    <div className="w-28 flex-shrink-0 flex items-center bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 focus-within:border-orange-500 focus-within:ring-1 focus-within:ring-orange-500">
                      <span className="text-xs font-extrabold text-slate-500 mr-1 flex-shrink-0">₹</span>
                      <input
                        type="number"
                        inputMode="decimal"
                        step="any"
                        placeholder="Price"
                        value={extra.price === 0 ? '' : extra.price}
                        onChange={(e) => handleUpdateExtra(extra.id, 'price', e.target.value)}
                        className="w-full text-xs font-black text-slate-900 outline-none min-w-0 bg-transparent"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveExtra(extra.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg flex-shrink-0 transition-colors"
                      title="Remove Extra"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <button
              type="button"
              onClick={handleAddExtra}
              className="w-full py-2.5 px-4 rounded-xl border-2 border-slate-300 hover:border-orange-500 text-slate-700 hover:text-orange-600 font-bold text-xs flex items-center justify-center gap-1.5 transition-all bg-slate-50 hover:bg-orange-50"
            >
              <Plus className="w-4 h-4" />
              <span>Add Extra</span>
            </button>
          </div>

          {/* 9. Stock Settings */}
          <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm space-y-3">
            <b className="text-xs font-bold text-slate-900 block">Stock Settings</b>

            {/* Track Quantity */}
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-800 block">Track Quantity</span>
                <span className="text-[11px] text-slate-500">
                  {trackQuantity ? 'Track Qty on' : 'Track Qty off'}
                </span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                <input
                  type="checkbox"
                  checked={trackQuantity}
                  onChange={(e) => setTrackQuantity(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-600"></div>
              </label>
            </div>

            {/* Stock Count Input if tracked */}
            {trackQuantity && (
              <div className="pt-2 border-t border-slate-100">
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Current Available Stock Units
                </label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={stockQty}
                  onChange={(e) => setStockQty(e.target.value)}
                  className="w-full text-xs font-bold text-slate-800 p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-orange-500"
                />
              </div>
            )}

            {/* In Stock Checkbox */}
            <div className="pt-2 border-t border-slate-100 flex items-center gap-2.5">
              <input
                type="checkbox"
                id="modalInStockCheck"
                checked={inStock}
                onChange={(e) => setInStock(e.target.checked)}
                className="w-4 h-4 text-orange-600 border-slate-300 rounded focus:ring-orange-500 cursor-pointer"
              />
              <label
                htmlFor="modalInStockCheck"
                className="text-xs font-bold text-slate-800 cursor-pointer flex items-center gap-1.5"
              >
                In Stock
              </label>
            </div>
          </div>

          {/* 10. Raw Materials (Recipe/Ingredients) */}
          <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm space-y-2">
            <div>
              <b className="text-xs font-bold text-slate-900 block">Raw Materials</b>
              <span className="text-[11px] text-slate-400 block font-medium">
                (Recipe/Ingredients)
              </span>
              <p className="text-[11px] text-slate-500 leading-snug mt-0.5">
                Define raw materials needed to prepare this dish
              </p>
            </div>

            {rawMaterials.length === 0 ? (
              <p className="text-[11px] text-rose-600 font-semibold pt-1">
                No raw materials found. Add materials in Raw Materials screen first.
              </p>
            ) : (
              <div className="space-y-1.5 pt-1">
                {rawMaterials.map((rm) => (
                  <div
                    key={rm.id}
                    className="p-2 bg-slate-50 border rounded-lg flex items-center justify-between text-xs"
                  >
                    <span className="font-semibold text-slate-800">{rm.materialName}</span>
                    <span className="font-bold text-slate-600">
                      {rm.qty} {rm.unit}
                    </span>
                  </div>
                ))}
              </div>
            )}

            <button
              type="button"
              onClick={() => {
                if (onOpenRawMaterials) onOpenRawMaterials();
              }}
              className="w-full py-2.5 px-4 rounded-xl border border-slate-300 hover:border-orange-500 text-slate-700 hover:text-orange-600 font-bold text-xs flex items-center justify-center gap-1.5 transition-all bg-white hover:bg-orange-50"
            >
              <ArrowRight className="w-3.5 h-3.5" />
              <span>Go to Raw Materials</span>
            </button>
          </div>

          {/* Optional Collapsible: Retail/GST/Barcode Details */}
          <div className="p-3 bg-white rounded-2xl border border-slate-200">
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="w-full flex items-center justify-between text-xs font-bold text-slate-600 hover:text-slate-900"
            >
              <span>Tax & Barcode Details (Optional)</span>
              <ChevronDown
                className={`w-4 h-4 transition-transform ${showAdvanced ? 'rotate-180' : ''}`}
              />
            </button>

            {showAdvanced && (
              <div className="pt-3 mt-2 border-t border-slate-100 space-y-3">
                <div>
                  <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                    GST Rate (%)
                  </label>
                  <div className="grid grid-cols-5 gap-1">
                    {[0, 5, 12, 18, 28].map((rate) => (
                      <button
                        key={rate}
                        type="button"
                        onClick={() => setGstRate(rate)}
                        className={`py-1 text-xs font-bold rounded-lg border ${
                          gstRate === rate
                            ? 'bg-orange-600 text-white border-orange-600'
                            : 'bg-slate-50 text-slate-700 border-slate-200'
                        }`}
                      >
                        {rate}%
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                    Barcode / SKU
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 890103000101"
                    value={barcode}
                    onChange={(e) => setBarcode(e.target.value)}
                    className="w-full text-xs font-mono p-2 border border-slate-200 rounded-lg outline-none"
                  />
                </div>
              </div>
            )}
          </div>
        </form>

        {/* Bottom Actions Bar matching Screenshot 1 & 4 */}
        <div className="p-4 bg-white border-t border-slate-100 flex items-center justify-between gap-4 sticky bottom-0 z-10">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-3 text-sm font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-full transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className="flex-1 py-3 px-8 bg-orange-600 hover:bg-orange-700 text-white font-bold text-sm rounded-full shadow-lg hover:shadow-orange-500/25 transition-all text-center"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
};

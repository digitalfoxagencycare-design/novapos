import React, { useState, useEffect, useRef } from 'react';
import {
  Menu as MenuIcon,
  Search,
  Plus,
  Share2,
  Trash2,
  Upload,
  FolderPlus,
  ChevronDown,
  CheckCircle2,
  XCircle,
  ArrowUpDown,
  Edit2,
  TrendingUp,
  TrendingDown,
  X,
  Layers,
} from 'lucide-react';
import { mergeCatalog, barcodeConflict, itemBarcodes } from '../lib/catalog';
import { useBackHandler } from '../lib/navigation';
import {
  UNITS,
  presetCatalog,
  type BusinessProfile,
  type Uom,
  isWeight,
} from '../lib/business';
import { TRANSLATIONS, type SupportedLanguage } from '../lib/translations';
import { CameraBarcodeScanner } from '../components/CameraBarcodeScanner';
import { AddEditMenuItemModal } from '../components/AddEditMenuItemModal';
import { ManageCategoriesModal } from '../components/ManageCategoriesModal';
import { BulkUploadModal } from '../components/BulkUploadModal';
import { ShareMenuModal } from '../components/ShareMenuModal';
import { RawMaterialsModal } from '../components/RawMaterialsModal';
import { getCuratedPhotoForItem } from '../lib/itemPhotos';

export interface ItemPortion {
  id: string;
  name: string;
  price: number;
}

export interface ItemExtra {
  id: string;
  name: string;
  price: number;
}

export interface RawMaterialRequirement {
  id: string;
  materialName: string;
  qty: number;
  unit: string;
}

export interface RawMaterial {
  id: string;
  name: string;
  stockQty: number;
  unit: string;
  costMinor?: number;
}

export interface CatalogItem {
  id: string;
  name: string;
  categoryId: string;
  categoryName: string;
  menuName?: string;
  priceMinor: number;
  mrpMinor?: number;
  purchasePriceMinor?: number;
  uom: Uom;
  isWeighed: boolean;
  isVeg: boolean;
  code: string;
  stockQty?: number;
  inStock?: boolean;
  trackQuantity?: boolean;
  portions?: ItemPortion[];
  portionWiseExtras?: boolean;
  extras?: ItemExtra[];
  singleChoiceExtras?: boolean;
  rawMaterials?: RawMaterialRequirement[];
  barcode?: string;
  barcode2?: string;
  barcode3?: string;
  barcode4?: string;
  barcode5?: string;
  imageUrl?: string;
  gstRate?: number;
  hsnSac?: string;
  isGstApplicable?: boolean;
  archived?: boolean;
  businessProfile?: BusinessProfile;
  displayOrder?: number;
}

interface Props {
  language: SupportedLanguage;
  profile: BusinessProfile;
  onProfileChange?: (p: BusinessProfile) => void;
  customItems: CatalogItem[];
  onUpdateItems: (items: CatalogItem[]) => void;
  onBack?: () => void;
  onOpenMenu?: () => void;
  phone?: string;
  profileName?: string;
}

// Built-in starter dishes matching Screenshots 1-5 exactly
const DEFAULT_MENU_PRESETS: CatalogItem[] = [
  {
    id: 'demo-starter-soup',
    name: 'Soup',
    categoryName: 'Starter Demo',
    categoryId: 'cat-starter-demo',
    menuName: 'Main Menu',
    priceMinor: 8000,
    uom: 'pcs',
    isWeighed: false,
    isVeg: true,
    code: 'DEMO-101',
    stockQty: 50,
    inStock: true,
    imageUrl: 'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=400&auto=format&fit=crop&q=80',
  },
  {
    id: 'demo-starter-fishfry',
    name: 'Fish Fry',
    categoryName: 'Starter Demo',
    categoryId: 'cat-starter-demo',
    menuName: 'Main Menu',
    priceMinor: 25000,
    uom: 'pcs',
    isWeighed: false,
    isVeg: false,
    code: 'DEMO-102',
    stockQty: 30,
    inStock: true,
    imageUrl: 'https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?w=400&auto=format&fit=crop&q=80',
  },
  {
    id: 'demo-starter-kabab',
    name: 'Chicken Kabab',
    categoryName: 'Starter Demo',
    categoryId: 'cat-starter-demo',
    menuName: 'Main Menu',
    priceMinor: 10000,
    uom: 'pcs',
    isWeighed: false,
    isVeg: false,
    code: 'DEMO-103',
    stockQty: 40,
    inStock: true,
    imageUrl: 'https://images.unsplash.com/photo-1599488615731-7e5c2823ff28?w=400&auto=format&fit=crop&q=80',
  },
  {
    id: 'demo-main-rice',
    name: 'Rice',
    categoryName: 'Main Course Demo',
    categoryId: 'cat-main-course-demo',
    menuName: 'Main Menu',
    priceMinor: 12000,
    uom: 'pcs',
    isWeighed: false,
    isVeg: true,
    code: 'DEMO-201',
    stockQty: 80,
    inStock: true,
    imageUrl: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=400&auto=format&fit=crop&q=80',
    portions: [
      { id: 'p-rice-half', name: 'Half plate', price: 120 },
      { id: 'p-rice-full', name: 'Full plate', price: 200 },
    ],
  },
  {
    id: 'demo-main-chicken-biriyani',
    name: 'Chicken Biriyani',
    categoryName: 'Main Course Demo',
    categoryId: 'cat-main-course-demo',
    menuName: 'Main Menu',
    priceMinor: 18000,
    uom: 'pcs',
    isWeighed: false,
    isVeg: false,
    code: 'DEMO-202',
    stockQty: 60,
    inStock: true,
    imageUrl: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=400&auto=format&fit=crop&q=80',
    portions: [
      { id: 'p-cb-half', name: 'Half plate', price: 180 },
      { id: 'p-cb-full', name: 'Full plate', price: 300 },
    ],
    extras: [
      { id: 'e-cb-gravy', name: 'Extra gravy', price: 30 },
      { id: 'e-cb-raita', name: 'Extra raita', price: 20 },
    ],
  },
  {
    id: 'demo-main-mutton-biriyani',
    name: 'Mutton Biriyani',
    categoryName: 'Main Course Demo',
    categoryId: 'cat-main-course-demo',
    menuName: 'Main Menu',
    priceMinor: 25000,
    uom: 'pcs',
    isWeighed: false,
    isVeg: false,
    code: 'DEMO-203',
    stockQty: 45,
    inStock: true,
    imageUrl: 'https://images.unsplash.com/photo-1633945274405-b6c8069047b0?w=400&auto=format&fit=crop&q=80',
    portions: [
      { id: 'p-mb-half', name: 'Half plate', price: 250 },
      { id: 'p-mb-full', name: 'Full plate', price: 400 },
    ],
  },
];

export const InventoryScreen: React.FC<Props> = ({
  language,
  profile,
  customItems,
  onUpdateItems,
  onBack,
  onOpenMenu,
  phone = '9848787308',
  profileName = 'Nova Restaurant',
}) => {
  const t = TRANSLATIONS[language];
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false);

  // Modals state
  const [isAddEditModalOpen, setIsAddEditModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<CatalogItem | null>(null);
  const [isManageCatModalOpen, setIsManageCatModalOpen] = useState(false);
  const [isBulkUploadModalOpen, setIsBulkUploadModalOpen] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isRawMaterialsModalOpen, setIsRawMaterialsModalOpen] = useState(false);

  // Stock Adjustment Modal States
  const [adjustStockModalOpen, setAdjustStockModalOpen] = useState(false);
  const [adjustStockItem, setAdjustStockItem] = useState<CatalogItem | null>(null);
  const [adjustStockMode, setAdjustStockMode] = useState<'add' | 'reduce'>('add');
  const [adjustStockQty, setAdjustStockQty] = useState('');
  const [adjustStockReason, setAdjustStockReason] = useState('New Purchase / Stock Received');

  // Barcode Scanner Modal State
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scanningField, setScanningField] = useState<'1' | '2' | '3' | '4' | '5'>('1');

  // Menus and Raw Materials list in localStorage
  const [menus, setMenus] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem('novapos:menus');
      return stored ? JSON.parse(stored) : ['Main Menu', 'Bar Menu', 'Breakfast'];
    } catch {
      return ['Main Menu', 'Bar Menu', 'Breakfast'];
    }
  });

  const [rawMaterialsList, setRawMaterialsList] = useState<RawMaterial[]>(() => {
    try {
      const stored = localStorage.getItem('novapos:raw_materials');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const saveRawMaterials = (materials: RawMaterial[]) => {
    setRawMaterialsList(materials);
    localStorage.setItem('novapos:raw_materials', JSON.stringify(materials));
  };

  const handleAddMenu = (newMenu: string) => {
    if (!newMenu.trim() || menus.includes(newMenu.trim())) return;
    const updated = [...menus, newMenu.trim()];
    setMenus(updated);
    localStorage.setItem('novapos:menus', JSON.stringify(updated));
  };

  useBackHandler(
    isAddEditModalOpen ||
      isManageCatModalOpen ||
      isBulkUploadModalOpen ||
      isShareModalOpen ||
      isRawMaterialsModalOpen ||
      adjustStockModalOpen ||
      scannerOpen,
    () => {
      if (scannerOpen) setScannerOpen(false);
      else if (adjustStockModalOpen) setAdjustStockModalOpen(false);
      else if (isShareModalOpen) setIsShareModalOpen(false);
      else if (isRawMaterialsModalOpen) setIsRawMaterialsModalOpen(false);
      else if (isBulkUploadModalOpen) setIsBulkUploadModalOpen(false);
      else if (isManageCatModalOpen) setIsManageCatModalOpen(false);
      else if (isAddEditModalOpen) setIsAddEditModalOpen(false);
    }
  );

  // Combine demo presets with user custom items
  const preset = presetCatalog(profile);
  const combinedDefaults = [...DEFAULT_MENU_PRESETS, ...preset.items];
  const allItems = mergeCatalog<CatalogItem>(combinedDefaults, customItems, profile);

  // Categories list
  const existingCategories = Array.from(
    new Set([
      'Starter Demo',
      'Main Course Demo',
      'Chinese Demo',
      ...allItems.map((i) => i.categoryName).filter(Boolean),
    ])
  );

  const [categoriesOrder, setCategoriesOrder] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem('novapos:category_order');
      if (stored) {
        const parsed: string[] = JSON.parse(stored);
        const merged = [...parsed];
        existingCategories.forEach((c) => {
          if (!merged.includes(c)) merged.push(c);
        });
        return merged;
      }
    } catch {
      // fallback
    }
    return existingCategories;
  });

  const handleSaveCategoriesOrder = (newOrder: string[]) => {
    setCategoriesOrder(newOrder);
    localStorage.setItem('novapos:category_order', JSON.stringify(newOrder));
  };

  // Filter items based on selected category & search
  const filteredItems = allItems.filter((item) => {
    if (selectedCategory !== 'all' && item.categoryName !== selectedCategory) return false;
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      item.name.toLowerCase().includes(q) ||
      item.code.toLowerCase().includes(q) ||
      (item.hsnSac && item.hsnSac.includes(q)) ||
      itemBarcodes(item).some((code) => code.toLowerCase().includes(q))
    );
  });

  // Group items by category in ordered list
  const categoriesToDisplay =
    selectedCategory === 'all'
      ? categoriesOrder.filter((cat) =>
          filteredItems.some((item) => item.categoryName === cat)
        )
      : [selectedCategory];

  // Helper to format price or portions range (e.g. ₹120 / ₹200)
  const formatItemPriceDisplay = (item: CatalogItem) => {
    if (item.portions && item.portions.length > 0) {
      return item.portions.map((p) => `₹${p.price}`).join(' / ');
    }
    return `₹${(item.priceMinor / 100).toFixed(0)}`;
  };

  // Open Add modal
  const handleOpenAdd = () => {
    setEditingItem(null);
    setIsAddEditModalOpen(true);
  };

  // Open Edit modal
  const handleOpenEdit = (item: CatalogItem) => {
    setEditingItem(item);
    setIsAddEditModalOpen(true);
  };

  // Save or update item
  const handleSaveItem = (data: Partial<CatalogItem>) => {
    if (editingItem) {
      const updated: CatalogItem = {
        ...editingItem,
        ...data,
      } as CatalogItem;
      onUpdateItems([...customItems.filter((i) => i.id !== editingItem.id), updated]);
    } else {
      const newItem: CatalogItem = {
        id: `custom-${Date.now()}`,
        businessProfile: profile,
        uom: 'pcs',
        isWeighed: false,
        isVeg: true,
        code: `ITM-${Date.now().toString().slice(-4)}`,
        inStock: true,
        stockQty: 100,
        ...data,
      } as CatalogItem;
      onUpdateItems([newItem, ...customItems]);
    }
    setIsAddEditModalOpen(false);
  };

  // Delete category
  const handleDeleteCategory = (catName: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (
      window.confirm(
        `Are you sure you want to delete category "${catName}" and archive all its items?`
      )
    ) {
      const updatedCustom = customItems.map((item) =>
        item.categoryName === catName ? { ...item, archived: true } : item
      );
      onUpdateItems(updatedCustom);
      const updatedCats = categoriesOrder.filter((c) => c !== catName);
      handleSaveCategoriesOrder(updatedCats);
      if (selectedCategory === catName) setSelectedCategory('all');
    }
  };

  // Reorder category up/down
  const handleReorderCategory = (catName: string, direction: 'up' | 'down') => {
    const idx = categoriesOrder.indexOf(catName);
    if (idx === -1) return;
    if (direction === 'up' && idx > 0) {
      const copy = [...categoriesOrder];
      const [moved] = copy.splice(idx, 1);
      copy.splice(idx - 1, 0, moved);
      handleSaveCategoriesOrder(copy);
    } else if (direction === 'down' && idx < categoriesOrder.length - 1) {
      const copy = [...categoriesOrder];
      const [moved] = copy.splice(idx, 1);
      copy.splice(idx + 1, 0, moved);
      handleSaveCategoriesOrder(copy);
    }
  };

  // Bulk import items
  const handleImportItems = (newItems: Partial<CatalogItem>[]) => {
    const created: CatalogItem[] = newItems.map((item, idx) => ({
      id: `custom-bulk-${Date.now()}-${idx}`,
      businessProfile: profile,
      name: item.name || 'Menu Dish',
      categoryId: item.categoryId || 'cat-general',
      categoryName: item.categoryName || 'General',
      priceMinor: item.priceMinor || 10000,
      uom: item.uom || 'pcs',
      isWeighed: false,
      isVeg: true,
      code: `ITM-${Date.now().toString().slice(-4)}-${idx}`,
      inStock: item.inStock !== undefined ? item.inStock : true,
      stockQty: 100,
      portions: item.portions,
      extras: item.extras,
      imageUrl: item.imageUrl || getCuratedPhotoForItem(item.name || ''),
    }));
    onUpdateItems([...created, ...customItems]);
  };

  return (
    <div className="menu-screen-container bg-[#F4F6F9] min-h-screen pb-28">
      {/* ────────────────── 1. Top Header matching Screenshot 2 ────────────────── */}
      <header className="px-4 py-3.5 bg-white border-b border-slate-200 sticky top-0 z-30 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onOpenMenu || onBack}
            className="p-1.5 -ml-1 text-slate-800 hover:bg-slate-100 rounded-xl transition-colors"
            aria-label="Open Menu Navigation"
          >
            <MenuIcon className="w-6 h-6 stroke-[2.5]" />
          </button>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Menu</h1>
        </div>

        {/* Share Menu button on right matching Screenshot 2 */}
        <button
          type="button"
          onClick={() => setIsShareModalOpen(true)}
          className="py-2 px-3.5 bg-[#E8EEFC] hover:bg-[#D5DEFF] text-[#2E3C64] font-bold text-xs rounded-full flex items-center gap-1.5 transition-all shadow-xs"
        >
          <Share2 className="w-3.5 h-3.5 stroke-[2.5]" />
          <span>Share Menu</span>
        </button>
      </header>

      {/* ────────────────── 2. Select Category Dropdown & Search ────────────────── */}
      <div className="px-4 pt-3 pb-2 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-700">Select Category</span>
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="text-[11px] font-bold text-orange-600 hover:underline"
            >
              Clear Search
            </button>
          )}
        </div>

        {/* Category Pill Dropdown Button */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setIsCategoryDropdownOpen(!isCategoryDropdownOpen)}
            className="w-full py-3 px-4 bg-white border border-slate-300 rounded-full font-bold text-xs text-slate-800 flex items-center justify-center gap-2 shadow-xs hover:border-slate-400 transition-colors"
          >
            <span>
              {selectedCategory === 'all'
                ? 'All Categories'
                : selectedCategory}
            </span>
            <ChevronDown
              className={`w-4 h-4 text-slate-500 transition-transform ${
                isCategoryDropdownOpen ? 'rotate-180' : ''
              }`}
            />
          </button>

          {/* Category Dropdown Popover */}
          {isCategoryDropdownOpen && (
            <div className="absolute top-full left-0 right-0 mt-1.5 bg-white border border-slate-200 rounded-2xl shadow-xl z-40 max-h-64 overflow-y-auto py-1">
              <button
                type="button"
                onClick={() => {
                  setSelectedCategory('all');
                  setIsCategoryDropdownOpen(false);
                }}
                className={`w-full px-4 py-2.5 text-left text-xs font-bold flex items-center justify-between ${
                  selectedCategory === 'all'
                    ? 'bg-orange-50 text-orange-600'
                    : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                <span>All Categories</span>
                <span className="text-[10px] text-slate-400 font-mono">
                  ({allItems.length})
                </span>
              </button>
              {categoriesOrder.map((cat) => {
                const count = allItems.filter((i) => i.categoryName === cat).length;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => {
                      setSelectedCategory(cat);
                      setIsCategoryDropdownOpen(false);
                    }}
                    className={`w-full px-4 py-2.5 text-left text-xs font-bold flex items-center justify-between ${
                      selectedCategory === cat
                        ? 'bg-orange-50 text-orange-600'
                        : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span>{cat}</span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      ({count})
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Quick Search Bar */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder="Search items, dishes, prices..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full text-xs font-semibold text-slate-800 pl-9 pr-3 py-2.5 bg-white border border-slate-200 rounded-xl outline-none focus:border-orange-500 shadow-xs placeholder:text-slate-400"
          />
        </div>
      </div>

      {/* ────────────────── 3. Category Sections & Item Cards (Screenshot 2) ────────────────── */}
      <main className="px-4 py-2 space-y-4">
        {categoriesToDisplay.length === 0 ? (
          <div className="p-8 text-center bg-white rounded-3xl border border-slate-200 shadow-sm mt-4">
            <div className="w-16 h-16 rounded-full bg-orange-50 mx-auto flex items-center justify-center text-orange-500 mb-3">
              <Plus className="w-8 h-8" />
            </div>
            <h3 className="font-black text-slate-800 text-base">No Menu Items Found</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
              Tap &quot;+ Add Item&quot; or &quot;Bulk Upload&quot; at the bottom to build your restaurant menu.
            </p>
            <button
              onClick={handleOpenAdd}
              className="mt-4 px-6 py-2.5 bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs rounded-full shadow"
            >
              + Add First Item
            </button>
          </div>
        ) : (
          categoriesToDisplay.map((catName) => {
            const catItems = filteredItems.filter((i) => i.categoryName === catName);
            if (catItems.length === 0 && searchQuery) return null;

            return (
              <div
                key={catName}
                className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden"
              >
                {/* Category Card Header matching Screenshot 2 */}
                <div className="px-5 py-3.5 bg-white border-b border-slate-100 flex items-center justify-between">
                  <h2 className="text-base font-black text-[#2E3C64] tracking-tight">
                    {catName}
                  </h2>

                  {/* Header Actions: ≡ reorder and 🗑 delete */}
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => handleReorderCategory(catName, 'up')}
                      className="p-1 text-slate-400 hover:text-slate-700"
                      title="Move Category Up"
                    >
                      <MenuIcon className="w-5 h-5 text-[#2E3C64]" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => handleDeleteCategory(catName, e)}
                      className="p-1 text-rose-500 hover:text-rose-700"
                      title="Delete Category"
                    >
                      <Trash2 className="w-4 h-4 stroke-[2.2]" />
                    </button>
                  </div>
                </div>

                {/* Items List inside this Category Card */}
                <div className="p-3 space-y-2">
                  {catItems.length === 0 ? (
                    <p className="text-xs text-slate-400 italic py-3 text-center">
                      No dishes in this category yet.
                    </p>
                  ) : (
                    catItems.map((item) => (
                      <div
                        key={item.id}
                        onClick={() => handleOpenEdit(item)}
                        className="p-2.5 bg-[#F0F4FF] hover:bg-[#E5ECFF] rounded-2xl flex items-center justify-between gap-3 cursor-pointer transition-all active:scale-[0.99] border border-[#E0E8FC]"
                      >
                        {/* Left: Thumbnail & Name & Stock */}
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          {item.imageUrl ? (
                            <img
                              src={item.imageUrl}
                              alt={item.name}
                              className="w-14 h-14 rounded-2xl object-cover flex-shrink-0 shadow-xs border border-white"
                              loading="lazy"
                            />
                          ) : (
                            <div className="w-14 h-14 rounded-2xl bg-white border border-slate-200 flex items-center justify-center flex-shrink-0 text-orange-600 font-black text-lg shadow-xs">
                              {item.name.charAt(0)}
                            </div>
                          )}

                          <div className="min-w-0">
                            <b className="text-sm font-bold text-slate-900 block truncate">
                              {item.name}
                            </b>
                            <div className="flex items-center gap-1 mt-0.5">
                              {item.inStock !== false ? (
                                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700">
                                  <CheckCircle2 className="w-3.5 h-3.5 fill-emerald-600 text-white" />
                                  <span>In Stock</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-600">
                                  <XCircle className="w-3.5 h-3.5 fill-rose-600 text-white" />
                                  <span>Out of Stock</span>
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Right: Price / Portions Display */}
                        <div className="text-right flex-shrink-0">
                          <b className="text-sm font-black text-slate-900">
                            {formatItemPriceDisplay(item)}
                          </b>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })
        )}
      </main>

      {/* ────────────────── 4. Bottom Action Bar matching Screenshot 2 ────────────────── */}
      {/* 3 buttons: [📤 Upload], [📁 Category], [+ Add Item] */}
      <div className="fixed bottom-[calc(64px+env(safe-area-inset-bottom,22px))] left-0 right-0 z-30 bg-[#3B4D80] text-white shadow-xl px-4 py-2.5 flex items-center justify-around border-t border-slate-700/30">
        {/* 1. Upload */}
        <button
          type="button"
          onClick={() => setIsBulkUploadModalOpen(true)}
          className="flex items-center justify-center gap-2 py-2 px-3 hover:bg-white/10 rounded-xl transition-colors font-bold text-xs flex-1 text-center"
        >
          <Upload className="w-4 h-4 stroke-[2.5]" />
          <span>Upload</span>
        </button>

        <div className="w-[1px] h-6 bg-white/20"></div>

        {/* 2. Category */}
        <button
          type="button"
          onClick={() => setIsManageCatModalOpen(true)}
          className="flex items-center justify-center gap-2 py-2 px-3 hover:bg-white/10 rounded-xl transition-colors font-bold text-xs flex-1 text-center"
        >
          <FolderPlus className="w-4 h-4 stroke-[2.5]" />
          <span>Category</span>
        </button>

        <div className="w-[1px] h-6 bg-white/20"></div>

        {/* 3. Add Item */}
        <button
          type="button"
          onClick={handleOpenAdd}
          className="flex items-center justify-center gap-2 py-2 px-3 hover:bg-white/10 rounded-xl transition-colors font-bold text-xs flex-1 text-center"
        >
          <Plus className="w-4 h-4 stroke-[3]" />
          <span>Add Item</span>
        </button>
      </div>

      {/* ────────────────── 5. Modals ────────────────── */}
      {/* Add / Edit Menu Item Modal (Screenshots 1 & 4) */}
      <AddEditMenuItemModal
        isOpen={isAddEditModalOpen}
        onClose={() => setIsAddEditModalOpen(false)}
        onSave={handleSaveItem}
        editingItem={editingItem}
        menus={menus}
        categories={categoriesOrder}
        onOpenRawMaterials={() => {
          setIsAddEditModalOpen(false);
          setIsRawMaterialsModalOpen(true);
        }}
      />

      {/* Manage Categories Modal (Screenshot 3) */}
      <ManageCategoriesModal
        isOpen={isManageCatModalOpen}
        onClose={() => setIsManageCatModalOpen(false)}
        menus={menus}
        categories={categoriesOrder}
        onSaveCategories={handleSaveCategoriesOrder}
        onAddMenu={handleAddMenu}
        selectedMenu={menus[0] || 'Main Menu'}
        onSelectMenu={() => {}}
      />

      {/* Bulk Upload Modal (Screenshot 5) */}
      <BulkUploadModal
        isOpen={isBulkUploadModalOpen}
        onClose={() => setIsBulkUploadModalOpen(false)}
        onImportItems={handleImportItems}
        categories={categoriesOrder}
      />

      {/* Share Menu Modal */}
      <ShareMenuModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        items={allItems}
        profileName={profileName}
        phone={phone}
      />

      {/* Raw Materials Modal */}
      <RawMaterialsModal
        isOpen={isRawMaterialsModalOpen}
        onClose={() => setIsRawMaterialsModalOpen(false)}
        rawMaterials={rawMaterialsList}
        onSaveRawMaterials={saveRawMaterials}
      />
    </div>
  );
};

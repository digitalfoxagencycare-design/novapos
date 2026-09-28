import React, { useState } from 'react';
import {
  X,
  Plus,
  Menu as MenuIcon,
  Edit2,
  Trash2,
  Check,
  ChevronUp,
  ChevronDown,
} from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  menus: string[];
  categories: string[];
  onSaveCategories: (newCategories: string[]) => void;
  onAddMenu: (menuName: string) => void;
  selectedMenu: string;
  onSelectMenu: (menuName: string) => void;
}

export const ManageCategoriesModal: React.FC<Props> = ({
  isOpen,
  onClose,
  menus,
  categories,
  onSaveCategories,
  onAddMenu,
  selectedMenu,
  onSelectMenu,
}) => {
  const [catList, setCatList] = useState<string[]>(categories);
  const [newCatName, setNewCatName] = useState('');
  const [isAddingMenu, setIsAddingMenu] = useState(false);
  const [newMenuInput, setNewMenuInput] = useState('');
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingValue, setEditingValue] = useState('');
  const [hasChanges, setHasChanges] = useState(false);

  // Sync state if incoming categories change while modal open
  React.useEffect(() => {
    setCatList(categories);
    setHasChanges(false);
  }, [categories]);

  if (!isOpen) return null;

  const handleCreateCategory = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const clean = newCatName.trim();
    if (!clean) return;
    if (catList.includes(clean)) {
      alert('This category already exists.');
      return;
    }
    const updated = [...catList, clean];
    setCatList(updated);
    setNewCatName('');
    setHasChanges(true);
  };

  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    const copy = [...catList];
    const [moved] = copy.splice(index, 1);
    copy.splice(index - 1, 0, moved);
    setCatList(copy);
    setHasChanges(true);
  };

  const handleMoveDown = (index: number) => {
    if (index >= catList.length - 1) return;
    const copy = [...catList];
    const [moved] = copy.splice(index, 1);
    copy.splice(index + 1, 0, moved);
    setCatList(copy);
    setHasChanges(true);
  };

  const handleDeleteCategory = (cat: string) => {
    if (catList.length <= 1) {
      alert('At least one category is required.');
      return;
    }
    if (window.confirm(`Delete "${cat}" category?`)) {
      setCatList(catList.filter((c) => c !== cat));
      setHasChanges(true);
    }
  };

  const handleStartEdit = (idx: number, name: string) => {
    setEditingIndex(idx);
    setEditingValue(name);
  };

  const handleSaveEdit = (idx: number) => {
    const clean = editingValue.trim();
    if (!clean) return;
    const copy = [...catList];
    copy[idx] = clean;
    setCatList(copy);
    setEditingIndex(null);
    setEditingValue('');
    setHasChanges(true);
  };

  const handleCreateMenu = () => {
    const clean = newMenuInput.trim();
    if (!clean) return;
    onAddMenu(clean);
    onSelectMenu(clean);
    setNewMenuInput('');
    setIsAddingMenu(false);
  };

  const handleSaveAll = () => {
    if (!hasChanges) return;
    onSaveCategories(catList);
    setHasChanges(false);
    onClose();
  };

  return (
    <div className="menu-modal-overlay">
      <div className="menu-modal-sheet max-w-lg w-full bg-[#F3F4F6] rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden border border-slate-200 animate-slide-up">
        {/* Header */}
        <div className="px-5 py-4 bg-white border-b border-slate-100 flex items-center justify-between sticky top-0 z-10">
          <h2 className="text-xl font-black text-slate-900 tracking-tight">
            Manage Categories
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

        <div className="p-5 overflow-y-auto space-y-5 flex-1">
          {/* SELECT MENU */}
          <div>
            <span className="text-[11px] font-black text-slate-500 uppercase tracking-wider block mb-2">
              SELECT MENU
            </span>
            <div className="flex flex-wrap gap-2">
              {menus.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => onSelectMenu(m)}
                  className={`px-5 py-2.5 rounded-xl font-bold text-xs transition-all shadow-sm ${
                    selectedMenu === m
                      ? 'bg-[#2E3C64] text-white shadow'
                      : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {m}
                </button>
              ))}

              {!isAddingMenu ? (
                <button
                  type="button"
                  onClick={() => setIsAddingMenu(true)}
                  className="px-4 py-2.5 rounded-xl font-bold text-xs border border-slate-300 bg-white text-slate-700 hover:border-orange-500 hover:text-orange-600 flex items-center gap-1 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Menu</span>
                </button>
              ) : (
                <div className="flex items-center gap-1.5 bg-white p-1 rounded-xl border border-orange-400">
                  <input
                    type="text"
                    autoFocus
                    placeholder="Menu name..."
                    value={newMenuInput}
                    onChange={(e) => setNewMenuInput(e.target.value)}
                    className="p-1.5 text-xs font-bold text-slate-800 outline-none w-28"
                    onKeyDown={(e) => e.key === 'Enter' && handleCreateMenu()}
                  />
                  <button
                    type="button"
                    onClick={handleCreateMenu}
                    className="p-1.5 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
                  >
                    <Check className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsAddingMenu(false)}
                    className="p-1.5 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* CREATE NEW CATEGORY BOX matching Screenshot 3 */}
          <div className="p-4 bg-[#EEF2FF] rounded-2xl border border-[#D5DEFF] space-y-3">
            <span className="text-[11px] font-black text-[#3730A3] uppercase tracking-wider block">
              CREATE NEW CATEGORY
            </span>

            <input
              type="text"
              placeholder="Category Name"
              value={newCatName}
              onChange={(e) => setNewCatName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreateCategory()}
              className="w-full text-sm font-semibold text-slate-800 p-3.5 bg-white border border-slate-200 rounded-xl outline-none focus:border-indigo-500 shadow-sm placeholder:text-slate-400"
            />

            <button
              type="button"
              onClick={handleCreateCategory}
              disabled={!newCatName.trim()}
              className={`w-full py-3.5 rounded-full font-bold text-sm transition-all shadow-sm text-center ${
                newCatName.trim()
                  ? 'bg-orange-600 hover:bg-orange-700 text-white shadow-orange-500/20'
                  : 'bg-[#BAC6E5] text-white/80 cursor-not-allowed'
              }`}
            >
              Create Category
            </button>
          </div>

          {/* EXISTING CATEGORIES LIST */}
          <div>
            <span className="text-[11px] font-black text-[#2E3C64] uppercase tracking-wider block mb-3">
              EXISTING CATEGORIES (Long-Press and Drag to Reorder)
            </span>

            <div className="space-y-2.5">
              {catList.map((cat, idx) => (
                <div
                  key={cat}
                  className="p-3.5 bg-white rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between gap-3 group transition-all hover:border-slate-300"
                >
                  {/* Left: Reorder Handle & Name */}
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="flex flex-col gap-0.5 text-slate-400">
                      <button
                        type="button"
                        onClick={() => handleMoveUp(idx)}
                        disabled={idx === 0}
                        className={`p-0.5 rounded hover:bg-slate-100 ${idx === 0 ? 'opacity-20' : 'hover:text-slate-700'}`}
                      >
                        <ChevronUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMoveDown(idx)}
                        disabled={idx === catList.length - 1}
                        className={`p-0.5 rounded hover:bg-slate-100 ${idx === catList.length - 1 ? 'opacity-20' : 'hover:text-slate-700'}`}
                      >
                        <ChevronDown className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <MenuIcon className="w-4 h-4 text-slate-400 flex-shrink-0 cursor-grab" />

                    {editingIndex === idx ? (
                      <div className="flex items-center gap-1.5 flex-1">
                        <input
                          type="text"
                          value={editingValue}
                          onChange={(e) => setEditingValue(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleSaveEdit(idx)}
                          className="flex-1 text-sm font-bold text-slate-900 p-1.5 bg-slate-50 border border-orange-400 rounded-lg outline-none"
                          autoFocus
                        />
                        <button
                          type="button"
                          onClick={() => handleSaveEdit(idx)}
                          className="p-1.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingIndex(null)}
                          className="p-1.5 text-slate-400 hover:text-slate-600"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <span className="font-bold text-slate-900 text-sm truncate">
                        {cat}
                      </span>
                    )}
                  </div>

                  {/* Right: Edit & Index badge */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => handleStartEdit(idx, cat)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                      title="Edit Category Name"
                    >
                      <Edit2 className="w-4 h-4 text-[#2E3C64]" />
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDeleteCategory(cat)}
                      className="p-1.5 rounded-lg text-slate-300 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                      title="Delete Category"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>

                    <span className="text-xs font-bold text-slate-400 font-mono pl-1">
                      #{idx + 1}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom Save Button */}
        <div className="p-4 bg-white border-t border-slate-100 sticky bottom-0 z-10">
          <button
            type="button"
            onClick={handleSaveAll}
            disabled={!hasChanges}
            className={`w-full py-3.5 rounded-full font-bold text-sm transition-all shadow-md text-center ${
              hasChanges
                ? 'bg-orange-600 hover:bg-orange-700 text-white shadow-orange-500/25 active:scale-98'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
            }`}
          >
            {hasChanges ? 'Save Changes' : 'No Changes to Save'}
          </button>
        </div>
      </div>
    </div>
  );
};

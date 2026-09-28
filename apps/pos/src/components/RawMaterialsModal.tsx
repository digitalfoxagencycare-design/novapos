import React, { useState } from 'react';
import { X, Plus, Trash2, Layers, AlertCircle } from 'lucide-react';
import type { RawMaterial } from '../screens/InventoryScreen';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  rawMaterials: RawMaterial[];
  onSaveRawMaterials: (materials: RawMaterial[]) => void;
}

export const RawMaterialsModal: React.FC<Props> = ({
  isOpen,
  onClose,
  rawMaterials,
  onSaveRawMaterials,
}) => {
  const [list, setList] = useState<RawMaterial[]>(rawMaterials);
  const [name, setName] = useState('');
  const [stock, setStock] = useState('');
  const [unit, setUnit] = useState('kg');

  if (!isOpen) return null;

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    const newMat: RawMaterial = {
      id: `mat-${Date.now()}`,
      name: name.trim(),
      stockQty: parseFloat(stock) || 0,
      unit,
    };
    const updated = [...list, newMat];
    setList(updated);
    onSaveRawMaterials(updated);
    setName('');
    setStock('');
  };

  const handleRemove = (id: string) => {
    const updated = list.filter((m) => m.id !== id);
    setList(updated);
    onSaveRawMaterials(updated);
  };

  return (
    <div className="menu-modal-overlay">
      <div className="menu-modal-sheet max-w-lg w-full bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden border border-slate-200 animate-slide-up">
        {/* Header */}
        <div className="px-5 py-4 bg-white border-b border-slate-100 flex items-center justify-between sticky top-0 z-10">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-orange-100 flex items-center justify-center text-orange-600 font-bold">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900 tracking-tight">
                Raw Materials & Recipe Stock
              </h2>
              <p className="text-[11px] text-slate-500">
                Track ingredients used in your kitchen dishes
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-slate-100 text-slate-600 transition-colors"
          >
            <X className="w-5 h-5 stroke-[2.5]" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {/* Add Material Form */}
          <form
            onSubmit={handleAdd}
            className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-2.5"
          >
            <span className="text-xs font-bold text-slate-700 block">
              + Add New Raw Material / Ingredient
            </span>
            <div className="flex gap-2">
              <input
                type="text"
                required
                placeholder="Ingredient name (e.g. Basmati Rice, Chicken)"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="flex-1 text-xs font-semibold p-2.5 bg-white border border-slate-200 rounded-xl outline-none focus:border-orange-500"
              />
              <input
                type="number"
                step="any"
                min="0"
                placeholder="Stock"
                value={stock}
                onChange={(e) => setStock(e.target.value)}
                className="w-20 text-xs font-semibold p-2.5 bg-white border border-slate-200 rounded-xl outline-none focus:border-orange-500"
              />
              <select
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                className="text-xs font-bold p-2.5 bg-white border border-slate-200 rounded-xl outline-none focus:border-orange-500"
              >
                <option value="kg">kg</option>
                <option value="g">g</option>
                <option value="litre">litre</option>
                <option value="ml">ml</option>
                <option value="pcs">pcs</option>
              </select>
            </div>
            <button
              type="submit"
              className="w-full py-2 bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs rounded-xl shadow-sm"
            >
              Add Material
            </button>
          </form>

          {/* List of Ingredients */}
          <div className="space-y-2">
            <span className="text-xs font-bold text-slate-600 block">
              Existing Raw Materials ({list.length}):
            </span>
            {list.length === 0 ? (
              <p className="text-xs text-slate-400 italic text-center py-4">
                No raw materials added yet. Add ingredients above.
              </p>
            ) : (
              list.map((m) => (
                <div
                  key={m.id}
                  className="p-3 bg-white border border-slate-200 rounded-xl flex items-center justify-between shadow-sm"
                >
                  <div>
                    <b className="text-xs font-bold text-slate-800 block">{m.name}</b>
                    <span className="text-[11px] text-slate-500 font-mono">
                      Stock: {m.stockQty} {m.unit}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemove(m.id)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="p-4 bg-white border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-3 bg-slate-900 text-white font-bold text-xs rounded-full shadow"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

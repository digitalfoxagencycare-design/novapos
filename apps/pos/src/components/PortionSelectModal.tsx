import React, { useState } from 'react';
import { X, Plus, Minus, Check } from 'lucide-react';
import type { CatalogItem, ItemPortion, ItemExtra } from '../screens/InventoryScreen';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  item: CatalogItem | null;
  onConfirm: (
    item: CatalogItem,
    selectedPortion: ItemPortion | null,
    selectedExtras: ItemExtra[],
    quantity: number
  ) => void;
}

export const PortionSelectModal: React.FC<Props> = ({
  isOpen,
  onClose,
  item,
  onConfirm,
}) => {
  if (!isOpen || !item) return null;

  const portions = item.portions || [];
  const extras = item.extras || [];

  const [selectedPortion, setSelectedPortion] = useState<ItemPortion | null>(
    portions.length > 0 ? portions[0] : null
  );
  const [selectedExtras, setSelectedExtras] = useState<ItemExtra[]>([]);
  const [quantity, setQuantity] = useState(1);

  // Toggle or select extra
  const handleToggleExtra = (extra: ItemExtra) => {
    if (item.singleChoiceExtras) {
      if (selectedExtras.some((e) => e.id === extra.id)) {
        setSelectedExtras([]);
      } else {
        setSelectedExtras([extra]);
      }
    } else {
      if (selectedExtras.some((e) => e.id === extra.id)) {
        setSelectedExtras((prev) => prev.filter((e) => e.id !== extra.id));
      } else {
        setSelectedExtras((prev) => [...prev, extra]);
      }
    }
  };

  const basePrice = selectedPortion ? selectedPortion.price : item.priceMinor / 100;
  const extrasTotal = selectedExtras.reduce((sum, e) => sum + e.price, 0);
  const unitTotal = basePrice + extrasTotal;
  const grandTotal = unitTotal * quantity;

  const handleAdd = () => {
    onConfirm(item, selectedPortion, selectedExtras, quantity);
    onClose();
  };

  return (
    <div className="menu-modal-overlay">
      <div className="menu-modal-sheet max-w-sm w-full bg-white rounded-3xl shadow-2xl p-5 border border-slate-200 animate-slide-up space-y-4">
        {/* Header with image */}
        <div className="flex items-start justify-between gap-3 border-b pb-3">
          <div className="flex items-center gap-3">
            {item.imageUrl ? (
              <img
                src={item.imageUrl}
                alt={item.name}
                className="w-14 h-14 rounded-2xl object-cover border border-slate-100 shadow-sm"
              />
            ) : (
              <div className="w-14 h-14 rounded-2xl bg-orange-50 border border-orange-100 flex items-center justify-center text-orange-600 font-bold text-lg">
                {item.name.charAt(0)}
              </div>
            )}
            <div>
              <b className="text-base font-black text-slate-900 block leading-tight">
                {item.name}
              </b>
              <span className="text-xs font-semibold text-slate-500">
                {item.categoryName}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-full hover:bg-slate-100 text-slate-500"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 1. Portions Selector */}
        {portions.length > 0 && (
          <div className="space-y-2">
            <span className="text-xs font-bold text-slate-700 block">
              Select Portion <span className="text-rose-500">*</span>
            </span>
            <div className="grid grid-cols-2 gap-2">
              {portions.map((portion) => {
                const isSelected = selectedPortion?.id === portion.id;
                return (
                  <button
                    key={portion.id}
                    type="button"
                    onClick={() => setSelectedPortion(portion)}
                    className={`p-3 rounded-2xl border text-left transition-all relative ${
                      isSelected
                        ? 'border-orange-500 bg-orange-50/60 shadow-sm ring-1 ring-orange-500'
                        : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <b
                      className={`text-xs block ${
                        isSelected ? 'text-orange-950 font-black' : 'text-slate-800'
                      }`}
                    >
                      {portion.name}
                    </b>
                    <span
                      className={`text-sm font-black mt-0.5 block ${
                        isSelected ? 'text-orange-600' : 'text-slate-600'
                      }`}
                    >
                      ₹{portion.price}
                    </span>
                    {isSelected && (
                      <div className="absolute top-2 right-2 w-4 h-4 rounded-full bg-orange-600 text-white flex items-center justify-center">
                        <Check className="w-3 h-3 stroke-[3]" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* 2. Extras Selector */}
        {extras.length > 0 && (
          <div className="space-y-2 pt-1 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700">Add-ons / Extras</span>
              {item.singleChoiceExtras && (
                <span className="text-[10px] text-slate-400 font-semibold">(Pick 1)</span>
              )}
            </div>
            <div className="space-y-1.5">
              {extras.map((extra) => {
                const isChecked = selectedExtras.some((e) => e.id === extra.id);
                return (
                  <button
                    key={extra.id}
                    type="button"
                    onClick={() => handleToggleExtra(extra)}
                    className={`w-full p-2.5 rounded-xl border flex items-center justify-between text-xs transition-all ${
                      isChecked
                        ? 'border-orange-400 bg-orange-50 text-orange-900 font-bold'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-4 h-4 rounded ${
                          item.singleChoiceExtras ? 'rounded-full' : 'rounded-md'
                        } border flex items-center justify-center ${
                          isChecked
                            ? 'bg-orange-600 border-orange-600 text-white'
                            : 'border-slate-300 bg-white'
                        }`}
                      >
                        {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                      </div>
                      <span>{extra.name}</span>
                    </div>
                    <span className="font-bold text-orange-600">+₹{extra.price}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Quantity Controls & Grand Total */}
        <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              disabled={quantity <= 1}
              className="w-7 h-7 rounded-lg bg-white text-slate-700 flex items-center justify-center font-bold disabled:opacity-30 shadow-sm"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>
            <span className="w-8 text-center text-xs font-black text-slate-900">
              {quantity}
            </span>
            <button
              type="button"
              onClick={() => setQuantity((q) => q + 1)}
              className="w-7 h-7 rounded-lg bg-white text-slate-700 flex items-center justify-center font-bold shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="text-right">
            <span className="text-[10px] text-slate-400 font-semibold block">Total</span>
            <b className="text-base font-black text-slate-900">₹{grandTotal.toFixed(0)}</b>
          </div>
        </div>

        {/* Add to Bill Button */}
        <button
          type="button"
          onClick={handleAdd}
          className="w-full py-3.5 bg-orange-600 hover:bg-orange-700 text-white font-bold text-sm rounded-full shadow-lg shadow-orange-500/25 active:scale-98 transition-all flex items-center justify-center gap-2"
        >
          <span>Add to Bill</span>
          <span>•</span>
          <span>₹{grandTotal.toFixed(0)}</span>
        </button>
      </div>
    </div>
  );
};

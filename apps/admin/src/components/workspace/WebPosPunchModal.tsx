import { useEffect, useMemo, useState } from 'react';
import {
  X, Plus, Minus, Trash2, CheckCircle2, Printer, ShoppingBag,
  UtensilsCrossed, Zap, Search, CreditCard, Banknote, QrCode
} from 'lucide-react';
import type { AdminApi } from '../../lib/api';
import type { Category, MenuItem, WorkspaceOutlet } from './types';
import { button, primary, card, field } from './primitives';

interface WebPosPunchModalProps {
  api: AdminApi;
  outlet: WorkspaceOutlet;
  onClose: () => void;
  onOrderPlaced: () => void;
}

interface CartLine {
  item: MenuItem;
  quantity: number;
}

export function WebPosPunchModal({ api, outlet, onClose, onOrderPlaced }: WebPosPunchModalProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [selectedCatId, setSelectedCatId] = useState<string>('ALL');
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<CartLine[]>([]);
  const [channel, setChannel] = useState<'QUICK_BILL' | 'DINE_IN' | 'TAKEAWAY'>('QUICK_BILL');
  const [paymentMode, setPaymentMode] = useState<'upi' | 'cash' | 'card'>('upi');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [settledOrder, setSettledOrder] = useState<{
    invoiceNumber: string;
    totalAmount: number;
    lines: { name: string; quantity: number; price: number; lineTotal: number }[];
    paymentMode: string;
    placedAt: string;
  } | null>(null);

  // Load menu categories and items
  useEffect(() => {
    let active = true;
    Promise.all([api.categories(), api.items()])
      .then(([cats, itms]) => {
        if (!active) return;
        setCategories(Array.isArray(cats) ? cats : []);
        setItems(Array.isArray(itms) ? itms : []);
      })
      .catch((e) => {
        if (active) setError((e as Error).message);
      });
    return () => { active = false; };
  }, [api]);

  // Filter items
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchCat = selectedCatId === 'ALL' || item.categoryId === selectedCatId;
      const matchSearch = !search.trim() || item.name.toLowerCase().includes(search.toLowerCase());
      return matchCat && matchSearch;
    });
  }, [items, selectedCatId, search]);

  const addToCart = (item: MenuItem) => {
    setCart((prev) => {
      const idx = prev.findIndex((l) => l.item.id === item.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = { ...copy[idx], quantity: copy[idx].quantity + 1 };
        return copy;
      }
      return [...prev, { item, quantity: 1 }];
    });
  };

  const updateQuantity = (itemId: string, delta: number) => {
    setCart((prev) => {
      return prev
        .map((l) => {
          if (l.item.id === itemId) {
            const nextQty = l.quantity + delta;
            return nextQty > 0 ? { ...l, quantity: nextQty } : null;
          }
          return l;
        })
        .filter(Boolean) as CartLine[];
    });
  };

  const removeFromCart = (itemId: string) => {
    setCart((prev) => prev.filter((l) => l.item.id !== itemId));
  };

  // Calculations
  const grossSubtotalMinor = cart.reduce((sum, line) => sum + line.item.priceMinor * line.quantity, 0);
  // GST 5% inclusive calculation:
  const taxableMinor = Math.round(grossSubtotalMinor / 1.05);
  const totalTaxMinor = grossSubtotalMinor - taxableMinor;
  const cgstMinor = Math.round(totalTaxMinor / 2);
  const sgstMinor = totalTaxMinor - cgstMinor;
  const netPayableRupees = grossSubtotalMinor / 100;

  const handleSettleBill = async () => {
    if (cart.length === 0) return;
    setBusy(true);
    setError('');

    const invoiceNum = `INV-${Date.now().toString().slice(-6)}`;
    const now = new Date();

    const taxSnapshot = {
      currency: 'INR',
      taxRuleSetKey: 'IN-GST',
      taxableMinor,
      totalTaxMinor,
      componentTotals: [
        { code: 'CGST', rate: '2.5', baseMinor: taxableMinor, amountMinor: cgstMinor },
        { code: 'SGST', rate: '2.5', baseMinor: taxableMinor, amountMinor: sgstMinor },
      ],
    };

    const linesPayload = cart.map((line) => ({
      itemId: line.item.id,
      name: line.item.name,
      quantity: line.quantity,
      price: line.item.priceMinor / 100,
      taxSlabId: line.item.taxSlabId || 'gst-5',
      netMinor: line.item.priceMinor * line.quantity,
    }));

    try {
      await api.recordPosSale({
        clientOrderId: crypto.randomUUID ? crypto.randomUUID() : `web-${Date.now()}`,
        invoiceNumber: invoiceNum,
        amount: netPayableRupees,
        paymentMode,
        customerName: customerName.trim() || undefined,
        customerPhone: customerPhone.trim() || undefined,
        notes: `Punched from Web POS Backoffice (${channel})`,
        taxSnapshot,
        lines: linesPayload,
        placedAt: now.toISOString(),
      });

      setSettledOrder({
        invoiceNumber: invoiceNum,
        totalAmount: netPayableRupees,
        lines: cart.map((l) => ({
          name: l.item.name,
          quantity: l.quantity,
          price: l.item.priceMinor / 100,
          lineTotal: (l.item.priceMinor * l.quantity) / 100,
        })),
        paymentMode: paymentMode.toUpperCase(),
        placedAt: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      });

      setCart([]);
      onOrderPlaced();
    } catch (e) {
      setError((e as Error).message || 'Failed to punch order. Please retry.');
    } finally {
      setBusy(false);
    }
  };

  const handlePrintReceipt = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-2 sm:p-4 backdrop-blur-sm">
      <div className="flex h-full max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl border border-slate-200">
        {/* Header */}
        <header className="flex items-center justify-between border-b border-slate-200 bg-forest px-6 py-4 text-white">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 text-emerald-300">
              <Zap size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold tracking-tight">Fast POS Counter Billing</h2>
                <span className="rounded bg-emerald-400/20 px-2 py-0.5 text-[10px] font-bold text-emerald-200 uppercase">
                  Live Terminal
                </span>
              </div>
              <p className="text-xs text-emerald-100">{outlet.name} · Instant Bill Punch & Settle</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-white/80 transition-colors hover:bg-white/10 hover:text-white"
          >
            <X size={20} />
          </button>
        </header>

        {/* Content Body */}
        {settledOrder ? (
          /* Bill Settlement Success View */
          <div className="flex flex-1 flex-col items-center justify-center overflow-y-auto p-8 text-center bg-slate-50">
            <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-md text-left">
              <div className="flex items-center justify-center mb-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                  <CheckCircle2 size={32} />
                </div>
              </div>
              <h3 className="text-xl font-bold text-center text-slate-900">Bill Settled Successfully!</h3>
              <p className="text-center font-mono text-sm font-semibold text-emerald-700 mt-1">
                Invoice #{settledOrder.invoiceNumber}
              </p>
              <div className="my-4 border-y border-dashed border-slate-200 py-3 text-xs text-slate-600 space-y-1">
                <div className="flex justify-between">
                  <span>Store:</span>
                  <span className="font-semibold text-slate-800">{outlet.name}</span>
                </div>
                <div className="flex justify-between">
                  <span>Payment Mode:</span>
                  <span className="font-semibold text-emerald-700">{settledOrder.paymentMode}</span>
                </div>
                <div className="flex justify-between">
                  <span>Time:</span>
                  <span>{settledOrder.placedAt}</span>
                </div>
              </div>

              {/* Items summary */}
              <div className="space-y-1.5 text-xs">
                {settledOrder.lines.map((l, i) => (
                  <div key={i} className="flex justify-between text-slate-700">
                    <span>
                      {l.name} <span className="text-slate-400">×{l.quantity}</span>
                    </span>
                    <span className="font-mono">₹{l.lineTotal.toFixed(2)}</span>
                  </div>
                ))}
              </div>

              <div className="mt-4 flex justify-between border-t border-slate-200 pt-3 text-base font-bold text-slate-900">
                <span>Total Paid</span>
                <span className="font-mono text-emerald-700">₹{settledOrder.totalAmount.toFixed(2)}</span>
              </div>

              <div className="mt-6 grid grid-cols-2 gap-3">
                <button
                  className={`${button} w-full`}
                  onClick={handlePrintReceipt}
                >
                  <Printer size={15} /> Print Bill
                </button>
                <button
                  className={`${primary} w-full`}
                  onClick={() => setSettledOrder(null)}
                >
                  Punch Next Bill
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* Normal Billing Layout: 2 Columns (Menu on Left, Bill on Right) */
          <div className="grid flex-1 grid-cols-1 md:grid-cols-[minmax(0,1.3fr)_380px] overflow-hidden">
            {/* Left Column: Menu Items */}
            <div className="flex flex-col border-r border-slate-200 overflow-hidden bg-slate-50/50">
              {/* Category tabs & Search */}
              <div className="border-b border-slate-200 bg-white p-3 space-y-2.5">
                <div className="relative">
                  <Search size={16} className="absolute left-3 top-3 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search menu items (e.g. Chai, Biryani, Dosa)..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className={`${field} pl-9 py-2 text-xs`}
                  />
                </div>
                <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                  <button
                    onClick={() => setSelectedCatId('ALL')}
                    className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                      selectedCatId === 'ALL'
                        ? 'bg-forest text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    All Items ({items.length})
                  </button>
                  {categories.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => setSelectedCatId(c.id)}
                      className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                        selectedCatId === c.id
                          ? 'bg-forest text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {c.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Items Grid */}
              <div className="flex-1 overflow-y-auto p-4">
                {filteredItems.length === 0 ? (
                  <div className="flex h-48 flex-col items-center justify-center text-slate-400">
                    <UtensilsCrossed size={28} className="mb-2" />
                    <p className="text-xs">No items found matching your filter</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                    {filteredItems.map((item) => {
                      const inCart = cart.find((l) => l.item.id === item.id);
                      return (
                        <div
                          key={item.id}
                          onClick={() => addToCart(item)}
                          role="button"
                          tabIndex={0}
                          className={`flex flex-col justify-between rounded-xl border p-3 text-left transition-all cursor-pointer ${
                            inCart
                              ? 'border-emerald-600 bg-emerald-50/40 shadow-sm'
                              : 'border-slate-200 bg-white hover:border-emerald-400 hover:shadow-sm'
                          }`}
                        >
                          <div>
                            <div className="flex items-start justify-between gap-1">
                              <span
                                className={`h-2.5 w-2.5 rounded-full mt-0.5 shrink-0 ${
                                  item.isVeg !== false ? 'bg-emerald-600' : 'bg-rose-600'
                                }`}
                                title={item.isVeg !== false ? 'Vegetarian' : 'Non-Vegetarian'}
                              />
                              {inCart && (
                                <span className="rounded-full bg-forest px-1.5 py-0.5 text-[10px] font-bold text-white">
                                  {inCart.quantity}
                                </span>
                              )}
                            </div>
                            <h4 className="mt-1 font-semibold text-xs text-slate-800 line-clamp-2 leading-tight">
                              {item.name}
                            </h4>
                          </div>
                          <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2">
                            <span className="font-mono text-sm font-bold text-emerald-800">
                              ₹{(item.priceMinor / 100).toFixed(0)}
                            </span>
                            <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                              + Add
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: Order Cart & Checkout */}
            <div className="flex flex-col bg-white overflow-hidden">
              {/* Channel Selector */}
              <div className="flex border-b border-slate-200 p-2 gap-1.5 bg-slate-50">
                {(
                  [
                    { id: 'QUICK_BILL', label: 'Counter' },
                    { id: 'DINE_IN', label: 'Dine-In' },
                    { id: 'TAKEAWAY', label: 'Takeaway' },
                  ] as const
                ).map((ch) => (
                  <button
                    key={ch.id}
                    onClick={() => setChannel(ch.id)}
                    className={`flex-1 rounded-lg py-1.5 text-xs font-semibold transition-all ${
                      channel === ch.id
                        ? 'bg-forest text-white shadow-sm'
                        : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {ch.label}
                  </button>
                ))}
              </div>

              {/* Cart Items List */}
              <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
                {cart.length === 0 ? (
                  <div className="flex h-48 flex-col items-center justify-center text-center text-slate-400">
                    <ShoppingBag size={32} className="mb-2 opacity-50" />
                    <p className="text-xs font-semibold">Cart is currently empty</p>
                    <p className="mt-1 text-[11px] text-slate-400">
                      Tap items on the left to add them to this bill.
                    </p>
                  </div>
                ) : (
                  cart.map((line) => (
                    <div
                      key={line.item.id}
                      className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/80 p-2.5 text-xs"
                    >
                      <div className="min-w-0 flex-1 pr-2">
                        <p className="font-semibold text-slate-800 truncate">{line.item.name}</p>
                        <p className="text-[10px] text-slate-500 font-mono">
                          ₹{(line.item.priceMinor / 100).toFixed(0)} each
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => updateQuantity(line.item.id, -1)}
                          className="flex h-6 w-6 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-600 hover:bg-slate-100"
                        >
                          <Minus size={12} />
                        </button>
                        <span className="w-5 text-center font-mono font-bold text-slate-800">
                          {line.quantity}
                        </span>
                        <button
                          onClick={() => updateQuantity(line.item.id, 1)}
                          className="flex h-6 w-6 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-600 hover:bg-slate-100"
                        >
                          <Plus size={12} />
                        </button>
                        <span className="w-14 text-right font-mono font-bold text-slate-900">
                          ₹{((line.item.priceMinor * line.quantity) / 100).toFixed(0)}
                        </span>
                        <button
                          onClick={() => removeFromCart(line.item.id)}
                          className="ml-1 text-slate-400 hover:text-rose-600"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Bill Details & Payment */}
              <div className="border-t border-slate-200 bg-slate-50 p-4 space-y-3">
                {/* Payment Mode Pills */}
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Payment Mode
                  </span>
                  <div className="mt-1.5 grid grid-cols-3 gap-2">
                    {[
                      { id: 'upi', label: 'UPI QR', icon: QrCode },
                      { id: 'cash', label: 'Cash', icon: Banknote },
                      { id: 'card', label: 'Card', icon: CreditCard },
                    ].map((mode) => {
                      const Icon = mode.icon;
                      return (
                        <button
                          key={mode.id}
                          onClick={() => setPaymentMode(mode.id as any)}
                          className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-bold transition-all ${
                            paymentMode === mode.id
                              ? 'bg-emerald-700 text-white shadow-sm'
                              : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          <Icon size={14} />
                          {mode.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Subtotal & Taxes breakdown */}
                <div className="space-y-1 text-xs text-slate-600 border-t border-slate-200 pt-2 font-mono">
                  <div className="flex justify-between">
                    <span>Taxable Base:</span>
                    <span>₹{(taxableMinor / 100).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-slate-500 text-[11px]">
                    <span>GST (CGST 2.5% + SGST 2.5%):</span>
                    <span>₹{(totalTaxMinor / 100).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm font-bold text-slate-900 pt-1 border-t border-slate-200">
                    <span>Net Payable:</span>
                    <span className="font-mono text-emerald-800 text-base">
                      ₹{netPayableRupees.toFixed(2)}
                    </span>
                  </div>
                </div>

                {error && (
                  <p role="alert" className="rounded-lg bg-rose-50 p-2 text-xs text-rose-700">
                    {error}
                  </p>
                )}

                {/* Punch & Settle Button */}
                <button
                  disabled={cart.length === 0 || busy}
                  onClick={handleSettleBill}
                  className={`${primary} w-full py-3 text-sm font-bold tracking-wide`}
                >
                  <Zap size={16} />
                  {busy ? 'Settling bill…' : `Punch & Settle Bill (₹${netPayableRupees.toFixed(0)})`}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

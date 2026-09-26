import { useBackHandler } from '../lib/navigation';
import React, { useState, useEffect } from 'react';
import {
  Calculator,
  Printer,
  Trash2,
  Plus,
  QrCode,
  Banknote,
  CheckCircle2,
  ArrowLeft,
  Users,
  ChevronDown,
  ChevronUp,
  Percent,
  RotateCcw,
  Search,
  X,
} from 'lucide-react';
import { TRANSLATIONS, type SupportedLanguage } from '../lib/translations';
import { printReceiptViaBrowser, type BillData } from '../lib/thermalPrinter';
import { addDayBookEntry } from '../lib/dayBook';
import { speakPaymentAlert } from '../lib/hardwareBridge';
import { loadParties, upsertParty, recordKhataSale, type Party } from '../lib/khata';

interface CalcLine {
  id: string;
  amount: number;
  note: string;
}

interface Props {
  language: SupportedLanguage;
  profileName: string;
  phone: string;
  address: string;
  upiVpa: string;
  onSaleCompleted?: (total: number, mode: 'cash' | 'upi' | 'credit') => void;
  onBack?: () => void;
}

const NOTE_PRESETS = ['General', 'Grocery', 'Dairy', 'Snacks', 'Beverages', 'Vegetables'];
const CASH_PRESETS = [10, 20, 50, 100, 200, 500];

export const CalculatorBillingScreen: React.FC<Props> = ({
  language,
  profileName,
  phone,
  address,
  upiVpa,
  onSaleCompleted,
  onBack,
}) => {
  const t = TRANSLATIONS[language];

  // Calculator input and expression states
  const [currentInput, setCurrentInput] = useState<string>('');
  const [expression, setExpression] = useState<string>('');
  const [currentNote, setCurrentNote] = useState<string>('');
  const [lines, setLines] = useState<CalcLine[]>([]);
  const [showLinesTray, setShowLinesTray] = useState<boolean>(false);
  const [lastBilled, setLastBilled] = useState<{ total: number; billNo: string; billData: BillData } | null>(null);

  // Credit / Khata selection modal
  const [parties, setParties] = useState<Party[]>(() => loadParties());
  const [khataModalOpen, setKhataModalOpen] = useState(false);
  const [partySearch, setPartySearch] = useState('');
  const [showQuickAddParty, setShowQuickAddParty] = useState(false);
  const [newPartyName, setNewPartyName] = useState('');
  const [newPartyPhone, setNewPartyPhone] = useState('');
  useBackHandler(showLinesTray, () => setShowLinesTray(false));
  useBackHandler(khataModalOpen, () => setKhataModalOpen(false));
  useBackHandler(showQuickAddParty, () => setShowQuickAddParty(false));

  useEffect(() => {
    if (khataModalOpen) {
      setParties(loadParties());
    }
  }, [khataModalOpen]);

  // Evaluate arithmetic expression safely
  const evaluateMath = (expr: string): number | null => {
    try {
      // Replace safe math operators
      const sanitized = expr
        .replace(/×/g, '*')
        .replace(/÷/g, '/')
        .replace(/−/g, '-')
        .replace(/[^0-9+\-*/.%() ]/g, '');
      if (!sanitized) return null;
      // Handle simple percentage: e.g. 500 - 10%
      const pctHandled = sanitized.replace(/([0-9.]+)\s*([+\-])\s*([0-9.]+)%/g, (_, base, op, pct) => {
        const b = parseFloat(base);
        const p = parseFloat(pct);
        const discount = (b * p) / 100;
        return op === '-' ? String(b - discount) : String(b + discount);
      });
      // eslint-disable-next-line no-new-func
      const result = Function(`'use strict'; return (${pctHandled})`)();
      if (typeof result === 'number' && !isNaN(result) && isFinite(result)) {
        return Math.round(result * 100) / 100;
      }
      return null;
    } catch {
      return null;
    }
  };

  const handleKeyPress = (val: string) => {
    if (val === 'C') {
      setCurrentInput('');
      setExpression('');
      return;
    }

    if (val === 'BACK') {
      if (currentInput.length > 0) {
        setCurrentInput((prev) => prev.slice(0, -1));
      } else if (expression.length > 0) {
        setExpression((prev) => prev.slice(0, -1));
      }
      return;
    }

    if (val === '=') {
      const fullExpr = expression + (currentInput || '');
      if (!fullExpr) return;
      const res = evaluateMath(fullExpr);
      if (res !== null) {
        setCurrentInput(String(res));
        setExpression('');
      }
      return;
    }

    // Operators (+, −, ×, ÷, %)
    if (['+', '−', '×', '÷', '%'].includes(val)) {
      if (currentInput) {
        setExpression((prev) => prev + currentInput + ' ' + val + ' ');
        setCurrentInput('');
      } else if (expression) {
        // Change last operator
        setExpression((prev) => prev.replace(/\s[+−×÷%]\s$/, ` ${val} `));
      }
      return;
    }

    if (val === '.') {
      if (currentInput.includes('.')) return;
      setCurrentInput((prev) => (prev ? prev + '.' : '0.'));
      return;
    }

    if (val === '00') {
      if (!currentInput || currentInput === '0') return;
      if (currentInput.length >= 8) return;
      setCurrentInput((prev) => prev + '00');
      return;
    }

    // Digits 0-9
    if (currentInput.length >= 8) return;
    if (currentInput === '0' && val !== '.') {
      setCurrentInput(val);
    } else {
      setCurrentInput((prev) => prev + val);
    }
  };

  const getEffectiveCurrentAmount = (): number => {
    if (currentInput) {
      const fullExpr = expression + currentInput;
      const evaluated = evaluateMath(fullExpr);
      return evaluated ?? (parseFloat(currentInput) || 0);
    }
    if (expression) {
      const evaluated = evaluateMath(expression);
      return evaluated ?? 0;
    }
    return 0;
  };

  const handleAddLine = () => {
    const amount = getEffectiveCurrentAmount();
    if (!amount || amount <= 0) return;

    setLines((prev) => [
      ...prev,
      {
        id: `line-${Date.now()}`,
        amount: Math.round(amount * 100) / 100,
        note: currentNote.trim() || `Item ${prev.length + 1}`,
      },
    ]);
    setCurrentInput('');
    setExpression('');
    setCurrentNote('');
  };

  const handleQuickAdd = (amt: number) => {
    setLines((prev) => [
      ...prev,
      {
        id: `line-${Date.now()}`,
        amount: amt,
        note: `Fast ₹${amt}`,
      },
    ]);
  };

  const handleRemoveLine = (id: string) => {
    setLines((prev) => prev.filter((l) => l.id !== id));
  };

  const handleClearAll = () => {
    setLines([]);
    setCurrentInput('');
    setExpression('');
    setCurrentNote('');
  };

  const grandTotal = lines.reduce((s, l) => s + l.amount, 0);
  const pendingAmount = getEffectiveCurrentAmount();
  const effectiveTotal = grandTotal + pendingAmount;

  const handleCompleteSale = async (mode: 'cash' | 'upi' | 'credit', selectedParty?: Party) => {
    let finalLines = [...lines];

    // If an active keypad amount is typed, automatically include it into the bill
    if (pendingAmount > 0) {
      finalLines.push({
        id: `line-${Date.now()}`,
        amount: pendingAmount,
        note: currentNote.trim() || `Item ${finalLines.length + 1}`,
      });
    }

    const total = finalLines.reduce((s, l) => s + l.amount, 0);
    if (total <= 0) return;

    const billNo = `CALC-${Date.now().toString().slice(-6)}`;
    const now = new Date();

    const billData: BillData = {
      restaurantName: profileName || 'NovaPOS Store',
      address: address || 'Hyderabad',
      phone: phone || '9701463241',
      billNo,
      date: now.toLocaleDateString('en-IN'),
      time: now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
      orderType: 'Takeaway',
      customerName: selectedParty?.name || undefined,
      customerPhone: selectedParty?.phone || undefined,
      items: finalLines.map((l) => ({
        name: l.note,
        quantity: 1,
        price: l.amount,
        total: l.amount,
      })),
      subtotal: total,
      cgst: 0,
      sgst: 0,
      total,
      paymentMode: mode === 'credit' ? 'CREDIT (KHATA)' : mode.toUpperCase(),
      upiVpa: upiVpa || 'merchant@upi',
      upiPayload: `upi://pay?pa=${encodeURIComponent(upiVpa || 'merchant@upi')}&pn=${encodeURIComponent(profileName || 'Store')}&am=${total.toFixed(2)}&cu=INR`,
    };

    // 1. Voice audio alert
    speakPaymentAlert(total, mode === 'credit' ? 'Khata' : mode);

    // 2. Thermal receipt printing
    try {
      printReceiptViaBrowser(billData, '58mm');
    } catch {
      // print fallback
    }

    // 3. Log into Day Book
    addDayBookEntry({
      type: 'sale',
      description: `Fast Calculator Sale #${billNo} (${mode.toUpperCase()})`,
      amount: total,
      paymentMode: mode,
      referenceNo: billNo,
    });

    // 4. If Credit/Khata, update customer ledger
    if (mode === 'credit' && selectedParty) {
      recordKhataSale(selectedParty.id, total, billNo);
    }

    setLastBilled({ total, billNo, billData });
    setLines([]);
    setCurrentInput('');
    setExpression('');
    setCurrentNote('');
    setKhataModalOpen(false);

    if (onSaleCompleted) onSaleCompleted(total, mode);
  };

  const handleReprintLastBill = () => {
    if (!lastBilled) return;
    try {
      printReceiptViaBrowser(lastBilled.billData, '58mm');
    } catch {
      // ignore
    }
  };

  const handleQuickAddParty = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newPartyName.trim() || !newPartyPhone.trim()) return;
    const cleanPhone = newPartyPhone.replace(/[^0-9]/g, '').slice(-10);
    if (cleanPhone.length < 10) return;
    const created = upsertParty({
      name: newPartyName.trim(),
      phone: cleanPhone,
      type: 'customer',
      balance: 0,
    });
    setParties(loadParties());
    setNewPartyName('');
    setNewPartyPhone('');
    setShowQuickAddParty(false);
    handleCompleteSale('credit', created);
  };

  const filteredParties = parties
    .filter((p) => p.type === 'customer')
    .filter((p) => {
      if (!partySearch) return true;
      const q = partySearch.toLowerCase();
      return p.name.toLowerCase().includes(q) || p.phone.includes(q);
    });

  return (
    <div className="calculator-screen">
      {/* Sleek Ultra-Compact Top Header Bar */}
      <div className="calc-slim-header">
        {onBack && (
          <button
            onClick={onBack}
            className="calc-slim-back-btn"
            title="Back to Dashboard"
            aria-label="Back to Dashboard"
          >
            <ArrowLeft className="w-4 h-4 mr-1 text-white" />
            <span>Back</span>
          </button>
        )}
        <span className="calc-slim-title">Keypad POS</span>
        {lastBilled ? (
          <button
            onClick={handleReprintLastBill}
            className="calc-slim-last-chip"
            title="Tap to re-print receipt"
          >
            <Printer className="w-3 h-3 mr-1" />
            <span>Last: ₹{lastBilled.total}</span>
          </button>
        ) : (
          <span className="text-[11px] text-indigo-200 font-medium">1-Tap Billing</span>
        )}
      </div>

      <div className="calculator-body">
        {/* Desktop Left / Mobile Collapsible: Added Lines Panel */}
        <div className={`calculator-lines-panel ${showLinesTray ? 'expanded' : ''}`}>
          <div className="calc-lines-header">
            <div className="flex items-center gap-2">
              <h3>Added Lines ({lines.length})</h3>
              <span className="text-xs font-bold text-indigo-600 font-mono">
                ₹{grandTotal.toFixed(2)}
              </span>
            </div>

            <div className="flex items-center gap-2">
              {lines.length > 0 && (
                <button onClick={handleClearAll} className="btn-clear-calc" title="Clear Bill Items">
                  <Trash2 className="w-3.5 h-3.5 mr-1" />
                  Clear All
                </button>
              )}
              {/* Mobile Toggle Lines Tray */}
              <button
                type="button"
                onClick={() => setShowLinesTray(!showLinesTray)}
                className="btn-toggle-tray-mobile"
              >
                {showLinesTray ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="calc-lines-list">
            {lines.length === 0 ? (
              <div className="calc-empty-state">
                <p>No items added yet. Enter amount on keypad & tap "+ Add Line"</p>
              </div>
            ) : (
              lines.map((line, idx) => (
                <div key={line.id} className="calc-line-item">
                  <div className="calc-line-info">
                    <span className="calc-line-idx">{idx + 1}.</span>
                    <span className="calc-line-note">{line.note}</span>
                  </div>
                  <div className="calc-line-right">
                    <span className="calc-line-amount">₹{line.amount.toFixed(2)}</span>
                    <button
                      onClick={() => handleRemoveLine(line.id)}
                      className="btn-del-line"
                      title="Remove item"
                    >
                      ×
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Main Keypad & Display Panel */}
        <div className="calculator-keypad-panel">
          {/* Active Bill Lines Horizontal Chip Strip (Single Row) */}
          {lines.length > 0 && (
            <div className="calc-added-strip">
              <div className="calc-chips-scroll">
                <span className="text-[11px] font-bold text-slate-700 whitespace-nowrap self-center mr-1">
                  Bill ({lines.length}):
                </span>
                {lines.map((l, idx) => (
                  <div key={l.id} className="calc-line-chip">
                    <span className="calc-chip-text">
                      {idx + 1}. {l.note}: <b>₹{l.amount.toFixed(2)}</b>
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemoveLine(l.id)}
                      className="btn-chip-del"
                      title="Remove item"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
              <button type="button" onClick={handleClearAll} className="btn-clear-strip flex-shrink-0">
                Clear
              </button>
            </div>
          )}

          {/* Active Calculation Display Box (Compact & Clean) */}
          <div className="calc-input-box">
            <div className="calc-note-row">
              <input
                type="text"
                placeholder="Note (Milk, Snacks)..."
                value={currentNote}
                onChange={(e) => setCurrentNote(e.target.value)}
                className="calc-note-input"
              />
              {currentNote && (
                <button
                  type="button"
                  onClick={() => setCurrentNote('')}
                  className="text-xs text-slate-400 hover:text-slate-600 px-1"
                >
                  ✕
                </button>
              )}
              <div className="calc-note-presets-row">
                {NOTE_PRESETS.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => setCurrentNote(tag)}
                    className={`calc-note-preset-chip ${currentNote === tag ? 'active' : ''}`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>

            <div className="calc-display-row">
              <div className="calc-expr-line">
                {expression ? <span>{expression}</span> : <span>&nbsp;</span>}
              </div>
              <div className="calc-display">
                <span className="calc-curr">₹</span>
                <span className="calc-digits">
                  {currentInput || (expression ? (evaluateMath(expression) ?? '0') : '0')}
                </span>
              </div>
            </div>
          </div>

          {/* Dedicated High-Visibility Add to Bill Button */}
          <button
            type="button"
            onClick={handleAddLine}
            disabled={!pendingAmount || pendingAmount <= 0}
            className={`btn-primary-add-line ${pendingAmount > 0 ? 'active' : ''}`}
          >
            <Plus className="w-4 h-4 mr-1" />
            <span>
              {pendingAmount > 0
                ? `+ Add ₹${pendingAmount.toFixed(2)} (${currentNote || 'General'}) to Bill`
                : '+ Add Item to Bill'}
            </span>
          </button>

          {/* Quick Cash Rupee Currency Note Chips */}
          <div className="quick-amounts-bar">
            {CASH_PRESETS.map((amt) => (
              <button
                key={amt}
                type="button"
                onClick={() => handleQuickAdd(amt)}
                className="btn-quick-amt"
              >
                +₹{amt}
              </button>
            ))}
          </div>

          {/* Large Tactile 4-Column Touch Numpad (Exact 5 rows) */}
          <div className="numpad-grid">
            <button type="button" onClick={() => handleKeyPress('C')} className="btn-numpad btn-c">
              C
            </button>
            <button type="button" onClick={() => handleKeyPress('BACK')} className="btn-numpad btn-back">
              ⌫
            </button>
            <button type="button" onClick={() => handleKeyPress('%')} className="btn-numpad btn-op">
              %
            </button>
            <button type="button" onClick={() => handleKeyPress('÷')} className="btn-numpad btn-op">
              ÷
            </button>

            <button type="button" onClick={() => handleKeyPress('7')} className="btn-numpad">
              7
            </button>
            <button type="button" onClick={() => handleKeyPress('8')} className="btn-numpad">
              8
            </button>
            <button type="button" onClick={() => handleKeyPress('9')} className="btn-numpad">
              9
            </button>
            <button type="button" onClick={() => handleKeyPress('×')} className="btn-numpad btn-op">
              ×
            </button>

            <button type="button" onClick={() => handleKeyPress('4')} className="btn-numpad">
              4
            </button>
            <button type="button" onClick={() => handleKeyPress('5')} className="btn-numpad">
              5
            </button>
            <button type="button" onClick={() => handleKeyPress('6')} className="btn-numpad">
              6
            </button>
            <button type="button" onClick={() => handleKeyPress('−')} className="btn-numpad btn-op">
              −
            </button>

            <button type="button" onClick={() => handleKeyPress('1')} className="btn-numpad">
              1
            </button>
            <button type="button" onClick={() => handleKeyPress('2')} className="btn-numpad">
              2
            </button>
            <button type="button" onClick={() => handleKeyPress('3')} className="btn-numpad">
              3
            </button>
            <button type="button" onClick={() => handleKeyPress('+')} className="btn-numpad btn-op">
              +
            </button>

            <button type="button" onClick={() => handleKeyPress('0')} className="btn-numpad">
              0
            </button>
            <button type="button" onClick={() => handleKeyPress('00')} className="btn-numpad">
              00
            </button>
            <button type="button" onClick={() => handleKeyPress('.')} className="btn-numpad">
              .
            </button>
            <button type="button" onClick={() => handleKeyPress('=')} className="btn-numpad btn-eq">
              =
            </button>
          </div>
        </div>
      </div>

      {/* Floating Bottom Settlement Bar */}
      <div className="calc-total-bar">
        <div className="calc-total-summary-row">
          <div className="flex flex-col">
            <span className="calc-total-label">
              {lines.length > 0 || pendingAmount > 0
                ? `${lines.length + (pendingAmount > 0 ? 1 : 0)} Items in Bill`
                : 'Single Item Sale'}
            </span>
            <span className="text-xs text-slate-500">
              {effectiveTotal > 0 ? `Total Payable Amount` : `Enter amount above`}
            </span>
          </div>
          <span className="calc-total-val">₹{effectiveTotal.toFixed(2)}</span>
        </div>

        <div className="calc-pay-actions">
          <button
            type="button"
            disabled={effectiveTotal <= 0}
            onClick={() => handleCompleteSale('cash')}
            className="btn-pay-cash"
          >
            <Banknote className="w-5 h-5 mr-1.5" />
            <span>Cash Sale</span>
          </button>

          <button
            type="button"
            disabled={effectiveTotal <= 0}
            onClick={() => handleCompleteSale('upi')}
            className="btn-pay-upi"
          >
            <QrCode className="w-5 h-5 mr-1.5" />
            <span>UPI QR Sale</span>
          </button>

          <button
            type="button"
            disabled={effectiveTotal <= 0}
            onClick={() => setKhataModalOpen(true)}
            className="btn-pay-khata"
            title="Record to Udhar / Khata Book"
          >
            <Users className="w-5 h-5 mr-1.5" />
            <span>Khata (Udhar)</span>
          </button>
        </div>
      </div>

      {/* Credit / Khata Customer Selection Modal */}
      {khataModalOpen && (
        <div className="table-modal-overlay">
          <div className="table-modal" role="dialog" aria-modal="true">
            <div className="modal-header">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-indigo-600" />
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Select Customer for Credit</h3>
                  <p className="text-xs text-slate-500">Record ₹{effectiveTotal.toFixed(2)} to Udhar</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setKhataModalOpen(false)}
                className="btn-close-modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 border-b border-slate-200">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search customer name or phone..."
                  value={partySearch}
                  onChange={(e) => setPartySearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:border-indigo-600"
                />
              </div>

              {/* Quick Add Toggle */}
              <div className="flex items-center justify-between mt-2 pt-1">
                <span className="text-xs font-bold text-slate-600">Customers ({filteredParties.length})</span>
                <button
                  type="button"
                  onClick={() => setShowQuickAddParty(!showQuickAddParty)}
                  className="text-xs font-bold text-indigo-600 hover:text-indigo-800"
                >
                  {showQuickAddParty ? '− Close New Form' : '+ New Customer'}
                </button>
              </div>

              {/* Quick Add Customer Form */}
              {showQuickAddParty && (
                <form onSubmit={handleQuickAddParty} className="mt-2 p-2.5 bg-indigo-50 border border-indigo-200 rounded-lg flex flex-col gap-2">
                  <span className="text-xs font-bold text-indigo-900">+ Add New Customer to Khata</span>
                  <input
                    type="text"
                    required
                    placeholder="Customer Name (e.g. Siva)"
                    value={newPartyName}
                    onChange={(e) => setNewPartyName(e.target.value)}
                    className="p-1.5 border border-slate-300 rounded text-sm bg-white"
                  />
                  <input
                    type="tel"
                    required
                    placeholder="10-digit Mobile (e.g. 9014061654)"
                    value={newPartyPhone}
                    onChange={(e) => setNewPartyPhone(e.target.value)}
                    className="p-1.5 border border-slate-300 rounded text-sm bg-white"
                  />
                  <button
                    type="submit"
                    className="bg-indigo-600 text-white font-bold py-1.5 rounded text-xs hover:bg-indigo-700"
                  >
                    Save & Record ₹{effectiveTotal.toFixed(2)} Credit
                  </button>
                </form>
              )}
            </div>

            <div className="max-h-60 overflow-y-auto p-2 flex flex-col gap-1.5">
              {filteredParties.length === 0 ? (
                <div className="p-4 text-center text-slate-400 text-sm">No customers found</div>
              ) : (
                filteredParties.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleCompleteSale('credit', p)}
                    className="flex items-center justify-between p-2.5 rounded-lg hover:bg-indigo-50 border border-slate-200 text-left transition-colors"
                  >
                    <div>
                      <b className="text-sm text-slate-900 block">{p.name}</b>
                      <span className="text-xs text-slate-500">{p.phone}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-bold block text-slate-700">
                        Due: <span className={p.balance > 0 ? 'text-rose-600' : 'text-emerald-600'}>₹{Math.abs(p.balance).toFixed(2)}</span>
                      </span>
                      <span className="text-[10px] text-indigo-600 font-semibold">Select →</span>
                    </div>
                  </button>
                ))
              )}
            </div>

            <div className="p-3 border-t border-slate-200 flex justify-end">
              <button
                type="button"
                onClick={() => setKhataModalOpen(false)}
                className="btn-cancel"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

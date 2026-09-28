import { useBackHandler } from '../lib/navigation';
import React, { useState } from 'react';
import {
  Users,
  Search,
  Plus,
  Phone,
  ArrowDownLeft,
  ArrowUpRight,
  Share2,
  Calendar,
  FileText,
  X,
  CreditCard,
  Banknote,
  CheckCircle2,
  ArrowLeft,
  Clock,
  QrCode,
} from 'lucide-react';
import {
  Party,
  KhataTransaction,
  loadParties,
  loadTransactions,
  upsertParty,
  recordMoneyIn,
  recordMoneyOut,
  buildWhatsAppReminderUrl,
} from '../lib/khata';
import { TRANSLATIONS, type SupportedLanguage } from '../lib/translations';
import { addDayBookEntry } from '../lib/dayBook';
import { speakPaymentAlert } from '../lib/hardwareBridge';

interface Props {
  language: SupportedLanguage;
  merchantName: string;
  upiVpa: string;
  onBack?: () => void;
}

export const KhataScreen: React.FC<Props> = ({ language, merchantName, upiVpa, onBack }) => {
  const t = TRANSLATIONS[language];
  const [parties, setParties] = useState<Party[]>(loadParties());
  const [activeTab, setActiveTab] = useState<'customer' | 'supplier'>('customer');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedParty, setSelectedParty] = useState<Party | null>(null);

  // Modals
  const [addPartyOpen, setAddPartyOpen] = useState(false);
  const [moneyInOpen, setMoneyInOpen] = useState(false);
  const [moneyOutOpen, setMoneyOutOpen] = useState(false);

  // Form states
  const [newPartyName, setNewPartyName] = useState('');
  const [newPartyPhone, setNewPartyPhone] = useState('');
  const [newPartyBalance, setNewPartyBalance] = useState('');
  const [moneyAmount, setMoneyAmount] = useState('');
  const [moneyMode, setMoneyMode] = useState<'cash' | 'upi'>('cash');
  const [moneyNote, setMoneyNote] = useState('');

  const filteredParties = parties.filter((p) => {
    if (p.type !== activeTab) return false;
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return p.name.toLowerCase().includes(q) || p.phone.includes(q);
  });

  const totalCustomerDues = parties
    .filter((p) => p.type === 'customer' && p.balance > 0)
    .reduce((s, p) => s + p.balance, 0);

  const totalSupplierPayables = parties
    .filter((p) => p.type === 'supplier' && p.balance < 0)
    .reduce((s, p) => s + Math.abs(p.balance), 0);

  const activeTransactions: KhataTransaction[] = selectedParty
    ? loadTransactions(selectedParty.id)
    : [];

  useBackHandler(addPartyOpen || moneyInOpen || moneyOutOpen || Boolean(selectedParty), () => {
    if (moneyInOpen) setMoneyInOpen(false);
    else if (moneyOutOpen) setMoneyOutOpen(false);
    else if (addPartyOpen) setAddPartyOpen(false);
    else setSelectedParty(null);
  });

  const handleCreateParty = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPartyName.trim() || !newPartyPhone.trim()) return;

    const openingDue = parseFloat(newPartyBalance) || 0;
    const created = upsertParty({
      name: newPartyName.trim(),
      phone: newPartyPhone.trim(),
      type: activeTab,
      balance: activeTab === 'customer' ? openingDue : -openingDue,
    });

    setParties(loadParties());
    setSelectedParty(created);
    setAddPartyOpen(false);
    setNewPartyName('');
    setNewPartyPhone('');
    setNewPartyBalance('');
  };

  const handleRecordMoneyIn = () => {
    if (!selectedParty) return;
    const amt = parseFloat(moneyAmount);
    if (!amt || amt <= 0) return;

    const modeLabel = moneyMode === 'upi' ? 'UPI / GPay' : 'CASH';
    const finalNote = moneyNote.trim() || `Payment Received (${modeLabel})`;
    const updated = recordMoneyIn(selectedParty.id, amt, moneyMode, finalNote);
    if (updated) {
      addDayBookEntry({
        type: 'money_in',
        category: 'Khata Payment',
        description: `Received ₹${amt.toFixed(2)} from ${selectedParty.name} (${modeLabel})`,
        amount: amt,
        paymentMode: moneyMode,
      });

      // Voice alert feedback
      speakPaymentAlert(amt, moneyMode === 'cash' ? 'Cash' : 'UPI');

      setParties(loadParties());
      setSelectedParty({ ...updated });
      setMoneyInOpen(false);
      setMoneyAmount('');
      setMoneyNote('');
    }
  };

  const handleRecordMoneyOut = () => {
    if (!selectedParty) return;
    const amt = parseFloat(moneyAmount);
    if (!amt || amt <= 0) return;

    const modeLabel = moneyMode === 'upi' ? 'UPI / Bank' : 'CASH';
    const finalNote = moneyNote.trim() || `Payment Made (${modeLabel})`;
    const updated = recordMoneyOut(selectedParty.id, amt, moneyMode, finalNote);
    if (updated) {
      addDayBookEntry({
        type: 'money_out',
        category: 'Supplier Payment',
        description: `Paid ₹${amt.toFixed(2)} to ${selectedParty.name} (${modeLabel})`,
        amount: amt,
        paymentMode: moneyMode,
      });

      setParties(loadParties());
      setSelectedParty({ ...updated });
      setMoneyOutOpen(false);
      setMoneyAmount('');
      setMoneyNote('');
    }
  };

  const handleSendReminder = (party: Party) => {
    const url = buildWhatsAppReminderUrl(party, merchantName || 'NovaPOS Store', upiVpa);
    window.open(url, '_blank');
  };

  return (
    <div className="khata-screen">
      {/* Top Header with Back Button */}
      <div className="ezo-app-bar">
        {onBack && (
          <button
            onClick={() => {
              if (selectedParty) {
                setSelectedParty(null);
              } else {
                onBack();
              }
            }}
            className="ezo-back-btn"
            title={selectedParty ? 'Back to Parties' : 'Back to Dashboard'}
            aria-label={selectedParty ? 'Back to Parties' : 'Back to Dashboard'}
          >
            <ArrowLeft className="w-6 h-6 text-white stroke-[2.5]" />
            <span>{selectedParty ? 'Parties' : 'Back'}</span>
          </button>
        )}
        <div className="ezo-title-group">
          <h1 className="ezo-bar-title">{selectedParty ? selectedParty.name : 'Party / Khata Book'}</h1>
          <span className="ezo-bar-sub">
            {selectedParty ? `${selectedParty.phone} · Statement & Ledger` : 'Customer Dues, Suppliers & Ledger'}
          </span>
        </div>
      </div>

      {/* Top Banner Stats */}
      <div className="khata-stats-grid">
        <div className="khata-stat-card due-card">
          <span className="stat-card-title">{t.khata.netReceivable}</span>
          <span className="stat-card-num text-rose-400">₹{totalCustomerDues.toFixed(2)}</span>
          <span className="stat-card-sub">
            {parties.filter((p) => p.type === 'customer' && p.balance > 0).length} customers with pending dues
          </span>
        </div>

        <div className="khata-stat-card pay-card">
          <span className="stat-card-title">{t.khata.netPayable}</span>
          <span className="stat-card-num text-amber-400">₹{totalSupplierPayables.toFixed(2)}</span>
          <span className="stat-card-sub">
            {parties.filter((p) => p.type === 'supplier' && p.balance < 0).length} suppliers to pay
          </span>
        </div>
      </div>

      <div className={`khata-layout ${selectedParty ? 'has-selected-party' : 'no-selected-party'}`}>
        {/* Left Column: Party List */}
        <div className="khata-list-panel">
          <div className="khata-filter-bar">
            <div className="party-type-tabs">
              <button
                onClick={() => {
                  setActiveTab('customer');
                  setSelectedParty(null);
                }}
                className={`btn-ptab ${activeTab === 'customer' ? 'active' : ''}`}
              >
                {t.khata.customers}
              </button>
              <button
                onClick={() => {
                  setActiveTab('supplier');
                  setSelectedParty(null);
                }}
                className={`btn-ptab ${activeTab === 'supplier' ? 'active' : ''}`}
              >
                {t.khata.suppliers}
              </button>
            </div>

            <button onClick={() => setAddPartyOpen(true)} className="btn-add-party">
              <Plus className="w-4 h-4 mr-1" />
              + Add Party
            </button>
          </div>

          <div className="khata-search-input">
            <Search className="w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder={t.khata.searchParty}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="parties-scroll-list">
            {filteredParties.length === 0 ? (
              <div className="khata-empty-state">
                <Users className="w-8 h-8 text-slate-500 mb-2" />
                <p>No parties found</p>
              </div>
            ) : (
              filteredParties.map((party) => {
                const isSelected = selectedParty?.id === party.id;
                const hasDues = party.balance > 0;
                return (
                  <div
                    key={party.id}
                    onClick={() => setSelectedParty(party)}
                    className={`party-row ${isSelected ? 'selected' : ''}`}
                  >
                    <div className="party-row-main">
                      <b className="party-row-name">{party.name}</b>
                      <span className="party-row-phone">
                        <Phone className="w-3 h-3 inline mr-1" />
                        {party.phone}
                      </span>
                    </div>

                    <div className="party-row-balance">
                      <span className={`bal-amount ${hasDues ? 'text-rose-400' : 'text-emerald-400'}`}>
                        ₹{Math.abs(party.balance).toFixed(2)}
                      </span>
                      <span className="bal-tag">
                        {party.balance > 0
                          ? t.khata.due
                          : party.balance < 0
                          ? t.khata.advance
                          : 'CLEAR'}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Statement & Ledger History */}
        <div className="khata-detail-panel">
          {selectedParty ? (
            <div className="party-statement-container">
              {/* Mobile Back Button Bar */}
              <div className="mobile-party-back-bar">
                <button
                  onClick={() => setSelectedParty(null)}
                  className="btn-back-parties-mobile"
                >
                  <ArrowLeft className="w-4 h-4 mr-1.5" />
                  <span>← Back to Customers List</span>
                </button>
              </div>

              {/* Party Header Card */}
              <div className="statement-header-card">
                <div className="party-profile-details">
                  <h3>{selectedParty.name}</h3>
                  <p className="party-profile-meta">
                    <Phone className="w-3.5 h-3.5 inline mr-1" />
                    {selectedParty.phone} {selectedParty.address ? `· ${selectedParty.address}` : ''}
                  </p>
                </div>

                <div className="statement-bal-box">
                  <span className="stat-bal-label">{t.khata.balance}:</span>
                  <span
                    className={`stat-bal-val ${
                      selectedParty.balance > 0 ? 'text-rose-500' : 'text-emerald-500'
                    }`}
                  >
                    ₹{Math.abs(selectedParty.balance).toFixed(2)}
                  </span>
                  <span className="stat-bal-sub">
                    {selectedParty.balance > 0
                      ? 'Due Balance'
                      : 'Settled / Advance'}
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="statement-actions-row">
                <button
                  onClick={() => {
                    setMoneyAmount('');
                    setMoneyNote('');
                    setMoneyMode('cash');
                    setMoneyInOpen(true);
                  }}
                  className="btn-khata-action btn-money-in"
                >
                  <ArrowDownLeft className="w-4 h-4 mr-1.5" />
                  + Money In
                </button>

                <button
                  onClick={() => {
                    setMoneyAmount('');
                    setMoneyNote('');
                    setMoneyMode('cash');
                    setMoneyOutOpen(true);
                  }}
                  className="btn-khata-action btn-money-out"
                >
                  <ArrowUpRight className="w-4 h-4 mr-1.5" />
                  + Money Out
                </button>

                {selectedParty.balance > 0 && (
                  <button
                    onClick={() => handleSendReminder(selectedParty)}
                    className="btn-khata-action btn-whatsapp-reminder"
                  >
                    <Share2 className="w-4 h-4 mr-1.5" />
                    WhatsApp Reminder
                  </button>
                )}
              </div>

              {/* Ledger Statement Table */}
              <div className="statement-table-box">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-bold text-slate-800 text-sm flex items-center">
                    <FileText className="w-4 h-4 mr-1.5 text-orange-600" />
                    Ledger Statement ({activeTransactions.length})
                  </h4>
                  <span className="text-[11px] text-slate-500 font-medium">History</span>
                </div>

                <div className="transactions-list">
                  {activeTransactions.length === 0 ? (
                    <p className="no-tx-text">No transactions recorded yet</p>
                  ) : (
                    activeTransactions.map((tx) => {
                      const isDueIncrease = tx.type === 'credit_sale' || tx.type === 'payment_out';
                      return (
                        <div key={tx.id} className="ledger-tx-card">
                          {/* Top Row: Type Badge, Mode Badge, and Amount */}
                          <div className="ledger-tx-header">
                            <div className="ledger-tx-badge-group">
                              <span className={`ledger-type-pill ${isDueIncrease ? 'due' : 'settled'}`}>
                                {tx.type === 'credit_sale'
                                  ? 'Sale (Due Added)'
                                  : tx.type === 'payment_in'
                                  ? 'Money In (Received)'
                                  : tx.type === 'payment_out'
                                  ? 'Money Out (Paid)'
                                  : 'Adjustment'}
                              </span>
                              <span className="ledger-mode-pill">
                                {tx.paymentMode ? tx.paymentMode.toUpperCase() : 'CASH'}
                              </span>
                            </div>

                            <div className={`ledger-amount-box ${isDueIncrease ? 'amount-due' : 'amount-received'}`}>
                              <span className="ledger-amount-val">
                                {isDueIncrease ? '+' : '−'}₹{tx.amount.toFixed(2)}
                              </span>
                            </div>
                          </div>

                          {/* Middle Row: Note / Description */}
                          <div className="ledger-tx-note-row">
                            <span className="ledger-tx-note-text">
                              {tx.notes || (tx.referenceBillNo ? `Bill #${tx.referenceBillNo}` : 'Direct Transaction')}
                            </span>
                          </div>

                          {/* Bottom Row: Date/Time and Running Balance */}
                          <div className="ledger-tx-footer">
                            <span className="ledger-tx-time">
                              <Clock className="w-3 h-3 inline mr-1 text-slate-400" />
                              {tx.date} · {tx.time}
                            </span>
                            <span className="ledger-tx-balance">
                              Balance: <b>₹{Math.abs(tx.balanceAfter).toFixed(2)}</b>{' '}
                              <span className={tx.balanceAfter > 0 ? 'text-rose-500 font-bold' : 'text-emerald-500 font-bold'}>
                                {tx.balanceAfter > 0 ? 'Due' : 'Advance'}
                              </span>
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="no-party-selected">
              <Users className="w-12 h-12 text-slate-600 mb-3" />
              <h3>Select a Party to View Ledger</h3>
              <p>View full transaction history, previous dues and send WhatsApp reminders</p>
            </div>
          )}
        </div>
      </div>

      {/* Add Party Modal */}
      {addPartyOpen && (
        <div className="table-modal-overlay">
          <div className="table-modal">
            <div className="modal-header">
              <h3>{t.khata.addParty}</h3>
              <button onClick={() => setAddPartyOpen(false)} className="btn-close-modal">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreateParty} className="modal-body">
              <div className="form-group">
                <label>Party Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ramesh Reddy"
                  value={newPartyName}
                  onChange={(e) => setNewPartyName(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label>Phone Number *</label>
                <input
                  type="tel"
                  required
                  placeholder="10-digit mobile number"
                  value={newPartyPhone}
                  onChange={(e) => setNewPartyPhone(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label>Opening Due Balance (₹)</label>
                <input
                  type="number"
                  placeholder="0.00 (optional)"
                  value={newPartyBalance}
                  onChange={(e) => setNewPartyBalance(e.target.value)}
                />
              </div>

              <div className="modal-actions-bar">
                <button type="button" onClick={() => setAddPartyOpen(false)} className="btn-cancel">
                  {t.common.cancel}
                </button>
                <button type="submit" className="btn-submit">
                  {t.common.save}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Money In Modal with Distinct Cash / UPI Toggle & Dynamic QR Code */}
      {moneyInOpen && selectedParty && (
        <div className="table-modal-overlay">
          <div className="table-modal money-modal">
            <div className="modal-header">
              <div>
                <h3 className="text-base font-bold text-slate-900">+ Money In (Received)</h3>
                <span className="text-xs text-slate-500">
                  Customer: <b>{selectedParty.name}</b> ({selectedParty.phone})
                </span>
              </div>
              <button onClick={() => setMoneyInOpen(false)} className="btn-close-modal">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="text-xs font-bold text-slate-700">Received Amount (₹) *</label>
                <input
                  type="number"
                  autoFocus
                  required
                  placeholder="0.00"
                  value={moneyAmount}
                  onChange={(e) => setMoneyAmount(e.target.value)}
                  className="money-input text-lg font-bold"
                />
              </div>

              {/* Quick Amount Suggestion Chips */}
              <div className="quick-amounts-bar mb-2">
                {[100, 200, 500, 1000, 2000].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setMoneyAmount(String(amt))}
                    className="btn-quick-amt"
                  >
                    ₹{amt}
                  </button>
                ))}
                {selectedParty.balance > 0 && (
                  <button
                    type="button"
                    onClick={() => setMoneyAmount(String(selectedParty.balance))}
                    className="btn-quick-amt font-black bg-rose-50 text-rose-700 border-rose-300"
                  >
                    Full: ₹{selectedParty.balance}
                  </button>
                )}
              </div>

              {/* Distinct Selectable Payment Mode Buttons */}
              <div className="form-group">
                <label className="text-xs font-bold text-slate-700 mb-1.5 block">Payment Mode</label>
                <div className="payment-mode-pills-row">
                  <button
                    type="button"
                    onClick={() => setMoneyMode('cash')}
                    className={`btn-payment-mode-pill ${moneyMode === 'cash' ? 'active-cash' : ''}`}
                  >
                    <Banknote className="w-4 h-4 mr-1.5 inline" />
                    <span>Cash</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setMoneyMode('upi')}
                    className={`btn-payment-mode-pill ${moneyMode === 'upi' ? 'active-upi' : ''}`}
                  >
                    <QrCode className="w-4 h-4 mr-1.5 inline" />
                    <span>UPI / GPay</span>
                  </button>
                </div>
              </div>

              {/* If UPI / GPay is selected, show Dynamic QR Code and Shop UPI details */}
              {moneyMode === 'upi' && (
                <div className="upi-qr-card-container">
                  <div className="upi-qr-image-wrap">
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(
                        `upi://pay?pa=${upiVpa || 'merchant@upi'}&pn=${encodeURIComponent(
                          merchantName || 'Store'
                        )}&am=${parseFloat(moneyAmount) || ''}&cu=INR`
                      )}`}
                      alt="UPI QR Code"
                      className="upi-qr-img"
                    />
                  </div>
                  <div className="upi-qr-details">
                    <span className="upi-id-text">
                      UPI ID: <b>{upiVpa || 'merchant@upi'}</b>
                    </span>
                    <span className="upi-scan-hint">
                      {parseFloat(moneyAmount) > 0
                        ? `Customer can scan this QR to pay ₹${parseFloat(moneyAmount).toFixed(2)} via GPay / PhonePe / Paytm`
                        : 'Customer can scan to pay via any UPI App'}
                    </span>
                    <div className="upi-paid-badge">
                      ✓ Paid via UPI / PhonePe / GPay? Tap Confirm below
                    </div>
                  </div>
                </div>
              )}

              <div className="form-group">
                <label className="text-xs font-bold text-slate-700">Notes (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Cleared bill / Google Pay / Cash at counter"
                  value={moneyNote}
                  onChange={(e) => setMoneyNote(e.target.value)}
                  className="p-2 border border-slate-300 rounded-lg text-sm"
                />
              </div>

              <div className="modal-actions-bar">
                <button type="button" onClick={() => setMoneyInOpen(false)} className="btn-cancel">
                  {t.common.cancel}
                </button>
                <button
                  type="button"
                  onClick={handleRecordMoneyIn}
                  disabled={!parseFloat(moneyAmount)}
                  className="btn-submit"
                >
                  Confirm Received
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Money Out Modal */}
      {moneyOutOpen && selectedParty && (
        <div className="table-modal-overlay">
          <div className="table-modal money-modal">
            <div className="modal-header">
              <div>
                <h3 className="text-base font-bold text-slate-900">+ Money Out (Paid)</h3>
                <span className="text-xs text-slate-500">
                  Party: <b>{selectedParty.name}</b> ({selectedParty.phone})
                </span>
              </div>
              <button onClick={() => setMoneyOutOpen(false)} className="btn-close-modal">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="text-xs font-bold text-slate-700">Paid Amount (₹) *</label>
                <input
                  type="number"
                  autoFocus
                  required
                  placeholder="0.00"
                  value={moneyAmount}
                  onChange={(e) => setMoneyAmount(e.target.value)}
                  className="money-input text-lg font-bold"
                />
              </div>

              <div className="form-group">
                <label className="text-xs font-bold text-slate-700 mb-1.5 block">Payment Mode</label>
                <div className="payment-mode-pills-row">
                  <button
                    type="button"
                    onClick={() => setMoneyMode('cash')}
                    className={`btn-payment-mode-pill ${moneyMode === 'cash' ? 'active-cash' : ''}`}
                  >
                    <Banknote className="w-4 h-4 mr-1.5 inline" />
                    <span>Cash</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setMoneyMode('upi')}
                    className={`btn-payment-mode-pill ${moneyMode === 'upi' ? 'active-upi' : ''}`}
                  >
                    <CreditCard className="w-4 h-4 mr-1.5 inline" />
                    <span>UPI / Bank</span>
                  </button>
                </div>
              </div>

              <div className="form-group">
                <label className="text-xs font-bold text-slate-700">Notes (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Paid for inventory purchase / vendor advance"
                  value={moneyNote}
                  onChange={(e) => setMoneyNote(e.target.value)}
                  className="p-2 border border-slate-300 rounded-lg text-sm"
                />
              </div>

              <div className="modal-actions-bar">
                <button type="button" onClick={() => setMoneyOutOpen(false)} className="btn-cancel">
                  {t.common.cancel}
                </button>
                <button
                  type="button"
                  onClick={handleRecordMoneyOut}
                  disabled={!parseFloat(moneyAmount)}
                  className="btn-submit"
                >
                  Confirm Paid
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * Customer & Vendor Khata Book (Party Ledger & Credit Management)
 * Handles customer credit, previous dues, money in/out,
 * and WhatsApp reminder message generation.
 */

export interface Party {
  id: string;
  name: string;
  phone: string;
  type: 'customer' | 'supplier';
  balance: number; // positive = customer owes merchant; negative = advance
  creditLimit?: number;
  address?: string;
  gstin?: string;
  isFavorite?: boolean;
  createdAt: string;
}

export interface KhataTransaction {
  id: string;
  partyId: string;
  type: 'credit_sale' | 'payment_in' | 'payment_out' | 'sale_return';
  amount: number;
  balanceAfter: number;
  date: string;
  time: string;
  referenceBillNo?: string;
  paymentMode?: string;
  notes?: string;
}

const PARTIES_STORAGE_KEY = 'novapos:khata_parties';
const TXS_STORAGE_KEY = 'novapos:khata_transactions';

const INITIAL_PARTIES: Party[] = [
  {
    id: 'p-1',
    name: 'Ramesh Reddy',
    phone: '9848012345',
    type: 'customer',
    balance: 450,
    creditLimit: 2000,
    address: 'Madhapur, Hyderabad',
    isFavorite: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'p-2',
    name: 'Suresh Kumar',
    phone: '9988776655',
    type: 'customer',
    balance: 1250,
    creditLimit: 5000,
    address: 'Kukatpally, Hyderabad',
    isFavorite: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'p-3',
    name: 'Sri Krishna Dairy (Supplier)',
    phone: '9440011223',
    type: 'supplier',
    balance: -3200, // We owe supplier 3200
    address: 'Secunderabad',
    isFavorite: false,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'p-4',
    name: 'Venkata Rao (Kirana regular)',
    phone: '9701463241',
    type: 'customer',
    balance: 280,
    creditLimit: 1500,
    address: 'Ameerpet, Hyderabad',
    isFavorite: true,
    createdAt: new Date().toISOString(),
  },
];

export function loadParties(): Party[] {
  try {
    const raw = localStorage.getItem(PARTIES_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(PARTIES_STORAGE_KEY, JSON.stringify(INITIAL_PARTIES));
      return INITIAL_PARTIES;
    }
    return JSON.parse(raw);
  } catch {
    return INITIAL_PARTIES;
  }
}

export function saveParties(parties: Party[]): void {
  try {
    localStorage.setItem(PARTIES_STORAGE_KEY, JSON.stringify(parties));
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('Failed to save parties', e);
  }
}

export function loadTransactions(partyId?: string): KhataTransaction[] {
  try {
    const raw = localStorage.getItem(TXS_STORAGE_KEY);
    const all: KhataTransaction[] = raw ? JSON.parse(raw) : [];
    if (partyId) {
      return all.filter((t) => t.partyId === partyId).sort((a, b) => b.time.localeCompare(a.time));
    }
    return all.sort((a, b) => b.time.localeCompare(a.time));
  } catch {
    return [];
  }
}

export function saveTransactions(txs: KhataTransaction[]): void {
  try {
    localStorage.setItem(TXS_STORAGE_KEY, JSON.stringify(txs));
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('Failed to save transactions', e);
  }
}

export function findPartyByPhone(phone: string): Party | undefined {
  const clean = phone.replace(/[^0-9]/g, '').slice(-10);
  if (!clean || clean.length < 5) return undefined;
  const parties = loadParties();
  return parties.find((p) => p.phone.replace(/[^0-9]/g, '').slice(-10) === clean);
}

export function upsertParty(party: Partial<Party> & { name: string; phone: string }): Party {
  const parties = loadParties();
  const cleanPhone = party.phone.replace(/[^0-9]/g, '').slice(-10);
  const existingIdx = parties.findIndex((p) => p.phone.replace(/[^0-9]/g, '').slice(-10) === cleanPhone);

  if (existingIdx >= 0) {
    const updated: Party = {
      ...parties[existingIdx],
      ...party,
    };
    parties[existingIdx] = updated;
    saveParties(parties);
    return updated;
  }

  const newParty: Party = {
    id: `party-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name: party.name,
    phone: party.phone,
    type: party.type || 'customer',
    balance: party.balance || 0,
    creditLimit: party.creditLimit || 5000,
    address: party.address || '',
    gstin: party.gstin || '',
    isFavorite: party.isFavorite || false,
    createdAt: new Date().toISOString(),
  };
  parties.push(newParty);
  saveParties(parties);
  return newParty;
}

export function recordKhataSale(partyId: string, amount: number, billNo: string): Party | null {
  const parties = loadParties();
  const party = parties.find((p) => p.id === partyId);
  if (!party) return null;

  party.balance += amount;
  saveParties(parties);

  const txs = loadTransactions();
  const now = new Date();
  const newTx: KhataTransaction = {
    id: `tx-${Date.now()}`,
    partyId,
    type: 'credit_sale',
    amount,
    balanceAfter: party.balance,
    date: now.toLocaleDateString('en-IN'),
    time: now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
    referenceBillNo: billNo,
    notes: `Credit Sale Bill #${billNo}`,
  };
  txs.unshift(newTx);
  saveTransactions(txs);
  return party;
}

export function recordMoneyIn(partyId: string, amount: number, paymentMode = 'cash', notes = ''): Party | null {
  const parties = loadParties();
  const party = parties.find((p) => p.id === partyId);
  if (!party) return null;

  party.balance -= amount;
  saveParties(parties);

  const txs = loadTransactions();
  const now = new Date();
  const newTx: KhataTransaction = {
    id: `tx-${Date.now()}`,
    partyId,
    type: 'payment_in',
    amount,
    balanceAfter: party.balance,
    date: now.toLocaleDateString('en-IN'),
    time: now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
    paymentMode,
    notes: notes || `Received payment (${paymentMode.toUpperCase()})`,
  };
  txs.unshift(newTx);
  saveTransactions(txs);
  return party;
}

export function recordMoneyOut(partyId: string, amount: number, paymentMode = 'cash', notes = ''): Party | null {
  const parties = loadParties();
  const party = parties.find((p) => p.id === partyId);
  if (!party) return null;

  party.balance += amount; // We paid supplier, reducing our payable
  saveParties(parties);

  const txs = loadTransactions();
  const now = new Date();
  const newTx: KhataTransaction = {
    id: `tx-${Date.now()}`,
    partyId,
    type: 'payment_out',
    amount,
    balanceAfter: party.balance,
    date: now.toLocaleDateString('en-IN'),
    time: now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
    paymentMode,
    notes: notes || `Payment Made (${paymentMode.toUpperCase()})`,
  };
  txs.unshift(newTx);
  saveTransactions(txs);
  return party;
}

/**
 * Generate formatted WhatsApp Payment Reminder Message
 */
export function buildWhatsAppReminderUrl(
  party: Party,
  merchantName: string,
  upiId?: string,
): string {
  const phone = party.phone.replace(/[^0-9]/g, '');
  const cleanPhone = phone.length === 10 ? `91${phone}` : phone;
  const balance = Math.abs(party.balance);

  const text = `Dear ${party.name},\n\nPayment Reminder from ${merchantName}:\nYour pending due balance is: *₹${balance.toFixed(2)}*\n\nPlease clear the dues via UPI to:\nUPI ID: *${upiId || 'merchant@upi'}*\n\nThank you! - ${merchantName}`;

  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`;
}

/**
 * Generate formatted WhatsApp Bill Share Message
 */
export function buildWhatsAppBillUrl(
  phone: string,
  customerName: string,
  billNo: string,
  total: number,
  items: { name: string; quantity: number; price: number }[],
  balance: number,
  merchantName: string,
): string {
  const clean = phone.replace(/[^0-9]/g, '');
  const cleanPhone = clean.length === 10 ? `91${clean}` : clean;

  const itemLines = items.map((i) => `• ${i.name} x ${i.quantity} = ₹${(i.price * i.quantity).toFixed(2)}`).join('\n');

  const text = `💐 *${merchantName}* - Invoice 💐\nBill No: *${billNo}*\nDate: ${new Date().toLocaleDateString('en-IN')}\nCustomer: ${customerName || 'Customer'}\n\n*Items:*\n${itemLines}\n\n*Grand Total:* *₹${total.toFixed(2)}*${balance > 0 ? `\n(Current Due Balance: *₹${balance.toFixed(2)}*)` : ''}\n\nThank you for shopping with us! Please visit again.`;

  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`;
}

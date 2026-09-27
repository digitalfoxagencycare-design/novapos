/**
 * Day Book & End-of-Day / Z-Report (Cut-Off Day / Cash Drawer Reconciliation)
 * Tracks cash flows, petty expenses, daily closing tally, and variance.
 */

import { financialYear, type Uom } from './business';

export interface DayBookEntry {
  id: string;
  timestamp: string;
  type: 'sale' | 'money_in' | 'money_out' | 'expense' | 'opening_cash';
  category?: string; // 'Tea', 'Milk', 'Salaries', 'Customer Payment', etc.
  description: string;
  amount: number;
  paymentMode: 'cash' | 'upi' | 'card' | 'credit';
  referenceNo?: string;
  lines?: { itemId: string; name: string; category: string; price: number; quantity: number; uom: Uom }[];
}

export interface DayClosingReport {
  id: string;
  date: string;
  closedAt: string;
  cashierName: string;
  openingCash: number;
  totalSales: number;
  cashSales: number;
  upiSales: number;
  cardSales: number;
  creditSales: number;
  moneyInCash: number;
  moneyOutCash: number;
  expensesCash: number;
  expectedDrawerCash: number;
  actualCountedCash: number;
  variance: number; // positive = surplus, negative = shortage
  billsCount: number;
  notes?: string;
}

const DAYBOOK_STORAGE_KEY = 'novapos:daybook_entries';
const CLOSING_STORAGE_KEY = 'novapos:daybook_closings';
const OPENING_CASH_KEY = 'novapos:opening_cash';

export function getOpeningCash(): number {
  return Number(localStorage.getItem(OPENING_CASH_KEY) || '1000');
}

export function setOpeningCash(amount: number): void {
  localStorage.setItem(OPENING_CASH_KEY, String(amount));
}

export function generateSeedDayBookEntries(): DayBookEntry[] {
  const customerNames = [
    'Ramesh Kumar', 'Suresh Reddy', 'Venkatesh Rao', 'Anitha Devi', 'Pooja Sharma',
    'Rajesh Verma', 'Laxmi Narayana', 'Kiran Kumar', 'Sai Teja', 'Deepak Jain',
    'Naveen Goud', 'Pradeep V', 'Bhavani Shankar', 'Madhavi Latha', 'Kalyan Chakravarthy',
    'Sunil Dutt', 'Meenakshi Sundaram', 'Raghu Ram', 'Gopal Krishna', 'Harish Babu'
  ];

  const sampleProducts = [
    { itemId: 'preset:kirana:0', name: 'Sona Masoori Rice (1kg)', category: 'Rice & Staples', price: 62.00, uom: 'kg' as Uom },
    { itemId: 'preset:kirana:2', name: 'Toor Dal Desi (1kg)', category: 'Rice & Staples', price: 165.00, uom: 'kg' as Uom },
    { itemId: 'preset:kirana:6', name: 'Aashirvaad Shudh Chakki Atta (5kg)', category: 'Flour & Atta', price: 245.00, uom: 'pack' as Uom },
    { itemId: 'preset:kirana:9', name: 'Crystal Sugar (1kg)', category: 'Sugar & Salt', price: 48.00, uom: 'kg' as Uom },
    { itemId: 'preset:kirana:11', name: 'Freedom Refined Sunflower Oil (1L)', category: 'Edible Oils', price: 142.00, uom: 'pack' as Uom },
    { itemId: 'preset:kirana:13', name: 'Vijaya Pure Cow Ghee (500ml)', category: 'Dairy & Ghee', price: 340.00, uom: 'pack' as Uom },
    { itemId: 'preset:kirana:14', name: 'Amul Taaza Toned Milk (500ml)', category: 'Dairy & Ghee', price: 27.00, uom: 'pack' as Uom },
    { itemId: 'preset:kirana:23', name: 'Red Label Tea (250g)', category: 'Beverages', price: 130.00, uom: 'pack' as Uom },
    { itemId: 'preset:kirana:28', name: 'Maggi 2-Minute Noodles (70g)', category: 'Snacks & Biscuits', price: 14.00, uom: 'pack' as Uom },
    { itemId: 'preset:kirana:30', name: 'Britannia Good Day Butter (120g)', category: 'Snacks & Biscuits', price: 30.00, uom: 'pack' as Uom },
    { itemId: 'preset:kirana:34', name: 'Lifebuoy Total Soap Bar (100g)', category: 'Personal & Home Care', price: 36.00, uom: 'pcs' as Uom },
    { itemId: 'preset:kirana:38', name: 'Surf Excel Quick Wash Powder (1kg)', category: 'Personal & Home Care', price: 145.00, uom: 'pack' as Uom }
  ];

  const paymentModes: ('cash' | 'upi' | 'card' | 'credit')[] = ['cash', 'upi', 'upi', 'cash', 'card', 'credit'];
  const entries: DayBookEntry[] = [];
  const now = new Date();

  // Generate 100 sales invoices spread across past 14 days + today
  let invoiceSeq = 101;
  for (let i = 0; i < 100; i++) {
    const daysAgo = i < 35 ? 0 : i < 65 ? 1 : i < 85 ? Math.floor(Math.random() * 5) + 2 : Math.floor(Math.random() * 8) + 7;
    const date = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
    // Randomize time of day between 8:00 AM and 10:00 PM
    const hours = 8 + Math.floor(Math.random() * 14);
    const minutes = Math.floor(Math.random() * 60);
    date.setHours(hours, minutes, 0, 0);

    const mode = paymentModes[i % paymentModes.length];
    const cust = customerNames[i % customerNames.length];
    
    // Pick 1 to 4 random lines
    const lineCount = 1 + (i % 4);
    const lines: { itemId: string; name: string; category: string; price: number; quantity: number; uom: Uom }[] = [];
    let billTotal = 0;

    for (let k = 0; k < lineCount; k++) {
      const prod = sampleProducts[(i * 3 + k) % sampleProducts.length];
      const qty = prod.uom === 'kg' ? (1 + (k % 3)) : (1 + (k % 4));
      const lineAmt = prod.price * qty;
      billTotal += lineAmt;
      lines.push({
        itemId: prod.itemId,
        name: prod.name,
        category: prod.category,
        price: prod.price,
        quantity: qty,
        uom: prod.uom
      });
    }

    const billNo = `VM-T1-${financialYear(date)}-${String(invoiceSeq++).padStart(5, '0')}`;
    entries.push({
      id: `db-seed-${i}-${date.getTime()}`,
      timestamp: date.toISOString(),
      type: 'sale',
      category: 'Sales',
      description: `Sale Bill #${billNo} (${cust})`,
      amount: Math.round(billTotal),
      paymentMode: mode,
      referenceNo: billNo,
      lines
    });
  }

  // Add realistic expenses
  const expenseCategories = ['Shop Electricity', 'Tea & Refreshments', 'Shop Staff Salary Advance', 'Packaging Bags & Rolls', 'Store Cleaning Supplies', 'Drinking Water Cans'];
  for (let e = 0; e < 12; e++) {
    const daysAgo = e < 3 ? 0 : e < 7 ? 1 : Math.floor(Math.random() * 10) + 2;
    const date = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
    date.setHours(11 + e, 30, 0, 0);
    entries.push({
      id: `db-exp-${e}`,
      timestamp: date.toISOString(),
      type: 'expense',
      category: expenseCategories[e % expenseCategories.length],
      description: `Store Expense: ${expenseCategories[e % expenseCategories.length]}`,
      amount: [150, 450, 1200, 280, 500, 180][e % 6],
      paymentMode: 'cash'
    });
  }

  // Add realistic Money In (customer dues collected) & Money Out
  for (let m = 0; m < 8; m++) {
    const daysAgo = m < 3 ? 0 : Math.floor(Math.random() * 7) + 1;
    const date = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
    date.setHours(16 + (m % 4), 15, 0, 0);
    entries.push({
      id: `db-money-in-${m}`,
      timestamp: date.toISOString(),
      type: 'money_in',
      category: 'Customer Udhar Payment',
      description: `Udhar recovery from ${customerNames[m % customerNames.length]}`,
      amount: [500, 1200, 850, 2000, 650, 1500, 950, 3000][m],
      paymentMode: m % 2 === 0 ? 'cash' : 'upi'
    });
  }

  // Sort descending by timestamp
  return entries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

export function loadDayBookEntries(): DayBookEntry[] {
  try {
    const raw = localStorage.getItem(DAYBOOK_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length >= 20) {
        return parsed;
      }
    }
    // Auto-seed rich 100+ invoices if empty or fresh
    const seeded = generateSeedDayBookEntries();
    localStorage.setItem(DAYBOOK_STORAGE_KEY, JSON.stringify(seeded));
    return seeded;
  } catch {
    return generateSeedDayBookEntries();
  }
}

export function addDayBookEntry(entry: Omit<DayBookEntry, 'id' | 'timestamp'>): DayBookEntry {
  const all = loadDayBookEntries();
  const created: DayBookEntry = {
    ...entry,
    id: `db-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp: new Date().toISOString(),
  };
  all.unshift(created);
  try {
    localStorage.setItem(DAYBOOK_STORAGE_KEY, JSON.stringify(all));
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('Failed to save daybook entry', e);
    throw new Error('Bill could not be saved. Free device storage and try again.');
  }
  return created;
}

export function filterEntriesByPeriod<T extends { timestamp: string }>(
  entries: T[],
  period: 'today' | 'yesterday' | 'week' | 'month' | 'all' | 'custom',
  customRangeOrNow?: { start?: string; end?: string } | Date,
  nowArg = new Date()
): T[] {
  let now = nowArg;
  let customRange: { start?: string; end?: string } | undefined;

  if (customRangeOrNow instanceof Date) {
    now = customRangeOrNow;
  } else if (customRangeOrNow && typeof customRangeOrNow === 'object') {
    customRange = customRangeOrNow;
  }

  if (period === 'custom' && customRange) {
    const startTime = customRange.start ? new Date(customRange.start).setHours(0, 0, 0, 0) : 0;
    const endTime = customRange.end ? new Date(customRange.end).setHours(23, 59, 59, 999) : Infinity;
    return entries.filter(entry => {
      const time = new Date(entry.timestamp).getTime();
      return time >= startTime && time <= endTime;
    });
  }
  if (period === 'yesterday') {
    const yStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 0, 0, 0, 0);
    const yEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 23, 59, 59, 999);
    return entries.filter(entry => {
      const time = new Date(entry.timestamp).getTime();
      return time >= yStart.getTime() && time <= yEnd.getTime();
    });
  }
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (period === 'week') start.setDate(start.getDate() - 6);
  if (period === 'month') start.setDate(1);
  return entries.filter(entry => {
    const time = new Date(entry.timestamp).getTime();
    return time <= now.getTime() && (period === 'all' || time >= start.getTime());
  });
}

export function nextInvoiceNumber(now = new Date()): string {
  const prefix = `VM-T1-${financialYear(now)}-`;
  const current = loadDayBookEntries().reduce((max, entry) => {
    const value = entry.referenceNo?.startsWith(prefix) ? Number(entry.referenceNo.slice(prefix.length)) : 0;
    return Number.isFinite(value) ? Math.max(max, value) : max;
  }, 0);
  if (current >= 99999) throw new Error('Invoice sequence exhausted. Configure a new terminal series.');
  return `${prefix}${String(current + 1).padStart(5, '0')}`;
}

export function loadClosings(): DayClosingReport[] {
  try {
    const raw = localStorage.getItem(CLOSING_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveDayClosing(report: DayClosingReport): void {
  const closings = loadClosings();
  closings.unshift(report);
  try {
    localStorage.setItem(CLOSING_STORAGE_KEY, JSON.stringify(closings));
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('Failed to save closing', e);
  }
}

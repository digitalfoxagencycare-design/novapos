/**
 * Restaurant & Cafe Floor Management: AC & Non-AC Tables, Table Statuses,
 * KOT Generation, and Kitchen Dispatch.
 */

export interface RestaurantTable {
  id: string;
  name: string;
  section: 'AC' | 'Non-AC' | 'Parcel' | 'Rooftop';
  capacity: number;
  status: 'vacant' | 'occupied' | 'billed';
  activeOrder?: TableOrder;
}

export interface TableOrderLine {
  id: string;
  itemId: string;
  name: string;
  category: string;
  price: number;
  quantity: number;
  uom: string;
  isVeg: boolean;
  notes?: string;
  isFiredToKot?: boolean;
}

export interface KotRecord {
  kotNo: string;
  time: string;
  tableNo: string;
  waiterName?: string;
  items: { name: string; quantity: number; notes?: string }[];
}

export interface TableOrder {
  orderId: string;
  tableNo: string;
  waiterName: string;
  customerName?: string;
  customerPhone?: string;
  seatedAt: string;
  lines: TableOrderLine[];
  kots: KotRecord[];
}

const TABLES_STORAGE_KEY = 'novapos:restaurant_tables';
const KOT_COUNTER_KEY = 'novapos:kot_counter';

export function getNextKotNumber(): string {
  const current = Number(localStorage.getItem(KOT_COUNTER_KEY) || '100');
  const next = current + 1;
  localStorage.setItem(KOT_COUNTER_KEY, String(next));
  return `KOT-${next}`;
}

const INITIAL_TABLES: RestaurantTable[] = [
  // AC Section
  { id: 'ac-1', name: 'AC-1', section: 'AC', capacity: 4, status: 'vacant' },
  { id: 'ac-2', name: 'AC-2', section: 'AC', capacity: 4, status: 'vacant' },
  { id: 'ac-3', name: 'AC-3', section: 'AC', capacity: 6, status: 'vacant' },
  { id: 'ac-4', name: 'AC-4', section: 'AC', capacity: 2, status: 'vacant' },
  { id: 'ac-5', name: 'AC-5', section: 'AC', capacity: 8, status: 'vacant' },
  // Non-AC Section
  { id: 'nonac-1', name: 'T-1', section: 'Non-AC', capacity: 4, status: 'vacant' },
  { id: 'nonac-2', name: 'T-2', section: 'Non-AC', capacity: 4, status: 'vacant' },
  { id: 'nonac-3', name: 'T-3', section: 'Non-AC', capacity: 4, status: 'vacant' },
  { id: 'nonac-4', name: 'T-4', section: 'Non-AC', capacity: 6, status: 'vacant' },
  { id: 'nonac-5', name: 'T-5', section: 'Non-AC', capacity: 6, status: 'vacant' },
  { id: 'nonac-6', name: 'T-6', section: 'Non-AC', capacity: 2, status: 'vacant' },
  // Parcel / Takeaway Section
  { id: 'p-1', name: 'Parcel-1', section: 'Parcel', capacity: 1, status: 'vacant' },
  { id: 'p-2', name: 'Parcel-2', section: 'Parcel', capacity: 1, status: 'vacant' },
];

export function loadTables(): RestaurantTable[] {
  try {
    const raw = localStorage.getItem(TABLES_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(TABLES_STORAGE_KEY, JSON.stringify(INITIAL_TABLES));
      return INITIAL_TABLES;
    }
    return JSON.parse(raw);
  } catch {
    return INITIAL_TABLES;
  }
}

export function saveTables(tables: RestaurantTable[]): void {
  try {
    localStorage.setItem(TABLES_STORAGE_KEY, JSON.stringify(tables));
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('Failed to save tables', e);
  }
}

export function occupyTable(
  tableId: string,
  waiterName = 'Captain',
  customerName = '',
  customerPhone = '',
): RestaurantTable | null {
  const tables = loadTables();
  const table = tables.find((t) => t.id === tableId);
  if (!table) return null;

  table.status = 'occupied';
  table.activeOrder = {
    orderId: `ord-${Date.now()}`,
    tableNo: table.name,
    waiterName,
    customerName,
    customerPhone,
    seatedAt: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
    lines: [],
    kots: [],
  };
  saveTables(tables);
  return table;
}

export function fireKotForTable(tableId: string): { table: RestaurantTable; kot: KotRecord | null } | null {
  const tables = loadTables();
  const table = tables.find((t) => t.id === tableId);
  if (!table || !table.activeOrder) return null;

  // Unfired lines
  const unfiredLines = table.activeOrder.lines.filter((l) => !l.isFiredToKot);
  if (unfiredLines.length === 0) {
    return { table, kot: null };
  }

  const kotNo = getNextKotNumber();
  const kot: KotRecord = {
    kotNo,
    time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
    tableNo: table.name,
    waiterName: table.activeOrder.waiterName,
    items: unfiredLines.map((l) => ({
      name: l.name,
      quantity: l.quantity,
      notes: l.notes,
    })),
  };

  // Mark lines as fired
  unfiredLines.forEach((l) => {
    l.isFiredToKot = true;
  });
  table.activeOrder.kots.push(kot);

  saveTables(tables);
  return { table, kot };
}

export function freeTable(tableId: string): void {
  const tables = loadTables();
  const table = tables.find((t) => t.id === tableId);
  if (table) {
    table.status = 'vacant';
    delete table.activeOrder;
    saveTables(tables);
  }
}

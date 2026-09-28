import { cloudApi } from './cloudSession';
import {
  addDayBookEntry,
  loadDayBookEntries,
  saveDayBookEntries,
  updateDayBookEntry,
  type DayBookEntry,
} from './dayBook';

const PENDING_SYNC_KEY = 'novapos:pending_cloud_sales';

function getPendingIds(): string[] {
  try {
    const raw = localStorage.getItem(PENDING_SYNC_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function setPendingIds(ids: string[]): void {
  try {
    localStorage.setItem(PENDING_SYNC_KEY, JSON.stringify([...new Set(ids)]));
  } catch {
    // ignore
  }
}

function extractCustomerName(description?: string): string | undefined {
  if (!description) return undefined;
  const match = description.match(/\(([^)]+)\)/);
  if (match && match[1] && match[1] !== 'Walk-in' && !match[1].startsWith('CASH') && !match[1].startsWith('UPI')) {
    return match[1].trim();
  }
  return undefined;
}

/**
 * Uploads a single daybook sale entry to the cloud API.
 */
export async function syncSaleEntry(entry: DayBookEntry): Promise<boolean> {
  if (!cloudApi.isAuthenticated) return false;
  if (entry.type !== 'sale') return true; // only sales map to cloud orders for now

  try {
    const payload = {
      clientOrderId: entry.id,
      orderNumber: entry.referenceNo || `ORD-${entry.id}`,
      invoiceNumber: entry.referenceNo,
      amount: entry.amount,
      paymentMode: entry.paymentMode,
      customerName: extractCustomerName(entry.description),
      notes: entry.description,
      taxSnapshot: entry.taxSnapshot,
      receiptSnapshot: entry.receiptSnapshot,
      lines: entry.lines?.map((l) => ({
        itemId: l.itemId,
        name: l.name,
        quantity: l.quantity,
        price: l.price,
        uom: l.uom,
        gstRate: l.gstRate,
        netMinor: l.netMinor,
      })),
      placedAt: entry.timestamp,
    };

    const res = await cloudApi.recordPosSale(payload);
    if (res && res.id) {
      updateDayBookEntry(entry.id, { synced: true, cloudOrderId: res.id });
      const pending = getPendingIds().filter((id) => id !== entry.id);
      setPendingIds(pending);
      return true;
    }
    return false;
  } catch (err) {
    console.warn(`[CloudSync] Failed to sync sale ${entry.id}:`, (err as Error).message);
    return false;
  }
}

/**
 * Primary point of sale recording.
 * Saves locally first (offline-first resilience), then dispatches async cloud sync.
 */
export function recordSale(entry: Omit<DayBookEntry, 'id' | 'timestamp'>): DayBookEntry {
  const created = addDayBookEntry({
    ...entry,
    synced: false,
  });

  const pending = getPendingIds();
  pending.push(created.id);
  setPendingIds(pending);

  // Trigger background cloud sync immediately if online
  if (navigator.onLine && cloudApi.isAuthenticated) {
    void syncSaleEntry(created).catch(() => undefined);
  }

  return created;
}

/**
 * Flush all pending offline sales to the cloud database and pull down remote sales.
 */
export async function syncPendingSales(): Promise<{ uploaded: number; downloaded: number }> {
  if (!navigator.onLine || !cloudApi.isAuthenticated) {
    return { uploaded: 0, downloaded: 0 };
  }

  let uploaded = 0;
  let downloaded = 0;

  // 1. Flush local unsynced entries
  const allEntries = loadDayBookEntries();
  const pendingSet = new Set(getPendingIds());

  // Also include any sales in daybook marked synced !== true
  for (const entry of allEntries) {
    if (entry.type === 'sale' && !entry.synced) {
      pendingSet.add(entry.id);
    }
  }

  for (const id of pendingSet) {
    const entry = allEntries.find((e) => e.id === id);
    if (entry) {
      const ok = await syncSaleEntry(entry);
      if (ok) uploaded++;
    }
  }

  // 2. Pull remote sales to ensure consistency across multiple devices / sessions
  const outletId = cloudApi.sessionScope?.outletId;
  if (outletId) {
    try {
      const remoteSales = await cloudApi.salesHistory(outletId, 100);
      if (Array.isArray(remoteSales) && remoteSales.length > 0) {
        const currentEntries = loadDayBookEntries();
        const existingOrderIds = new Set(
          currentEntries.map((e) => e.cloudOrderId).filter(Boolean),
        );
        const existingRefNos = new Set(
          currentEntries.map((e) => e.referenceNo).filter(Boolean),
        );
        const existingClientIds = new Set(
          currentEntries.map((e) => e.id),
        );

        let hasNew = false;
        for (const order of remoteSales) {
          if (
            existingOrderIds.has(order.id) ||
            (order.clientOrderId && existingClientIds.has(order.clientOrderId)) ||
            (order.invoiceNumber && existingRefNos.has(order.invoiceNumber))
          ) {
            continue;
          }

          // Map remote order to local daybook entry
          const payMode = (order.payments?.[0]?.method || 'CASH').toLowerCase() as any;
          const mappedMode = ['cash', 'upi', 'card', 'credit'].includes(payMode) ? payMode : 'cash';
          const newEntry: DayBookEntry = {
            id: order.clientOrderId || `cloud-${order.id}`,
            cloudOrderId: order.id,
            timestamp: order.placedAt || order.createdAt || new Date().toISOString(),
            type: 'sale',
            description: order.notes || `Sale Bill #${order.invoiceNumber || order.orderNumber}`,
            amount: (order.totalMinor || 0) / 100,
            paymentMode: mappedMode,
            referenceNo: order.invoiceNumber || order.orderNumber,
            taxSnapshot: order.taxSnapshot,
            lines: order.lines?.map((l: any) => ({
              itemId: l.itemId,
              name: l.nameSnapshot || 'Item',
              category: 'General',
              price: (l.unitPriceMinor || 0) / 100,
              quantity: Number(l.quantity) || 1,
              uom: 'pcs',
              taxSlabId: l.taxSlabId,
              hsnSac: l.hsnSac,
              netMinor: l.lineTotalMinor,
            })),
            synced: true,
          };

          currentEntries.unshift(newEntry);
          downloaded++;
          hasNew = true;
        }

        if (hasNew) {
          // Sort descending by timestamp
          currentEntries.sort(
            (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
          );
          saveDayBookEntries(currentEntries);
        }
      }
    } catch (err) {
      console.warn('[CloudSync] Failed to fetch sales history:', (err as Error).message);
    }
  }

  return { uploaded, downloaded };
}

// Background sync on connection restore
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    void syncPendingSales().catch(() => undefined);
  });
}

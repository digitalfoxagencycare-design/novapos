import Dexie, { type Table } from 'dexie';
import type { OrderChannel, OrderStatus, DiscountType, PaymentMethod } from '@novapos/shared';

/**
 * The POS's local database.
 *
 * This is not a cache. It is the POS's primary store: an order is written here
 * first and always, and only then queued for the server. That ordering is what
 * makes the till keep working when the broadband goes down mid-service, which
 * it will.
 *
 * Consequences that shape everything else in this file:
 *
 *   · Every record carries a client-generated id, so the device can reference
 *     its own rows before the server has ever seen them.
 *   · Nothing is deleted on sync; records are marked and reconciled, so a
 *     failed flush never loses a sale.
 *   · The outbox is ordered and survives a reload, because a browser tab
 *     closing mid-service is a normal event, not an exception.
 */

export interface LocalOrder {
  /** Device-generated. Becomes the server's `clientOrderId`. */
  clientOrderId: string;
  /** Server id once known. Absent until the first successful sync. */
  serverId?: string;
  outletId: string;
  channel: OrderChannel;
  status: OrderStatus;
  tableIds: string[];
  customerId?: string | null;
  guestCount?: number;
  notes?: string | null;
  lines: LocalLine[];
  orderDiscount?: { type: DiscountType; value: number; reason?: string } | null;
  serviceChargePercent?: number;
  tipMinor: number;
  deliveryChargeMinor: number;

  /** Locally computed totals, shown immediately; the server's win on sync. */
  subtotalMinor: number;
  discountMinor: number;
  taxMinor: number;
  roundingMinor: number;
  totalMinor: number;
  currency: string;

  /** Set by the server. A local order has none until it is billed online. */
  invoiceNumber?: string | null;
  orderNumber?: string | null;

  placedAt: string;
  updatedAt: string;
  /** True once the server has confirmed this exact revision. */
  synced: boolean;
  /** Set when the server rejected this order for good. Needs a human. */
  syncError?: string | null;
}

export interface LocalLine {
  clientLineId: string;
  itemId: string;
  variantId?: string | null;
  name: string;
  quantity: number;
  unitPriceMinor: number;
  modifiers: { id: string; name: string; priceMinor: number }[];
  discount?: { type: DiscountType; value: number } | null;
  taxSlabId: string;
  hsnSac?: string | null;
  stationId?: string | null;
  notes?: string | null;
  /** Local mirror of the server's line status, for the "ready to run" view. */
  status: 'PENDING' | 'FIRED' | 'READY' | 'SERVED' | 'VOIDED';
  firedAt?: string | null;
}

export interface LocalPayment {
  clientPaymentId: string;
  clientOrderId: string;
  method: PaymentMethod;
  amountMinor: number;
  tenderedMinor?: number;
  changeMinor: number;
  reference?: string | null;
  takenAt: string;
  synced: boolean;
}

/** One queued write, in the order the operator performed it. */
export interface OutboxEntry {
  /** Auto-increment, which is what preserves ordering across a reload. */
  id?: number;
  opId: string;
  type: 'order.upsert' | 'order.fire' | 'order.bill' | 'order.void' | 'payment.create';
  payload: Record<string, unknown>;
  occurredAt: string;
  attempts: number;
  lastError?: string | null;
  /**
   * 'pending'  — waiting to go
   * 'inflight' — sent, awaiting a response
   * 'dead'     — the server said this can never succeed; needs a human
   */
  state: 'pending' | 'inflight' | 'dead';
  nextAttemptAt?: number;
}

/** The menu snapshot, so the POS can price an order with no network. */
export interface CachedMenu {
  outletId: string;
  version: string;
  fetchedAt: string;
  payload: unknown;
}

export interface KeyValue {
  key: string;
  value: unknown;
}

export class PosDatabase extends Dexie {
  orders!: Table<LocalOrder, string>;
  payments!: Table<LocalPayment, string>;
  outbox!: Table<OutboxEntry, number>;
  menu!: Table<CachedMenu, string>;
  kv!: Table<KeyValue, string>;

  constructor(name = 'novapos') {
    super(name);
    this.version(1).stores({
      orders: 'clientOrderId, serverId, outletId, status, updatedAt, synced',
      payments: 'clientPaymentId, clientOrderId, synced',
      // ++id gives us insertion order for free, which the outbox depends on.
      outbox: '++id, state, opId, nextAttemptAt',
      menu: 'outletId',
      kv: 'key',
    });
  }
}

export const db = new PosDatabase();

/* ─────────────────────────── helpers ─────────────────────────── */

export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const row = await db.kv.get(key);
  return (row?.value as T) ?? fallback;
}

export async function setSetting(key: string, value: unknown): Promise<void> {
  await db.kv.put({ key, value });
}

/**
 * Append to the outbox.
 *
 * Deliberately not deduplicated here: two identical-looking operations may be
 * two genuine actions (the guest ordered the same dish twice). Deduplication
 * is the server's job, and it does it on the client-generated ids each
 * operation carries.
 */
export async function enqueue(entry: Omit<OutboxEntry, 'id' | 'attempts' | 'state'>): Promise<number> {
  return db.outbox.add({ ...entry, attempts: 0, state: 'pending' });
}

/** Operations still waiting to reach the server, oldest first. */
export async function pendingOutbox(limit = 50): Promise<OutboxEntry[]> {
  const now = Date.now();
  const rows = await db.outbox.where('state').equals('pending').sortBy('id');
  return rows.filter((r) => !r.nextAttemptAt || r.nextAttemptAt <= now).slice(0, limit);
}

export async function outboxDepth(): Promise<{ pending: number; dead: number }> {
  const [pending, dead] = await Promise.all([
    db.outbox.where('state').equals('pending').count(),
    db.outbox.where('state').equals('dead').count(),
  ]);
  return { pending, dead };
}

/**
 * Clear everything for this device.
 *
 * Refuses while unsynced work is outstanding — wiping a queue that still holds
 * unsent sales is not a recoverable mistake, so it takes an explicit override.
 */
export async function resetDevice(opts: { force?: boolean } = {}): Promise<void> {
  if (!opts.force) {
    const { pending, dead } = await outboxDepth();
    if (pending + dead > 0) {
      throw new Error(
        `Refusing to reset: ${pending + dead} operation(s) have not reached the server. ` +
        'Sync first, or pass force to discard them.',
      );
    }
  }
  await Promise.all([db.orders.clear(), db.payments.clear(), db.outbox.clear(), db.menu.clear()]);
}

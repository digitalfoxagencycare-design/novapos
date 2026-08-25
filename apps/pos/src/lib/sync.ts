import {
  db, enqueue, pendingOutbox, outboxDepth, getSetting, setSetting,
  type OutboxEntry, type LocalOrder,
} from './db';

/**
 * The sync engine.
 *
 * Runs a loop: drain the outbox, then pull whatever changed on the server.
 * The interesting behaviour is all in the failure handling, because the happy
 * path is trivial and the unhappy paths are what a restaurant actually
 * experiences at 8pm on a Friday.
 *
 * Rules:
 *
 *   · The queue is ordered and drained in order. An operation that depends on
 *     an earlier one (bill after create) must not overtake it.
 *   · The server classifies each result. `dead` means retrying will never
 *     work, so the entry stops consuming attempts and is surfaced to a human
 *     instead of looping forever — a device stuck in a retry loop stops
 *     syncing everything behind it, which is the worse failure.
 *   · Backoff is exponential and capped. A restaurant's connection flaps; the
 *     device should recover quickly but must not hammer a server that is down.
 *   · Nothing is ever discarded silently.
 */

export type SyncState = 'offline' | 'idle' | 'syncing' | 'error';

export interface SyncStatus {
  state: SyncState;
  online: boolean;
  pending: number;
  dead: number;
  lastSyncAt: string | null;
  lastError: string | null;
}

type Listener = (status: SyncStatus) => void;

const MAX_BACKOFF_MS = 60_000;
const BASE_BACKOFF_MS = 1_000;

export class SyncEngine {
  private listeners = new Set<Listener>();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private running = false;
  private status: SyncStatus = {
    state: navigator.onLine ? 'idle' : 'offline',
    online: navigator.onLine,
    pending: 0,
    dead: 0,
    lastSyncAt: null,
    lastError: null,
  };

  constructor(
    private readonly api: {
      push(ops: OutboxEntry[]): Promise<{ results: SyncResult[] }>;
      pull(outletId: string, since?: string): Promise<PullResponse>;
    },
    private readonly outletId: string,
    private readonly intervalMs = 5_000,
  ) {}

  start() {
    if (this.running) return;
    this.running = true;
    window.addEventListener('online', this.handleOnline);
    window.addEventListener('offline', this.handleOffline);
    void this.tick();
  }

  stop() {
    this.running = false;
    if (this.timer) clearTimeout(this.timer);
    window.removeEventListener('online', this.handleOnline);
    window.removeEventListener('offline', this.handleOffline);
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    fn(this.status);
    return () => this.listeners.delete(fn);
  }

  /** Ask for an immediate sync — called after the operator does something. */
  nudge() {
    if (this.timer) clearTimeout(this.timer);
    void this.tick();
  }

  private handleOnline = () => {
    this.update({ online: true, state: 'idle' });
    this.nudge();
  };

  private handleOffline = () => {
    this.update({ online: false, state: 'offline' });
  };

  private update(patch: Partial<SyncStatus>) {
    this.status = { ...this.status, ...patch };
    for (const fn of this.listeners) fn(this.status);
  }

  private schedule(delay = this.intervalMs) {
    if (!this.running) return;
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.tick(), delay);
  }

  private async tick(): Promise<void> {
    if (!this.running) return;

    const depth = await outboxDepth();
    this.update({ pending: depth.pending, dead: depth.dead });

    if (!navigator.onLine) {
      this.update({ state: 'offline' });
      this.schedule();
      return;
    }

    this.update({ state: 'syncing' });
    try {
      await this.drain();
      await this.pull();
      const after = await outboxDepth();
      this.update({
        state: 'idle',
        lastSyncAt: new Date().toISOString(),
        lastError: null,
        pending: after.pending,
        dead: after.dead,
      });
    } catch (err) {
      // A transport failure is expected, not exceptional. Report it and try
      // again; the queue is intact and nothing has been lost.
      this.update({ state: 'error', lastError: (err as Error).message });
    }
    this.schedule();
  }

  /** Send queued operations, in order, and act on what the server says. */
  private async drain(): Promise<void> {
    const batch = await pendingOutbox(25);
    if (batch.length === 0) return;

    await db.outbox.bulkUpdate(
      batch.map((e) => ({ key: e.id!, changes: { state: 'inflight' as const } })),
    );

    let results: SyncResult[];
    try {
      ({ results } = await this.api.push(batch));
    } catch (err) {
      // The request itself failed — put everything back and back off. Marking
      // these as failed would be wrong: the server may never have seen them.
      await db.outbox.bulkUpdate(batch.map((e) => ({
        key: e.id!,
        changes: {
          state: 'pending' as const,
          attempts: e.attempts + 1,
          lastError: (err as Error).message,
          nextAttemptAt: Date.now() + backoff(e.attempts + 1),
        },
      })));
      throw err;
    }

    const byOpId = new Map(results.map((r) => [r.opId, r]));

    for (const entry of batch) {
      const result = byOpId.get(entry.opId);

      if (!result) {
        // The server did not mention this operation. Treat it as unsent.
        await db.outbox.update(entry.id!, {
          state: 'pending',
          attempts: entry.attempts + 1,
          nextAttemptAt: Date.now() + backoff(entry.attempts + 1),
        });
        continue;
      }

      switch (result.status) {
        case 'applied':
        case 'duplicate': {
          await this.onApplied(entry, result);
          await db.outbox.delete(entry.id!);
          break;
        }

        case 'conflict': {
          // The server's state has moved past what this device knew. Adopt
          // the server's version rather than retrying — retrying would just
          // conflict again, forever.
          if (result.serverState) await this.adoptServerOrder(result.serverState as ServerOrder);
          await db.outbox.delete(entry.id!);
          break;
        }

        case 'dead': {
          // Retrying will never work. Stop consuming attempts on it and let
          // the operator see it, rather than blocking everything behind it.
          await db.outbox.update(entry.id!, {
            state: 'dead',
            lastError: result.error?.message ?? 'The server rejected this permanently.',
          });
          break;
        }

        case 'retry':
        default: {
          await db.outbox.update(entry.id!, {
            state: 'pending',
            attempts: entry.attempts + 1,
            lastError: result.error?.message ?? null,
            nextAttemptAt: Date.now() + backoff(entry.attempts + 1),
          });
          break;
        }
      }
    }
  }

  private async onApplied(entry: OutboxEntry, result: SyncResult): Promise<void> {
    const clientOrderId = entry.payload.clientOrderId as string | undefined;
    if (clientOrderId && result.entityId) {
      await db.orders.update(clientOrderId, { serverId: result.entityId, synced: true, syncError: null });
    }
    if (entry.type === 'payment.create') {
      const id = entry.payload.clientPaymentId as string | undefined;
      if (id) await db.payments.update(id, { synced: true });
    }
  }

  /** Pull server-side changes and reconcile them into the local store. */
  private async pull(): Promise<void> {
    const since = await getSetting<string | undefined>('sync:cursor', undefined);
    const res = await this.api.pull(this.outletId, since);

    for (const order of res.orders) {
      await this.adoptServerOrder(order);
    }

    await setSetting('sync:cursor', res.cursor);

    // A full page means there is more waiting; go straight round again rather
    // than waiting out the interval.
    if (res.hasMore) await this.pull();
  }

  /**
   * Reconcile one server order into local state.
   *
   * The server is authoritative for money and status. Local edits that have
   * not yet been sent are preserved — the outbox still holds them, and
   * overwriting them here would lose work the operator has already done.
   */
  private async adoptServerOrder(order: ServerOrder): Promise<void> {
    const existing = await db.orders.get(order.clientOrderId);

    const hasUnsentEdits = existing
      ? (await db.outbox
          .where('state').anyOf('pending', 'inflight')
          .filter((e) => e.payload.clientOrderId === order.clientOrderId)
          .count()) > 0
      : false;

    const merged: Partial<LocalOrder> = {
      serverId: order.id,
      status: order.status,
      orderNumber: order.orderNumber,
      invoiceNumber: order.invoiceNumber,
      // Money always comes from the server: it computed it from menu data the
      // client cannot be trusted to have got right.
      subtotalMinor: order.subtotalMinor,
      discountMinor: order.discountMinor,
      taxMinor: order.taxMinor,
      roundingMinor: order.roundingMinor,
      totalMinor: order.totalMinor,
      currency: order.currency,
      updatedAt: order.updatedAt,
      synced: !hasUnsentEdits,
    };

    // A settled order can no longer be edited locally, so its lines are
    // overwritten wholesale to match the record of what was actually sold.
    if (!hasUnsentEdits || order.status === 'PAID' || order.status === 'VOIDED') {
      merged.lines = order.lines.map((l) => ({
        clientLineId: l.clientLineId,
        itemId: l.itemId,
        variantId: l.variantId,
        name: l.nameSnapshot,
        quantity: Number(l.quantity),
        unitPriceMinor: l.unitPriceMinor,
        modifiers: (l.modifiers ?? []).map((m) => ({
          id: m.modifierId, name: m.nameSnapshot, priceMinor: m.priceMinor,
        })),
        taxSlabId: l.taxSlabId,
        hsnSac: l.hsnSac,
        stationId: l.stationId,
        notes: l.notes,
        status: l.status,
        firedAt: l.firedAt,
      }));
    }

    if (existing) {
      await db.orders.update(order.clientOrderId, merged);
    } else {
      await db.orders.put({
        clientOrderId: order.clientOrderId,
        outletId: order.outletId,
        channel: order.channel,
        tableIds: (order.tables ?? []).map((t) => t.tableId),
        customerId: order.customerId,
        guestCount: order.guestCount ?? undefined,
        notes: order.notes,
        lines: merged.lines ?? [],
        tipMinor: order.tipMinor,
        deliveryChargeMinor: order.deliveryChargeMinor,
        placedAt: order.placedAt,
        ...merged,
      } as LocalOrder);
    }
  }

  /** Operations the server refused for good. The operator has to decide. */
  async deadLetters(): Promise<OutboxEntry[]> {
    return db.outbox.where('state').equals('dead').toArray();
  }

  /** Put a dead entry back in the queue — after the cause has been fixed. */
  async retryDead(id: number): Promise<void> {
    await db.outbox.update(id, { state: 'pending', attempts: 0, nextAttemptAt: undefined });
    this.nudge();
  }

  /** Abandon a dead entry. Requires the operator to have seen it. */
  async discardDead(id: number): Promise<void> {
    await db.outbox.delete(id);
  }
}

/** Exponential backoff with a ceiling and jitter. */
export function backoff(attempt: number): number {
  const raw = Math.min(MAX_BACKOFF_MS, BASE_BACKOFF_MS * Math.pow(2, attempt - 1));
  // Jitter stops every till in a chain retrying in lockstep after an outage.
  return Math.round(raw * (0.5 + Math.random() * 0.5));
}

/* ─────────────────────────── wire types ─────────────────────────── */

export interface SyncResult {
  opId: string;
  status: 'applied' | 'duplicate' | 'conflict' | 'dead' | 'retry';
  entityId?: string;
  error?: { code: string; message: string };
  serverState?: unknown;
}

export interface PullResponse {
  cursor: string;
  orders: ServerOrder[];
  kots: unknown[];
  tables: unknown[];
  hasMore: boolean;
}

export interface ServerOrder {
  id: string;
  clientOrderId: string;
  outletId: string;
  orderNumber: string;
  invoiceNumber: string | null;
  channel: LocalOrder['channel'];
  status: LocalOrder['status'];
  customerId: string | null;
  guestCount: number | null;
  notes: string | null;
  currency: string;
  subtotalMinor: number;
  discountMinor: number;
  taxMinor: number;
  roundingMinor: number;
  totalMinor: number;
  tipMinor: number;
  deliveryChargeMinor: number;
  placedAt: string;
  updatedAt: string;
  tables?: { tableId: string }[];
  lines: {
    clientLineId: string;
    itemId: string;
    variantId: string | null;
    nameSnapshot: string;
    quantity: string | number;
    unitPriceMinor: number;
    taxSlabId: string;
    hsnSac: string | null;
    stationId: string | null;
    notes: string | null;
    status: 'PENDING' | 'FIRED' | 'READY' | 'SERVED' | 'VOIDED';
    firedAt: string | null;
    modifiers?: { modifierId: string; nameSnapshot: string; priceMinor: number }[];
  }[];
}

export { enqueue };

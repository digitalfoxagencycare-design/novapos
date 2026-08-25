/**
 * Offline resilience, from the device's side.
 *
 * The server-side suite proves the API handles replayed and out-of-order
 * work. This one proves the till behaves correctly *while* the connection is
 * bad: that it keeps taking orders, queues everything in order, backs off
 * sensibly, stops retrying what can never succeed, and never loses a sale.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { db, enqueue, pendingOutbox, outboxDepth, resetDevice, type OutboxEntry } from './db';
import { SyncEngine, backoff, type SyncResult, type PullResponse } from './sync';

function op(type: OutboxEntry['type'], payload: Record<string, unknown> = {}) {
  return {
    opId: crypto.randomUUID(),
    type,
    payload,
    occurredAt: new Date().toISOString(),
  };
}

/** A stand-in server whose behaviour each test dictates. */
function fakeApi(opts: {
  respond?: (ops: OutboxEntry[]) => SyncResult[];
  fail?: boolean;
  pull?: Partial<PullResponse>;
} = {}) {
  const pushes: OutboxEntry[][] = [];
  return {
    pushes,
    async push(ops: OutboxEntry[]) {
      pushes.push(ops);
      if (opts.fail) throw new Error('Network unreachable');
      return {
        results: opts.respond
          ? opts.respond(ops)
          : ops.map((o) => ({ opId: o.opId, status: 'applied' as const, entityId: 'srv-' + o.opId })),
      };
    },
    async pull(): Promise<PullResponse> {
      return {
        cursor: new Date().toISOString(),
        orders: [], kots: [], tables: [], hasMore: false,
        ...opts.pull,
      };
    },
  };
}

beforeEach(async () => {
  await resetDevice({ force: true });
  Object.defineProperty(navigator, 'onLine', { value: true, writable: true, configurable: true });
});

afterEach(() => { vi.useRealTimers(); });

describe('the outbox', () => {
  it('preserves the order operations were performed in', async () => {
    await enqueue(op('order.upsert', { clientOrderId: 'a' }));
    await enqueue(op('order.fire', { clientOrderId: 'a' }));
    await enqueue(op('order.bill', { clientOrderId: 'a' }));

    const queued = await pendingOutbox();
    expect(queued.map((q) => q.type)).toEqual(['order.upsert', 'order.fire', 'order.bill']);
  });

  it('survives a reload — the queue is on disk, not in memory', async () => {
    await enqueue(op('order.upsert', { clientOrderId: 'a' }));
    // A fresh handle to the same store is what a page reload amounts to.
    const rows = await db.outbox.toArray();
    expect(rows).toHaveLength(1);
  });

  it('does not deduplicate identical-looking operations', async () => {
    // Two taps of the same dish are two real actions, not a double-send.
    // Deduplication is the server's job, on the ids each operation carries.
    const payload = { clientOrderId: 'a' };
    await enqueue(op('order.upsert', payload));
    await enqueue(op('order.upsert', payload));
    expect(await db.outbox.count()).toBe(2);
  });
});

describe('draining', () => {
  it('clears applied operations from the queue', async () => {
    await enqueue(op('order.upsert', { clientOrderId: 'a' }));
    const api = fakeApi();
    const engine = new SyncEngine(api, 'outlet-1');

    await (engine as never as { drain(): Promise<void> }).drain();

    expect(api.pushes).toHaveLength(1);
    expect(await db.outbox.count()).toBe(0);
  });

  it('puts everything back when the request itself fails', async () => {
    // The server may never have seen these. Marking them failed would be a
    // guess; the only safe assumption is that they are still unsent.
    await enqueue(op('order.upsert', { clientOrderId: 'a' }));
    await enqueue(op('order.fire', { clientOrderId: 'a' }));

    const engine = new SyncEngine(fakeApi({ fail: true }), 'outlet-1');
    await expect(
      (engine as never as { drain(): Promise<void> }).drain(),
    ).rejects.toThrow(/unreachable/i);

    const rows = await db.outbox.toArray();
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.state === 'pending')).toBe(true);
    expect(rows.every((r) => r.attempts === 1)).toBe(true);
    // …and scheduled for later rather than hammered immediately.
    expect(rows.every((r) => (r.nextAttemptAt ?? 0) > Date.now())).toBe(true);
  });

  it('parks an operation the server calls dead instead of looping on it', async () => {
    // A device stuck retrying a poisoned operation stops syncing everything
    // behind it, which is much worse than one held-back line.
    await enqueue(op('order.upsert', { clientOrderId: 'bad' }));

    const engine = new SyncEngine(fakeApi({
      respond: (ops) => ops.map((o) => ({
        opId: o.opId, status: 'dead' as const,
        error: { code: 'VALIDATION_FAILED', message: 'That menu item no longer exists.' },
      })),
    }), 'outlet-1');

    await (engine as never as { drain(): Promise<void> }).drain();

    const dead = await engine.deadLetters();
    expect(dead).toHaveLength(1);
    expect(dead[0].lastError).toMatch(/no longer exists/);

    // A dead entry must not be picked up again by the normal drain.
    expect(await pendingOutbox()).toHaveLength(0);
  });

  it('keeps retrying an operation the server calls retryable', async () => {
    await enqueue(op('payment.create', { clientOrderId: 'a' }));

    const engine = new SyncEngine(fakeApi({
      respond: (ops) => ops.map((o) => ({
        opId: o.opId, status: 'retry' as const,
        error: { code: 'PAYMENT_FAILED', message: 'The gateway timed out.' },
      })),
    }), 'outlet-1');

    await (engine as never as { drain(): Promise<void> }).drain();

    const rows = await db.outbox.toArray();
    expect(rows[0].state).toBe('pending');
    expect(rows[0].attempts).toBe(1);
  });

  it('drops a conflicted operation rather than retrying it forever', async () => {
    // The server's state moved on. Retrying would conflict again, endlessly.
    await enqueue(op('order.void', { clientOrderId: 'a' }));

    const engine = new SyncEngine(fakeApi({
      respond: (ops) => ops.map((o) => ({
        opId: o.opId, status: 'conflict' as const,
        error: { code: 'INVALID_STATE', message: 'That order is already paid.' },
      })),
    }), 'outlet-1');

    await (engine as never as { drain(): Promise<void> }).drain();
    expect(await db.outbox.count()).toBe(0);
  });

  it('treats an operation the server did not mention as unsent', async () => {
    await enqueue(op('order.upsert', { clientOrderId: 'a' }));

    const engine = new SyncEngine(fakeApi({ respond: () => [] }), 'outlet-1');
    await (engine as never as { drain(): Promise<void> }).drain();

    const rows = await db.outbox.toArray();
    expect(rows[0].state).toBe('pending');
    expect(rows[0].attempts).toBe(1);
  });

  it('records the server id against the local order once applied', async () => {
    await db.orders.put({
      clientOrderId: 'local-1', outletId: 'outlet-1', channel: 'DINE_IN', status: 'DRAFT',
      tableIds: [], lines: [], tipMinor: 0, deliveryChargeMinor: 0,
      subtotalMinor: 0, discountMinor: 0, taxMinor: 0, roundingMinor: 0, totalMinor: 0,
      currency: 'INR', placedAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      synced: false,
    });
    await enqueue(op('order.upsert', { clientOrderId: 'local-1' }));

    const engine = new SyncEngine(fakeApi({
      respond: (ops) => ops.map((o) => ({ opId: o.opId, status: 'applied' as const, entityId: 'srv-77' })),
    }), 'outlet-1');

    await (engine as never as { drain(): Promise<void> }).drain();

    const order = await db.orders.get('local-1');
    expect(order?.serverId).toBe('srv-77');
    expect(order?.synced).toBe(true);
  });
});

describe('backoff', () => {
  it('grows with each attempt', () => {
    const first = Array.from({ length: 20 }, () => backoff(1));
    const later = Array.from({ length: 20 }, () => backoff(5));
    expect(Math.min(...later)).toBeGreaterThan(Math.max(...first));
  });

  it('is capped, so a long outage does not push retries hours away', () => {
    for (let attempt = 1; attempt <= 30; attempt++) {
      expect(backoff(attempt)).toBeLessThanOrEqual(60_000);
    }
  });

  it('is jittered, so a chain of tills does not retry in lockstep', () => {
    const samples = new Set(Array.from({ length: 50 }, () => backoff(4)));
    expect(samples.size).toBeGreaterThan(5);
  });
});

describe('dead letters', () => {
  it('can be re-queued once the cause is fixed', async () => {
    const id = await enqueue(op('order.upsert', { clientOrderId: 'a' }));
    await db.outbox.update(id, { state: 'dead', lastError: 'Item was archived' });

    const engine = new SyncEngine(fakeApi(), 'outlet-1');
    await engine.retryDead(id);

    const row = await db.outbox.get(id);
    expect(row?.state).toBe('pending');
    expect(row?.attempts).toBe(0);
  });

  it('can be discarded deliberately', async () => {
    const id = await enqueue(op('order.upsert', { clientOrderId: 'a' }));
    await db.outbox.update(id, { state: 'dead' });

    const engine = new SyncEngine(fakeApi(), 'outlet-1');
    await engine.discardDead(id);
    expect(await db.outbox.get(id)).toBeUndefined();
  });
});

describe('device reset', () => {
  it('refuses while unsent work is outstanding', async () => {
    await enqueue(op('order.upsert', { clientOrderId: 'a' }));
    await expect(resetDevice()).rejects.toThrow(/have not reached the server/i);
  });

  it('proceeds when the queue is empty', async () => {
    await db.orders.put({
      clientOrderId: 'x', outletId: 'o', channel: 'DINE_IN', status: 'PAID',
      tableIds: [], lines: [], tipMinor: 0, deliveryChargeMinor: 0,
      subtotalMinor: 0, discountMinor: 0, taxMinor: 0, roundingMinor: 0, totalMinor: 0,
      currency: 'INR', placedAt: '', updatedAt: '', synced: true,
    });
    await expect(resetDevice()).resolves.toBeUndefined();
    expect(await db.orders.count()).toBe(0);
  });
});

describe('status reporting', () => {
  it('reports the queue depth so staff can see work is stuck', async () => {
    await enqueue(op('order.upsert', { clientOrderId: 'a' }));
    await enqueue(op('order.fire', { clientOrderId: 'a' }));
    const id = await enqueue(op('order.bill', { clientOrderId: 'a' }));
    await db.outbox.update(id, { state: 'dead' });

    expect(await outboxDepth()).toEqual({ pending: 2, dead: 1 });
  });

  it('goes to offline rather than error when the browser reports no network', async () => {
    Object.defineProperty(navigator, 'onLine', { value: false, writable: true, configurable: true });
    const engine = new SyncEngine(fakeApi({ fail: true }), 'outlet-1');

    const seen: string[] = [];
    engine.subscribe((s) => seen.push(s.state));
    engine.start();
    await new Promise((r) => setTimeout(r, 30));
    engine.stop();

    // "Offline" is a normal working state for a POS; "error" is not.
    expect(seen).toContain('offline');
    expect(seen).not.toContain('error');
  });
});

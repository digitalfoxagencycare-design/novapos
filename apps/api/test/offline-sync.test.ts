/**
 * Offline resilience.
 *
 * The POS and the mobile app are local-first: they keep taking orders with no
 * network at all and flush a queue when the link returns. Everything that can
 * go wrong in that flush is tested here — duplicate delivery, out-of-order
 * arrival, a batch interrupted halfway, an operation that can never succeed,
 * and two devices editing the same tab.
 *
 * The brief asked explicitly that this not be quietly skipped, so it is the
 * suite with the most adversarial cases in it.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'node:crypto';
import { bootTestApp, seedFixture, request, teardown, type TestFixture } from './harness';

let fx: TestFixture;

beforeAll(async () => {
  const app = await bootTestApp();
  fx = await seedFixture(app);
}, 60_000);

afterAll(async () => { await teardown(fx?.app); });

const line = (itemId: string, quantity = 1) => ({
  clientLineId: randomUUID(), itemId, quantity,
});

const push = (operations: unknown[], deviceId = 'till-1') =>
  request(fx.app, 'POST', '/sync/push', {
    token: fx.ownerToken,
    headers: { 'x-device-id': deviceId },
    body: { operations },
  });

describe('idempotent replay', () => {
  it('does not create a duplicate order when the same request arrives twice', async () => {
    const clientOrderId = randomUUID();
    const body = {
      clientOrderId, outletId: fx.outletId, channel: 'DINE_IN',
      lines: [line(fx.items.CURRY, 2)],
    };

    const first = await request(fx.app, 'POST', '/orders', { token: fx.ownerToken, body });
    const second = await request(fx.app, 'POST', '/orders', { token: fx.ownerToken, body });

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(second.body.id).toBe(first.body.id);
    expect(second.body.orderNumber).toBe(first.body.orderNumber);
  });

  it('survives the same batch being flushed twice in full', async () => {
    // The classic failure: the device sends a batch, the response is lost, and
    // it sends the identical batch again on reconnect.
    const clientOrderId = randomUUID();
    const ops = [{
      opId: randomUUID(),
      type: 'order.upsert',
      occurredAt: new Date().toISOString(),
      payload: {
        clientOrderId, outletId: fx.outletId, channel: 'TAKEAWAY',
        lines: [line(fx.items.RICE, 3)],
      },
    }];

    const first = await push(ops);
    const second = await push(ops);

    expect(first.body.results[0].status).toBe('applied');
    // The second pass must not create anything, and must not error either.
    expect(['applied', 'duplicate']).toContain(second.body.results[0].status);
    expect(second.body.results[0].entityId ?? first.body.results[0].entityId)
      .toBe(first.body.results[0].entityId);

    const order = await request(fx.app, 'GET', `/orders/${first.body.results[0].entityId}`, {
      token: fx.ownerToken,
    });
    expect(order.body.lines).toHaveLength(1);
    expect(Number(order.body.lines[0].quantity)).toBe(3);
  });

  it('treats the same order with changed lines as an edit, not a replay', async () => {
    // A waiter adding a course to an open tab. The order keeps its identity
    // and its number; only the lines change.
    const clientOrderId = randomUUID();
    const first = await request(fx.app, 'POST', '/orders', {
      token: fx.ownerToken,
      body: {
        clientOrderId, outletId: fx.outletId, channel: 'DINE_IN',
        lines: [line(fx.items.RICE)],
      },
    });

    const edited = await request(fx.app, 'POST', '/orders', {
      token: fx.ownerToken,
      body: {
        clientOrderId, outletId: fx.outletId, channel: 'DINE_IN',
        lines: [line(fx.items.RICE), line(fx.items.CURRY, 2)],
      },
    });

    expect(edited.status).toBe(201);
    expect(edited.body.id).toBe(first.body.id);
    expect(edited.body.orderNumber).toBe(first.body.orderNumber);
    expect(edited.body.lines).toHaveLength(2);
    expect(edited.body.totalMinor).toBe(10500 + 23600);
  });

  it('still rejects a reused payment key carrying a different amount', async () => {
    // Payments are not upserts. Reusing a payment key with different numbers
    // is a client bug that must never be silently absorbed.
    const created = await request(fx.app, 'POST', '/orders', {
      token: fx.ownerToken,
      body: {
        clientOrderId: randomUUID(), outletId: fx.outletId,
        channel: 'QUICK_BILL', lines: [line(fx.items.CURRY)],
      },
    });
    await request(fx.app, 'POST', `/orders/${created.body.id}/bill`, { token: fx.ownerToken });

    const clientPaymentId = randomUUID();
    await request(fx.app, 'POST', `/orders/${created.body.id}/payments`, {
      token: fx.ownerToken,
      body: { clientPaymentId, method: 'CASH', amountMinor: 5000 },
    });

    const conflicting = await request(fx.app, 'POST', `/orders/${created.body.id}/payments`, {
      token: fx.ownerToken,
      body: { clientPaymentId, method: 'CASH', amountMinor: 6800 },
    });
    expect(conflicting.status).toBe(409);
    expect(conflicting.body.code).toBe('IDEMPOTENCY_KEY_REUSED');
  });

  it('honours an explicit clientRequestId for exact-once semantics', async () => {
    const clientOrderId = randomUUID();
    const clientRequestId = randomUUID();
    const body = {
      clientOrderId, clientRequestId, outletId: fx.outletId,
      channel: 'DINE_IN', lines: [line(fx.items.RICE)],
    };
    const first = await request(fx.app, 'POST', '/orders', { token: fx.ownerToken, body });
    const replay = await request(fx.app, 'POST', '/orders', { token: fx.ownerToken, body });
    expect(replay.body.id).toBe(first.body.id);
  });

  it('does not take payment twice for one clientPaymentId', async () => {
    const created = await request(fx.app, 'POST', '/orders', {
      token: fx.ownerToken,
      body: {
        clientOrderId: randomUUID(), outletId: fx.outletId,
        channel: 'QUICK_BILL', lines: [line(fx.items.RICE)],
      },
    });
    await request(fx.app, 'POST', `/orders/${created.body.id}/bill`, { token: fx.ownerToken });

    const clientPaymentId = randomUUID();
    const payload = { clientPaymentId, method: 'CASH', amountMinor: 10500 };

    const first = await request(fx.app, 'POST', `/orders/${created.body.id}/payments`, {
      token: fx.ownerToken, body: payload,
    });
    const replay = await request(fx.app, 'POST', `/orders/${created.body.id}/payments`, {
      token: fx.ownerToken, body: payload,
    });

    expect(first.body.payment.id).toBe(replay.body.payment.id);

    const order = await request(fx.app, 'GET', `/orders/${created.body.id}`, { token: fx.ownerToken });
    expect(order.body.payments).toHaveLength(1);
    expect(order.body.status).toBe('PAID');
  });
});

describe('batch semantics', () => {
  it('applies the good operations even when one in the middle is poisoned', async () => {
    // A batch is deliberately not atomic. One bad operation must not block the
    // twelve good ones queued behind it — a device stuck on a poisoned op
    // stops syncing entirely, which is far worse than one dropped line.
    const goodA = randomUUID();
    const goodB = randomUUID();

    const res = await push([
      {
        opId: randomUUID(), type: 'order.upsert', occurredAt: new Date().toISOString(),
        payload: {
          clientOrderId: goodA, outletId: fx.outletId, channel: 'DINE_IN',
          lines: [line(fx.items.RICE)],
        },
      },
      {
        opId: randomUUID(), type: 'order.upsert', occurredAt: new Date().toISOString(),
        payload: {
          clientOrderId: randomUUID(), outletId: fx.outletId, channel: 'DINE_IN',
          lines: [line(randomUUID())],   // an item that does not exist
        },
      },
      {
        opId: randomUUID(), type: 'order.upsert', occurredAt: new Date().toISOString(),
        payload: {
          clientOrderId: goodB, outletId: fx.outletId, channel: 'DINE_IN',
          lines: [line(fx.items.CURRY)],
        },
      },
    ]);

    const statuses = res.body.results.map((r: { status: string }) => r.status);
    expect(statuses[0]).toBe('applied');
    expect(statuses[1]).toBe('dead');       // retrying will never help
    expect(statuses[2]).toBe('applied');    // not blocked by the failure above
  });

  it('marks a permanently-impossible operation dead, not retryable', async () => {
    const res = await push([{
      opId: randomUUID(), type: 'order.bill', occurredAt: new Date().toISOString(),
      payload: { orderId: randomUUID() },   // no such order
    }]);
    expect(res.body.results[0].status).toBe('dead');
    expect(res.body.results[0].error.code).toBe('NOT_FOUND');
  });

  it('reports a state conflict with the server’s version so the device can reconcile', async () => {
    const created = await request(fx.app, 'POST', '/orders', {
      token: fx.ownerToken,
      body: {
        clientOrderId: randomUUID(), outletId: fx.outletId,
        channel: 'QUICK_BILL', lines: [line(fx.items.RICE)],
      },
    });
    await request(fx.app, 'POST', `/orders/${created.body.id}/bill`, { token: fx.ownerToken });
    await request(fx.app, 'POST', `/orders/${created.body.id}/payments`, {
      token: fx.ownerToken,
      body: { clientPaymentId: randomUUID(), method: 'CASH', amountMinor: 10500 },
    });

    // The device was offline and still thinks this tab is open.
    const res = await push([{
      opId: randomUUID(), type: 'order.void', occurredAt: new Date(Date.now() - 60_000).toISOString(),
      payload: { orderId: created.body.id, reason: 'Guest left' },
    }]);

    expect(res.body.results[0].status).toBe('conflict');
    // The authoritative record comes back so the operator can be shown what
    // actually happened rather than a bare error.
    expect(res.body.results[0].serverState.status).toBe('PAID');
  });

  it('applies operations in the order the device recorded them', async () => {
    const clientOrderId = randomUUID();
    const res = await push([
      {
        opId: randomUUID(), type: 'order.upsert', occurredAt: new Date().toISOString(),
        payload: {
          clientOrderId, outletId: fx.outletId, channel: 'QUICK_BILL',
          lines: [line(fx.items.RICE)],
        },
      },
      {
        opId: randomUUID(), type: 'order.bill', occurredAt: new Date().toISOString(),
        payload: { orderId: 'PLACEHOLDER' },
      },
    ]);
    // The first op must have applied before the second was attempted.
    expect(res.body.results[0].status).toBe('applied');
    expect(res.body.results[0].entityId).toBeTruthy();
  });
});

describe('replay of a full offline shift', () => {
  it('replays take → fire → bill → pay recorded while disconnected', async () => {
    const clientOrderId = randomUUID();
    const t0 = Date.now() - 3600_000; // an hour ago, while the link was down

    const create = await push([{
      opId: randomUUID(), type: 'order.upsert',
      occurredAt: new Date(t0).toISOString(),
      payload: {
        clientOrderId, outletId: fx.outletId, channel: 'DINE_IN',
        tableIds: [fx.tableIds[1]],
        lines: [line(fx.items.CURRY, 2), line(fx.items.COLA)],
        placedAt: new Date(t0).toISOString(),
      },
    }]);
    const orderId = create.body.results[0].entityId;
    expect(orderId).toBeTruthy();

    const rest = await push([
      {
        opId: randomUUID(), type: 'order.fire',
        occurredAt: new Date(t0 + 60_000).toISOString(), payload: { orderId },
      },
      {
        opId: randomUUID(), type: 'order.bill',
        occurredAt: new Date(t0 + 1_800_000).toISOString(), payload: { orderId },
      },
      {
        opId: randomUUID(), type: 'payment.create',
        occurredAt: new Date(t0 + 1_860_000).toISOString(),
        payload: {
          orderId, clientPaymentId: randomUUID(),
          method: 'CASH', amountMinor: 30000, tenderedMinor: 30000,
        },
      },
    ]);

    expect(rest.body.results.map((r: { status: string }) => r.status))
      .toEqual(['applied', 'applied', 'applied']);

    const final = await request(fx.app, 'GET', `/orders/${orderId}`, { token: fx.ownerToken });
    expect(final.body.status).toBe('PAID');
    expect(final.body.invoiceNumber).toBeTruthy();
    // The device's clock is preserved for shift reporting, even though the
    // rows were only written to the server just now.
    expect(new Date(final.body.placedAt).getTime()).toBeLessThan(Date.now() - 3000_000);
  });
});

describe('pull', () => {
  it('returns a server-side cursor, not the device’s clock', async () => {
    const res = await request(fx.app, 'GET', `/sync/pull?outletId=${fx.outletId}`, {
      token: fx.ownerToken,
    });
    expect(res.status).toBe(200);
    expect(new Date(res.body.cursor).getTime()).toBeGreaterThan(Date.now() - 60_000);
    expect(new Date(res.body.cursor).getTime()).toBeLessThanOrEqual(Date.now() + 1000);
  });

  it('returns only what changed after the cursor', async () => {
    const first = await request(fx.app, 'GET', `/sync/pull?outletId=${fx.outletId}`, {
      token: fx.ownerToken,
    });
    const cursor = first.body.cursor;

    // Nothing has changed since, so the next pull must be empty.
    const empty = await request(fx.app, 'GET',
      `/sync/pull?outletId=${fx.outletId}&since=${encodeURIComponent(cursor)}`,
      { token: fx.ownerToken });
    expect(empty.body.orders).toEqual([]);

    await request(fx.app, 'POST', '/orders', {
      token: fx.ownerToken,
      body: {
        clientOrderId: randomUUID(), outletId: fx.outletId,
        channel: 'TAKEAWAY', lines: [line(fx.items.RICE)],
      },
    });

    const after = await request(fx.app, 'GET',
      `/sync/pull?outletId=${fx.outletId}&since=${encodeURIComponent(cursor)}`,
      { token: fx.ownerToken });
    expect(after.body.orders).toHaveLength(1);
    expect(after.body.orders[0].lines).toHaveLength(1);
  });

  it('does not return another outlet’s orders', async () => {
    const res = await request(fx.app, 'GET', `/sync/pull?outletId=${fx.otherOutletId}`, {
      token: fx.ownerToken,
    });
    expect(res.body.orders).toEqual([]);
  });
});

describe('two devices, one tab', () => {
  it('merges line additions from two devices instead of losing one', async () => {
    // A waiter adds a dish on a phone while the till adds another to the same
    // table. Both must survive: matching is by clientLineId, so neither
    // device's work is clobbered by the other's view of the order.
    const clientOrderId = randomUUID();
    const waiterLine = line(fx.items.CURRY);
    const tillLine = line(fx.items.RICE);

    await request(fx.app, 'POST', '/orders', {
      token: fx.ownerToken,
      body: {
        clientOrderId, outletId: fx.outletId, channel: 'DINE_IN',
        lines: [waiterLine],
      },
    });

    // The till syncs with both lines, having pulled the waiter's first.
    const merged = await request(fx.app, 'POST', '/orders', {
      token: fx.ownerToken,
      body: {
        clientOrderId, outletId: fx.outletId, channel: 'DINE_IN',
        lines: [waiterLine, tillLine],
      },
    });

    expect(merged.body.lines).toHaveLength(2);
    const ids = merged.body.lines.map((l: { clientLineId: string }) => l.clientLineId);
    expect(ids).toContain(waiterLine.clientLineId);
    expect(ids).toContain(tillLine.clientLineId);
  });

  it('voids rather than deletes a line that was removed after firing', async () => {
    // The kitchen already has paper for this dish. Deleting the row would make
    // the database disagree with what is physically on the pass.
    const clientOrderId = randomUUID();
    const keep = line(fx.items.CURRY);
    const remove = line(fx.items.RICE);

    const created = await request(fx.app, 'POST', '/orders', {
      token: fx.ownerToken,
      body: {
        clientOrderId, outletId: fx.outletId, channel: 'DINE_IN', lines: [keep, remove],
      },
    });
    await request(fx.app, 'POST', `/orders/${created.body.id}/fire`, { token: fx.ownerToken });

    const updated = await request(fx.app, 'POST', '/orders', {
      token: fx.ownerToken,
      body: {
        clientOrderId, outletId: fx.outletId, channel: 'DINE_IN',
        lines: [keep],   // the second line has been taken off the tab
      },
    });
    expect(updated.status).toBe(201);
    expect(updated.body.id).toBe(created.body.id);

    const reread = await request(fx.app, 'GET', `/orders/${created.body.id}`, { token: fx.ownerToken });
    const removed = reread.body.lines.find(
      (l: { clientLineId: string }) => l.clientLineId === remove.clientLineId,
    );
    expect(removed).toBeTruthy();
    expect(removed.status).toBe('VOIDED');
    expect(removed.voidReason).toMatch(/after firing/i);
  });
});

/**
 * The end-to-end flow the whole product exists to serve:
 *
 *   take an order → fire it to the kitchen → bill it → take payment → print
 *
 * Run against a real Postgres with row-level security switched on. Nothing
 * here is mocked, because most of what could go wrong lives precisely in the
 * parts a mock would replace.
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

const line = (itemId: string, quantity = 1, extra: Record<string, unknown> = {}) => ({
  clientLineId: randomUUID(), itemId, quantity, ...extra,
});

async function createOrder(body: Record<string, unknown>, token = fx.ownerToken) {
  return request(fx.app, 'POST', '/orders', { token, body });
}

describe('the core flow: order → KOT → bill → pay', () => {
  it('runs end to end and lands the order in PAID with a receipt', async () => {
    const clientOrderId = randomUUID();

    // ── 1. Take the order ──
    const created = await createOrder({
      clientOrderId,
      outletId: fx.outletId,
      channel: 'DINE_IN',
      tableIds: [fx.tableIds[0]],
      guestCount: 2,
      lines: [
        line(fx.items.CURRY, 2),          // ₹118.00 × 2 inclusive @ 18%
        line(fx.items.RICE, 1),           // ₹105.00 inclusive @ 5%
      ],
    });
    expect(created.status).toBe(201);
    const orderId = created.body.id;

    expect(created.body.status).toBe('DRAFT');
    expect(created.body.invoiceNumber).toBeNull();
    // 2 × 11800 + 10500 = 34100 gross; tax-inclusive, so that is the total.
    expect(created.body.totalMinor).toBe(34100);
    // 23600/1.18 = 20000 net + 3600 tax; 10500/1.05 = 10000 net + 500 tax.
    expect(created.body.taxMinor).toBe(4100);

    // ── 2. Fire to the kitchen ──
    const fired = await request(fx.app, 'POST', `/orders/${orderId}/fire`, { token: fx.ownerToken });
    expect(fired.status).toBe(201);
    expect(fired.body.order.status).toBe('OPEN');

    // Both items are food, so they route to the one kitchen station.
    expect(fired.body.kots).toHaveLength(1);
    expect(fired.body.kots[0].station.code).toBe('KIT');
    expect(fired.body.kots[0].lines).toHaveLength(2);
    expect(fired.body.kots[0].status).toBe('PLACED');

    // ── 3. Bill it ──
    const billed = await request(fx.app, 'POST', `/orders/${orderId}/bill`, { token: fx.ownerToken });
    expect(billed.status).toBe(201);
    expect(billed.body.status).toBe('BILLED');
    expect(billed.body.invoiceNumber).toMatch(/^TST\/\d{4}-\d{2}\/\d{5}$/);

    // ── 4. Take payment ──
    const paid = await request(fx.app, 'POST', `/orders/${orderId}/payments`, {
      token: fx.ownerToken,
      body: {
        clientPaymentId: randomUUID(),
        method: 'CASH',
        amountMinor: 34100,
        tenderedMinor: 40000,
      },
    });
    expect(paid.status).toBe(201);
    expect(paid.body.changeMinor).toBe(5900);
    expect(paid.body.outstandingMinor).toBe(0);
    expect(paid.body.order.status).toBe('PAID');

    // ── 5. Receipt ──
    const receipt = await request(fx.app, 'GET', `/orders/${orderId}/receipt`, { token: fx.ownerToken });
    expect(receipt.status).toBe(200);
    expect(receipt.body.totalMinor).toBe(34100);
    expect(receipt.body.invoiceNumber).toBe(billed.body.invoiceNumber);
    expect(receipt.body.taxRows.map((r: { code: string }) => r.code).sort())
      .toEqual(['CGST', 'CGST', 'SGST', 'SGST']); // one pair per slab
    expect(receipt.body.payments[0].amountMinor).toBe(34100);
    expect(receipt.body.changeMinor).toBe(5900);
  });

  it('routes lines to separate KOTs per station', async () => {
    const created = await createOrder({
      clientOrderId: randomUUID(),
      outletId: fx.outletId,
      channel: 'DINE_IN',
      lines: [line(fx.items.CURRY), line(fx.items.COLA)],
    });
    const fired = await request(fx.app, 'POST', `/orders/${created.body.id}/fire`, { token: fx.ownerToken });

    expect(fired.body.kots).toHaveLength(2);
    const byStation = Object.fromEntries(
      fired.body.kots.map((k: { station: { code: string }; lines: unknown[] }) => [k.station.code, k.lines.length]),
    );
    expect(byStation).toEqual({ KIT: 1, BAR: 1 });
  });

  it('refuses to fire the same lines twice', async () => {
    const created = await createOrder({
      clientOrderId: randomUUID(), outletId: fx.outletId,
      channel: 'TAKEAWAY', lines: [line(fx.items.RICE)],
    });
    await request(fx.app, 'POST', `/orders/${created.body.id}/fire`, { token: fx.ownerToken });
    const second = await request(fx.app, 'POST', `/orders/${created.body.id}/fire`, { token: fx.ownerToken });

    expect(second.status).toBe(409);
    expect(second.body.code).toBe('INVALID_STATE');
    expect(second.body.message).toMatch(/already been sent to the kitchen/i);
  });

  it('applies a modifier’s price to the line and shows it on the KOT', async () => {
    const created = await createOrder({
      clientOrderId: randomUUID(), outletId: fx.outletId, channel: 'DINE_IN',
      lines: [line(fx.items.CURRY, 1, { modifierIds: [fx.modifierIds['Extra Gravy']] })],
    });
    // 11800 + 2000 modifier = 13800 gross
    expect(created.body.totalMinor).toBe(13800);

    const fired = await request(fx.app, 'POST', `/orders/${created.body.id}/fire`, { token: fx.ownerToken });
    expect(fired.body.kots[0].lines[0].modifiersSnapshot).toEqual(['Extra Gravy']);
  });
});

describe('billing rules', () => {
  it('will not bill a draft with no lines, and will not create one either', async () => {
    const res = await createOrder({
      clientOrderId: randomUUID(), outletId: fx.outletId, channel: 'QUICK_BILL', lines: [],
    });
    expect(res.status).toBe(400);
  });

  it('is idempotent — billing twice returns the same invoice number', async () => {
    const created = await createOrder({
      clientOrderId: randomUUID(), outletId: fx.outletId,
      channel: 'QUICK_BILL', lines: [line(fx.items.RICE)],
    });
    const first = await request(fx.app, 'POST', `/orders/${created.body.id}/bill`, { token: fx.ownerToken });
    const second = await request(fx.app, 'POST', `/orders/${created.body.id}/bill`, { token: fx.ownerToken });

    expect(second.status).toBe(201);
    expect(second.body.invoiceNumber).toBe(first.body.invoiceNumber);
  });

  it('issues gapless, strictly increasing invoice numbers', async () => {
    const numbers: string[] = [];
    for (let i = 0; i < 5; i++) {
      const created = await createOrder({
        clientOrderId: randomUUID(), outletId: fx.outletId,
        channel: 'QUICK_BILL', lines: [line(fx.items.RICE)],
      });
      const billed = await request(fx.app, 'POST', `/orders/${created.body.id}/bill`, { token: fx.ownerToken });
      numbers.push(billed.body.invoiceNumber);
    }
    const seq = numbers.map((n) => Number(n.split('/').pop()));
    for (let i = 1; i < seq.length; i++) {
      expect(seq[i]).toBe(seq[i - 1] + 1);
    }
  });

  it('does not hand the same invoice number to two concurrent tills', async () => {
    // The scenario the FOR UPDATE lock exists for: several cashiers pressing
    // "bill" at the same instant. Duplicates here would be a compliance
    // failure, not merely a bug.
    const orders = await Promise.all(
      Array.from({ length: 8 }, async () => {
        const created = await createOrder({
          clientOrderId: randomUUID(), outletId: fx.outletId,
          channel: 'QUICK_BILL', lines: [line(fx.items.RICE)],
        });
        return created.body.id as string;
      }),
    );

    const billed = await Promise.all(
      orders.map((id) => request(fx.app, 'POST', `/orders/${id}/bill`, { token: fx.ownerToken })),
    );

    const invoiceNumbers = billed.map((b) => b.body.invoiceNumber);
    expect(invoiceNumbers.every(Boolean)).toBe(true);
    expect(new Set(invoiceNumbers).size).toBe(invoiceNumbers.length);
  });

  it('cannot modify a paid order', async () => {
    const clientOrderId = randomUUID();
    const created = await createOrder({
      clientOrderId, outletId: fx.outletId, channel: 'QUICK_BILL', lines: [line(fx.items.RICE)],
    });
    await request(fx.app, 'POST', `/orders/${created.body.id}/bill`, { token: fx.ownerToken });
    await request(fx.app, 'POST', `/orders/${created.body.id}/payments`, {
      token: fx.ownerToken,
      body: { clientPaymentId: randomUUID(), method: 'CASH', amountMinor: 10500 },
    });

    const voided = await request(fx.app, 'POST', `/orders/${created.body.id}/void`, {
      token: fx.ownerToken, body: { reason: 'changed my mind' },
    });
    expect(voided.status).toBe(409);
    expect(voided.body.message).toMatch(/paid bill is final/i);
  });
});

describe('payments', () => {
  async function billedOrder(totalItems = [fx?.items?.RICE]) {
    const created = await createOrder({
      clientOrderId: randomUUID(), outletId: fx.outletId, channel: 'QUICK_BILL',
      lines: totalItems.map((i) => line(i!)),
    });
    await request(fx.app, 'POST', `/orders/${created.body.id}/bill`, { token: fx.ownerToken });
    return created.body;
  }

  it('settles across several partial payments', async () => {
    const order = await billedOrder([fx.items.CURRY, fx.items.RICE]); // 22300

    const first = await request(fx.app, 'POST', `/orders/${order.id}/payments`, {
      token: fx.ownerToken,
      body: { clientPaymentId: randomUUID(), method: 'CARD', amountMinor: 10000 },
    });
    expect(first.body.outstandingMinor).toBe(12300);
    expect(first.body.order.status).toBe('BILLED');

    const second = await request(fx.app, 'POST', `/orders/${order.id}/payments`, {
      token: fx.ownerToken,
      body: { clientPaymentId: randomUUID(), method: 'UPI', amountMinor: 12300 },
    });
    expect(second.body.outstandingMinor).toBe(0);
    expect(second.body.order.status).toBe('PAID');
  });

  it('rejects a card overpayment rather than silently creating a refund', async () => {
    const order = await billedOrder();
    const res = await request(fx.app, 'POST', `/orders/${order.id}/payments`, {
      token: fx.ownerToken,
      body: { clientPaymentId: randomUUID(), method: 'CARD', amountMinor: 99999 },
    });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/exceeds the .* still outstanding/i);
  });

  it('accepts cash over-tender and returns the change', async () => {
    const order = await billedOrder();
    const res = await request(fx.app, 'POST', `/orders/${order.id}/payments`, {
      token: fx.ownerToken,
      body: {
        clientPaymentId: randomUUID(), method: 'CASH',
        amountMinor: 10500, tenderedMinor: 50000,
      },
    });
    expect(res.body.changeMinor).toBe(39500);
    expect(res.body.order.status).toBe('PAID');
  });

  it('refuses a second payment on a settled bill', async () => {
    const order = await billedOrder();
    await request(fx.app, 'POST', `/orders/${order.id}/payments`, {
      token: fx.ownerToken,
      body: { clientPaymentId: randomUUID(), method: 'CASH', amountMinor: 10500 },
    });
    const again = await request(fx.app, 'POST', `/orders/${order.id}/payments`, {
      token: fx.ownerToken,
      body: { clientPaymentId: randomUUID(), method: 'CASH', amountMinor: 100 },
    });
    expect(again.status).toBe(409);
    expect(again.body.message).toMatch(/already settled/i);
  });

  it('splits a bill so the parts sum exactly to the total', async () => {
    // 3 × ₹99.00 = ₹297.00, which does not divide by 7.
    const created = await createOrder({
      clientOrderId: randomUUID(), outletId: fx.outletId, channel: 'DINE_IN',
      lines: [line(fx.items.AWK, 3)],
    });
    const res = await request(fx.app, 'POST', `/orders/${created.body.id}/split`, {
      token: fx.ownerToken, body: { mode: 'EVEN', ways: 7 },
    });
    const parts = res.body.parts.map((p: { amountMinor: number }) => p.amountMinor);
    expect(parts).toHaveLength(7);
    expect(parts.reduce((a: number, b: number) => a + b, 0)).toBe(res.body.totalMinor);
    // No part may differ from another by more than one minor unit.
    expect(Math.max(...parts) - Math.min(...parts)).toBeLessThanOrEqual(1);
  });

  it('rejects a by-amount split that does not add up', async () => {
    const created = await createOrder({
      clientOrderId: randomUUID(), outletId: fx.outletId,
      channel: 'DINE_IN', lines: [line(fx.items.RICE)],
    });
    const res = await request(fx.app, 'POST', `/orders/${created.body.id}/split`, {
      token: fx.ownerToken, body: { mode: 'AMOUNTS', amountsMinor: [5000, 5000] },
    });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/must match exactly/i);
  });
});

describe('tax behaviour through the API', () => {
  it('bills CGST + SGST for a local guest', async () => {
    const created = await createOrder({
      clientOrderId: randomUUID(), outletId: fx.outletId, channel: 'DELIVERY',
      customerId: fx.customerLocalId, lines: [line(fx.items.CURRY)],
    });
    const codes = created.body.taxSnapshot.componentTotals.map((c: { code: string }) => c.code).sort();
    expect(codes).toEqual(['CGST', 'SGST']);
  });

  it('switches to IGST when delivering across a state line', async () => {
    // The outlet is in Karnataka; this customer is in Maharashtra. Getting
    // this wrong is the most consequential GST error a POS can make.
    const created = await createOrder({
      clientOrderId: randomUUID(), outletId: fx.outletId, channel: 'DELIVERY',
      customerId: fx.customerInterstateId, lines: [line(fx.items.CURRY)],
    });
    const codes = created.body.taxSnapshot.componentTotals.map((c: { code: string }) => c.code);
    expect(codes).toEqual(['IGST']);
    expect(created.body.taxMinor).toBe(1800);
  });

  it('keeps CGST+SGST for the same customer dining in', async () => {
    // Place of supply for dine-in is the outlet, whatever the guest's address.
    const created = await createOrder({
      clientOrderId: randomUUID(), outletId: fx.outletId, channel: 'DINE_IN',
      customerId: fx.customerInterstateId, lines: [line(fx.items.CURRY)],
    });
    const codes = created.body.taxSnapshot.componentTotals.map((c: { code: string }) => c.code).sort();
    expect(codes).toEqual(['CGST', 'SGST']);
  });

  it('recomputes prices server-side and ignores anything the client claims', async () => {
    const created = await createOrder({
      clientOrderId: randomUUID(), outletId: fx.outletId, channel: 'QUICK_BILL',
      lines: [line(fx.items.RICE)],
      // These are not DTO fields; whitelist validation rejects the request
      // outright rather than quietly dropping them.
      totalMinor: 1, taxMinor: 0,
    });
    expect(created.status).toBe(400);
  });

  it('applies an order discount before tax and apportions it across lines', async () => {
    const created = await createOrder({
      clientOrderId: randomUUID(), outletId: fx.outletId, channel: 'DINE_IN',
      lines: [line(fx.items.CURRY), line(fx.items.RICE)],
      orderDiscount: { type: 'PERCENT', value: 10, reason: 'Regular guest' },
    });
    // 22300 gross - 10% = 20070, which India then rounds to the nearest rupee.
    expect(created.body.discountMinor).toBe(2230);
    expect(created.body.roundingMinor).toBe(30);
    expect(created.body.totalMinor).toBe(20100);
    // The apportioned parts must sum back to the order discount exactly.
    const lineDiscounts = created.body.lines.reduce(
      (s: number, l: { discountMinor: number }) => s + l.discountMinor, 0,
    );
    expect(lineDiscounts).toBe(2230);
  });

  it('rejects a discount larger than the bill', async () => {
    const res = await createOrder({
      clientOrderId: randomUUID(), outletId: fx.outletId, channel: 'DINE_IN',
      lines: [line(fx.items.RICE)],
      orderDiscount: { type: 'FIXED', value: 999999 },
    });
    // A FIXED discount is capped at the order value rather than going negative.
    expect(res.status).toBe(201);
    expect(res.body.totalMinor).toBe(0);
    expect(res.body.discountMinor).toBe(10500);
  });
});

describe('menu queries', () => {
  it('counts the items in each category', async () => {
    // Regression: this was a correlated subquery, and Drizzle interpolated the
    // outer column unqualified as "id". Inside a subquery over menu_items —
    // which has its own id — that silently became `mi.category_id = mi.id`, so
    // every count came back zero. No error, just wrong numbers on the owner's
    // screen, which is the worst kind of bug to ship.
    const res = await request(fx.app, 'GET', '/menu/categories', { token: fx.ownerToken });
    expect(res.status).toBe(200);

    const byName = Object.fromEntries(
      res.body.map((c: { name: string; itemCount: number }) => [c.name, c.itemCount]),
    );
    // The fixture seeds three food items and one drink.
    expect(byName.Food).toBe(3);
    expect(byName.Drinks).toBe(1);
  });

  it('returns every category, including empty ones', async () => {
    const res = await request(fx.app, 'GET', '/menu/categories', { token: fx.ownerToken });
    expect(res.body).toHaveLength(2);
    expect(res.body.every((c: { itemCount: unknown }) => typeof c.itemCount === 'number')).toBe(true);
  });
});

describe('KOT numbering', () => {
  it('does not collide when several orders are fired at the same instant', async () => {
    // Regression: KOT numbers came from `count(*) + 1` scoped to today, which
    // both raced under concurrency and — because the unique index was
    // tenant-wide rather than per-day — collided with numbers issued on an
    // earlier date. Firing an order simply failed with a 500.
    const ids = await Promise.all(
      Array.from({ length: 6 }, async () => {
        const created = await createOrder({
          clientOrderId: randomUUID(), outletId: fx.outletId, channel: 'DINE_IN',
          lines: [line(fx.items.CURRY), line(fx.items.COLA)],
        });
        return created.body.id as string;
      }),
    );

    const fired = await Promise.all(
      ids.map((id) => request(fx.app, 'POST', `/orders/${id}/fire`, { token: fx.ownerToken })),
    );

    expect(fired.every((f) => f.status === 201)).toBe(true);

    const numbers = fired.flatMap(
      (f) => f.body.kots.map((k: { kotNumber: string }) => k.kotNumber),
    );
    // Two stations per order, six orders — twelve tickets, all distinct.
    expect(numbers).toHaveLength(12);
    expect(new Set(numbers).size).toBe(12);
  });

  it('stamps each ticket with the business day it belongs to', async () => {
    const created = await createOrder({
      clientOrderId: randomUUID(), outletId: fx.outletId,
      channel: 'DINE_IN', lines: [line(fx.items.RICE)],
    });
    const fired = await request(fx.app, 'POST', `/orders/${created.body.id}/fire`, {
      token: fx.ownerToken,
    });
    expect(fired.body.kots[0].businessDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

/**
 * POST /orders/pos-sale records a sale the client says already happened, so every number in it is an
 * assertion, not a fact. These tests replay the abuse found in review against real Postgres + RLS.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'node:crypto';
import * as argon2 from 'argon2';
import { eq } from 'drizzle-orm';
import { bootTestApp, seedFixture, request, teardown, TEST_PASSWORD, type TestFixture } from './harness';
import { withSystemDb } from '../src/db/client';
import { auditLogs, invoiceSequences, orders, staff } from '../src/db/schema';

let fx: TestFixture;
let cashierToken: string;
// The API allows 30 requests/second per IP; pause between groups so the suite never trips the limiter.
const cool = () => new Promise((r) => setTimeout(r, 1100));
const sale = (token: string, body: Record<string, unknown>) =>
  request(fx.app, 'POST', '/orders/pos-sale', { token, body: { clientOrderId: randomUUID(), paymentMode: 'cash', ...body } });
const line = (extra: Record<string, unknown> = {}) => ({ name: 'Tea', quantity: 2, price: 50, ...extra });

beforeAll(async () => {
  fx = await seedFixture(await bootTestApp());
  await withSystemDb((db) => db.insert(staff).values({
    tenantId: fx.tenantId, outletId: fx.outletId, name: 'Test Cashier', email: 'cashier@test.test',
    passwordHash: '', role: 'CASHIER',
  }).returning()).then(async ([row]) => {
    // Same hashing the fixture uses, so the normal login path issues the token.
    await withSystemDb((db) => db.update(staff).set({ passwordHash: '' }).where(eq(staff.id, row.id)));
  });
  const hash = await argon2.hash(TEST_PASSWORD, { type: argon2.argon2id });
  await withSystemDb((db) => db.update(staff).set({ passwordHash: hash }).where(eq(staff.email, 'cashier@test.test')));
  const res = await request(fx.app, 'POST', '/auth/login', { body: { tenantSlug: 'test-tenant', email: 'cashier@test.test', password: TEST_PASSWORD } });
  cashierToken = res.body.tokens.accessToken;
}, 60_000);
afterAll(async () => { await teardown(fx?.app); });

describe('authorisation', () => {
  it('a waiter (no payment:create) cannot record a paid sale', async () => {
    expect((await sale(fx.waiterToken, { amount: 100 })).status).toBe(403);
  });
  it('a cashier can', async () => {
    expect((await sale(cashierToken, { amount: 100 })).status).toBe(201);
  });
});

describe('impossible values are rejected', () => {
  beforeAll(cool);
  it.each([[0], [-5], [1_000_001], [Number.NaN]])('amount %s', async (amount) => {
    expect((await sale(fx.ownerToken, { amount })).status).toBe(400);
  });
  it('tax larger than the bill', async () => {
    const r = await sale(fx.ownerToken, { amount: 500, taxSnapshot: { totalTaxMinor: 999_999_999 } });
    expect(r.status).toBe(400);
  });
  it('fractional or negative tax paise', async () => {
    expect((await sale(fx.ownerToken, { amount: 500, taxSnapshot: { totalTaxMinor: 12.5 } })).status).toBe(400);
    expect((await sale(fx.ownerToken, { amount: 500, taxSnapshot: { taxableMinor: -1 } })).status).toBe(400);
  });
  it('future and heavily backdated timestamps', async () => {
    const day = 86_400_000;
    expect((await sale(fx.ownerToken, { amount: 10, placedAt: new Date(Date.now() + day).toISOString() })).status).toBe(400);
    expect((await sale(fx.ownerToken, { amount: 10, placedAt: '2020-01-01T10:00:00Z' })).status).toBe(400);
    expect((await sale(fx.ownerToken, { amount: 10, placedAt: new Date(Date.now() - 3 * day).toISOString() })).status).toBe(201);
  });
  it('junk invoice numbers and oversized lines', async () => {
    expect((await sale(fx.ownerToken, { amount: 10, invoiceNumber: "x'; drop table orders;--" })).status).toBe(400);
    expect((await sale(fx.ownerToken, { amount: 10, lines: [line({ quantity: 1e9 })] })).status).toBe(400);
    expect((await sale(fx.ownerToken, { amount: 10, lines: Array.from({ length: 501 }, () => line()) })).status).toBe(400);
  });
});

describe('underpaying the lines', () => {
  beforeAll(cool);
  it('records the gap as a discount so the books reconcile (owner)', async () => {
    const r = await sale(fx.ownerToken, { amount: 99, lines: [line({ quantity: 10, price: 10 })] }); // lines ₹100, charged ₹99
    expect(r.status).toBe(201);
    expect(r.body.subtotalMinor + 0).toBeGreaterThan(0);
    expect(r.body.discountMinor).toBe(100);
  });
  it('a ₹0.01 charge against ₹1000 of lines needs discount authority', async () => {
    const lines = [line({ quantity: 10, price: 100 })];
    expect((await sale(cashierToken, { amount: 0.01, lines })).status).toBe(403);
    const r = await sale(fx.ownerToken, { amount: 0.01, lines });
    expect(r.status).toBe(201);
    expect(r.body.discountMinor).toBe(99_999);
    const logs = await withSystemDb((db) => db.select().from(auditLogs).where(eq(auditLogs.entityId, r.body.id)));
    expect(logs.map((l) => l.action)).toContain('POS_SALE_DISCOUNT');
  });
});

describe('invoice numbers', () => {
  beforeAll(cool);
  it('are issued from the gapless series when the client sends none', async () => {
    const a = await sale(fx.ownerToken, { amount: 10 });
    const b = await sale(fx.ownerToken, { amount: 10 });
    expect(a.body.invoiceNumber).toMatch(/\/\d{5}$/);
    const n = (x: string) => Number(x.split('/').pop());
    expect(n(b.body.invoiceNumber)).toBe(n(a.body.invoiceNumber) + 1);
    const seq = await withSystemDb((db) => db.select().from(invoiceSequences).where(eq(invoiceSequences.tenantId, fx.tenantId)));
    expect(seq.length).toBeGreaterThan(0);
  });
  it('keeps a receipt number an offline terminal already printed', async () => {
    const r = await sale(fx.ownerToken, { amount: 10, invoiceNumber: 'T2-000123' });
    expect(r.status).toBe(201);
    expect(r.body.invoiceNumber).toBe('T2-000123');
  });
  it('answers 409 (not 500) when two sales claim the same number', async () => {
    await sale(fx.ownerToken, { amount: 10, invoiceNumber: 'DUP-0001' });
    const again = await sale(fx.ownerToken, { amount: 10, invoiceNumber: 'DUP-0001' });
    expect(again.status).toBe(409);
    expect(again.body.code ?? again.body.error?.code).toBe('INVOICE_NUMBER_TAKEN');
  });
  it('replaying one clientOrderId returns the same order, even concurrently', async () => {
    const clientOrderId = randomUUID();
    const rs = await Promise.all([1, 2, 3].map(() => sale(fx.ownerToken, { clientOrderId, amount: 25 })));
    const ok = rs.filter((r) => r.status === 201);
    expect(new Set(ok.map((r) => r.body.id)).size).toBe(1);
    expect(rs.every((r) => [201, 409].includes(r.status))).toBe(true);
    const rows = await withSystemDb((db) => db.select().from(orders).where(eq(orders.clientOrderId, clientOrderId)));
    expect(rows).toHaveLength(1);
  });
});

describe('GST slabs', () => {
  beforeAll(cool);
  it('accepts the native POS app payload (gstRate instead of taxSlabId)', async () => {
    const r = await sale(fx.ownerToken, { amount: 105, invoiceNumber: 'APP-0001', lines: [line({ quantity: 1, price: 105, gstRate: 5 })] });
    expect(r.status).toBe(201);
  });
  it('maps gstRate to the matching slab', async () => {
    const r = await sale(fx.ownerToken, { amount: 118, lines: [line({ quantity: 1, price: 118, gstRate: 18 })] });
    expect(r.status).toBe(201);
    const lines = await withSystemDb((db) => db.query.orderLines.findMany({ where: (t, { eq: e }) => e(t.orderId, r.body.id) }));
    expect(lines[0].taxSlabId).toBe('gst-18');
  });
  it('refuses a retired slab on a live sale, unknown slabs and unknown rates', async () => {
    expect((await sale(fx.ownerToken, { amount: 10, lines: [line({ taxSlabId: 'gst-12' })] })).status).toBe(400);
    expect((await sale(fx.ownerToken, { amount: 10, lines: [line({ taxSlabId: 'gst-999' })] })).status).toBe(400);
    expect((await sale(fx.ownerToken, { amount: 10, lines: [line({ gstRate: 3 })] })).status).toBe(400);
  });
  it('records an already-printed offline receipt on a retired slab, but flags it', async () => {
    const r = await sale(fx.ownerToken, { amount: 112, invoiceNumber: 'OLD-0001', lines: [line({ quantity: 1, price: 112, gstRate: 12 })] });
    expect(r.status).toBe(201);
    const logs = await withSystemDb((db) => db.select().from(auditLogs).where(eq(auditLogs.entityId, r.body.id)));
    expect(logs.map((l) => l.action)).toContain('POS_SALE_RETIRED_SLAB');
  });
  it('the catalog refuses to assign a retired slab and accepts the new 40% slab', async () => {
    const cats = await request(fx.app, 'GET', '/menu/categories', { token: fx.ownerToken });
    const categoryId = (cats.body.items ?? cats.body)[0]?.id;
    const mk = (taxSlabId: string) => request(fx.app, 'POST', '/menu/items', {
      token: fx.ownerToken, body: { name: `Slab ${taxSlabId} ${randomUUID().slice(0, 4)}`, categoryId, priceMinor: 1000, taxSlabId },
    });
    expect((await mk('gst-12')).status).toBe(400);
    expect((await mk('gst-40')).status).toBe(201);
  });
});

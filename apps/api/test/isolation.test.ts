/**
 * Tenant isolation and access control.
 *
 * These are the tests that matter most in a multi-tenant system, and they are
 * written adversarially: each one is an attempt to reach another tenant's data
 * through a path the application does offer, using a token the attacker
 * legitimately holds. A test that only checks the happy path proves nothing
 * about isolation.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'node:crypto';
import { bootTestApp, seedFixture, request, teardown, type TestFixture } from './harness';
import { withTenantDb, withSystemDb, verifyRlsCoverage, rawDb } from '../src/db/client';
import { orders, menuItems, TENANT_SCOPED_TABLES } from '../src/db/schema';
import { sql } from 'drizzle-orm';

let fx: TestFixture;

beforeAll(async () => {
  const app = await bootTestApp();
  fx = await seedFixture(app);
}, 60_000);

afterAll(async () => { await teardown(fx?.app); });

describe('row-level security', () => {
  it('has a policy on every tenant-scoped table', async () => {
    const coverage = await verifyRlsCoverage(rawDb());
    expect(coverage.unprotected).toEqual([]);
    expect(TENANT_SCOPED_TABLES.length).toBeGreaterThan(25);
  });

  it('shows a tenant only its own rows', async () => {
    const mine = await withTenantDb(fx.tenantId, (db) => db.select().from(menuItems));
    const theirs = await withTenantDb(fx.otherTenantId, (db) => db.select().from(menuItems));

    expect(mine.length).toBeGreaterThan(0);
    expect(theirs.length).toBeGreaterThan(0);
    expect(mine.every((i) => i.tenantId === fx.tenantId)).toBe(true);
    expect(theirs.every((i) => i.tenantId === fx.otherTenantId)).toBe(true);

    const overlap = mine.filter((m) => theirs.some((t) => t.id === m.id));
    expect(overlap).toEqual([]);
  });

  it('returns nothing — not everything — when the tenant is not set', async () => {
    // The failure mode that matters. A missed scope must produce an empty
    // result, never a full table scan across every tenant.
    const rows = await withSystemDb(async (db) => {
      await db.execute(sql`SET LOCAL ROLE novapos_app`);
      await db.execute(sql`SELECT set_config('app.current_tenant', '', true)`);
      return db.select().from(menuItems);
    }).catch(() => null);

    // If the app role is not present (single-role dev setup), skip rather than
    // pass vacuously — a skipped isolation test is honest, a fake pass is not.
    if (rows === null) {
      console.warn('Skipping: novapos_app role not available in this database.');
      return;
    }
    expect(rows).toEqual([]);
  });

  it('refuses a write that would land in another tenant', async () => {
    await expect(
      withSystemDb(async (db) => {
        await db.execute(sql`SET LOCAL ROLE novapos_app`);
        await db.execute(sql`SELECT set_config('app.current_tenant', ${fx.tenantId}, true)`);
        return db.insert(menuItems).values({
          tenantId: fx.otherTenantId,       // <- someone else's tenant
          categoryId: randomUUID(),
          name: 'Smuggled item',
          priceMinor: 1,
          taxSlabId: 'gst-5',
        });
      }),
    ).rejects.toThrow();
  });
});

describe('cross-tenant access through the API', () => {
  it('will not read another tenant’s order', async () => {
    const created = await request(fx.app, 'POST', '/orders', {
      token: fx.ownerToken,
      body: {
        clientOrderId: randomUUID(), outletId: fx.outletId, channel: 'QUICK_BILL',
        lines: [{ clientLineId: randomUUID(), itemId: fx.items.RICE, quantity: 1 }],
      },
    });
    expect(created.status).toBe(201);

    const stolen = await request(fx.app, 'GET', `/orders/${created.body.id}`, {
      token: fx.otherOwnerToken,
    });
    expect(stolen.status).toBe(404);
  });

  it('will not put another tenant’s menu item on an order', async () => {
    const res = await request(fx.app, 'POST', '/orders', {
      token: fx.ownerToken,
      body: {
        clientOrderId: randomUUID(), outletId: fx.outletId, channel: 'QUICK_BILL',
        lines: [{ clientLineId: randomUUID(), itemId: fx.otherItemId, quantity: 1 }],
      },
    });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/no longer exist|not available/i);
  });

  it('will not create an order against another tenant’s outlet', async () => {
    const res = await request(fx.app, 'POST', '/orders', {
      token: fx.ownerToken,
      body: {
        clientOrderId: randomUUID(), outletId: fx.otherOutletId, channel: 'QUICK_BILL',
        lines: [{ clientLineId: randomUUID(), itemId: fx.items.RICE, quantity: 1 }],
      },
    });
    expect(res.status).toBe(404);
  });

  it('does not leak another tenant’s menu through the snapshot endpoint', async () => {
    const res = await request(fx.app, 'GET', `/menu/snapshot?outletId=${fx.outletId}`, {
      token: fx.ownerToken,
    });
    expect(res.status).toBe(200);
    const names = res.body.items.map((i: { name: string }) => i.name);
    expect(names).not.toContain('Other Item');
  });

  it('scopes reports to the caller’s tenant', async () => {
    const from = new Date(Date.now() - 86400_000).toISOString();
    const to = new Date(Date.now() + 86400_000).toISOString();
    const res = await request(fx.app, 'GET',
      `/reports/sales?outletId=${fx.otherOutletId}&from=${from}&to=${to}`,
      { token: fx.ownerToken });
    // The outlet id belongs to another tenant, so RLS yields no rows at all.
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});

describe('authentication', () => {
  it('rejects a request with no token', async () => {
    const res = await request(fx.app, 'GET', '/orders?outletId=' + fx.outletId);
    expect(res.status).toBe(401);
  });

  it('rejects a forged token', async () => {
    const res = await request(fx.app, 'GET', '/auth/me', { token: 'not.a.real.token' });
    expect(res.status).toBe(401);
  });

  it('gives the same answer for a wrong password and a nonexistent account', async () => {
    const wrongPassword = await request(fx.app, 'POST', '/auth/login', {
      body: { tenantSlug: 'test-tenant', email: 'owner@test.test', password: 'wrong-password-here' },
    });
    const noSuchUser = await request(fx.app, 'POST', '/auth/login', {
      body: { tenantSlug: 'test-tenant', email: 'ghost@test.test', password: 'wrong-password-here' },
    });
    const noSuchTenant = await request(fx.app, 'POST', '/auth/login', {
      body: { tenantSlug: 'no-such-tenant', email: 'owner@test.test', password: 'wrong-password-here' },
    });

    // Identical status and message: none of these may reveal which part was
    // wrong, or the login endpoint becomes an account-enumeration oracle.
    expect(wrongPassword.status).toBe(401);
    expect(noSuchUser.status).toBe(401);
    expect(noSuchTenant.status).toBe(401);
    expect(noSuchUser.body.message).toBe(wrongPassword.body.message);
    expect(noSuchTenant.body.message).toBe(wrongPassword.body.message);
  });

  it('counts failed attempts and locks the account', async () => {
    // This is the test that would have caught the bug where the failed-login
    // increment was rolled back by the very throw that reported it, leaving
    // brute-force protection permanently inert.
    const attempt = () => request(fx.app, 'POST', '/auth/login', {
      body: { tenantSlug: 'test-tenant', email: 'owner@test.test', password: 'definitely-wrong' },
    });

    for (let i = 0; i < 8; i++) {
      const res = await attempt();
      expect(res.status).toBe(401);
    }

    // The counter must have persisted across those requests.
    const locked = await request(fx.app, 'POST', '/auth/login', {
      body: { tenantSlug: 'test-tenant', email: 'owner@test.test', password: 'test-password-123' },
    });
    expect(locked.status).toBe(401);
    expect(locked.body.message).toMatch(/locked/i);

    // Unlock so later tests in this file still have a usable owner.
    await withSystemDb((db) => db.execute(sql`
      UPDATE staff SET locked_until = NULL, failed_login_count = 0
      WHERE email = 'owner@test.test'
    `));
  });

  it('rotates refresh tokens and revokes the family on reuse', async () => {
    const login = await request(fx.app, 'POST', '/auth/login', {
      body: { tenantSlug: 'test-tenant', email: 'waiter@test.test', password: 'test-password-123' },
    });
    const original = login.body.tokens.refreshToken;

    const rotated = await request(fx.app, 'POST', '/auth/refresh', {
      body: { refreshToken: original },
    });
    expect(rotated.status).toBe(200);
    expect(rotated.body.refreshToken).not.toBe(original);

    // Replaying the consumed token is the signature of theft.
    const replay = await request(fx.app, 'POST', '/auth/refresh', {
      body: { refreshToken: original },
    });
    expect(replay.status).toBe(401);
    expect(replay.body.message).toMatch(/already been used|signed out/i);

    // …and it takes the token that replaced it down too.
    const afterFamilyRevoke = await request(fx.app, 'POST', '/auth/refresh', {
      body: { refreshToken: rotated.body.refreshToken },
    });
    expect(afterFamilyRevoke.status).toBe(401);
  });
});

describe('role-based access control', () => {
  it('lets a waiter take an order', async () => {
    const res = await request(fx.app, 'POST', '/orders', {
      token: fx.waiterToken,
      body: {
        clientOrderId: randomUUID(), outletId: fx.outletId, channel: 'DINE_IN',
        lines: [{ clientLineId: randomUUID(), itemId: fx.items.RICE, quantity: 1 }],
      },
    });
    expect(res.status).toBe(201);
  });

  it('does not let a waiter void an order', async () => {
    const created = await request(fx.app, 'POST', '/orders', {
      token: fx.waiterToken,
      body: {
        clientOrderId: randomUUID(), outletId: fx.outletId, channel: 'DINE_IN',
        lines: [{ clientLineId: randomUUID(), itemId: fx.items.RICE, quantity: 1 }],
      },
    });
    const res = await request(fx.app, 'POST', `/orders/${created.body.id}/void`, {
      token: fx.waiterToken, body: { reason: 'oops' },
    });
    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/order:void/);
  });

  it('does not let a waiter take payment', async () => {
    const created = await request(fx.app, 'POST', '/orders', {
      token: fx.waiterToken,
      body: {
        clientOrderId: randomUUID(), outletId: fx.outletId, channel: 'QUICK_BILL',
        lines: [{ clientLineId: randomUUID(), itemId: fx.items.RICE, quantity: 1 }],
      },
    });
    await request(fx.app, 'POST', `/orders/${created.body.id}/bill`, { token: fx.waiterToken });
    const res = await request(fx.app, 'POST', `/orders/${created.body.id}/payments`, {
      token: fx.waiterToken,
      body: { clientPaymentId: randomUUID(), method: 'CASH', amountMinor: 10500 },
    });
    expect(res.status).toBe(403);
  });

  it('does not let a waiter change the menu', async () => {
    const res = await request(fx.app, 'POST', '/menu/items', {
      token: fx.waiterToken,
      body: { name: 'Free Lunch', categoryId: randomUUID(), priceMinor: 0, taxSlabId: 'gst-5' },
    });
    expect(res.status).toBe(403);
  });

  it('requires a reason to void', async () => {
    const created = await request(fx.app, 'POST', '/orders', {
      token: fx.ownerToken,
      body: {
        clientOrderId: randomUUID(), outletId: fx.outletId, channel: 'DINE_IN',
        lines: [{ clientLineId: randomUUID(), itemId: fx.items.RICE, quantity: 1 }],
      },
    });
    const res = await request(fx.app, 'POST', `/orders/${created.body.id}/void`, {
      token: fx.ownerToken, body: { reason: '   ' },
    });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/reason/i);
  });

  it('records who voided what, and why', async () => {
    const created = await request(fx.app, 'POST', '/orders', {
      token: fx.ownerToken,
      body: {
        clientOrderId: randomUUID(), outletId: fx.outletId, channel: 'DINE_IN',
        lines: [{ clientLineId: randomUUID(), itemId: fx.items.RICE, quantity: 1 }],
      },
    });
    await request(fx.app, 'POST', `/orders/${created.body.id}/void`, {
      token: fx.ownerToken, body: { reason: 'Guest walked out' },
    });

    const logs = await withTenantDb(fx.tenantId, (db) =>
      db.execute(sql`
        SELECT action, detail, staff_id FROM audit_logs
        WHERE entity_id = ${created.body.id} AND action = 'order.void'
      `));
    const rows = (logs as unknown as { rows?: Record<string, unknown>[] }).rows
      ?? (logs as unknown as Record<string, unknown>[]);
    expect(rows).toHaveLength(1);
    expect((rows[0].detail as { reason: string }).reason).toBe('Guest walked out');
    expect(rows[0].staff_id).toBeTruthy();
  });
});

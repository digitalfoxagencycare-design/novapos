/**
 * RLS hides other tenants' rows, but a plain FOREIGN KEY check can still see them. The composite
 * (tenant_id, id) foreign keys from migration 0011 make the database refuse a parent from another tenant.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { bootTestApp, seedFixture, teardown, type TestFixture } from './harness';
import { withSystemDb, withTenantDb } from '../src/db/client';
import { menuItemVariants, menuItems, stations, outlets } from '../src/db/schema';
import { eq } from 'drizzle-orm';

let fx: TestFixture;
beforeAll(async () => { fx = await seedFixture(await bootTestApp()); }, 60_000);
afterAll(async () => { await teardown(fx?.app); });

const fkViolation = async (run: () => Promise<unknown>) => {
  try { await run(); } catch (e) {
    const err = e as { cause?: { code?: string; constraint?: string }; code?: string };
    return { code: err.cause?.code ?? err.code, constraint: err.cause?.constraint };
  }
  return null;
};

describe('cross-tenant foreign keys', () => {
  it("a tenant cannot attach a row to another tenant's menu item", async () => {
    const foreignItem = await withSystemDb(async (db) => (await db.select().from(menuItems).where(eq(menuItems.tenantId, fx.otherTenantId)).limit(1))[0]);
    // The other tenant's item really is invisible through RLS ...
    expect(await withTenantDb(fx.tenantId, (db) => db.select().from(menuItems).where(eq(menuItems.id, foreignItem.id)))).toHaveLength(0);
    // ... yet before migration 0011 the FK still accepted it. Now the database refuses.
    const v = await fkViolation(() => withTenantDb(fx.tenantId, (db) =>
      db.insert(menuItemVariants).values({ tenantId: fx.tenantId, itemId: foreignItem.id, name: 'CROSS-TENANT', priceMinor: 1 })));
    expect(v?.code).toBe('23503');
  });

  it("a tenant cannot point a station at another tenant's outlet", async () => {
    const v = await fkViolation(() => withTenantDb(fx.tenantId, (db) =>
      db.insert(stations).values({ tenantId: fx.tenantId, outletId: fx.otherOutletId, name: 'Rogue', code: 'ROGUE' } as never)));
    expect(v?.code).toBe('23503');
  });

  it('same-tenant references still work', async () => {
    const item = await withTenantDb(fx.tenantId, async (db) => (await db.select().from(menuItems).limit(1))[0]);
    await withTenantDb(fx.tenantId, (db) =>
      db.insert(menuItemVariants).values({ tenantId: fx.tenantId, itemId: item.id, name: 'Large', priceMinor: 100 }));
  });

  it('deleting an outlet still cascades exactly as before', async () => {
    const [outlet] = await withSystemDb((db) => db.insert(outlets).values({
      tenantId: fx.tenantId, name: 'Temp', code: 'TMP', country: 'IN', currency: 'INR',
    } as never).returning());
    const [st] = await withSystemDb((db) => db.insert(stations).values({ tenantId: fx.tenantId, outletId: outlet.id, name: 'Temp st', code: 'TST' } as never).returning());
    await withSystemDb((db) => db.delete(outlets).where(eq(outlets.id, outlet.id)));
    expect(await withSystemDb((db) => db.select().from(stations).where(eq(stations.id, st.id)))).toHaveLength(0);
  });
});

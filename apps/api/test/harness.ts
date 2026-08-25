/**
 * Integration-test harness.
 *
 * Boots the real Nest application against a real Postgres database — no mocked
 * repositories. The whole point of these tests is to exercise the things a
 * mock cannot: row-level security, `SELECT … FOR UPDATE` under concurrency,
 * transaction rollback, and the actual SQL the reports emit.
 */
import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as argon2 from 'argon2';
import { eq, sql } from 'drizzle-orm';
import { AppModule } from '../src/app.module';
import { withSystemDb, closePools } from '../src/db/client';
import {
  tenants, outlets, staff, stations, categories, menuItems, modifierGroups,
  modifiers, restaurantTables, printers, taxRuleSets, customers,
} from '../src/db/schema';
import { IN_GST } from '@novapos/tax-engine';

const ARGON = { type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 } as const;
export const TEST_PASSWORD = 'test-password-123';

export interface TestFixture {
  app: INestApplication;
  tenantId: string;
  outletId: string;
  kitchenStationId: string;
  barStationId: string;
  ownerToken: string;
  waiterToken: string;
  items: Record<string, string>;
  modifierIds: Record<string, string>;
  tableIds: string[];
  customerLocalId: string;
  customerInterstateId: string;
  /** A second tenant, so isolation can actually be tested. */
  otherTenantId: string;
  otherOutletId: string;
  otherOwnerToken: string;
  otherItemId: string;
}

export async function bootTestApp(): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication({ rawBody: true });
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true, forbidNonWhitelisted: true, transform: true,
    transformOptions: { enableImplicitConversion: true },
  }));
  await app.init();
  return app;
}

/** Wipe and re-create a known dataset. Called once per test file. */
export async function seedFixture(app: INestApplication): Promise<TestFixture> {
  const passwordHash = await argon2.hash(TEST_PASSWORD, ARGON);

  const data = await withSystemDb(async (db) => {
    // TRUNCATE … CASCADE rather than DELETE: order_lines reference menu_items
    // without ON DELETE CASCADE (deliberately — an old bill must stay
    // reprintable), so a plain delete hits that foreign key.
    await db.execute(sql`TRUNCATE TABLE tenants CASCADE`);

    /* ── Primary tenant ── */
    const [tenant] = await db.insert(tenants).values({
      name: 'Test Restaurant', slug: 'test-tenant', taxId: '29TESTGST1234Z',
      country: 'IN', defaultCurrency: 'INR', taxRuleSetKey: 'IN-GST',
    }).returning();

    await db.insert(taxRuleSets).values({
      tenantId: tenant.id, key: 'IN-GST', label: 'India GST', country: 'IN',
      definition: IN_GST as never,
    });

    const [outlet] = await db.insert(outlets).values({
      tenantId: tenant.id, name: 'Test Outlet', code: 'TST',
      region: 'KA', country: 'IN', currency: 'INR',
      invoicePrefix: 'TST', receiptTemplateId: 'in-gst',
    }).returning();

    const [kitchen, bar] = await db.insert(stations).values([
      { tenantId: tenant.id, outletId: outlet.id, name: 'KITCHEN', code: 'KIT', sortOrder: 0, mode: 'BOTH' },
      { tenantId: tenant.id, outletId: outlet.id, name: 'BAR', code: 'BAR', sortOrder: 1, mode: 'SCREEN' },
    ]).returning();

    await db.insert(staff).values([
      {
        tenantId: tenant.id, name: 'Test Owner', email: 'owner@test.test',
        passwordHash, role: 'OWNER',
      },
      {
        tenantId: tenant.id, outletId: outlet.id, name: 'Test Waiter',
        email: 'waiter@test.test', passwordHash, role: 'WAITER',
      },
    ]);

    const [food, drink] = await db.insert(categories).values([
      { tenantId: tenant.id, name: 'Food', code: 'FOOD', stationId: kitchen.id },
      { tenantId: tenant.id, name: 'Drinks', code: 'DRINK', stationId: bar.id },
    ]).returning();

    const items = await db.insert(menuItems).values([
      // ₹118.00 inclusive at 18% -> exactly ₹100 net, ₹9 CGST, ₹9 SGST.
      { tenantId: tenant.id, categoryId: food.id, name: 'Test Curry', code: 'CURRY',
        priceMinor: 11800, taxSlabId: 'gst-18', hsnSac: '996331' },
      // ₹105.00 inclusive at 5%  -> exactly ₹100 net.
      { tenantId: tenant.id, categoryId: food.id, name: 'Test Rice', code: 'RICE',
        priceMinor: 10500, taxSlabId: 'gst-5', hsnSac: '996331' },
      { tenantId: tenant.id, categoryId: drink.id, name: 'Test Cola', code: 'COLA',
        priceMinor: 6400, taxSlabId: 'gst-28', hsnSac: '2202' },
      // Priced so it cannot divide cleanly — exercises rounding.
      { tenantId: tenant.id, categoryId: food.id, name: 'Awkward Item', code: 'AWK',
        priceMinor: 9900, taxSlabId: 'gst-5', hsnSac: '996331' },
    ]).returning();

    const [extras] = await db.insert(modifierGroups).values({
      tenantId: tenant.id, name: 'Extras', minSelect: 0, maxSelect: 2,
    }).returning();

    const mods = await db.insert(modifiers).values([
      { tenantId: tenant.id, groupId: extras.id, name: 'Extra Gravy', priceMinor: 2000 },
      { tenantId: tenant.id, groupId: extras.id, name: 'No Onion', priceMinor: 0 },
    ]).returning();

    const tables = await db.insert(restaurantTables).values([
      { tenantId: tenant.id, outletId: outlet.id, label: 'T1', seats: 4 },
      { tenantId: tenant.id, outletId: outlet.id, label: 'T2', seats: 2 },
    ]).returning();

    // A screen-only bar station plus a kitchen printer, so KOT routing has
    // both a printing and a non-printing path to exercise.
    await db.insert(printers).values({
      tenantId: tenant.id, outletId: outlet.id, stationId: kitchen.id,
      name: 'Kitchen', profileId: 'generic-80',
      // BLUETOOTH so the queue defers rather than trying to open a socket to
      // a printer that does not exist in CI.
      connection: 'BLUETOOTH', address: 'AA:BB:CC:DD:EE:FF', role: 'KOT',
    });

    const [localCustomer, interstateCustomer] = await db.insert(customers).values([
      { tenantId: tenant.id, name: 'Local Guest', phone: '+910000000001', country: 'IN', region: 'KA' },
      {
        tenantId: tenant.id, name: 'Mumbai Business', phone: '+910000000002',
        taxId: '27AABCS1429B1ZX', isBusiness: true, country: 'IN', region: 'MH',
      },
    ]).returning();

    /* ── Second tenant, purely so isolation is testable ── */
    const [other] = await db.insert(tenants).values({
      name: 'Other Restaurant', slug: 'other-tenant',
      country: 'IN', defaultCurrency: 'INR', taxRuleSetKey: 'IN-GST',
    }).returning();

    await db.insert(taxRuleSets).values({
      tenantId: other.id, key: 'IN-GST', label: 'India GST', country: 'IN',
      definition: IN_GST as never,
    });

    const [otherOutlet] = await db.insert(outlets).values({
      tenantId: other.id, name: 'Other Outlet', code: 'OTH',
      region: 'KA', country: 'IN', currency: 'INR', invoicePrefix: 'OTH',
    }).returning();

    await db.insert(stations).values({
      tenantId: other.id, outletId: otherOutlet.id, name: 'KITCHEN', code: 'KIT', mode: 'SCREEN',
    });

    await db.insert(staff).values({
      tenantId: other.id, name: 'Other Owner', email: 'owner@other.test',
      passwordHash, role: 'OWNER',
    });

    const [otherCat] = await db.insert(categories).values({
      tenantId: other.id, name: 'Food', code: 'FOOD',
    }).returning();

    const [otherItem] = await db.insert(menuItems).values({
      tenantId: other.id, categoryId: otherCat.id, name: 'Other Item', code: 'OI',
      priceMinor: 10000, taxSlabId: 'gst-5',
    }).returning();

    return {
      tenantId: tenant.id,
      outletId: outlet.id,
      kitchenStationId: kitchen.id,
      barStationId: bar.id,
      items: Object.fromEntries(items.map((i) => [i.code!, i.id])),
      modifierIds: Object.fromEntries(mods.map((m) => [m.name, m.id])),
      tableIds: tables.map((t) => t.id),
      customerLocalId: localCustomer.id,
      customerInterstateId: interstateCustomer.id,
      otherTenantId: other.id,
      otherOutletId: otherOutlet.id,
      otherItemId: otherItem.id,
    };
  });

  const ownerToken = await login(app, 'test-tenant', 'owner@test.test');
  const waiterToken = await login(app, 'test-tenant', 'waiter@test.test');
  const otherOwnerToken = await login(app, 'other-tenant', 'owner@other.test');

  return { app, ...data, ownerToken, waiterToken, otherOwnerToken };
}

async function login(app: INestApplication, tenantSlug: string, email: string): Promise<string> {
  const res = await request(app, 'POST', '/auth/login', {
    body: { tenantSlug, email, password: TEST_PASSWORD },
  });
  if (res.status !== 200) {
    throw new Error(`Test login failed for ${email}: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return res.body.tokens.accessToken;
}

/** Minimal HTTP helper over the running Nest server. */
export async function request(
  app: INestApplication,
  method: string,
  path: string,
  opts: { body?: unknown; token?: string; headers?: Record<string, string> } = {},
): Promise<{ status: number; body: any }> {
  const server = app.getHttpServer();
  if (!server.listening) await new Promise<void>((r) => server.listen(0, r));
  const { port } = server.address();

  const res = await fetch(`http://127.0.0.1:${port}/api/v1${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
      ...(opts.headers ?? {}),
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });

  const text = await res.text();
  let body: unknown;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  return { status: res.status, body };
}

export async function teardown(app?: INestApplication) {
  await app?.close();
  await closePools();
}

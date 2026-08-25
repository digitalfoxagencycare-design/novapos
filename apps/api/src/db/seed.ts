/**
 * Development seed.
 *
 *   pnpm --filter @novapos/api seed
 *
 * Creates two tenants deliberately: a single-outlet Indian restaurant and a
 * two-outlet German one. Two tenants because a multi-tenant system that has
 * only ever been run with one tenant has never actually been tested — every
 * isolation bug hides until the second tenant exists.
 */
import 'dotenv/config';
import * as argon2 from 'argon2';
import { eq } from 'drizzle-orm';
import { withSystemDb, closePools } from './client';
import {
  tenants, outlets, staff, stations, categories, menuItems, menuItemVariants,
  modifierGroups, modifiers, menuItemModifierGroups, restaurantTables,
  tableSections, printers, taxRuleSets, customers, inventoryItems, stockLevels,
} from './schema';
import { IN_GST, DE_VAT } from '@novapos/tax-engine';

const ARGON = { type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 } as const;

// Seed credentials are printed at the end and are obviously non-production.
// The API refuses to boot with a placeholder JWT secret, so a seeded database
// cannot accidentally become a live one without a deliberate config change.
const DEMO_PASSWORD = 'novapos-dev-2026';
const DEMO_PIN = '4321';

async function main() {
  const password = await argon2.hash(DEMO_PASSWORD, ARGON);
  const pin = await argon2.hash(DEMO_PIN, ARGON);

  await withSystemDb(async (db) => {
    console.log('→ Clearing existing seed data…');
    await db.delete(tenants).where(eq(tenants.slug, 'nova-kitchen'));
    await db.delete(tenants).where(eq(tenants.slug, 'berlin-bites'));

    /* ─────────────── Tenant 1: Nova Kitchen (India, 1 outlet) ─────────────── */

    console.log('→ Seeding Nova Kitchen (India)…');
    const [nova] = await db.insert(tenants).values({
      name: 'Nova Kitchen',
      slug: 'nova-kitchen',
      taxId: '29ABCDE1234F1Z5',
      country: 'IN',
      defaultLocale: 'en-IN',
      defaultCurrency: 'INR',
      timezone: 'Asia/Kolkata',
      taxRuleSetKey: 'IN-GST',
      settings: { paymentGateway: 'razorpay' },
    }).returning();

    await db.insert(taxRuleSets).values({
      tenantId: nova.id,
      key: 'IN-GST',
      label: 'India — GST (restaurant)',
      country: 'IN',
      definition: IN_GST as never,
    });

    const [blr] = await db.insert(outlets).values({
      tenantId: nova.id,
      name: 'Nova Kitchen — Indiranagar',
      code: 'BLR',
      addressLines: ['12 MG Road, Indiranagar'],
      city: 'Bengaluru',
      region: 'KA',
      country: 'IN',
      postalCode: '560038',
      phone: '+91 80 4123 4567',
      taxId: '29ABCDE1234F1Z5',
      extraIds: ['FSSAI: 12345678901234'],
      locale: 'en-IN',
      currency: 'INR',
      timezone: 'Asia/Kolkata',
      receiptTemplateId: 'in-gst',
      invoicePrefix: 'BLR',
      serviceChargePercent: '0',
    }).returning();

    const [kitchen, bar] = await db.insert(stations).values([
      { tenantId: nova.id, outletId: blr.id, name: 'MAIN KITCHEN', code: 'KITCHEN', sortOrder: 0, mode: 'BOTH' },
      { tenantId: nova.id, outletId: blr.id, name: 'BAR', code: 'BAR', sortOrder: 1, mode: 'BOTH' },
    ]).returning();

    await db.insert(staff).values([
      {
        tenantId: nova.id, outletId: null, name: 'Priya Nair',
        email: 'owner@novakitchen.test', passwordHash: password, pinHash: pin, role: 'OWNER',
      },
      {
        tenantId: nova.id, outletId: blr.id, name: 'Rahul Menon',
        email: 'manager@novakitchen.test', passwordHash: password, pinHash: pin, role: 'MANAGER',
      },
      {
        tenantId: nova.id, outletId: blr.id, name: 'Asha Kumari',
        email: 'cashier@novakitchen.test', passwordHash: password, pinHash: pin, role: 'CASHIER',
      },
      {
        tenantId: nova.id, outletId: blr.id, name: 'Vikram Shetty',
        email: 'waiter@novakitchen.test', passwordHash: password, pinHash: pin, role: 'WAITER',
      },
      {
        tenantId: nova.id, outletId: blr.id, name: 'Kitchen Screen',
        email: 'kitchen@novakitchen.test', passwordHash: password, pinHash: pin, role: 'KITCHEN',
      },
    ]);

    const [mains, breads, drinks, desserts] = await db.insert(categories).values([
      { tenantId: nova.id, name: 'Main Course', code: 'MAINS', sortOrder: 0, stationId: kitchen.id, colour: '#c2410c' },
      { tenantId: nova.id, name: 'Breads', code: 'BREADS', sortOrder: 1, stationId: kitchen.id, colour: '#a16207' },
      { tenantId: nova.id, name: 'Beverages', code: 'DRINKS', sortOrder: 2, stationId: bar.id, colour: '#0369a1' },
      { tenantId: nova.id, name: 'Desserts', code: 'SWEETS', sortOrder: 3, stationId: kitchen.id, colour: '#a21caf' },
    ]).returning();

    const items = await db.insert(menuItems).values([
      { tenantId: nova.id, categoryId: mains.id, name: 'Paneer Butter Masala', code: 'PBM',
        priceMinor: 32000, taxSlabId: 'gst-5', hsnSac: '996331', isVeg: true, prepMinutes: 15, sortOrder: 0 },
      { tenantId: nova.id, categoryId: mains.id, name: 'Chicken Biryani', code: 'BIR',
        priceMinor: 38000, taxSlabId: 'gst-5', hsnSac: '996331', isVeg: false, prepMinutes: 25, sortOrder: 1,
        // Delivery aggregators take a cut, so the delivery price is higher.
        channelPrices: { DELIVERY: 42000 } },
      { tenantId: nova.id, categoryId: mains.id, name: 'Dal Tadka', code: 'DAL',
        priceMinor: 24000, taxSlabId: 'gst-5', hsnSac: '996331', isVeg: true, prepMinutes: 12, sortOrder: 2 },
      { tenantId: nova.id, categoryId: breads.id, name: 'Butter Naan', code: 'NAAN',
        priceMinor: 6000, taxSlabId: 'gst-5', hsnSac: '996331', isVeg: true, prepMinutes: 6, sortOrder: 0 },
      { tenantId: nova.id, categoryId: breads.id, name: 'Tandoori Roti', code: 'ROTI',
        priceMinor: 4000, taxSlabId: 'gst-5', hsnSac: '996331', isVeg: true, prepMinutes: 5, sortOrder: 1 },
      { tenantId: nova.id, categoryId: drinks.id, name: 'Masala Chai', code: 'CHAI',
        priceMinor: 4000, taxSlabId: 'gst-5', hsnSac: '996331', isVeg: true, prepMinutes: 4, sortOrder: 0 },
      { tenantId: nova.id, categoryId: drinks.id, name: 'Fresh Lime Soda', code: 'LIME',
        priceMinor: 9000, taxSlabId: 'gst-12', hsnSac: '2202', isVeg: true, prepMinutes: 3, sortOrder: 1 },
      // A high-slab item, so the seed exercises more than one GST rate.
      { tenantId: nova.id, categoryId: drinks.id, name: 'Cola (300ml)', code: 'COLA',
        priceMinor: 6000, taxSlabId: 'gst-28', hsnSac: '2202', isVeg: true, prepMinutes: 1, sortOrder: 2 },
      { tenantId: nova.id, categoryId: desserts.id, name: 'Gulab Jamun (2 pc)', code: 'GJ',
        priceMinor: 12000, taxSlabId: 'gst-5', hsnSac: '996331', isVeg: true, prepMinutes: 3, sortOrder: 0 },
    ]).returning();

    const biryani = items.find((i) => i.code === 'BIR')!;
    const chai = items.find((i) => i.code === 'CHAI')!;

    await db.insert(menuItemVariants).values([
      { tenantId: nova.id, itemId: biryani.id, name: 'Half', priceDeltaMinor: -12000, sortOrder: 0 },
      { tenantId: nova.id, itemId: biryani.id, name: 'Full', priceDeltaMinor: 0, isDefault: true, sortOrder: 1 },
      { tenantId: nova.id, itemId: chai.id, name: 'Regular', priceDeltaMinor: 0, isDefault: true, sortOrder: 0 },
      { tenantId: nova.id, itemId: chai.id, name: 'Large', priceDeltaMinor: 2000, sortOrder: 1 },
    ]);

    const [spice, extras] = await db.insert(modifierGroups).values([
      { tenantId: nova.id, name: 'Spice Level', minSelect: 1, maxSelect: 1 },
      { tenantId: nova.id, name: 'Extras', minSelect: 0, maxSelect: 3 },
    ]).returning();

    await db.insert(modifiers).values([
      { tenantId: nova.id, groupId: spice.id, name: 'Mild', priceMinor: 0, sortOrder: 0 },
      { tenantId: nova.id, groupId: spice.id, name: 'Medium', priceMinor: 0, sortOrder: 1 },
      { tenantId: nova.id, groupId: spice.id, name: 'Extra Spicy', priceMinor: 0, sortOrder: 2 },
      { tenantId: nova.id, groupId: extras.id, name: 'Extra Gravy', priceMinor: 3000, sortOrder: 0 },
      { tenantId: nova.id, groupId: extras.id, name: 'Extra Cheese', priceMinor: 4000, sortOrder: 1 },
      { tenantId: nova.id, groupId: extras.id, name: 'No Onion', priceMinor: 0, sortOrder: 2 },
    ]);

    await db.insert(menuItemModifierGroups).values(
      items
        .filter((i) => [mains.id].includes(i.categoryId))
        .flatMap((i) => [
          { tenantId: nova.id, itemId: i.id, groupId: spice.id, sortOrder: 0 },
          { tenantId: nova.id, itemId: i.id, groupId: extras.id, sortOrder: 1 },
        ]),
    );

    const [ground, terrace] = await db.insert(tableSections).values([
      { tenantId: nova.id, outletId: blr.id, name: 'Ground Floor', sortOrder: 0 },
      { tenantId: nova.id, outletId: blr.id, name: 'Terrace', sortOrder: 1 },
    ]).returning();

    await db.insert(restaurantTables).values([
      ...Array.from({ length: 8 }, (_, i) => ({
        tenantId: nova.id, outletId: blr.id, sectionId: ground.id,
        label: `T${i + 1}`, seats: i < 4 ? 2 : 4,
        posX: (i % 4) * 2, posY: Math.floor(i / 4) * 2,
      })),
      ...Array.from({ length: 4 }, (_, i) => ({
        tenantId: nova.id, outletId: blr.id, sectionId: terrace.id,
        label: `TR${i + 1}`, seats: 6,
        posX: i * 2, posY: 5, width: 2, shape: 'round',
      })),
    ]);

    await db.insert(printers).values([
      {
        tenantId: nova.id, outletId: blr.id, name: 'Counter (80mm)',
        profileId: 'epson-tm-t82', connection: 'NETWORK',
        address: '192.168.1.50', port: 9100, role: 'RECEIPT',
      },
      {
        tenantId: nova.id, outletId: blr.id, stationId: kitchen.id, name: 'Kitchen (80mm)',
        profileId: 'generic-80', connection: 'NETWORK',
        address: '192.168.1.51', port: 9100, role: 'KOT',
      },
      {
        tenantId: nova.id, outletId: blr.id, stationId: bar.id, name: 'Bar (58mm Bluetooth)',
        profileId: 'xprinter-58iih', connection: 'BLUETOOTH',
        address: '66:22:11:AA:BB:CC', role: 'KOT',
      },
    ]);

    await db.insert(customers).values([
      {
        tenantId: nova.id, name: 'Ravi Kumar', phone: '+919876543210',
        country: 'IN', region: 'KA',
        consent: { marketing: false, recordedAt: new Date().toISOString() },
      },
      {
        // A Maharashtra business customer: an interstate delivery to this
        // customer bills IGST rather than CGST+SGST, which is the single most
        // important GST behaviour to be able to demo.
        tenantId: nova.id, name: 'Sunrise Logistics Pvt Ltd', phone: '+919812345678',
        taxId: '27AABCS1429B1ZX', isBusiness: true,
        country: 'IN', region: 'MH', city: 'Mumbai',
        addressLines: ['Unit 4, Andheri East'],
        consent: { marketing: true, recordedAt: new Date().toISOString() },
      },
    ]);

    const stock = await db.insert(inventoryItems).values([
      { tenantId: nova.id, name: 'Paneer', sku: 'RAW-PANEER', unit: 'kg', reorderLevel: '5', costMinor: 32000 },
      { tenantId: nova.id, name: 'Basmati Rice', sku: 'RAW-RICE', unit: 'kg', reorderLevel: '20', costMinor: 11000 },
      { tenantId: nova.id, name: 'Cooking Gas', sku: 'RAW-LPG', unit: 'cylinder', reorderLevel: '2', costMinor: 110000 },
    ]).returning();

    await db.insert(stockLevels).values(
      stock.map((s) => ({
        tenantId: nova.id, outletId: blr.id, inventoryItemId: s.id,
        // Deliberately below reorder level, so the low-stock alert has
        // something to show the moment the dashboard opens.
        quantity: s.sku === 'RAW-PANEER' ? '3' : '40',
      })),
    );

    /* ────────── Tenant 2: Berlin Bites (Germany, 2 outlets) ────────── */

    console.log('→ Seeding Berlin Bites (Germany)…');
    const [berlin] = await db.insert(tenants).values({
      name: 'Berlin Bites',
      slug: 'berlin-bites',
      taxId: 'DE123456789',
      country: 'DE',
      defaultLocale: 'de-DE',
      defaultCurrency: 'EUR',
      timezone: 'Europe/Berlin',
      taxRuleSetKey: 'EU-VAT-DE',
      settings: { paymentGateway: 'stripe' },
    }).returning();

    await db.insert(taxRuleSets).values({
      tenantId: berlin.id,
      key: 'EU-VAT-DE',
      label: 'Germany — VAT',
      country: 'DE',
      definition: DE_VAT as never,
    });

    const berlinOutlets = await db.insert(outlets).values([
      {
        tenantId: berlin.id, name: 'Berlin Bites — Mitte', code: 'MITTE',
        addressLines: ['Torstraße 140'], city: 'Berlin', region: 'BE', country: 'DE',
        postalCode: '10119', locale: 'de-DE', currency: 'EUR', timezone: 'Europe/Berlin',
        receiptTemplateId: 'eu-vat', invoicePrefix: 'MIT', serviceChargePercent: '0',
      },
      {
        tenantId: berlin.id, name: 'Berlin Bites — Kreuzberg', code: 'KREUZ',
        addressLines: ['Oranienstraße 20'], city: 'Berlin', region: 'BE', country: 'DE',
        postalCode: '10999', locale: 'de-DE', currency: 'EUR', timezone: 'Europe/Berlin',
        receiptTemplateId: 'eu-vat', invoicePrefix: 'KRZ', serviceChargePercent: '0',
      },
    ]).returning();

    for (const outlet of berlinOutlets) {
      const [station] = await db.insert(stations).values({
        tenantId: berlin.id, outletId: outlet.id, name: 'KÜCHE', code: 'KITCHEN', mode: 'BOTH',
      }).returning();

      await db.insert(restaurantTables).values(
        Array.from({ length: 6 }, (_, i) => ({
          tenantId: berlin.id, outletId: outlet.id,
          label: `${i + 1}`, seats: 4, posX: (i % 3) * 2, posY: Math.floor(i / 3) * 2,
        })),
      );

      await db.insert(printers).values({
        tenantId: berlin.id, outletId: outlet.id, stationId: station.id,
        name: 'Küche (80mm)', profileId: 'generic-80',
        connection: 'NETWORK', address: '10.0.0.20', role: 'KOT',
      });
    }

    await db.insert(staff).values({
      tenantId: berlin.id, outletId: null, name: 'Lena Fischer',
      email: 'owner@berlinbites.test', passwordHash: password, pinHash: pin, role: 'OWNER',
    });

    const [berlinCat] = await db.insert(categories).values({
      tenantId: berlin.id, name: 'Hauptgerichte', code: 'MAIN', sortOrder: 0,
      nameI18n: { 'en-GB': 'Main courses' },
    }).returning();

    await db.insert(menuItems).values([
      { tenantId: berlin.id, categoryId: berlinCat.id, name: 'Currywurst mit Pommes', code: 'CW',
        priceMinor: 890, taxSlabId: 'vat-standard', prepMinutes: 8, sortOrder: 0 },
      { tenantId: berlin.id, categoryId: berlinCat.id, name: 'Schnitzel', code: 'SCH',
        priceMinor: 1450, taxSlabId: 'vat-standard', prepMinutes: 18, sortOrder: 1 },
      // Reduced-rate takeaway food — proves the second VAT slab works.
      { tenantId: berlin.id, categoryId: berlinCat.id, name: 'Brötchen (zum Mitnehmen)', code: 'BR',
        priceMinor: 250, taxSlabId: 'vat-reduced', prepMinutes: 2, sortOrder: 2 },
    ]);

    console.log('\n✓ Seed complete.\n');
    console.log('  Tenant "nova-kitchen"  (India, INR, GST)');
    console.log('    owner@novakitchen.test / manager@ / cashier@ / waiter@ / kitchen@');
    console.log('    outlet code BLR · 12 tables · 2 stations · 3 printers');
    console.log('  Tenant "berlin-bites"  (Germany, EUR, VAT)');
    console.log('    owner@berlinbites.test');
    console.log('    outlet codes MITTE, KREUZ');
    console.log(`\n  password: ${DEMO_PASSWORD}     till PIN: ${DEMO_PIN}`);
    console.log('\n  These are development credentials. Never seed a production database.\n');
  });
}

main()
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exitCode = 1;
  })
  .finally(() => closePools());

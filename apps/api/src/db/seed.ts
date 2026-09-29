/**
 * Authentic Indian Restaurant Seed for Velpula Mess & NovaPOS.
 *
 *   pnpm --filter @novapos/api seed
 *
 * Configures pure Indian Restaurant & Retail data:
 * - Currency: INR (₹)
 * - India GST 5% (CGST 2.5% + SGST 2.5%)
 * - Authentic Dishes: Tiffins, Biryani, Meals, Curries, Chai & Beverages
 * - Real 58mm Bluetooth and 80mm USB/Network printer profiles
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
import { IN_GST } from '@novapos/tax-engine';

if (process.env.NODE_ENV === 'production') {
  console.error('CRITICAL: Seed script execution is strictly forbidden in production environments.');
  process.exit(1);
}

if (!process.argv.includes('--force-demo-reset') && process.env.ALLOW_TENANT_RESET !== 'true') {
  console.error('Tenant reset not authorized. Re-run with --force-demo-reset or ALLOW_TENANT_RESET=true to reset demo data.');
  process.exit(1);
}

const ARGON = { type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 } as const;

const DEMO_PASSWORD = '9701463241';
const DEMO_PIN = '4321';

async function main() {
  const password = await argon2.hash(DEMO_PASSWORD, ARGON);
  const pin = await argon2.hash(DEMO_PIN, ARGON);

  await withSystemDb(async (db) => {
    console.warn('⚠️  Resetting all tenant data in the configured database.');
    await db.delete(tenants);

    /* ─────────────── Velpula Mess / Nova Kitchen (India, Hyderabad) ─────────────── */

    console.log('→ Seeding Velpula Mess & Authentic Indian Restaurant…');
    const [nova] = await db.insert(tenants).values({
      name: 'Velpula Mess',
      slug: 'nova-kitchen', // Primary slug
      taxId: '36ABCDE1234F1Z5',
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
      label: 'India — GST 5% (Restaurant)',
      country: 'IN',
      definition: IN_GST as never,
    });

    const [hyd] = await db.insert(outlets).values({
      tenantId: nova.id,
      name: 'Velpula Mess — Hitech City Branch',
      code: 'HYD',
      addressLines: ['Near ORR Junction, Hitech City Main Road'],
      city: 'Hyderabad',
      region: 'TG',
      country: 'IN',
      postalCode: '500081',
      phone: '+91 9701463241',
      taxId: '36ABCDE1234F1Z5',
      extraIds: ['FSSAI: 12345678901234'],
      locale: 'en-IN',
      currency: 'INR',
      timezone: 'Asia/Kolkata',
      receiptTemplateId: 'in-gst',
      invoicePrefix: 'VM',
      serviceChargePercent: '0',
    }).returning();

    const [kitchen, chaiStation] = await db.insert(stations).values([
      { tenantId: nova.id, outletId: hyd.id, name: 'MAIN KITCHEN', code: 'KITCHEN', sortOrder: 0, mode: 'BOTH' },
      { tenantId: nova.id, outletId: hyd.id, name: 'TEA & TIFFIN COUNTER', code: 'TIFFIN', sortOrder: 1, mode: 'BOTH' },
    ]).returning();

    await db.insert(staff).values([
      {
        tenantId: nova.id, outletId: null, name: 'Lokesh',
        email: 'lokesh', phone: '9701463241', passwordHash: password, pinHash: pin, role: 'OWNER',
      },
      {
        tenantId: nova.id, outletId: null, name: 'Admin',
        email: 'admin', phone: '9701463241', passwordHash: password, pinHash: pin, role: 'OWNER',
      },
      {
        tenantId: nova.id, outletId: hyd.id, name: 'Billing Cashier',
        email: 'cashier', phone: '9701463241', passwordHash: password, pinHash: pin, role: 'CASHIER',
      },
      {
        tenantId: nova.id, outletId: hyd.id, name: 'Kitchen Screen',
        email: 'kitchen', phone: '9701463241', passwordHash: password, pinHash: pin, role: 'KITCHEN',
      },
    ]);

    // Categories matching Hyderabadi / Velpula Mess exactly
    const [tiffins, biryani, meals, currys, drinks] = await db.insert(categories).values([
      { tenantId: nova.id, name: 'Tiffins', code: 'TIFFINS', sortOrder: 0, stationId: chaiStation.id, colour: '#16a34a' },
      { tenantId: nova.id, name: 'Biryani', code: 'BIRYANI', sortOrder: 1, stationId: kitchen.id, colour: '#ea580c' },
      { tenantId: nova.id, name: 'Meals', code: 'MEALS', sortOrder: 2, stationId: kitchen.id, colour: '#ca8a04' },
      { tenantId: nova.id, name: 'Currys', code: 'CURRYS', sortOrder: 3, stationId: kitchen.id, colour: '#dc2626' },
      { tenantId: nova.id, name: 'Beverages & Snacks', code: 'DRINKS', sortOrder: 4, stationId: chaiStation.id, colour: '#0284c7' },
    ]).returning();

    // Menu Items
    const items = await db.insert(menuItems).values([
      // Tiffins
      {
        tenantId: nova.id, categoryId: tiffins.id, name: 'Idli (4 Pcs)', code: 'IDLI',
        priceMinor: 4000, taxSlabId: 'gst-5', hsnSac: '996331', isVeg: true, prepMinutes: 3, sortOrder: 0,
      },
      {
        tenantId: nova.id, categoryId: tiffins.id, name: 'Vada (4 Pcs)', code: 'VADA',
        priceMinor: 4000, taxSlabId: 'gst-5', hsnSac: '996331', isVeg: true, prepMinutes: 5, sortOrder: 1,
      },
      {
        tenantId: nova.id, categoryId: tiffins.id, name: 'Plain Dosa', code: 'PDOSA',
        priceMinor: 3000, taxSlabId: 'gst-5', hsnSac: '996331', isVeg: true, prepMinutes: 6, sortOrder: 2,
      },
      {
        tenantId: nova.id, categoryId: tiffins.id, name: 'Masala Dosa', code: 'MDOSA',
        priceMinor: 4000, taxSlabId: 'gst-5', hsnSac: '996331', isVeg: true, prepMinutes: 8, sortOrder: 3,
      },
      {
        tenantId: nova.id, categoryId: tiffins.id, name: 'Onion Dosa', code: 'ODOSA',
        priceMinor: 4000, taxSlabId: 'gst-5', hsnSac: '996331', isVeg: true, prepMinutes: 8, sortOrder: 4,
      },
      {
        tenantId: nova.id, categoryId: tiffins.id, name: 'Poori (4 Pcs)', code: 'POORI',
        priceMinor: 5000, taxSlabId: 'gst-5', hsnSac: '996331', isVeg: true, prepMinutes: 6, sortOrder: 5,
      },
      {
        tenantId: nova.id, categoryId: tiffins.id, name: 'Bonda (4 Pcs)', code: 'BONDA',
        priceMinor: 4000, taxSlabId: 'gst-5', hsnSac: '996331', isVeg: true, prepMinutes: 5, sortOrder: 6,
      },
      {
        tenantId: nova.id, categoryId: tiffins.id, name: 'Chapathi (1 Pc)', code: 'CHAPATHI',
        priceMinor: 1500, taxSlabId: 'gst-5', hsnSac: '996331', isVeg: true, prepMinutes: 4, sortOrder: 7,
      },

      // Biryani
      {
        tenantId: nova.id, categoryId: biryani.id, name: 'Chicken Dum Biryani', code: 'CHKBIR',
        priceMinor: 18000, taxSlabId: 'gst-5', hsnSac: '996331', isVeg: false, prepMinutes: 10, sortOrder: 8,
      },
      {
        tenantId: nova.id, categoryId: biryani.id, name: 'Special Chicken Biryani (Boneless)', code: 'SPLBIR',
        priceMinor: 22000, taxSlabId: 'gst-5', hsnSac: '996331', isVeg: false, prepMinutes: 12, sortOrder: 9,
      },
      {
        tenantId: nova.id, categoryId: biryani.id, name: 'Mutton Biryani', code: 'MUTBIR',
        priceMinor: 26000, taxSlabId: 'gst-5', hsnSac: '996331', isVeg: false, prepMinutes: 12, sortOrder: 10,
      },
      {
        tenantId: nova.id, categoryId: biryani.id, name: 'Paneer Biryani', code: 'PANBIR',
        priceMinor: 15000, taxSlabId: 'gst-5', hsnSac: '996331', isVeg: true, prepMinutes: 10, sortOrder: 11,
      },
      {
        tenantId: nova.id, categoryId: biryani.id, name: 'Veg Biryani', code: 'VEGBIR',
        priceMinor: 12000, taxSlabId: 'gst-5', hsnSac: '996331', isVeg: true, prepMinutes: 10, sortOrder: 12,
      },

      // Meals
      {
        tenantId: nova.id, categoryId: meals.id, name: 'Veg Meals (Unlimited)', code: 'VEGMEALS',
        priceMinor: 8000, taxSlabId: 'gst-5', hsnSac: '996331', isVeg: true, prepMinutes: 3, sortOrder: 13,
      },
      {
        tenantId: nova.id, categoryId: meals.id, name: 'Non-Veg Meals (with Chicken Curry)', code: 'NONVEGMEALS',
        priceMinor: 12000, taxSlabId: 'gst-5', hsnSac: '996331', isVeg: false, prepMinutes: 4, sortOrder: 14,
      },
      {
        tenantId: nova.id, categoryId: meals.id, name: 'Special South Indian Thali', code: 'SPLTHALI',
        priceMinor: 15000, taxSlabId: 'gst-5', hsnSac: '996331', isVeg: true, prepMinutes: 5, sortOrder: 15,
      },

      // Curries
      {
        tenantId: nova.id, categoryId: currys.id, name: 'Chicken Curry', code: 'CHKCURRY',
        priceMinor: 10000, taxSlabId: 'gst-5', hsnSac: '996331', isVeg: false, prepMinutes: 8, sortOrder: 16,
      },
      {
        tenantId: nova.id, categoryId: currys.id, name: 'Mutton Curry', code: 'MUTCURRY',
        priceMinor: 18000, taxSlabId: 'gst-5', hsnSac: '996331', isVeg: false, prepMinutes: 10, sortOrder: 17,
      },
      {
        tenantId: nova.id, categoryId: currys.id, name: 'Paneer Butter Masala', code: 'PBM',
        priceMinor: 12000, taxSlabId: 'gst-5', hsnSac: '996331', isVeg: true, prepMinutes: 8, sortOrder: 18,
      },
      {
        tenantId: nova.id, categoryId: currys.id, name: 'Dal Tadka', code: 'DALTADKA',
        priceMinor: 7000, taxSlabId: 'gst-5', hsnSac: '996331', isVeg: true, prepMinutes: 6, sortOrder: 19,
      },
      {
        tenantId: nova.id, categoryId: currys.id, name: 'Egg Curry (2 Eggs)', code: 'EGGCURRY',
        priceMinor: 6000, taxSlabId: 'gst-5', hsnSac: '996331', isVeg: false, prepMinutes: 6, sortOrder: 20,
      },

      // Beverages & Drinks
      {
        tenantId: nova.id, categoryId: drinks.id, name: 'Special Irani Chai', code: 'CHAI',
        priceMinor: 2000, taxSlabId: 'gst-5', hsnSac: '996331', isVeg: true, prepMinutes: 2, sortOrder: 21,
      },
      {
        tenantId: nova.id, categoryId: drinks.id, name: 'South Indian Filter Coffee', code: 'COFFEE',
        priceMinor: 2500, taxSlabId: 'gst-5', hsnSac: '996331', isVeg: true, prepMinutes: 2, sortOrder: 22,
      },
      {
        tenantId: nova.id, categoryId: drinks.id, name: 'Fresh Lime Soda', code: 'LIME',
        priceMinor: 3000, taxSlabId: 'gst-5', hsnSac: '2202', isVeg: true, prepMinutes: 2, sortOrder: 23,
      },
      {
        tenantId: nova.id, categoryId: drinks.id, name: 'Masala Butter Milk', code: 'MAJIGA',
        priceMinor: 2000, taxSlabId: 'gst-5', hsnSac: '996331', isVeg: true, prepMinutes: 1, sortOrder: 24,
      },
      {
        tenantId: nova.id, categoryId: drinks.id, name: 'Mineral Water (1L)', code: 'WATER',
        priceMinor: 2000, taxSlabId: 'gst-5', hsnSac: '2202', isVeg: true, prepMinutes: 0, sortOrder: 25,
      },
    ]).returning();

    // Biryani Variants
    const chkBir = items.find((i) => i.code === 'CHKBIR')!;
    await db.insert(menuItemVariants).values([
      { tenantId: nova.id, itemId: chkBir.id, name: 'Single', priceDeltaMinor: -6000, sortOrder: 0 },
      { tenantId: nova.id, itemId: chkBir.id, name: 'Full', priceDeltaMinor: 0, isDefault: true, sortOrder: 1 },
      { tenantId: nova.id, itemId: chkBir.id, name: 'Family Pack', priceDeltaMinor: 27000, sortOrder: 2 },
    ]);

    // Modifier Groups
    const [extras] = await db.insert(modifierGroups).values([
      { tenantId: nova.id, name: 'Add-ons & Extras', minSelect: 0, maxSelect: 3 },
    ]).returning();

    await db.insert(modifiers).values([
      { tenantId: nova.id, groupId: extras.id, name: 'Extra Salan / Gravy', priceMinor: 2000, sortOrder: 0 },
      { tenantId: nova.id, groupId: extras.id, name: 'Extra Raitha', priceMinor: 1000, sortOrder: 1 },
      { tenantId: nova.id, groupId: extras.id, name: 'Boiled Egg', priceMinor: 1500, sortOrder: 2 },
      { tenantId: nova.id, groupId: extras.id, name: 'Extra Butter / Ghee', priceMinor: 1500, sortOrder: 3 },
    ]);

    // Tables T1 to T12
    const [hall] = await db.insert(tableSections).values([
      { tenantId: nova.id, outletId: hyd.id, name: 'Dine-In Hall', sortOrder: 0 },
    ]).returning();

    await db.insert(restaurantTables).values(
      Array.from({ length: 12 }, (_, i) => ({
        tenantId: nova.id, outletId: hyd.id, sectionId: hall.id,
        label: `T${i + 1}`, seats: 4,
        posX: (i % 4) * 2, posY: Math.floor(i / 4) * 2,
      })),
    );

    // Thermal Printer profiles for 80mm and 58mm
    await db.insert(printers).values([
      {
        tenantId: nova.id, outletId: hyd.id, stationId: kitchen.id,
        name: 'Billing Counter (80mm TVS / Epson)',
        profileId: 'epson-tm-t82', connection: 'NETWORK',
        address: '192.168.1.100', port: 9100, role: 'RECEIPT',
      },
      {
        tenantId: nova.id, outletId: hyd.id, stationId: chaiStation.id,
        name: 'Handheld Mobile Bluetooth Printer (58mm)',
        profileId: 'xprinter-58iih', connection: 'BLUETOOTH',
        address: '00:11:22:33:44:55', role: 'RECEIPT',
      },
      {
        tenantId: nova.id, outletId: hyd.id, stationId: kitchen.id,
        name: 'Kitchen KOT Printer (80mm)',
        profileId: 'generic-80', connection: 'NETWORK',
        address: '192.168.1.101', port: 9100, role: 'KOT',
      },
    ]);

    console.log('\n✓ Clean Indian Restaurant Seed complete!\n');
    console.log('  Restaurant: "Velpula Mess" (Hyderabad, INR ₹, 5% GST)');
    console.log('  Tenant Slug: "nova-kitchen"');
    console.log('  Username: lokesh / Password: ' + DEMO_PASSWORD);
    console.log('  Till Quick PIN: ' + DEMO_PIN);
    console.log('  Total Items: ' + items.length + ' Indian Authentic Dishes seeded.');
  });
}

main()
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exitCode = 1;
  })
  .finally(() => closePools());

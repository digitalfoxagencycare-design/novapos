import 'dotenv/config';
import * as argon2 from 'argon2';
import { eq, or, sql } from 'drizzle-orm';
import { withSystemDb, closePools } from './client';
import { dealers, platformAdmins } from './schema';

async function main() {
  const adminPhone = process.env.PLATFORM_SEED_ADMIN_PHONE ?? '9381563241';
  const adminPassword = process.env.PLATFORM_SEED_ADMIN_PASSWORD ?? '9381563241';
  const adminEmail = process.env.PLATFORM_SEED_ADMIN_EMAIL ?? 'admin@novapos.in';

  const dealerPhone = process.env.PLATFORM_SEED_DEALER_PHONE ?? '9848787308';
  const dealerPassword = process.env.PLATFORM_SEED_DEALER_PASSWORD ?? '9848787308';
  const dealerEmail = process.env.PLATFORM_SEED_DEALER_EMAIL ?? 'dealer.9848@novapos.in';
  if (process.env.NODE_ENV === 'production' &&
      (adminPassword === '9381563241' || dealerPassword === '9848787308')) {
    throw new Error('Production platform seeding requires unique PLATFORM_SEED_* passwords; default credentials are disabled.');
  }

  console.log(`→ Seeding Super Admin (${adminEmail}) and NovaPOS Official Dealer (${dealerEmail})...`);
  const adminHash = await argon2.hash(adminPassword, { type: argon2.argon2id });
  const dealerHash = await argon2.hash(dealerPassword, { type: argon2.argon2id });

  await withSystemDb(async (db) => {
    const updated = await db
      .update(platformAdmins)
      .set({
        name: 'Super Admin',
        email: adminEmail,
        phone: adminPhone,
        passwordHash: adminHash,
        role: 'SUPER_ADMIN',
        authVersion: sql`${platformAdmins.authVersion} + 1`,
      })
      .where(or(eq(platformAdmins.email, adminEmail), eq(platformAdmins.phone, adminPhone), eq(platformAdmins.phone, '9381546324')))
      .returning({ id: platformAdmins.id });

    if (updated.length === 0) {
      await db
        .insert(platformAdmins)
        .values({
          name: 'Super Admin',
          email: adminEmail,
          phone: adminPhone,
          passwordHash: adminHash,
          role: 'SUPER_ADMIN',
        });
    }

    await db
      .insert(dealers)
      .values({
        name: 'NovaPOS Official Dealer',
        email: dealerEmail,
        phone: dealerPhone,
        dealerCode: 'DLR-9848',
        passwordHash: dealerHash,
        commissionPercent: 25,
        status: 'ACTIVE',
      })
      .onConflictDoUpdate({
        target: dealers.phone,
        set: {
          name: 'NovaPOS Official Dealer',
          email: dealerEmail,
          dealerCode: 'DLR-9848',
          passwordHash: dealerHash,
          commissionPercent: 25,
          status: 'ACTIVE',
          authVersion: sql`${dealers.authVersion} + 1`,
          updatedAt: new Date(),
        },
      });

    const userDealerHash = await argon2.hash('9381563241', { type: argon2.argon2id });
    const updatedDealer = await db
      .update(dealers)
      .set({
        name: 'Lokesh Naidu (Dealer)',
        email: 'dealer@novapos.in',
        phone: '9381563241',
        dealerCode: 'DLR-9381',
        passwordHash: userDealerHash,
        commissionPercent: 25,
        status: 'ACTIVE',
        authVersion: sql`${dealers.authVersion} + 1`,
        updatedAt: new Date(),
      })
      .where(or(eq(dealers.phone, '9381563241'), eq(dealers.email, 'dealer@novapos.in'), eq(dealers.dealerCode, 'DLR-9381')))
      .returning({ id: dealers.id });

    if (updatedDealer.length === 0) {
      await db
        .insert(dealers)
        .values({
          name: 'Lokesh Naidu (Dealer)',
          email: 'dealer@novapos.in',
          phone: '9381563241',
          dealerCode: 'DLR-9381',
          passwordHash: userDealerHash,
          commissionPercent: 25,
          status: 'ACTIVE',
        });
    }
  });

  console.log('✓ Platform seed completed successfully.');
  console.log(`  Super Admin: ${adminPhone} (also accepts 93815463241) · ${adminEmail}`);
  console.log(`  Dealer: ${dealerPhone} · ${dealerEmail} · DLR-9848 · 25% commission`);
  console.log('  Default development passwords match each account phone; change them after first sign-in.');
}

main()
  .catch((error) => {
    console.error('Seed error:', error.message);
    process.exitCode = 1;
  })
  .finally(closePools);

import 'dotenv/config';
import * as argon2 from 'argon2';
import { withSystemDb, closePools } from './client';
import { dealers, platformAdmins } from './schema';

async function main() {
  const adminPhone = process.env.PLATFORM_SEED_ADMIN_PHONE ?? '9381546324';
  const adminPassword = process.env.PLATFORM_SEED_ADMIN_PASSWORD ?? '9381546324';
  const adminEmail = process.env.PLATFORM_SEED_ADMIN_EMAIL ?? 'admin@novapos.in';

  const dealerPhone = process.env.PLATFORM_SEED_DEALER_PHONE ?? '9876543210';
  const dealerPassword = process.env.PLATFORM_SEED_DEALER_PASSWORD ?? 'dealer123456';
  const dealerEmail = process.env.PLATFORM_SEED_DEALER_EMAIL ?? 'dealer@novapos.in';

  console.log(`→ Seeding Super Admin (phone: ${adminPhone}, email: ${adminEmail})...`);
  const adminHash = await argon2.hash(adminPassword, { type: argon2.argon2id });
  const dealerHash = await argon2.hash(dealerPassword, { type: argon2.argon2id });

  await withSystemDb(async (db) => {
    await db
      .insert(platformAdmins)
      .values({
        name: 'Super Admin',
        email: adminEmail,
        phone: adminPhone,
        passwordHash: adminHash,
        role: 'SUPER_ADMIN',
      })
      .onConflictDoUpdate({
        target: platformAdmins.phone,
        set: {
          passwordHash: adminHash,
          role: 'SUPER_ADMIN',
          name: 'Super Admin',
        },
      });

    await db
      .insert(dealers)
      .values({
        name: 'NovaPOS Dealer',
        email: dealerEmail,
        phone: dealerPhone,
        dealerCode: 'DLR101',
        passwordHash: dealerHash,
        commissionPercent: 20,
        status: 'ACTIVE',
      })
      .onConflictDoNothing();
  });

  console.log('✓ Platform seed completed successfully.');
  console.log(`  Super Admin login: Phone/ID: ${adminPhone} | Password: ${adminPassword}`);
  console.log(`  Dealer login:      Phone/ID: ${dealerPhone} | Password: ${dealerPassword}`);
}

main()
  .catch((error) => {
    console.error('Seed error:', error.message);
    process.exitCode = 1;
  })
  .finally(closePools);


const postgres = require('postgres');
const argon2 = require('argon2');
require('dotenv').config({ path: 'apps/api/.env' });

async function run() {
  const sql = postgres(process.env.DATABASE_URL);
  const users = await sql`SELECT id, tenant_id, name, email, password_hash, pin_hash, is_active FROM staff`;
  console.log('Staff count:', users.length);
  for (const u of users) {
    console.log('User:', u.email, 'name:', u.name, 'tenantId:', u.tenant_id);
    if (u.password_hash) {
      const vDemo = await argon2.verify(u.password_hash, 'DEMO_PASSWORD').catch((e) => e.message);
      const vPhone = await argon2.verify(u.password_hash, '9701463241').catch((e) => e.message);
      console.log('  matches DEMO_PASSWORD:', vDemo, 'matches 9701463241:', vPhone);
    }
  }
  const tenants = await sql`SELECT id, slug, name, status FROM tenants`;
  console.log('Tenants:', tenants);
  await sql.end();
}
run().catch(console.error);

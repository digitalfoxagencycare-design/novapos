const { Pool } = require('pg');
const argon2 = require('argon2');
require('dotenv').config({ path: 'c:/novapos/apps/api/.env' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres.lkqteqsihocfoedpdxwx:naidu%401A9701463241@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

async function main() {
  const staffRes = await pool.query('SELECT id, name, phone, pin_hash, is_active, role FROM staff');
  console.log('Staff count:', staffRes.rows.length);
  for (const row of staffRes.rows) {
    let pinValid = false;
    if (row.pin_hash) {
      pinValid = await argon2.verify(row.pin_hash, '1411');
    }
    console.log(`Staff ${row.name} (${row.phone}) - Role: ${row.role} - 1411 valid: ${pinValid}`);
  }

  const tenantRes = await pool.query('SELECT id, name, slug, status, settings FROM tenants');
  console.log('Tenant count:', tenantRes.rows.length);
  for (const t of tenantRes.rows) {
    console.log(`Tenant ${t.name} (${t.slug}) - Subscription:`, JSON.stringify(t.settings?.subscription));
  }

  await pool.end();
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});

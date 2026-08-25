/**
 * Migration runner.
 *
 *   pnpm --filter @novapos/api db:migrate
 *
 * Applies the reviewed SQL files in ./drizzle, then (re)applies the row-level
 * security policies. RLS is applied last and idempotently on every run so that
 * a newly added table can never sit in production without its policy — the
 * one mistake in this system that would be a cross-tenant data leak rather
 * than a bug.
 */
import 'dotenv/config';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { rlsStatements, verifyRlsCoverage, schema } from './client';

async function main() {
  const url = process.env.DATABASE_ADMIN_URL ?? process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL is not set. Copy .env.example to .env first.');
    process.exit(1);
  }

  const pool = new Pool({ connectionString: url, max: 1 });
  const db = drizzle(pool);

  try {
    console.log('→ Applying schema migrations…');
    await migrate(db, { migrationsFolder: join(__dirname, '../../drizzle') });

    console.log('→ Applying row-level security policies…');
    for (const statement of rlsStatements()) {
      await pool.query(statement);
    }

    // Any extra SQL the schema cannot express — triggers, constraints, the
    // application role — lives here and is re-run idempotently.
    const extraPath = join(__dirname, '../../drizzle/manual/post-migrate.sql');
    if (existsSync(extraPath)) {
      console.log('→ Applying post-migration SQL…');
      await pool.query(readFileSync(extraPath, 'utf8'));
    }

    const coverage = await verifyRlsCoverage(drizzle(pool, { schema }) as never);
    if (!coverage.ok) {
      console.error(
        '\n✗ These tenant-scoped tables have no row-level security policy:\n' +
        coverage.unprotected.map((t) => `    ${t}`).join('\n') +
        '\n\nRefusing to report success — this would be a cross-tenant data leak.\n',
      );
      process.exit(1);
    }

    console.log(`✓ Migrations applied. RLS active on ${schema.TENANT_SCOPED_TABLES.length} tables.`);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});

import { Pool, type PoolClient } from 'pg';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { sql } from 'drizzle-orm';
import * as schema from './schema';
import { getTenantContext } from '../tenancy/tenant-context';

export type Db = NodePgDatabase<typeof schema>;

/**
 * Database access and tenant isolation.
 *
 * ── How isolation actually works ───────────────────────────────────────────
 * The API connects as `novapos_app`, a role with no BYPASSRLS. Every table
 * that carries `tenant_id` has a row-level-security policy of the form:
 *
 *     USING (tenant_id = current_setting('app.current_tenant', true)::uuid)
 *
 * Before any query runs, the connection sets `app.current_tenant` for the
 * duration of the transaction. A query that forgets its tenant therefore
 * returns *nothing* — the failure mode is an empty result, not a cross-tenant
 * leak. This is deliberately different from filtering in application code:
 * a missed `where` clause in a repository is a data breach, whereas a missed
 * setting here is a visible, immediate bug.
 *
 * ── Escape hatch ───────────────────────────────────────────────────────────
 * Genuinely cross-tenant work — the login lookup, payment webhooks, retention
 * sweeps, the print-queue worker — goes through `withSystemDb`, which connects
 * as `novapos_admin` (BYPASSRLS). Every call site is explicit and greppable,
 * which is the point.
 */

let pool: Pool | null = null;
let adminPool: Pool | null = null;

export function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: Number(process.env.DB_POOL_MAX ?? 10),
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
      // A till waiting on a query is a queue of customers waiting. Fail fast
      // and let the client retry rather than hanging the terminal.
      statement_timeout: Number(process.env.DB_STATEMENT_TIMEOUT_MS ?? 15_000),
    });
    pool.on('error', (err) => {
      // eslint-disable-next-line no-console
      console.error('[db] idle client error', err.message);
    });
  }
  return pool;
}

/**
 * The privileged pool. Falls back to the main connection string when no
 * separate admin URL is configured (single-role development setups), which is
 * why `withSystemDb` is still explicit even when the roles are the same.
 */
export function getAdminPool(): Pool {
  if (!adminPool) {
    adminPool = new Pool({
      connectionString: process.env.DATABASE_ADMIN_URL ?? process.env.DATABASE_URL,
      max: Number(process.env.DB_ADMIN_POOL_MAX ?? 4),
      idleTimeoutMillis: 30_000,
    });
    adminPool.on('error', () => { /* handled per-query */ });
  }
  return adminPool;
}

/** Unscoped handle. Only for migrations and the RLS bootstrap. */
export function rawDb(): Db {
  return drizzle(getPool(), { schema });
}

export class MissingTenantContextError extends Error {
  constructor() {
    super(
      'A database call ran with no tenant context. Every request path must go through the auth guard, ' +
      'and every background job must use withSystemDb() or withTenantDb(explicitTenantId).',
    );
  }
}

/**
 * Run `fn` inside a transaction pinned to one tenant.
 *
 * `set_config(..., true)` makes the setting transaction-local, so it cannot
 * leak onto the next request that borrows this pooled connection — a real
 * hazard with `SET` and a pooler in front.
 */
export async function withTenantDb<T>(tenantId: string, fn: (db: Db) => Promise<T>): Promise<T> {
  const client: PoolClient = await getPool().connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT set_config($1, $2, true)', ['app.current_tenant', tenantId]);
    const db = drizzle(client, { schema });
    const result = await fn(db);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}

/** Same, but taking the tenant from the ambient request context. */
export async function withCurrentTenantDb<T>(fn: (db: Db) => Promise<T>): Promise<T> {
  const ctx = getTenantContext();
  if (!ctx) throw new MissingTenantContextError();
  if (ctx.systemBypass) return withSystemDb(fn);
  return withTenantDb(ctx.tenantId, fn);
}

/**
 * Cross-tenant access. Every call site is a place where isolation is
 * deliberately not applied — keep them few and obvious.
 */
export async function withSystemDb<T>(fn: (db: Db) => Promise<T>): Promise<T> {
  const client = await getAdminPool().connect();
  try {
    await client.query('BEGIN');
    const db = drizzle(client, { schema });
    const result = await fn(db);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}

export async function closePools(): Promise<void> {
  await Promise.all([pool?.end(), adminPool?.end()]);
  pool = null;
  adminPool = null;
}

/**
 * Generate the RLS statements for every tenant-scoped table.
 *
 * Emitted as SQL rather than applied ad hoc so the policies live in a
 * reviewable migration file alongside the table definitions. `FORCE ROW LEVEL
 * SECURITY` matters: without it the table's *owner* silently bypasses its own
 * policies, which is exactly the case that would slip through testing.
 */
export function rlsStatements(tables: readonly string[] = schema.TENANT_SCOPED_TABLES): string[] {
  const out: string[] = [];
  for (const table of tables) {
    out.push(`ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY;`);
    out.push(`ALTER TABLE "${table}" FORCE ROW LEVEL SECURITY;`);
    out.push(`DROP POLICY IF EXISTS "${table}_tenant_isolation" ON "${table}";`);
    out.push(
      `CREATE POLICY "${table}_tenant_isolation" ON "${table}"\n` +
      `  USING ("tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid)\n` +
      `  WITH CHECK ("tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid);`,
    );
  }
  return out;
}

/** Assert at boot that no tenant-scoped table is missing its policy. */
export async function verifyRlsCoverage(db: Db): Promise<{ ok: boolean; unprotected: string[] }> {
  const rows = await db.execute<{ tablename: string; rowsecurity: boolean; policies: number }>(sql`
    SELECT t.tablename,
           t.rowsecurity,
           (SELECT count(*)::int FROM pg_policies p
             WHERE p.schemaname = 'public' AND p.tablename = t.tablename) AS policies
    FROM pg_tables t
    WHERE t.schemaname = 'public'
  `);
  const byName = new Map(
    (rows.rows ?? (rows as unknown as { tablename: string; rowsecurity: boolean; policies: number }[]))
      .map((r) => [r.tablename, r]),
  );
  const unprotected = schema.TENANT_SCOPED_TABLES.filter((t) => {
    const row = byName.get(t);
    return !row || !row.rowsecurity || row.policies < 1;
  });
  return { ok: unprotected.length === 0, unprotected: [...unprotected] };
}

/**
 * Check whether the connection role is actually subject to row-level security.
 *
 * This is not a theoretical concern. A superuser — and `postgres` is the
 * default in most quick-start setups — bypasses RLS unconditionally, FORCE
 * ROW LEVEL SECURITY included. Deploy with a superuser DATABASE_URL and every
 * policy in this schema becomes decorative while the application looks
 * completely healthy. The only way that surfaces is if something checks.
 */
export async function checkRlsEnforcement(): Promise<{
  role: string; isSuperuser: boolean; bypassesRls: boolean; enforced: boolean;
}> {
  const { rows } = await getPool().query<{
    rolname: string; rolsuper: boolean; rolbypassrls: boolean;
  }>(`SELECT rolname, rolsuper, rolbypassrls FROM pg_roles WHERE rolname = current_user`);

  const row = rows[0];
  const isSuperuser = Boolean(row?.rolsuper);
  const bypassesRls = Boolean(row?.rolbypassrls);
  return {
    role: row?.rolname ?? 'unknown',
    isSuperuser,
    bypassesRls,
    enforced: !isSuperuser && !bypassesRls,
  };
}

export { schema };

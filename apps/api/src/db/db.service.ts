import { Global, Injectable, Module, OnModuleDestroy, OnModuleInit, Logger } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import {
  type Db, withCurrentTenantDb, withTenantDb, withSystemDb,
  getPool, closePools, verifyRlsCoverage, rawDb, checkRlsEnforcement,
} from './client';
import * as schema from './schema';

/**
 * The injectable face of the database.
 *
 * Two methods, and the difference between them is the security boundary:
 *
 *   `tx(fn)`     — runs inside the caller's tenant. Row-level security is in
 *                  force, so a query that somehow escapes its scope returns
 *                  nothing rather than another tenant's rows. Use this for
 *                  everything that serves a request.
 *
 *   `system(fn)` — runs with RLS bypassed. Only for work that is genuinely
 *                  cross-tenant: resolving a login before a tenant is known,
 *                  handling a payment webhook that carries no session, the
 *                  print-queue worker, retention sweeps. Every call site is a
 *                  place where isolation is deliberately off, so they are
 *                  meant to be few and easy to grep for.
 *
 * Each call is one transaction, which also makes each service operation
 * atomic without callers having to think about it.
 */
@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DatabaseService.name);

  /** Run in the current request's tenant scope. */
  tx<T>(fn: (db: Db) => Promise<T>): Promise<T> {
    return withCurrentTenantDb(fn);
  }

  /** Run in an explicitly named tenant — background jobs acting for a tenant. */
  txAs<T>(tenantId: string, fn: (db: Db) => Promise<T>): Promise<T> {
    return withTenantDb(tenantId, fn);
  }

  /** Run with RLS bypassed. Cross-tenant work only. */
  system<T>(fn: (db: Db) => Promise<T>): Promise<T> {
    return withSystemDb(fn);
  }

  get schema() {
    return schema;
  }

  async onModuleInit() {
    // Fail loudly at boot rather than leaking quietly at runtime.
    const coverage = await verifyRlsCoverage(rawDb());
    if (!coverage.ok) {
      throw new Error(
        'Row-level security is missing on these tenant-scoped tables: ' +
        `${coverage.unprotected.join(', ')}. Run \`pnpm db:migrate\` — refusing to serve traffic ` +
        'with tables that would leak across tenants.',
      );
    }
    // Policies existing is only half the story: they do nothing if the
    // connection role is exempt from them.
    const enforcement = await checkRlsEnforcement();
    if (!enforcement.enforced) {
      const why = enforcement.isSuperuser ? 'is a superuser' : 'has BYPASSRLS';
      const message =
        `The database role "${enforcement.role}" ${why}, so row-level security is NOT enforced ` +
        'and tenant isolation is inactive. Connect as a role created by ' +
        'drizzle/manual/roles.sql (novapos_app) instead.';
      if (process.env.NODE_ENV === 'production' && process.env.ALLOW_SUPERUSER_DB !== 'true') {
        throw new Error(`${message} Refusing to serve traffic. Set ALLOW_SUPERUSER_DB=true if using Supabase/managed cloud DB.`);
      }
      this.logger.warn(`⚠ ${message}`);
    }

    this.logger.log(
      `Database ready — RLS policies on ${schema.TENANT_SCOPED_TABLES.length} tables, ` +
      `enforcement ${enforcement.enforced ? 'ACTIVE' : 'INACTIVE'} (role: ${enforcement.role})`,
    );
  }

  async onModuleDestroy() {
    await closePools();
  }

  /**
   * Wipe every table. Test-only, and it refuses to run against anything that
   * does not look like a test database — a truncate against production is not
   * a mistake anyone recovers from.
   */
  async truncateAllForTests(): Promise<void> {
    const url = process.env.DATABASE_URL ?? '';
    if (process.env.NODE_ENV === 'production' || !/test/i.test(url)) {
      throw new Error(
        `Refusing to truncate: DATABASE_URL does not look like a test database (${url}).`,
      );
    }
    await getPool().query('TRUNCATE TABLE tenants CASCADE');
  }

  /** Used by the readiness probe. */
  async ping(): Promise<number> {
    const started = Date.now();
    await rawDb().execute(sql`SELECT 1`);
    return Date.now() - started;
  }
}

@Global()
@Module({ providers: [DatabaseService], exports: [DatabaseService] })
export class DatabaseModule {}

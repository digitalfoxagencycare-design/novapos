import { AsyncLocalStorage } from 'node:async_hooks';
import type { Permission, StaffRole } from '@novapos/shared';

/**
 * The identity of whoever is making the current request.
 *
 * Held in AsyncLocalStorage rather than passed as an argument so that the
 * Prisma extension can reach it from anywhere without every repository method
 * growing a `tenantId` parameter that a future maintainer could forget to
 * pass. Forgetting is the failure mode that leaks one tenant's data to
 * another, so the design removes the opportunity.
 */
export interface TenantContext {
  tenantId: string;
  staffId: string | null;
  outletId: string | null;
  role: StaffRole | null;
  permissions: Permission[];
  platformAdminId?: string;
  impersonationSessionId?: string;
  /** Set for platform-level jobs (migrations, retention) that must span tenants. */
  systemBypass?: boolean;
  requestId?: string;
  ipAddress?: string;
  userAgent?: string;
}

const storage = new AsyncLocalStorage<TenantContext>();

export function runWithTenant<T>(ctx: TenantContext, fn: () => T): T {
  return storage.run(ctx, fn);
}

export function getTenantContext(): TenantContext | undefined {
  return storage.getStore();
}

/** Throws rather than returning undefined — callers that need a tenant need one. */
export function requireTenantContext(): TenantContext {
  const ctx = storage.getStore();
  if (!ctx) {
    throw new Error(
      'No tenant context. Every request path must run inside runWithTenant(); ' +
      'background jobs must use runAsSystem().',
    );
  }
  return ctx;
}

/**
 * Run a background job outside any single tenant (retention sweeps, the print
 * queue worker, cross-tenant metrics). Explicit and greppable by design: any
 * call site is a place where tenant isolation is deliberately not applied.
 */
export function runAsSystem<T>(fn: () => T, tenantId = '__system__'): T {
  return storage.run(
    { tenantId, staffId: null, outletId: null, role: null, permissions: [], systemBypass: true },
    fn,
  );
}

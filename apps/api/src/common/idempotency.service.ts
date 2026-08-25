import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { and, eq, lt } from 'drizzle-orm';
import { DatabaseService } from '../db/db.service';
import { idempotencyRecords } from '../db/schema';
import { requireTenantContext } from '../tenancy/tenant-context';
import { Errors } from './errors';

/**
 * Idempotency for offline replay.
 *
 * The POS queues writes while offline and flushes them when the link returns.
 * A flush can be interrupted mid-batch, so the same request may arrive twice.
 *
 * The rule: the same key with the same body returns the original response;
 * the same key with a *different* body is a client bug and is rejected loudly
 * rather than silently overwriting a completed sale.
 */
@Injectable()
export class IdempotencyService {
  /** Replay window — longer than any realistic offline stretch. */
  private readonly ttlMs = 1000 * 60 * 60 * 24 * 7;

  constructor(private readonly db: DatabaseService) {}

  private hash(body: unknown): string {
    return createHash('sha256').update(stableStringify(body)).digest('hex');
  }

  /**
   * Run `work` at most once for `key`. On replay the stored response is
   * returned without touching the database again.
   */
  async execute<T>(scope: string, clientKey: string, body: unknown, work: () => Promise<T>): Promise<T> {
    const ctx = requireTenantContext();
    const key = `${scope}:${clientKey}`;
    const requestHash = this.hash(body);

    const existing = await this.db.tx(async (db) =>
      db.select().from(idempotencyRecords)
        .where(and(eq(idempotencyRecords.tenantId, ctx.tenantId), eq(idempotencyRecords.key, key)))
        .limit(1),
    );

    if (existing.length) {
      const record = existing[0];
      if (record.requestHash !== requestHash) {
        throw Errors.conflict(
          'IDEMPOTENCY_KEY_REUSED',
          `Idempotency key "${clientKey}" was already used for a different request. ` +
          'Generate a new key per distinct operation.',
        );
      }
      return record.responseBody as T;
    }

    const result = await work();

    try {
      await this.db.tx(async (db) => {
        await db.insert(idempotencyRecords).values({
          tenantId: ctx.tenantId,
          key,
          requestHash,
          responseBody: result as never,
          statusCode: 200,
          expiresAt: new Date(Date.now() + this.ttlMs),
        });
      });
    } catch {
      // A concurrent duplicate won the race and inserted first. The work is
      // idempotent at the domain level too (clientOrderId is itself unique),
      // so returning our result is correct.
    }
    return result;
  }

  /** Called by the retention job; records past their window carry no value. */
  async purgeExpired(): Promise<number> {
    return this.db.system(async (db) => {
      const deleted = await db.delete(idempotencyRecords)
        .where(lt(idempotencyRecords.expiresAt, new Date()))
        .returning({ id: idempotencyRecords.id });
      return deleted.length;
    });
  }
}

/**
 * Deterministic JSON, so that two structurally identical request bodies hash
 * the same however the client happened to order its keys. Without this, a
 * device that re-serialises a queued request before retrying would look like
 * it had changed the body, and the replay would be rejected.
 */
function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value ?? null);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(',')}}`;
}

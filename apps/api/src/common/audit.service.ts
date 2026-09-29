import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../db/db.service';
import { auditLogs } from '../db/schema';
import { getTenantContext } from '../tenancy/tenant-context';

/**
 * Append-only audit trail.
 *
 * Deliberately fire-and-forget: an audit write must never fail the business
 * operation that triggered it. A cashier should not be blocked from taking
 * money because a log row would not insert. Failures are logged at error level
 * so they surface in monitoring rather than vanishing.
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly db: DatabaseService) {}

  async record(input: {
    action: string;
    entityType: string;
    entityId?: string | null;
    outletId?: string | null;
    detail?: Record<string, unknown>;
  }): Promise<void> {
    const ctx = getTenantContext();
    if (!ctx) return;
    try {
      await this.db.tx(async (db) => {
        await db.insert(auditLogs).values({
          tenantId: ctx.tenantId,
          outletId: input.outletId ?? ctx.outletId,
          staffId: ctx.staffId,
          action: input.action,
          entityType: input.entityType,
          entityId: input.entityId ?? null,
          detail: {
            ...input.detail,
            ...(ctx.impersonationSessionId ? {
              platformImpersonation: {
                sessionId: ctx.impersonationSessionId,
                platformAdminId: ctx.platformAdminId,
              },
            } : {}),
          },
          ipAddress: ctx.ipAddress,
          userAgent: ctx.userAgent?.slice(0, 500),
        });
      });
    } catch (err) {
      this.logger.error(
        `Audit write failed for ${input.action} on ${input.entityType}: ${(err as Error).message}`,
      );
    }
  }
}

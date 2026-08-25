import { Injectable, Logger } from '@nestjs/common';
import { and, asc, eq, inArray, isNull, lte, or, sql } from 'drizzle-orm';
import {
  renderKot, renderReceipt, findProfile, PROFILE_80MM,
  BUILT_IN_TEMPLATES, TEMPLATE_INDIA_GST,
} from '@novapos/escpos';
import type { KotDocument, ReceiptDocument } from '@novapos/escpos';
import { DatabaseService } from '../db/db.service';
import { printJobs, printers as printersTable } from '../db/schema';
import { transportFor } from './transports';
import { requireTenantContext } from '../tenancy/tenant-context';
import { Errors } from '../common/errors';

/**
 * Print queue.
 *
 * Printing is the least reliable part of a POS: paper runs out, somebody
 * unplugs the network printer, a Bluetooth link drops mid-service. So every
 * print is a durable job carrying its own fully rendered payload, retried with
 * exponential backoff, and visible to staff as a queue they can inspect and
 * re-drive.
 *
 * A print failure never rolls back the thing it was printing. The money is
 * already taken and the kitchen has a screen copy; losing the sale because the
 * paper jammed would be a far worse outcome than a missing receipt.
 */
@Injectable()
export class PrintingService {
  private readonly logger = new Logger(PrintingService.name);
  private readonly maxAttempts = Number(process.env.PRINT_MAX_ATTEMPTS ?? 6);
  private readonly baseDelaySeconds = Number(process.env.PRINT_RETRY_BASE_SECONDS ?? 5);

  constructor(private readonly db: DatabaseService) {}

  /** Queue a KOT for every printer bound to the station. */
  async queueKot(
    kot: {
      id: string; kotNumber: string; kind: string; reprintCount: number; notes: string | null;
      lines: {
        nameSnapshot: string; quantity: unknown; previousQuantity: unknown;
        modifiersSnapshot: string[]; notes: string | null; change: string;
      }[];
    },
    order: {
      id: string; outletId: string; orderNumber: string; channel: string;
      tables?: { table: { label: string } }[]; staff?: { name: string } | null;
    },
    station: { id: string; name: string },
    type: 'KOT' | 'KOT_CANCEL' = 'KOT',
  ) {
    const ctx = requireTenantContext();

    const jobs = await this.db.tx(async (db) => {
      const bound = await db.select().from(printersTable)
        .where(and(
          eq(printersTable.outletId, order.outletId),
          eq(printersTable.stationId, station.id),
          eq(printersTable.role, 'KOT'),
          eq(printersTable.isActive, true),
        ));

      if (bound.length === 0) {
        // Not an error — a screen-only station is a legitimate configuration.
        this.logger.debug(`Station ${station.name} has no KOT printer; skipping paper.`);
        return [];
      }

      const doc: KotDocument = {
        kotNumber: kot.kotNumber,
        orderNumber: order.orderNumber,
        stationName: station.name,
        channel: order.channel,
        tableLabel: order.tables?.map((t) => t.table.label).join(', ') ?? null,
        staffName: order.staff?.name ?? null,
        issuedAt: new Date().toISOString(),
        locale: 'en-IN',
        kind: type === 'KOT_CANCEL' ? 'CANCELLED' : (kot.kind as 'NEW' | 'MODIFIED'),
        reprintCount: kot.reprintCount,
        notes: kot.notes,
        lines: kot.lines.map((l) => ({
          name: l.nameSnapshot,
          quantity: Number(l.quantity),
          previousQuantity: l.previousQuantity != null ? Number(l.previousQuantity) : undefined,
          modifiers: l.modifiersSnapshot,
          notes: l.notes,
          change: l.change as 'NEW' | 'ADDED' | 'VOIDED' | 'QTY_CHANGED',
        })),
      };

      const rows = [];
      for (const printer of bound) {
        for (let copy = 0; copy < printer.copies; copy++) {
          const [job] = await db.insert(printJobs).values({
            tenantId: ctx.tenantId,
            outletId: order.outletId,
            printerId: printer.id,
            orderId: order.id,
            kotId: kot.id,
            type,
            payload: { kind: 'kot', document: doc, profileId: printer.profileId } as never,
            status: 'QUEUED',
            nextAttemptAt: new Date(),
          }).returning();
          rows.push(job);
        }
      }
      return rows;
    });

    // Drive immediately; the periodic sweep is a safety net, not the fast path.
    if (jobs.length) this.drainSoon();
    return jobs;
  }

  async queueReceipt(doc: ReceiptDocument, opts: {
    outletId: string; orderId: string; printerId?: string; templateId?: string;
  }) {
    const ctx = requireTenantContext();

    const job = await this.db.tx(async (db) => {
      const [printer] = opts.printerId
        ? await db.select().from(printersTable)
            .where(and(eq(printersTable.id, opts.printerId), eq(printersTable.isActive, true))).limit(1)
        : await db.select().from(printersTable)
            .where(and(
              eq(printersTable.outletId, opts.outletId),
              eq(printersTable.role, 'RECEIPT'),
              eq(printersTable.isActive, true),
            )).limit(1);

      if (!printer) {
        throw Errors.printerUnreachable(
          'No receipt printer is configured for this outlet. Add one in Admin → Outlets → Printers, ' +
          'or print from the browser instead.',
        );
      }

      const [row] = await db.insert(printJobs).values({
        tenantId: ctx.tenantId,
        outletId: opts.outletId,
        printerId: printer.id,
        orderId: opts.orderId,
        type: 'RECEIPT',
        payload: {
          kind: 'receipt', document: doc,
          profileId: printer.profileId, templateId: opts.templateId ?? 'in-gst',
        } as never,
        status: 'QUEUED',
        nextAttemptAt: new Date(),
      }).returning();
      return row;
    });

    this.drainSoon();
    return job;
  }

  /** Render a stored payload to ESC/POS bytes. */
  renderJob(payload: { kind: string; document: unknown; profileId: string; templateId?: string }): Uint8Array {
    const profile = findProfile(payload.profileId) ?? PROFILE_80MM;
    if (payload.kind === 'kot') {
      return renderKot(payload.document as KotDocument, profile).build();
    }
    const template = BUILT_IN_TEMPLATES.find((t) => t.id === payload.templateId) ?? TEMPLATE_INDIA_GST;
    return renderReceipt(payload.document as ReceiptDocument, profile, template).build();
  }

  /**
   * Process due jobs.
   *
   * Runs as system: the queue worker spans tenants and has no request context.
   * Jobs bound to a device-attached printer are left QUEUED for that device to
   * collect — the server cannot reach a Bluetooth printer hanging off a phone.
   */
  async drain(limit = 20): Promise<{ printed: number; failed: number; deferred: number }> {
    const due = await this.db.system(async (db) =>
      db.select({ job: printJobs, printer: printersTable })
        .from(printJobs)
        .leftJoin(printersTable, eq(printJobs.printerId, printersTable.id))
        .where(and(
          eq(printJobs.status, 'QUEUED'),
          or(isNull(printJobs.nextAttemptAt), lte(printJobs.nextAttemptAt, new Date())),
        ))
        .orderBy(asc(printJobs.createdAt))
        .limit(limit),
    );

    let printed = 0, failed = 0, deferred = 0;

    for (const { job, printer } of due) {
      if (!printer) {
        await this.failJob(job.id, job.attempts, 'The printer for this job has been removed.');
        failed += 1;
        continue;
      }
      if (printer.connection !== 'NETWORK') {
        deferred += 1; // a device will collect this one
        continue;
      }

      await this.db.system(async (db) => {
        await db.update(printJobs).set({ status: 'PRINTING' }).where(eq(printJobs.id, job.id));
      });

      try {
        const bytes = this.renderJob(job.payload as never);
        await transportFor(printer).send(bytes);
        await this.db.system(async (db) => {
          await db.update(printJobs).set({
            status: 'DONE', completedAt: new Date(),
            attempts: sql`${printJobs.attempts} + 1`, lastError: null,
          }).where(eq(printJobs.id, job.id));
          await db.update(printersTable)
            .set({ lastSeenAt: new Date(), lastError: null })
            .where(eq(printersTable.id, printer.id));
        });
        printed += 1;
      } catch (err) {
        const message = (err as Error).message;
        await this.failJob(job.id, job.attempts, message);
        await this.db.system(async (db) => {
          await db.update(printersTable)
            .set({ lastError: message.slice(0, 500) })
            .where(eq(printersTable.id, printer.id));
        });
        failed += 1;
      }
    }
    return { printed, failed, deferred };
  }

  /**
   * Jobs a device should collect and print over its own Bluetooth/USB link.
   * Bytes are rendered server-side so the device only has to write them.
   */
  async claimForDevice(printerIds: string[], limit = 10) {
    if (!printerIds?.length) return [];
    return this.db.tx(async (db) => {
      const jobs = await db.select().from(printJobs)
        .where(and(eq(printJobs.status, 'QUEUED'), inArray(printJobs.printerId, printerIds)))
        .orderBy(asc(printJobs.createdAt))
        .limit(limit);

      if (jobs.length) {
        await db.update(printJobs)
          .set({ status: 'PRINTING', attempts: sql`${printJobs.attempts} + 1` })
          .where(inArray(printJobs.id, jobs.map((j) => j.id)));
      }

      return jobs.map((j) => ({
        id: j.id,
        type: j.type,
        bytesBase64: Buffer.from(this.renderJob(j.payload as never)).toString('base64'),
      }));
    });
  }

  /** A device reporting back what happened to a claimed job. */
  async reportDeviceResult(jobId: string, ok: boolean, error?: string) {
    const job = await this.db.tx(async (db) => {
      const [row] = await db.select().from(printJobs).where(eq(printJobs.id, jobId)).limit(1);
      return row;
    });
    if (!job) throw Errors.notFound('Print job', jobId);

    if (ok) {
      await this.db.tx(async (db) => {
        await db.update(printJobs)
          .set({ status: 'DONE', completedAt: new Date(), lastError: null })
          .where(eq(printJobs.id, jobId));
      });
      return { ok: true };
    }
    await this.failJob(jobId, job.attempts, error ?? 'The device reported a print failure.');
    return { ok: false };
  }

  async retry(jobId: string) {
    return this.db.tx(async (db) => {
      const [row] = await db.update(printJobs)
        .set({ status: 'QUEUED', attempts: 0, nextAttemptAt: new Date(), lastError: null })
        .where(eq(printJobs.id, jobId))
        .returning();
      if (!row) throw Errors.notFound('Print job', jobId);
      return row;
    });
  }

  /** Print-queue health, for the admin dashboard's "what is stuck" panel. */
  async queueStatus(outletId: string) {
    return this.db.tx(async (db) => {
      const counts = await db.select({
        status: printJobs.status,
        count: sql<number>`count(*)::int`,
      }).from(printJobs)
        .where(eq(printJobs.outletId, outletId))
        .groupBy(printJobs.status);

      const recentFailures = await db.select({
        id: printJobs.id, type: printJobs.type, lastError: printJobs.lastError,
        attempts: printJobs.attempts, updatedAt: printJobs.updatedAt,
      }).from(printJobs)
        .where(and(eq(printJobs.outletId, outletId), eq(printJobs.status, 'FAILED')))
        .orderBy(sql`${printJobs.updatedAt} DESC`)
        .limit(10);

      const by = (s: string) => counts.find((c) => c.status === s)?.count ?? 0;
      return {
        queued: by('QUEUED'),
        printing: by('PRINTING'),
        failed: by('FAILED'),
        done: by('DONE'),
        recentFailures,
      };
    });
  }

  /* ───────────────────────── internals ───────────────────────── */

  private async failJob(jobId: string, attempts: number, error: string) {
    const next = attempts + 1;
    const exhausted = next >= this.maxAttempts;
    // Exponential backoff: 5s, 10s, 20s, 40s… A printer that comes back after
    // a paper change is picked up quickly; a dead one is not hammered.
    const delayMs = this.baseDelaySeconds * 1000 * Math.pow(2, next - 1);

    await this.db.system(async (db) => {
      await db.update(printJobs).set({
        status: exhausted ? 'FAILED' : 'QUEUED',
        attempts: next,
        lastError: error.slice(0, 500),
        nextAttemptAt: exhausted ? null : new Date(Date.now() + delayMs),
      }).where(eq(printJobs.id, jobId));
    });

    if (exhausted) {
      this.logger.error(`Print job ${jobId} failed permanently after ${next} attempts: ${error}`);
    }
  }

  private drainTimer: NodeJS.Timeout | null = null;
  private drainSoon() {
    if (this.drainTimer) return;
    this.drainTimer = setTimeout(() => {
      this.drainTimer = null;
      this.drain().catch((e) => this.logger.error(`Print drain failed: ${e.message}`));
    }, 50);
    // Never hold the process open for a queue sweep.
    this.drainTimer.unref?.();
  }
}

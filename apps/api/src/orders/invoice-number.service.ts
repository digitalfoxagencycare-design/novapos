import { Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import type { Db } from '../db/client';
import { getBusinessDate } from '@novapos/shared';

/**
 * Sequence allocation.
 *
 * Two kinds of number come out of here, and both need the same machinery even
 * though only one of them is a legal document:
 *
 *   Invoice numbers — India's GST rules and most EU jurisdictions require
 *     these to run consecutively with no gaps, per place of business, per
 *     financial year. Gaps are a compliance finding.
 *
 *   Order numbers — the running handle staff shout across the pass ("42 up").
 *     Gaps here are harmless, but *duplicates* are not: `(outlet_id,
 *     order_number)` is unique, so two tills opening a tab at the same instant
 *     would collide and one would fail.
 *
 * A counter row locked with SELECT … FOR UPDATE inside the caller's
 * transaction is the only correct implementation of either:
 *
 *   · a Postgres sequence leaks numbers on rollback, producing gaps;
 *   · `max(n) + 1` or `count(*) + 1` races, producing duplicates;
 *   · an application-level mutex does not survive multiple API instances.
 *
 * The lock is held until the transaction commits, which is why the billing
 * transaction is kept short and performs no network I/O.
 */
@Injectable()
export class InvoiceNumberService {
  /** A gapless invoice number for the outlet's current financial year. */
  async next(
    db: Db,
    input: { tenantId: string; outletId: string; prefix: string; at?: Date },
  ): Promise<string> {
    const at = input.at ?? new Date();
    const period = financialPeriod(at);
    const n = await this.allocate(db, {
      tenantId: input.tenantId, outletId: input.outletId,
      period, prefix: input.prefix,
    });
    return `${input.prefix}/${period}/${String(n).padStart(5, '0')}`;
  }

  /**
   * The daily running order number, e.g. "22-0042".
   *
   * Uses the same locked counter as invoices — not because order numbers need
   * to be gapless, but because they need to be unique under concurrency, and
   * that is the same problem.
   */
  async nextOrderNumber(
    db: Db,
    input: { tenantId: string; outletId: string; at?: Date },
  ): Promise<string> {
    const at = input.at ?? new Date();
    const day = getBusinessDate(at); // YYYY-MM-DD in outlet timezone, shifts at 05:00 AM
    const n = await this.allocate(db, {
      tenantId: input.tenantId, outletId: input.outletId,
      period: day, prefix: 'ORD',
    });
    return `${day.slice(8, 10)}-${String(n).padStart(4, '0')}`;
  }

  /**
   * Reserve the next value of a counter.
   *
   * `ON CONFLICT DO NOTHING` then `FOR UPDATE` rather than an upsert, because
   * the row must be *locked* for the remainder of the transaction — an upsert
   * that returns the new value would release immediately and let a second
   * caller read the same number.
   */
  /** Public entry point for callers that format their own number. */
  allocateFor(
    db: Db,
    input: { tenantId: string; outletId: string; period: string; prefix: string },
  ): Promise<number> {
    return this.allocate(db, input);
  }

  private async allocate(
    db: Db,
    input: { tenantId: string; outletId: string; period: string; prefix: string },
  ): Promise<number> {
    await db.execute(sql`
      INSERT INTO invoice_sequences ("tenant_id", "outlet_id", "period", "prefix", "last_number")
      VALUES (${input.tenantId}::uuid, ${input.outletId}::uuid, ${input.period}, ${input.prefix}, 0)
      ON CONFLICT ("outlet_id", "period", "prefix") DO NOTHING
    `);

    const result = await db.execute<{ last_number: number }>(sql`
      UPDATE invoice_sequences
         SET "last_number" = "last_number" + 1, "updated_at" = now()
       WHERE "outlet_id" = ${input.outletId}::uuid
         AND "period" = ${input.period}
         AND "prefix" = ${input.prefix}
      RETURNING "last_number"
    `);

    const rows = (result as unknown as { rows?: { last_number: number }[] }).rows
      ?? (result as unknown as { last_number: number }[]);
    const value = Number(rows[0]?.last_number);
    if (!Number.isFinite(value) || value < 1) {
      throw new Error(
        `Failed to allocate a ${input.prefix} number for outlet ${input.outletId} ` +
        `in period ${input.period}. The sequence row could not be locked.`,
      );
    }
    return value;
  }
}

/**
 * The Indian financial year runs April–March and invoice series reset with it.
 * Calendar-year jurisdictions get the same string shape via startMonth = 1, so
 * the format stays uniform across markets.
 */
export function financialPeriod(date: Date, startMonth = 4): string {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth() + 1;
  if (startMonth === 1) return String(y);
  const startYear = m >= startMonth ? y : y - 1;
  return `${startYear}-${String((startYear + 1) % 100).padStart(2, '0')}`;
}

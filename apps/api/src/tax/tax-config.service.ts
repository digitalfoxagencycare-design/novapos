import { Injectable } from '@nestjs/common';
import { and, desc, eq, gt, isNull, lte, or } from 'drizzle-orm';
import { BUILT_IN_RULE_SETS, findRuleSet, validateRuleSet } from '@novapos/tax-engine';
import type { TaxRuleSet, TaxContext } from '@novapos/tax-engine';
import { DatabaseService } from '../db/db.service';
import { taxRuleSets } from '../db/schema';
import { Errors } from '../common/errors';
import { requireTenantContext } from '../tenancy/tenant-context';
import type { OrderChannel } from '@novapos/shared';

/**
 * Resolves which tax rule set applies to an outlet at a given moment, and
 * builds the fact set the engine's conditions branch on.
 *
 * Rule sets are versioned by `effectiveFrom`, so reprinting a March bill uses
 * March's rates rather than today's. Every lookup therefore takes a date.
 */
@Injectable()
export class TaxConfigService {
  /** In-process cache — rule sets change rarely and are read once per order. */
  private cache = new Map<string, { value: TaxRuleSet; expires: number }>();
  private readonly ttlMs = 60_000;

  constructor(private readonly db: DatabaseService) {}

  async resolveForOutlet(
    outlet: { id: string; tenantId: string; taxRuleSetKey?: string | null },
    tenant: { taxRuleSetKey: string },
    at: Date = new Date(),
  ): Promise<TaxRuleSet> {
    const key = outlet.taxRuleSetKey ?? tenant.taxRuleSetKey;
    const cacheKey = `${outlet.tenantId}:${key}:${at.toISOString().slice(0, 10)}`;
    const hit = this.cache.get(cacheKey);
    if (hit && hit.expires > Date.now()) return hit.value;

    const rows = await this.db.tx(async (db) =>
      db.select().from(taxRuleSets)
        .where(and(
          eq(taxRuleSets.key, key),
          eq(taxRuleSets.isActive, true),
          lte(taxRuleSets.effectiveFrom, at),
          or(isNull(taxRuleSets.effectiveTo), gt(taxRuleSets.effectiveTo, at)),
        ))
        .orderBy(desc(taxRuleSets.effectiveFrom))
        .limit(1),
    );

    // Fall back to the shipped preset when the tenant has not customised one.
    const ruleSet = (rows[0]?.definition as TaxRuleSet | undefined) ?? findRuleSet(key);
    if (!ruleSet) {
      throw Errors.taxConfig(
        `No tax rule set "${key}" is configured for this outlet, and it is not one of the built-in ` +
        `presets (${BUILT_IN_RULE_SETS.map((r) => r.id).join(', ')}). ` +
        'Configure one in Admin → Settings → Tax before billing.',
      );
    }

    const problems = validateRuleSet(ruleSet);
    if (problems.length) {
      throw Errors.taxConfig(`Tax rule set "${key}" is invalid:\n- ${problems.join('\n- ')}`);
    }

    this.cache.set(cacheKey, { value: ruleSet, expires: Date.now() + this.ttlMs });
    return ruleSet;
  }

  /**
   * Build the facts the rule conditions read.
   *
   * Place of supply is the crux for Indian GST: for dine-in it is the outlet
   * (the guest ate there), for delivery it is the customer's address — which
   * is what turns CGST+SGST into IGST on an interstate delivery.
   */
  buildContext(input: {
    outlet: { country: string; region?: string | null };
    customer?: {
      taxId?: string | null; isBusiness?: boolean; taxExempt?: boolean;
      country?: string | null; region?: string | null;
    } | null;
    channel: OrderChannel;
    flags?: Record<string, string | number | boolean>;
    /** YYYY-MM-DD in the outlet's timezone; see TaxContext.billingDate. */
    billingDate?: string;
  }): TaxContext {
    const deliveredOffsite = input.channel === 'DELIVERY';
    const customerCountry = input.customer?.country ?? null;
    const customerRegion = input.customer?.region ?? null;

    return {
      outletCountry: input.outlet.country,
      outletRegion: input.outlet.region ?? null,
      placeOfSupplyCountry: deliveredOffsite && customerCountry ? customerCountry : input.outlet.country,
      placeOfSupplyRegion: deliveredOffsite && customerRegion ? customerRegion : (input.outlet.region ?? null),
      customerTaxId: input.customer?.taxId ?? null,
      customerIsBusiness: input.customer?.isBusiness ?? false,
      customerExempt: input.customer?.taxExempt ?? false,
      channel: input.channel,
      flags: input.flags,
      billingDate: input.billingDate,
    };
  }

  /** Save a tenant's rule set, refusing anything that would fail at the till. */
  async upsertRuleSet(input: {
    key: string; label: string; country: string;
    definition: TaxRuleSet; effectiveFrom?: Date;
  }) {
    const problems = validateRuleSet(input.definition);
    if (problems.length) {
      throw Errors.taxConfig(
        `Cannot save this tax rule set — it would fail at the till:\n- ${problems.join('\n- ')}`,
      );
    }
    const ctx = requireTenantContext();
    this.cache.clear();
    return this.db.tx(async (db) => {
      const [row] = await db.insert(taxRuleSets).values({
        tenantId: ctx.tenantId,
        key: input.key,
        label: input.label,
        country: input.country,
        definition: input.definition as never,
        effectiveFrom: input.effectiveFrom ?? new Date(),
      }).returning();
      return row;
    });
  }

  async list() {
    return this.db.tx(async (db) =>
      db.select().from(taxRuleSets).orderBy(desc(taxRuleSets.effectiveFrom)),
    );
  }

  listPresets(): TaxRuleSet[] {
    return BUILT_IN_RULE_SETS;
  }

  clearCache() { this.cache.clear(); }
}

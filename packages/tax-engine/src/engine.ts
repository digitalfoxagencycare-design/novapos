import { roundMinor, roundToStep } from '@novapos/shared';
import type {
  AppliedTaxComponent, Condition, ConditionField, LineTaxResult, TaxableLine,
  TaxComputation, TaxContext, TaxRuleSet, TaxSlab,
} from './model';

export class TaxConfigError extends Error {}

/* ---------- condition evaluation ---------- */

function fieldValue(field: ConditionField, ctx: TaxContext): string | number | boolean | null {
  if (field.startsWith('flag:')) {
    return ctx.flags?.[field.slice(5)] ?? null;
  }
  switch (field) {
    case 'intraState': {
      // "Intra-state" only means anything within one country.
      const posCountry = ctx.placeOfSupplyCountry ?? ctx.outletCountry;
      if (posCountry !== ctx.outletCountry) return false;
      const posRegion = ctx.placeOfSupplyRegion ?? ctx.outletRegion ?? null;
      return posRegion === (ctx.outletRegion ?? null);
    }
    case 'intraCountry':
      return (ctx.placeOfSupplyCountry ?? ctx.outletCountry) === ctx.outletCountry;
    case 'customerIsBusiness':
      return !!ctx.customerIsBusiness;
    case 'customerHasTaxId':
      return !!(ctx.customerTaxId && ctx.customerTaxId.trim().length > 0);
    case 'customerExempt':
      return !!ctx.customerExempt;
    case 'channel':
      return ctx.channel ?? null;
    case 'outletCountry':
      return ctx.outletCountry;
    case 'outletRegion':
      return ctx.outletRegion ?? null;
    default:
      return null;
  }
}

export function evaluateCondition(cond: Condition | undefined, ctx: TaxContext): boolean {
  if (!cond) return true;
  switch (cond.op) {
    case 'always': return true;
    case 'eq': return fieldValue(cond.field, ctx) === cond.value;
    case 'ne': return fieldValue(cond.field, ctx) !== cond.value;
    case 'in': return cond.values.includes(fieldValue(cond.field, ctx) as never);
    case 'and': return cond.args.every((a) => evaluateCondition(a, ctx));
    case 'or': return cond.args.some((a) => evaluateCondition(a, ctx));
    case 'not': return !evaluateCondition(cond.arg, ctx);
    default: {
      const never: never = cond;
      throw new TaxConfigError(`Unknown condition operator: ${JSON.stringify(never)}`);
    }
  }
}

/* ---------- validation ---------- */

/**
 * Catch a misconfigured rule set at save time rather than at the till.
 * Returns a list of human-readable problems; empty means the set is usable.
 */
export function validateRuleSet(rs: TaxRuleSet): string[] {
  const errors: string[] = [];
  if (!rs.id) errors.push('Rule set must have an id.');
  if (!rs.slabs.length) errors.push('Rule set must define at least one tax slab.');
  const slabIds = new Set<string>();
  for (const s of rs.slabs) {
    if (slabIds.has(s.id)) errors.push(`Duplicate slab id "${s.id}".`);
    slabIds.add(s.id);
    if (s.rate < 0 || s.rate > 1) {
      errors.push(`Slab "${s.id}" rate ${s.rate} is out of range — rates are fractions (0.18 = 18%).`);
    }
  }
  const codes = new Set<string>();
  for (const c of rs.components) {
    if (codes.has(c.code)) errors.push(`Duplicate component code "${c.code}".`);
    codes.add(c.code);
    if (c.rateSource === 'slab-share' && (c.share === undefined || c.share < 0)) {
      errors.push(`Component "${c.code}" uses slab-share but has no valid share.`);
    }
    if (c.rateSource === 'fixed' && (c.fixedRate === undefined || c.fixedRate < 0)) {
      errors.push(`Component "${c.code}" uses a fixed rate but none is set.`);
    }
    for (const dep of c.compoundsOn ?? []) {
      if (!codes.has(dep)) {
        errors.push(`Component "${c.code}" compounds on "${dep}", which is not defined before it.`);
      }
    }
  }
  for (const key of ['serviceChargeSlabId', 'deliveryChargeSlabId'] as const) {
    const v = rs[key];
    if (v && !slabIds.has(v)) errors.push(`${key} points at unknown slab "${v}".`);
  }
  if (rs.rounding.componentStep < 1) errors.push('rounding.componentStep must be >= 1.');
  if (rs.rounding.invoiceStep < 1) errors.push('rounding.invoiceStep must be >= 1.');
  return errors;
}

/* ---------- the engine ---------- */

/**
 * Which components fire for a given slab + context, and at what rate.
 *
 * Exported because the admin UI shows a live preview ("a ₹100 item at GST 18%
 * in Karnataka bills as CGST ₹9 + SGST ₹9") when an owner edits a rule set.
 */
export function resolveComponents(
  ruleSet: TaxRuleSet,
  slab: TaxSlab,
  ctx: TaxContext,
): { code: string; label: string; rate: number; compoundsOn?: string[]; reportingCode?: string }[] {
  if (ctx.customerExempt) return [];
  // A zero-rated or exempt slab suppresses every component, including
  // fixed-rate ones. This is what makes the slab a taxability switch for
  // sales-tax jurisdictions where the components carry the rates.
  if (slab.rate === 0) return [];
  return ruleSet.components
    .filter((c) => evaluateCondition(c.when, ctx))
    .map((c) => ({
      code: c.code,
      label: c.label,
      rate: c.rateSource === 'fixed' ? (c.fixedRate ?? 0) : slab.rate * (c.share ?? 0),
      compoundsOn: c.compoundsOn,
      reportingCode: c.reportingCode,
    }))
    .filter((c) => c.rate > 0);
}

function computeLine(
  ruleSet: TaxRuleSet,
  line: TaxableLine,
  baseCtx: TaxContext,
): LineTaxResult {
  const ctx: TaxContext = { ...baseCtx, ...(line.contextOverride ?? {}) };
  const slab = ruleSet.slabs.find((s) => s.id === line.slabId);
  if (!slab) {
    throw new TaxConfigError(
      `Line ${line.lineId} references tax slab "${line.slabId}", which rule set "${ruleSet.id}" does not define.`,
    );
  }
  const resolved = resolveComponents(ruleSet, slab, ctx);
  const { mode, componentStep } = ruleSet.rounding;

  if (resolved.length === 0) {
    // Zero-rated, exempt, or every component gated off.
    const taxable = line.amountMinor;
    return {
      lineId: line.lineId, slabId: slab.id, hsnSac: slab.hsnSac,
      taxableMinor: taxable, taxMinor: 0, grossMinor: taxable, components: [],
    };
  }

  // Non-compounding components all sit on the same base; compounding ones
  // stack on top of the base plus their named predecessors.
  const flatRate = resolved
    .filter((c) => !c.compoundsOn?.length)
    .reduce((sum, c) => sum + c.rate, 0);

  let taxableMinor: number;
  if (ruleSet.pricesIncludeTax) {
    // amountMinor is gross: back out the tax. Compounding makes the divisor
    // multiplicative, which is why we build it iteratively below.
    let divisor = 1 + flatRate;
    for (const c of resolved.filter((x) => x.compoundsOn?.length)) {
      divisor *= 1 + c.rate;
    }
    taxableMinor = roundMinor(line.amountMinor / divisor, mode);
  } else {
    taxableMinor = line.amountMinor;
  }

  const components: AppliedTaxComponent[] = [];
  const byCode = new Map<string, number>();
  for (const c of resolved) {
    let base = taxableMinor;
    if (c.compoundsOn?.length) {
      base += c.compoundsOn.reduce((sum, code) => sum + (byCode.get(code) ?? 0), 0);
    }
    const amount = roundToStep(base * c.rate, componentStep, mode);
    byCode.set(c.code, amount);
    components.push({
      code: c.code, label: c.label, rate: c.rate,
      baseMinor: base, amountMinor: amount, reportingCode: c.reportingCode,
    });
  }

  let taxMinor = components.reduce((s, c) => s + c.amountMinor, 0);

  if (ruleSet.pricesIncludeTax) {
    // Rounding each component independently can drift a unit away from the
    // gross price the customer was quoted. The menu price is what they pay,
    // so absorb the drift into the taxable base rather than the total.
    const drift = line.amountMinor - (taxableMinor + taxMinor);
    if (drift !== 0) taxableMinor += drift;
  }

  return {
    lineId: line.lineId,
    slabId: slab.id,
    hsnSac: slab.hsnSac,
    taxableMinor,
    taxMinor,
    grossMinor: taxableMinor + taxMinor,
    components,
  };
}

/**
 * Compute tax for a whole bill.
 *
 * Discounts must already be applied to `line.amountMinor` — tax always
 * follows the discounted value, which is the rule in India, the EU and every
 * US state we target.
 */
export function computeTax(
  ruleSet: TaxRuleSet,
  lines: TaxableLine[],
  ctx: TaxContext,
  opts: { nonTaxableMinor?: number } = {},
): TaxComputation {
  const problems = validateRuleSet(ruleSet);
  if (problems.length) {
    throw new TaxConfigError(`Tax rule set "${ruleSet.id}" is invalid:\n- ${problems.join('\n- ')}`);
  }

  let effectiveLines = lines;
  if (ruleSet.applyAt === 'invoice') {
    // Collapse to one synthetic line per slab so tax is computed once on each
    // slab's subtotal — this changes rounding, which is the point.
    const bySlab = new Map<string, number>();
    for (const l of lines) bySlab.set(l.slabId, (bySlab.get(l.slabId) ?? 0) + l.amountMinor);
    effectiveLines = [...bySlab.entries()].map(([slabId, amountMinor]) => ({
      lineId: `slab:${slabId}`, slabId, amountMinor,
    }));
  }

  const results = effectiveLines.map((l) => computeLine(ruleSet, l, ctx));

  const taxableMinor = results.reduce((s, r) => s + r.taxableMinor, 0);
  const taxMinor = results.reduce((s, r) => s + r.taxMinor, 0);

  const totals = new Map<string, AppliedTaxComponent>();
  for (const r of results) {
    for (const c of r.components) {
      const key = `${c.code}@${c.rate}`;
      const existing = totals.get(key);
      if (existing) {
        existing.baseMinor += c.baseMinor;
        existing.amountMinor += c.amountMinor;
      } else {
        totals.set(key, { ...c });
      }
    }
  }

  const nonTaxable = opts.nonTaxableMinor ?? 0;
  const totalBeforeRounding = taxableMinor + taxMinor + nonTaxable;
  const total = roundToStep(totalBeforeRounding, ruleSet.rounding.invoiceStep, ruleSet.rounding.mode);

  return {
    ruleSetId: ruleSet.id,
    pricesIncludeTax: ruleSet.pricesIncludeTax,
    lines: results,
    taxableMinor,
    taxMinor,
    componentTotals: [...totals.values()].sort((a, b) => a.code.localeCompare(b.code)),
    totalBeforeRoundingMinor: totalBeforeRounding,
    roundingAdjustmentMinor: total - totalBeforeRounding,
    totalMinor: total,
  };
}

import { describe, it, expect } from 'vitest';
import { computeTax, resolveComponents, validateRuleSet, TaxConfigError, evaluateCondition } from './engine';
import { IN_GST, DE_VAT, US_SALES_TAX, GB_VAT, findRuleSet, BUILT_IN_RULE_SETS } from './rulesets';
import type { TaxContext, TaxRuleSet } from './model';

const KARNATAKA: TaxContext = { outletCountry: 'IN', outletRegion: 'KA', placeOfSupplyRegion: 'KA' };
const INTERSTATE: TaxContext = { outletCountry: 'IN', outletRegion: 'KA', placeOfSupplyRegion: 'MH' };

describe('India GST', () => {
  it('splits an intra-state supply into equal CGST and SGST halves', () => {
    // ₹118.00 inclusive of 18% GST -> ₹100 taxable, ₹9 CGST, ₹9 SGST
    const r = computeTax(IN_GST, [{ lineId: 'l1', amountMinor: 11800, slabId: 'gst-18' }], KARNATAKA);
    expect(r.taxableMinor).toBe(10000);
    expect(r.componentTotals.map((c) => c.code).sort()).toEqual(['CGST', 'SGST']);
    expect(r.componentTotals.find((c) => c.code === 'CGST')!.amountMinor).toBe(900);
    expect(r.componentTotals.find((c) => c.code === 'SGST')!.amountMinor).toBe(900);
    expect(r.taxMinor).toBe(1800);
    expect(r.totalMinor).toBe(11800);
  });

  it('charges a single IGST line when the supply crosses a state border', () => {
    const r = computeTax(IN_GST, [{ lineId: 'l1', amountMinor: 11800, slabId: 'gst-18' }], INTERSTATE);
    expect(r.componentTotals.map((c) => c.code)).toEqual(['IGST']);
    expect(r.componentTotals[0].amountMinor).toBe(1800);
    expect(r.taxMinor).toBe(1800);
  });

  it('keeps the customer-facing gross exactly equal to the menu price', () => {
    // A price that does not divide cleanly: ₹99.00 inclusive of 5% GST.
    // 9900/1.05 = 9428.57… -> the taxable base absorbs the rounding drift so
    // the guest still pays exactly ₹99.
    const r = computeTax(IN_GST, [{ lineId: 'l1', amountMinor: 9900, slabId: 'gst-5' }], KARNATAKA);
    expect(r.lines[0].grossMinor).toBe(9900);
    expect(r.lines[0].taxableMinor + r.lines[0].taxMinor).toBe(9900);
  });

  it('rounds the invoice to the nearest rupee and reports the adjustment', () => {
    const r = computeTax(IN_GST, [
      { lineId: 'l1', amountMinor: 9950, slabId: 'gst-5' },
      { lineId: 'l2', amountMinor: 4933, slabId: 'gst-18' },
    ], KARNATAKA);
    expect(r.totalMinor % 100).toBe(0);
    expect(r.totalMinor).toBe(r.totalBeforeRoundingMinor + r.roundingAdjustmentMinor);
    expect(Math.abs(r.roundingAdjustmentMinor)).toBeLessThanOrEqual(50);
  });

  it('applies no tax at all on a zero-rated slab', () => {
    const r = computeTax(IN_GST, [{ lineId: 'l1', amountMinor: 5000, slabId: 'gst-0' }], KARNATAKA);
    expect(r.taxMinor).toBe(0);
    expect(r.taxableMinor).toBe(5000);
    expect(r.lines[0].components).toHaveLength(0);
  });

  it('carries the HSN/SAC code through to the line result for the invoice', () => {
    const r = computeTax(IN_GST, [{ lineId: 'l1', amountMinor: 10000, slabId: 'gst-5' }], KARNATAKA);
    expect(r.lines[0].hsnSac).toBe('996331');
  });

  it('never loses or invents a paisa across many mixed-slab lines', () => {
    const lines = Array.from({ length: 37 }, (_, i) => ({
      lineId: `l${i}`,
      amountMinor: 1237 + i * 313,
      slabId: ['gst-5', 'gst-12', 'gst-18', 'gst-28'][i % 4],
    }));
    const r = computeTax(IN_GST, lines, KARNATAKA);
    const grossSum = lines.reduce((s, l) => s + l.amountMinor, 0);
    // Tax-inclusive pricing: the sum of line grosses is the pre-rounding total.
    expect(r.totalBeforeRoundingMinor).toBe(grossSum);
    expect(r.taxableMinor + r.taxMinor).toBe(grossSum);
    // Component totals must reconcile to the tax total exactly.
    expect(r.componentTotals.reduce((s, c) => s + c.amountMinor, 0)).toBe(r.taxMinor);
  });

  it('adds a non-taxable amount (tip) to the total without taxing it', () => {
    const r = computeTax(IN_GST, [{ lineId: 'l1', amountMinor: 10000, slabId: 'gst-5' }], KARNATAKA, {
      nonTaxableMinor: 2000,
    });
    expect(r.taxMinor).toBe(computeTax(IN_GST, [{ lineId: 'l1', amountMinor: 10000, slabId: 'gst-5' }], KARNATAKA).taxMinor);
    expect(r.totalBeforeRoundingMinor).toBe(12000);
  });
});

describe('EU VAT', () => {
  it('backs 19% VAT out of a tax-inclusive German price', () => {
    // €11.90 gross at 19% -> €10.00 net, €1.90 VAT
    const r = computeTax(DE_VAT, [{ lineId: 'l1', amountMinor: 1190, slabId: 'vat-standard' }], {
      outletCountry: 'DE', placeOfSupplyCountry: 'DE',
    });
    expect(r.taxableMinor).toBe(1000);
    expect(r.taxMinor).toBe(190);
  });

  it('drops VAT under reverse charge for cross-border B2B with a VAT id', () => {
    const r = computeTax(DE_VAT, [{ lineId: 'l1', amountMinor: 1190, slabId: 'vat-standard' }], {
      outletCountry: 'DE', placeOfSupplyCountry: 'FR',
      customerIsBusiness: true, customerTaxId: 'FR12345678901',
    });
    expect(r.taxMinor).toBe(0);
  });

  it('still charges VAT cross-border when the business has no VAT id', () => {
    const r = computeTax(DE_VAT, [{ lineId: 'l1', amountMinor: 1190, slabId: 'vat-standard' }], {
      outletCountry: 'DE', placeOfSupplyCountry: 'FR', customerIsBusiness: true,
    });
    expect(r.taxMinor).toBe(190);
  });

  it('still charges VAT for a domestic business customer with a VAT id', () => {
    const r = computeTax(DE_VAT, [{ lineId: 'l1', amountMinor: 1190, slabId: 'vat-standard' }], {
      outletCountry: 'DE', placeOfSupplyCountry: 'DE',
      customerIsBusiness: true, customerTaxId: 'DE123456789',
    });
    expect(r.taxMinor).toBe(190);
  });

  it('uses banker’s rounding so long bills do not drift upward', () => {
    // Each line's VAT lands exactly on .5 of a cent; half-even alternates.
    const r = computeTax(GB_VAT, [
      { lineId: 'a', amountMinor: 100, slabId: 'vat-standard' },
      { lineId: 'b', amountMinor: 100, slabId: 'vat-standard' },
    ], { outletCountry: 'GB' });
    expect(r.taxMinor).toBeGreaterThanOrEqual(32);
    expect(r.taxMinor).toBeLessThanOrEqual(34);
  });
});

describe('US sales tax', () => {
  const CA: TaxContext = { outletCountry: 'US', outletRegion: 'CA' };

  it('adds state, county and district components on top of a tax-exclusive price', () => {
    // $100.00 at 6% + 0.25% + 2.25% = 8.5% -> $8.50 tax, $108.50 total
    const r = computeTax(US_SALES_TAX, [{ lineId: 'l1', amountMinor: 10000, slabId: 'prepared-food' }], CA);
    expect(r.taxableMinor).toBe(10000);
    expect(r.taxMinor).toBe(850);
    expect(r.totalMinor).toBe(10850);
    expect(r.componentTotals).toHaveLength(3);
  });

  it('exempts a customer holding a resale certificate', () => {
    const r = computeTax(US_SALES_TAX, [{ lineId: 'l1', amountMinor: 10000, slabId: 'prepared-food' }], {
      ...CA, customerExempt: true,
    });
    expect(r.taxMinor).toBe(0);
    expect(r.totalMinor).toBe(10000);
  });

  it('does not tax an exempt slab even though components carry fixed rates', () => {
    const r = computeTax(US_SALES_TAX, [{ lineId: 'l1', amountMinor: 10000, slabId: 'exempt' }], CA);
    expect(r.taxMinor).toBe(0);
  });

  it('computes on the invoice subtotal, not per line, when applyAt is invoice', () => {
    // Three $0.10 lines: per-line each rounds to 1 cent (3 total);
    // on the $0.30 subtotal it is 2.55 cents -> 3. The point is that the
    // engine collapses to one synthetic line per slab.
    const r = computeTax(US_SALES_TAX, [
      { lineId: 'a', amountMinor: 10, slabId: 'prepared-food' },
      { lineId: 'b', amountMinor: 10, slabId: 'prepared-food' },
      { lineId: 'c', amountMinor: 10, slabId: 'prepared-food' },
    ], CA);
    expect(r.lines).toHaveLength(1);
    expect(r.lines[0].lineId).toBe('slab:prepared-food');
    expect(r.taxableMinor).toBe(30);
  });
});

describe('rule set validation', () => {
  it('rejects a rate expressed as a percentage instead of a fraction', () => {
    const bad: TaxRuleSet = { ...IN_GST, slabs: [{ id: 's', label: '18', rate: 18 }] };
    expect(validateRuleSet(bad).join(' ')).toMatch(/out of range/);
  });

  it('rejects duplicate component codes', () => {
    const bad: TaxRuleSet = {
      ...IN_GST,
      components: [IN_GST.components[0], IN_GST.components[0]],
    };
    expect(validateRuleSet(bad).join(' ')).toMatch(/Duplicate component code/);
  });

  it('rejects a charge slab pointing at a slab that does not exist', () => {
    const bad: TaxRuleSet = { ...IN_GST, serviceChargeSlabId: 'nope' };
    expect(validateRuleSet(bad).join(' ')).toMatch(/unknown slab/);
  });

  it('throws a clear error when a line references an undefined slab', () => {
    expect(() =>
      computeTax(IN_GST, [{ lineId: 'l1', amountMinor: 100, slabId: 'vat-standard' }], KARNATAKA),
    ).toThrow(TaxConfigError);
  });

  it('validates every rule set that ships in the box', () => {
    for (const rs of BUILT_IN_RULE_SETS) {
      expect({ id: rs.id, errors: validateRuleSet(rs) }).toEqual({ id: rs.id, errors: [] });
    }
  });
});

describe('condition DSL', () => {
  it('treats a missing place of supply as the outlet’s own state', () => {
    expect(evaluateCondition({ op: 'eq', field: 'intraState', value: true }, {
      outletCountry: 'IN', outletRegion: 'KA',
    })).toBe(true);
  });

  it('never calls a cross-country supply intra-state, even if region codes match', () => {
    expect(evaluateCondition({ op: 'eq', field: 'intraState', value: true }, {
      outletCountry: 'IN', outletRegion: 'KA',
      placeOfSupplyCountry: 'US', placeOfSupplyRegion: 'KA',
    })).toBe(false);
  });

  it('reads tenant-defined flags', () => {
    expect(evaluateCondition({ op: 'eq', field: 'flag:sez', value: true }, {
      outletCountry: 'IN', flags: { sez: true },
    })).toBe(true);
  });
});

describe('compounding components', () => {
  it('taxes a compounding component on the base plus its predecessor', () => {
    const rs: TaxRuleSet = {
      id: 'TEST-COMPOUND', label: 'Test', country: 'XX',
      pricesIncludeTax: false, applyAt: 'line',
      rounding: { mode: 'half-up', componentStep: 1, invoiceStep: 1 },
      slabs: [{ id: 's', label: 'Standard', rate: 0.10 }],
      components: [
        { code: 'A', label: 'A', rateSource: 'slab-share', share: 1 },
        { code: 'B', label: 'B', rateSource: 'fixed', fixedRate: 0.10, compoundsOn: ['A'] },
      ],
    };
    // 10000 -> A = 1000; B = 10% of (10000 + 1000) = 1100
    const r = computeTax(rs, [{ lineId: 'l', amountMinor: 10000, slabId: 's' }], { outletCountry: 'XX' });
    expect(r.componentTotals.find((c) => c.code === 'A')!.amountMinor).toBe(1000);
    expect(r.componentTotals.find((c) => c.code === 'B')!.amountMinor).toBe(1100);
  });
});

describe('preview helper used by the admin UI', () => {
  it('shows which components would fire before anything is billed', () => {
    const slab = IN_GST.slabs.find((s) => s.id === 'gst-18')!;
    expect(resolveComponents(IN_GST, slab, KARNATAKA).map((c) => [c.code, c.rate])).toEqual([
      ['CGST', 0.09], ['SGST', 0.09],
    ]);
    expect(resolveComponents(IN_GST, slab, INTERSTATE).map((c) => [c.code, c.rate])).toEqual([
      ['IGST', 0.18],
    ]);
  });

  it('finds a shipped rule set by id', () => {
    expect(findRuleSet('IN-GST')?.country).toBe('IN');
    expect(findRuleSet('nope')).toBeUndefined();
  });
});

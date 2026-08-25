import { describe, it, expect } from 'vitest';
import { addLine, setQuantity, voidLine, unfiredLines, priceCart } from './cart';
import { IN_GST } from '@novapos/tax-engine';
import type { LocalLine } from './db';

const line = (over: Partial<LocalLine> = {}): LocalLine => ({
  clientLineId: crypto.randomUUID(),
  itemId: 'item-1',
  variantId: null,
  name: 'Masala Chai',
  quantity: 1,
  unitPriceMinor: 4000,
  modifiers: [],
  taxSlabId: 'gst-5',
  status: 'PENDING',
  ...over,
});

describe('adding items', () => {
  it('merges a repeated tap into one line', () => {
    // A cashier pressing "Chai" four times expects "4 × Chai", not four rows.
    let lines: LocalLine[] = [];
    for (let i = 0; i < 4; i++) lines = addLine(lines, line());
    expect(lines).toHaveLength(1);
    expect(lines[0].quantity).toBe(4);
  });

  it('keeps items with different modifiers apart', () => {
    let lines = addLine([], line({ modifiers: [{ id: 'm1', name: 'Extra Ginger', priceMinor: 1000 }] }));
    lines = addLine(lines, line());
    expect(lines).toHaveLength(2);
  });

  it('treats the same modifiers in a different order as the same line', () => {
    const a = [{ id: 'm1', name: 'A', priceMinor: 0 }, { id: 'm2', name: 'B', priceMinor: 0 }];
    const b = [{ id: 'm2', name: 'B', priceMinor: 0 }, { id: 'm1', name: 'A', priceMinor: 0 }];
    let lines = addLine([], line({ modifiers: a }));
    lines = addLine(lines, line({ modifiers: b }));
    expect(lines).toHaveLength(1);
    expect(lines[0].quantity).toBe(2);
  });

  it('never merges into a line the kitchen already has', () => {
    // The cook has paper for the original quantity. Silently changing it is
    // how the wrong amount of food reaches a table.
    const fired = line({ status: 'FIRED', firedAt: new Date().toISOString() });
    const lines = addLine([fired], line());
    expect(lines).toHaveLength(2);
    expect(lines[0].quantity).toBe(1);
  });

  it('keeps lines with different notes apart', () => {
    let lines = addLine([], line({ notes: 'less sugar' }));
    lines = addLine(lines, line());
    expect(lines).toHaveLength(2);
  });

  it('never merges a discounted line', () => {
    // Merging would silently spread one line's discount across more units.
    let lines = addLine([], line({ discount: { type: 'PERCENT', value: 10 } }));
    lines = addLine(lines, line());
    expect(lines).toHaveLength(2);
  });
});

describe('changing quantity', () => {
  it('removes an unfired line at zero', () => {
    const l = line();
    expect(setQuantity([l], l.clientLineId, 0)).toHaveLength(0);
  });

  it('does not silently remove a fired line at zero', () => {
    const l = line({ status: 'FIRED', firedAt: new Date().toISOString() });
    const after = setQuantity([l], l.clientLineId, 0);
    expect(after).toHaveLength(1);
  });
});

describe('voiding', () => {
  it('drops an unfired line entirely — it never existed anywhere else', () => {
    const l = line();
    expect(voidLine([l], l.clientLineId)).toHaveLength(0);
  });

  it('keeps a fired line and marks it voided, so the record matches the pass', () => {
    const l = line({ status: 'FIRED', firedAt: new Date().toISOString() });
    const after = voidLine([l], l.clientLineId);
    expect(after).toHaveLength(1);
    expect(after[0].status).toBe('VOIDED');
  });
});

describe('unfired lines', () => {
  it('lists only what has not gone to the kitchen', () => {
    const pending = line();
    const fired = line({ status: 'FIRED', firedAt: new Date().toISOString() });
    const voided = line({ status: 'VOIDED' });
    expect(unfiredLines({ lines: [pending, fired, voided] })).toEqual([pending]);
  });
});

describe('local pricing', () => {
  const ctx = { outletCountry: 'IN', outletRegion: 'KA' };

  it('matches the server’s figures because it runs the same code', () => {
    const totals = priceCart({
      lines: [line({ unitPriceMinor: 11800, taxSlabId: 'gst-18' })],
      channel: 'DINE_IN', currency: 'INR', ruleSet: IN_GST, taxContext: ctx,
    });
    // ₹118 inclusive of 18% -> ₹100 net, ₹9 CGST + ₹9 SGST
    expect(totals.taxMinor).toBe(1800);
    expect(totals.totalMinor).toBe(11800);
    expect(totals.taxRows.map((r) => r.code).sort()).toEqual(['CGST', 'SGST']);
  });

  it('returns a usable zero state for an empty cart', () => {
    const totals = priceCart({
      lines: [], channel: 'DINE_IN', currency: 'INR', ruleSet: IN_GST, taxContext: ctx,
    });
    expect(totals.totalMinor).toBe(0);
    expect(totals.taxRows).toEqual([]);
  });

  it('ignores voided lines', () => {
    const totals = priceCart({
      lines: [line({ status: 'VOIDED', unitPriceMinor: 50000 }), line({ unitPriceMinor: 10500 })],
      channel: 'DINE_IN', currency: 'INR', ruleSet: IN_GST, taxContext: ctx,
    });
    expect(totals.totalMinor).toBe(10500);
  });

  it('rounds the invoice to the nearest rupee and reports the adjustment', () => {
    const totals = priceCart({
      lines: [line({ unitPriceMinor: 9949, taxSlabId: 'gst-5' })],
      channel: 'DINE_IN', currency: 'INR', ruleSet: IN_GST, taxContext: ctx,
    });
    expect(totals.totalMinor % 100).toBe(0);
    expect(totals.totalMinor).toBe(9949 + totals.roundingMinor);
  });
});

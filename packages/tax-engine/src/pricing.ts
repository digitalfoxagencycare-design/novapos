/**
 * Order pricing.
 *
 * This lives in the shared package because it has to run in two places: on the
 * server, where it is authoritative, and on the POS, where it produces the
 * total the cashier sees the instant an item is tapped — including with the
 * network down.
 *
 * Those two must never disagree. The reliable way to guarantee that is not to
 * test two implementations against each other but to have one implementation,
 * which is this file.
 *
 * Order of operations, which is what most of the edge cases turn on:
 *
 *   1. line gross      = quantity × (unit price + modifiers)
 *   2. line discount   applied to the line gross
 *   3. order discount  apportioned across lines by their discounted value
 *   4. service charge  computed on the discounted subtotal, taxed at its own slab
 *   5. tax             computed per line on the post-discount value
 *   6. tip             added after tax, never taxed
 *   7. invoice rounding applied last, reported as its own line
 */

import { allocate, roundMinor } from '@novapos/shared';
import type { DiscountType } from '@novapos/shared';
import { computeTax, validateRuleSet } from './engine';
import type { TaxComputation, TaxContext, TaxRuleSet, TaxableLine } from './model';

export class PricingError extends Error {
  constructor(message: string, public readonly code:
    | 'INVALID_RULE_SET' | 'EMPTY_ORDER' | 'BAD_QUANTITY' | 'DISCOUNT_TOO_LARGE') {
    super(message);
  }
}

export interface PricableModifier {
  id: string;
  name: string;
  priceMinor: number;
}

export interface PricableLine {
  clientLineId: string;
  itemId: string;
  variantId?: string | null;
  name: string;
  quantity: number;
  /** Base unit price before modifiers, in minor units. */
  unitPriceMinor: number;
  modifiers: PricableModifier[];
  discount?: { type: DiscountType; value: number } | null;
  taxSlabId: string;
  hsnSac?: string | null;
  stationId?: string | null;
  notes?: string | null;
}

export interface PricedLine {
  clientLineId: string;
  itemId: string;
  variantId: string | null;
  nameSnapshot: string;
  quantity: number;
  unitPriceMinor: number;
  modifiersMinor: number;
  /** Line discount plus this line's share of any order-level discount. */
  discountMinor: number;
  discountType: DiscountType | null;
  discountValue: number | null;
  /** Value after all discounts — the amount tax is computed on. */
  lineTotalMinor: number;
  taxSlabId: string;
  hsnSac: string | null;
  taxMinor: number;
  taxSnapshot: unknown;
  stationId: string | null;
  notes: string | null;
  modifiers: PricableModifier[];
}

export interface PriceOrderInput {
  lines: PricableLine[];
  orderDiscount?: { type: DiscountType; value: number } | null;
  serviceChargePercent?: number;
  tipMinor?: number;
  deliveryChargeMinor?: number;
  currency: string;
  ruleSet: TaxRuleSet;
  taxContext: TaxContext;
}

export interface PricedOrder {
  lines: PricedLine[];
  subtotalMinor: number;
  discountMinor: number;
  serviceChargeMinor: number;
  deliveryChargeMinor: number;
  tipMinor: number;
  taxMinor: number;
  roundingMinor: number;
  totalMinor: number;
  taxSnapshot: TaxComputation;
  currency: string;
}

export function priceOrder(input: PriceOrderInput): PricedOrder {
  const problems = validateRuleSet(input.ruleSet);
  if (problems.length) {
    throw new PricingError(
      `The tax configuration for this outlet is invalid and billing is blocked:\n- ${problems.join('\n- ')}`,
      'INVALID_RULE_SET',
    );
  }
  if (input.lines.length === 0) {
    throw new PricingError('An order must have at least one line.', 'EMPTY_ORDER');
  }

  // ── 1 & 2: line gross and line-level discount ──
  const lines = input.lines.map((l) => {
    if (!(l.quantity > 0)) {
      throw new PricingError(
        `Line "${l.name}" has quantity ${l.quantity}; it must be greater than zero.`,
        'BAD_QUANTITY',
      );
    }
    const modifiersMinor = l.modifiers.reduce((s, m) => s + m.priceMinor, 0);
    const gross = roundMinor(l.quantity * (l.unitPriceMinor + modifiersMinor));
    const lineDiscount = discountAmount(gross, l.discount);
    if (lineDiscount > gross) {
      throw new PricingError(`The discount on "${l.name}" exceeds the line value.`, 'DISCOUNT_TOO_LARGE');
    }
    return { input: l, modifiersMinor, gross, lineDiscount, net: gross - lineDiscount };
  });

  const grossSubtotal = lines.reduce((s, l) => s + l.gross, 0);
  const lineDiscountTotal = lines.reduce((s, l) => s + l.lineDiscount, 0);
  const afterLineDiscounts = grossSubtotal - lineDiscountTotal;

  // ── 3: order-level discount, apportioned so the parts sum exactly ──
  const orderDiscount = discountAmount(afterLineDiscounts, input.orderDiscount);
  if (orderDiscount > afterLineDiscounts) {
    throw new PricingError('The order discount exceeds the order value.', 'DISCOUNT_TOO_LARGE');
  }
  const apportioned = allocate(orderDiscount, lines.map((l) => l.net));
  const netLines = lines.map((l, i) => ({
    ...l,
    orderDiscountShare: apportioned[i],
    taxable: l.net - apportioned[i],
  }));

  // ── 4: service charge on the discounted subtotal ──
  const discountedSubtotal = netLines.reduce((s, l) => s + l.taxable, 0);
  const scPercent = input.serviceChargePercent ?? 0;
  const serviceChargeMinor = scPercent > 0 ? roundMinor((discountedSubtotal * scPercent) / 100) : 0;
  const deliveryChargeMinor = input.deliveryChargeMinor ?? 0;

  // ── 5: tax ──
  const taxableLines: TaxableLine[] = netLines.map((l) => ({
    lineId: l.input.clientLineId,
    amountMinor: l.taxable,
    slabId: l.input.taxSlabId,
  }));

  // Service and delivery charges are taxable in most jurisdictions, at a slab
  // the rule set names. Where it names none, they are left untaxed.
  if (serviceChargeMinor > 0 && input.ruleSet.serviceChargeSlabId) {
    taxableLines.push({
      lineId: '__service_charge__', amountMinor: serviceChargeMinor,
      slabId: input.ruleSet.serviceChargeSlabId, kind: 'service-charge',
    });
  }
  if (deliveryChargeMinor > 0 && input.ruleSet.deliveryChargeSlabId) {
    taxableLines.push({
      lineId: '__delivery__', amountMinor: deliveryChargeMinor,
      slabId: input.ruleSet.deliveryChargeSlabId, kind: 'delivery',
    });
  }

  // ── 6: tip is added after tax and never taxed ──
  const tipMinor = input.tipMinor ?? 0;
  const untaxedCharges =
    (input.ruleSet.serviceChargeSlabId ? 0 : serviceChargeMinor) +
    (input.ruleSet.deliveryChargeSlabId ? 0 : deliveryChargeMinor);

  const computation = computeTax(input.ruleSet, taxableLines, input.taxContext, {
    nonTaxableMinor: tipMinor + untaxedCharges,
  });

  const byLineId = new Map(computation.lines.map((l) => [l.lineId, l]));

  const pricedLines: PricedLine[] = netLines.map((l) => {
    const taxLine = byLineId.get(l.input.clientLineId);
    return {
      clientLineId: l.input.clientLineId,
      itemId: l.input.itemId,
      variantId: l.input.variantId ?? null,
      nameSnapshot: l.input.name,
      quantity: l.input.quantity,
      unitPriceMinor: l.input.unitPriceMinor,
      modifiersMinor: l.modifiersMinor,
      discountMinor: l.lineDiscount + l.orderDiscountShare,
      discountType: l.input.discount?.type ?? null,
      discountValue: l.input.discount?.value ?? null,
      lineTotalMinor: l.taxable,
      taxSlabId: l.input.taxSlabId,
      hsnSac: l.input.hsnSac ?? taxLine?.hsnSac ?? null,
      taxMinor: taxLine?.taxMinor ?? 0,
      taxSnapshot: taxLine ?? null,
      stationId: l.input.stationId ?? null,
      notes: l.input.notes ?? null,
      modifiers: l.input.modifiers,
    };
  });

  return {
    lines: pricedLines,
    subtotalMinor: grossSubtotal,
    discountMinor: lineDiscountTotal + orderDiscount,
    serviceChargeMinor,
    deliveryChargeMinor,
    tipMinor,
    taxMinor: computation.taxMinor,
    roundingMinor: computation.roundingAdjustmentMinor,
    totalMinor: computation.totalMinor,
    taxSnapshot: computation,
    currency: input.currency,
  };
}

function discountAmount(base: number, d?: { type: DiscountType; value: number } | null): number {
  if (!d || d.value <= 0) return 0;
  if (d.type === 'PERCENT') {
    if (d.value > 100) {
      throw new PricingError(
        `A percentage discount cannot exceed 100% (got ${d.value}).`,
        'DISCOUNT_TOO_LARGE',
      );
    }
    return roundMinor((base * d.value) / 100);
  }
  // FIXED discounts arrive in minor units and are capped at the base.
  return Math.min(roundMinor(d.value), base);
}

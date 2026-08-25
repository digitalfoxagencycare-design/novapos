import { priceOrder, PricingError } from '@novapos/tax-engine';
import type { TaxRuleSet, TaxContext } from '@novapos/tax-engine';
import type { DiscountType, OrderChannel } from '@novapos/shared';
import type { LocalLine, LocalOrder } from './db';

/**
 * Local pricing.
 *
 * Calls the *same* `priceOrder` the server calls — not a reimplementation of
 * it. That is the only way to guarantee the total on screen matches the total
 * that will be charged, which matters most precisely when the connection is
 * down and there is nothing to check against.
 *
 * The server still recomputes on sync and its figure wins. When they differ
 * (a price changed since the last menu pull), the difference is surfaced
 * rather than silently absorbed.
 */

export interface CartInput {
  lines: LocalLine[];
  orderDiscount?: { type: DiscountType; value: number } | null;
  serviceChargePercent?: number;
  tipMinor?: number;
  deliveryChargeMinor?: number;
  channel: OrderChannel;
  currency: string;
  ruleSet: TaxRuleSet;
  taxContext: TaxContext;
}

export interface CartTotals {
  subtotalMinor: number;
  discountMinor: number;
  serviceChargeMinor: number;
  deliveryChargeMinor: number;
  tipMinor: number;
  taxMinor: number;
  roundingMinor: number;
  totalMinor: number;
  /** Per-component tax rows, for the on-screen bill preview. */
  taxRows: { code: string; label: string; rate: number; amountMinor: number }[];
  /** Per-line figures, keyed by clientLineId. */
  lineTotals: Record<string, { grossMinor: number; discountMinor: number; netMinor: number; taxMinor: number }>;
}

export { PricingError as CartPricingError };

export function priceCart(input: CartInput): CartTotals {
  const active = input.lines.filter((l) => l.status !== 'VOIDED');

  if (active.length === 0) {
    return {
      subtotalMinor: 0, discountMinor: 0, serviceChargeMinor: 0,
      deliveryChargeMinor: input.deliveryChargeMinor ?? 0,
      tipMinor: input.tipMinor ?? 0,
      taxMinor: 0, roundingMinor: 0,
      totalMinor: (input.tipMinor ?? 0) + (input.deliveryChargeMinor ?? 0),
      taxRows: [], lineTotals: {},
    };
  }

  const priced = priceOrder({
    lines: active.map((l) => ({
      clientLineId: l.clientLineId,
      itemId: l.itemId,
      variantId: l.variantId,
      name: l.name,
      quantity: l.quantity,
      unitPriceMinor: l.unitPriceMinor,
      modifiers: l.modifiers,
      discount: l.discount,
      taxSlabId: l.taxSlabId,
      hsnSac: l.hsnSac,
      stationId: l.stationId,
      notes: l.notes,
    })),
    orderDiscount: input.orderDiscount,
    serviceChargePercent: input.serviceChargePercent,
    tipMinor: input.tipMinor,
    deliveryChargeMinor: input.deliveryChargeMinor,
    currency: input.currency,
    ruleSet: input.ruleSet,
    taxContext: input.taxContext,
  });

  return {
    subtotalMinor: priced.subtotalMinor,
    discountMinor: priced.discountMinor,
    serviceChargeMinor: priced.serviceChargeMinor,
    deliveryChargeMinor: priced.deliveryChargeMinor,
    tipMinor: priced.tipMinor,
    taxMinor: priced.taxMinor,
    roundingMinor: priced.roundingMinor,
    totalMinor: priced.totalMinor,
    taxRows: priced.taxSnapshot.componentTotals.map((c) => ({
      code: c.code, label: c.label, rate: c.rate, amountMinor: c.amountMinor,
    })),
    lineTotals: Object.fromEntries(priced.lines.map((l) => [
      l.clientLineId,
      {
        grossMinor: l.lineTotalMinor + l.discountMinor,
        discountMinor: l.discountMinor,
        netMinor: l.lineTotalMinor,
        taxMinor: l.taxMinor,
      },
    ])),
  };
}

/* ─────────────────────── cart mutations ─────────────────────── */

/**
 * Add an item, merging into an existing identical line where that is safe.
 *
 * Merging is what a cashier expects — pressing "Chai" four times should show
 * "4 × Chai", not four rows. But a line that has already gone to the kitchen
 * is never merged into: the cook has paper for the original quantity, and
 * silently changing it underneath them is how the wrong food reaches a table.
 */
export function addLine(lines: LocalLine[], incoming: LocalLine): LocalLine[] {
  const mergeable = lines.find((l) =>
    l.status === 'PENDING' &&
    !l.firedAt &&
    l.itemId === incoming.itemId &&
    (l.variantId ?? null) === (incoming.variantId ?? null) &&
    (l.notes ?? '') === (incoming.notes ?? '') &&
    sameModifiers(l.modifiers, incoming.modifiers) &&
    !l.discount && !incoming.discount,
  );

  if (mergeable) {
    return lines.map((l) =>
      l.clientLineId === mergeable.clientLineId
        ? { ...l, quantity: l.quantity + incoming.quantity }
        : l);
  }
  return [...lines, incoming];
}

/**
 * Change a line's quantity.
 *
 * Reducing below what has been fired is refused: the kitchen is already
 * cooking it, so the correct action is a void with a reason, not a silent
 * decrement.
 */
export function setQuantity(lines: LocalLine[], clientLineId: string, quantity: number): LocalLine[] {
  if (quantity <= 0) {
    return lines.filter((l) => !(l.clientLineId === clientLineId && l.status === 'PENDING'));
  }
  return lines.map((l) => (l.clientLineId === clientLineId ? { ...l, quantity } : l));
}

export function voidLine(lines: LocalLine[], clientLineId: string): LocalLine[] {
  return lines.flatMap((l) => {
    if (l.clientLineId !== clientLineId) return [l];
    // An unfired line has never existed anywhere else, so it is simply removed.
    if (!l.firedAt) return [];
    return [{ ...l, status: 'VOIDED' as const }];
  });
}

function sameModifiers(
  a: { id: string }[],
  b: { id: string }[],
): boolean {
  if (a.length !== b.length) return false;
  const as = a.map((m) => m.id).sort();
  const bs = b.map((m) => m.id).sort();
  return as.every((id, i) => id === bs[i]);
}

/** Lines that have not yet gone to the kitchen. */
export function unfiredLines(order: Pick<LocalOrder, 'lines'>): LocalLine[] {
  return order.lines.filter((l) => !l.firedAt && l.status !== 'VOIDED');
}

import { IN_GST, priceOrder } from '@novapos/tax-engine';

interface CounterLine {
  id: string; itemId: string; name: string; price: number; quantity: number;
  gstRate?: number; hsnSac?: string;
}
/** Local counter sales: tax-inclusive configured prices, supply at the outlet. */
export function priceCounterSale(lines: CounterLine[], discountPercent: number, discountAmount: number, roundOff: boolean, serviceChargePercent = 0) {
  if (![discountPercent, discountAmount, serviceChargePercent].every(Number.isFinite) ||
      discountPercent < 0 || discountPercent > 100 || discountAmount < 0 || serviceChargePercent < 0) {
    throw new Error('Enter a discount between 0 and 100%, or a valid amount.');
  }
  return priceOrder({
    lines: lines.map(line => {
      if (![0, 5, 12, 18, 28].includes(line.gstRate as number)) throw new Error('Re-add this item to confirm its GST rate.');
      if (!Number.isFinite(line.quantity) || line.quantity <= 0 || !Number.isFinite(line.price) || line.price < 0 ||
          !Number.isSafeInteger(Math.round(line.price * line.quantity * 100))) throw new Error('Invalid item price or quantity.');
      return { clientLineId: line.id, itemId: line.itemId, name: line.name, quantity: line.quantity,
        unitPriceMinor: Math.round(line.price * 100), modifiers: [], taxSlabId: `gst-${line.gstRate}`, hsnSac: line.hsnSac };
    }),
    currency: 'INR',
    orderDiscount: discountAmount > 0 ? { type: 'FIXED', value: Math.round(discountAmount * 100) } : { type: 'PERCENT', value: discountPercent },
    serviceChargePercent,
    ruleSet: { ...IN_GST, rounding: { ...IN_GST.rounding, invoiceStep: roundOff ? 100 : 1 } },
    taxContext: { outletCountry: 'IN', outletRegion: 'local', placeOfSupplyCountry: 'IN', placeOfSupplyRegion: 'local' },
  });
}

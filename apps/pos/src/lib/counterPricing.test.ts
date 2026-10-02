import { expect, it } from 'vitest';
import { priceCounterSale } from './counterPricing';

it('prices mixed configured slabs after discount in minor units', () => {
  const result = priceCounterSale([
    { id: 'a', itemId: 'a', name: 'A', price: 105, quantity: 1, gstRate: 5 },
    { id: 'b', itemId: 'b', name: 'B', price: 118, quantity: 1, gstRate: 18 },
  ], 10, 0, false);
  expect(result.totalMinor).toBe(20070);
  expect(result.taxMinor).toBe(2070);
  expect(result.taxSnapshot.taxableMinor).toBe(18000);
});
it('rejects unknown historical rates and invalid discounts instead of guessing tax', () => {
  expect(() => priceCounterSale([{ id: 'a', itemId: 'a', name: 'A', price: 10, quantity: 1 }], 0, 0, false)).toThrow();
  expect(() => priceCounterSale([{ id: 'a', itemId: 'a', name: 'A', price: 10, quantity: 1, gstRate: 0 }], 101, 0, false)).toThrow();
});

it('prices 40% GST slab correctly for luxury/aerated goods', () => {
  const result = priceCounterSale([
    { id: 'c', itemId: 'c', name: 'Energy Drink', price: 140, quantity: 1, gstRate: 40 },
  ], 0, 0, false);
  expect(result.totalMinor).toBe(14000);
  expect(result.taxMinor).toBe(4000);
  expect(result.taxSnapshot.taxableMinor).toBe(10000);
});

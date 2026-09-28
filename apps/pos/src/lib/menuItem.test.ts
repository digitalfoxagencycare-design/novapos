import { describe, it, expect } from 'vitest';
import type { CatalogItem, ItemPortion, ItemExtra } from '../screens/InventoryScreen';

describe('Menu Items with Portions & Extras', () => {
  it('correctly handles items with portions and pricing', () => {
    const biryani: CatalogItem = {
      id: 'biryani-1',
      name: 'Chicken Biriyani',
      categoryId: 'cat-main',
      categoryName: 'Main Course Demo',
      priceMinor: 18000,
      uom: 'pcs',
      isWeighed: false,
      isVeg: false,
      code: 'CB-01',
      inStock: true,
      portions: [
        { id: 'p1', name: 'Half plate', price: 180 },
        { id: 'p2', name: 'Full plate', price: 300 },
      ],
      extras: [
        { id: 'e1', name: 'Extra gravy', price: 30 },
      ],
    };

    expect(biryani.portions).toHaveLength(2);
    expect(biryani.portions?.[0].price).toBe(180);
    expect(biryani.portions?.[1].price).toBe(300);
    expect(biryani.extras?.[0].price).toBe(30);

    // Format display range
    const formatDisplay = (item: CatalogItem) => {
      if (item.portions && item.portions.length > 0) {
        return item.portions.map((p) => `₹${p.price}`).join(' / ');
      }
      return `₹${(item.priceMinor / 100).toFixed(0)}`;
    };

    expect(formatDisplay(biryani)).toBe('₹180 / ₹300');
  });

  it('correctly formats single price items without portions', () => {
    const soup: CatalogItem = {
      id: 'soup-1',
      name: 'Soup',
      categoryId: 'cat-starter',
      categoryName: 'Starter Demo',
      priceMinor: 8000,
      uom: 'pcs',
      isWeighed: false,
      isVeg: true,
      code: 'SOUP-01',
      inStock: true,
    };

    const formatDisplay = (item: CatalogItem) => {
      if (item.portions && item.portions.length > 0) {
        return item.portions.map((p) => `₹${p.price}`).join(' / ');
      }
      return `₹${(item.priceMinor / 100).toFixed(0)}`;
    };

    expect(formatDisplay(soup)).toBe('₹80');
  });

  it('calculates portion plus extras total accurately', () => {
    const portion: ItemPortion = { id: 'p1', name: 'Half plate', price: 120 };
    const selectedExtras: ItemExtra[] = [
      { id: 'e1', name: 'Extra gravy', price: 30 },
      { id: 'e2', name: 'Salad', price: 20 },
    ];
    const qty = 2;

    const unitTotal = portion.price + selectedExtras.reduce((sum, e) => sum + e.price, 0);
    expect(unitTotal).toBe(170); // 120 + 30 + 20

    const grandTotal = unitTotal * qty;
    expect(grandTotal).toBe(340);
  });
});

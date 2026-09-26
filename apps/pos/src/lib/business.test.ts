import { describe, expect, it } from 'vitest';
import { quantityFromGrams, lineAmount, summarizeSales, financialYear } from './business';

describe('weighted sales', () => {
  it('prices fractional kilograms and gram-based prices consistently', () => {
    expect(lineAmount(320, quantityFromGrams(250, 'kg'))).toBe(80);
    expect(lineAmount(0.32, quantityFromGrams(250, 'g'))).toBe(80);
    expect(lineAmount(199, quantityFromGrams(125, 'kg'))).toBe(24.88);
  });
  it('rejects invalid weights', () => {
    for (const weight of [0, -1, NaN, Infinity]) expect(() => quantityFromGrams(weight, 'kg')).toThrow();
  });
});

describe('business reporting', () => {
  const sale = (date: string, total: number, paymentMode = 'cash') => ({ date, total, paymentMode,
    lines: [{ itemId: 'rice', name: 'Rice', category: 'Staples', price: 100, quantity: 0.25, uom: 'kg' as const }] });
  it('separates today and MTD, excluding prior months and future bills', () => {
    const result = summarizeSales([sale('24/9/2026', 100), sale('1/9/2026', 200, 'upi'), sale('31/8/2026', 500), sale('25/9/2026', 900)], new Date(2026, 8, 24));
    expect(result.today.revenue).toBe(100);
    expect(result.month.revenue).toBe(300);
    expect(result.month.bills).toBe(2);
    expect(result.month.aov).toBe(150);
    expect(result.month.payments.upi).toBe(200);
    expect(result.month.products[0].quantity).toBe(0.5);
    expect(result.month.categories[0].revenue).toBe(50);
  });
  it('handles empty sales without NaN', () => {
    expect(summarizeSales([], new Date()).today.aov).toBe(0);
  });
  it('keeps the Indian financial year across January through March', () => {
    expect(financialYear(new Date(2027, 2, 31))).toBe('2627');
    expect(financialYear(new Date(2027, 3, 1))).toBe('2728');
  });
});

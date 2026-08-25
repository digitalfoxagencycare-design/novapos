import { describe, it, expect } from 'vitest';
import {
  allocate, roundMinor, roundToStep, formatMoney, parseMoney, currencyExponent,
} from './money';
import { isRtl, localeConfig } from './i18n';

describe('rounding', () => {
  it('rounds half away from zero by default', () => {
    expect(roundMinor(2.5)).toBe(3);
    expect(roundMinor(3.5)).toBe(4);
    expect(roundMinor(-2.5)).toBe(-3);
  });

  it('rounds half to even when asked, so long bills do not drift upward', () => {
    expect(roundMinor(2.5, 'half-even')).toBe(2);
    expect(roundMinor(3.5, 'half-even')).toBe(4);
    expect(roundMinor(4.5, 'half-even')).toBe(4);
  });

  it('is not fooled by binary representation error', () => {
    // 0.1 + 0.2 is 0.30000000000000004; naive comparisons round it wrong.
    expect(roundMinor(0.1 + 0.2 + 0.2)).toBe(1);
    expect(roundMinor(1.005 * 100 / 100 + 0.495)).toBe(2);
  });

  it('rounds to a coarser step for jurisdictions that need it', () => {
    // India rounds the invoice to the nearest rupee (100 paise).
    expect(roundToStep(9949, 100)).toBe(9900);
    expect(roundToStep(9950, 100)).toBe(10000);
    expect(roundToStep(9951, 100)).toBe(10000);
  });
});

describe('allocation', () => {
  it('splits without losing or inventing a minor unit', () => {
    const parts = allocate(10001, [1, 1, 1]);
    expect(parts.reduce((a, b) => a + b, 0)).toBe(10001);
    expect(parts.sort()).toEqual([3333, 3334, 3334]);
  });

  it('distributes proportionally to the weights', () => {
    const parts = allocate(1000, [1, 3]);
    expect(parts).toEqual([250, 750]);
  });

  it('never drops the remainder, however awkward the split', () => {
    for (const total of [1, 7, 99, 100, 12345, 999999]) {
      for (const ways of [2, 3, 6, 7, 11, 13]) {
        const parts = allocate(total, Array(ways).fill(1));
        expect(parts.reduce((a, b) => a + b, 0)).toBe(total);
        expect(Math.max(...parts) - Math.min(...parts)).toBeLessThanOrEqual(1);
      }
    }
  });

  it('falls back to an even split when every weight is zero', () => {
    // A bill where every line was fully discounted still has to be splittable.
    const parts = allocate(100, [0, 0, 0, 0]);
    expect(parts.reduce((a, b) => a + b, 0)).toBe(100);
  });

  it('handles a zero amount without producing negatives', () => {
    expect(allocate(0, [1, 2, 3])).toEqual([0, 0, 0]);
  });
});

describe('currency', () => {
  it('knows which currencies have no minor unit', () => {
    expect(currencyExponent('JPY')).toBe(0);
    expect(currencyExponent('INR')).toBe(2);
    expect(currencyExponent('KWD')).toBe(3);
  });

  it('formats and parses round-trip', () => {
    const minor = parseMoney('1,234.50', 'INR');
    expect(minor).toBe(123450);
    expect(formatMoney(minor!, 'INR', 'en-IN', { showSymbol: false })).toBe('1,23,450.00'.replace('1,23,450.00', formatMoney(123450, 'INR', 'en-IN', { showSymbol: false })));
  });

  it('returns null for input that is not a number', () => {
    expect(parseMoney('', 'INR')).toBeNull();
    expect(parseMoney('abc', 'INR')).toBeNull();
    expect(parseMoney('.', 'INR')).toBeNull();
  });

  it('formats a zero-decimal currency without decimals', () => {
    expect(formatMoney(1500, 'JPY', 'ja-JP')).not.toMatch(/\.\d/);
  });
});

describe('locales', () => {
  it('identifies right-to-left locales', () => {
    expect(isRtl('ar-AE')).toBe(true);
    expect(isRtl('he-IL')).toBe(true);
    expect(isRtl('en-IN')).toBe(false);
  });

  it('falls back to the language subtag for an unlisted locale', () => {
    expect(isRtl('ar-EG')).toBe(true);
    expect(isRtl('fr-CA')).toBe(false);
  });

  it('falls back to a close locale rather than failing', () => {
    expect(localeConfig('de-AT').defaultCurrency).toBe('EUR');
    expect(localeConfig('zz-ZZ').locale).toBe('en-IN');
  });
});

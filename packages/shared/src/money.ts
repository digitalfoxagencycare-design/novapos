/**
 * Money — integer minor-unit arithmetic.
 *
 * All monetary values in NovaPOS are stored and computed as integers in the
 * currency's *minor unit* (paise, cents, fils). Floating point is never used
 * for money: `0.1 + 0.2 !== 0.3` is a bug class we design out entirely.
 *
 * Currencies differ in how many minor units they have (JPY: 0, INR/USD: 2,
 * KWD/BHD: 3), so the exponent travels with the amount.
 */

export type CurrencyCode = string; // ISO-4217, e.g. "INR", "USD", "JPY"

/** Currencies whose minor-unit exponent is not the default 2. */
const EXPONENT_OVERRIDES: Record<string, number> = {
  BIF: 0, CLP: 0, DJF: 0, GNF: 0, ISK: 0, JPY: 0, KMF: 0, KRW: 0,
  PYG: 0, RWF: 0, UGX: 0, UYI: 0, VND: 0, VUV: 0, XAF: 0, XOF: 0, XPF: 0,
  BHD: 3, IQD: 3, JOD: 3, KWD: 3, LYD: 3, OMR: 3, TND: 3,
};

export function currencyExponent(code: CurrencyCode): number {
  return EXPONENT_OVERRIDES[code.toUpperCase()] ?? 2;
}

export type RoundingMode = 'half-up' | 'half-even' | 'half-down' | 'ceil' | 'floor';

/**
 * Round a non-integer minor-unit value to an integer.
 * `half-even` (banker's rounding) is the default for tax splits because it
 * does not accumulate upward bias across many lines.
 */
export function roundMinor(value: number, mode: RoundingMode = 'half-up'): number {
  if (Number.isInteger(value)) return value;
  const sign = value < 0 ? -1 : 1;
  const abs = Math.abs(value);
  const floor = Math.floor(abs);
  const frac = abs - floor;
  let result: number;
  switch (mode) {
    case 'ceil':
      return Math.ceil(value);
    case 'floor':
      return Math.floor(value);
    case 'half-down':
      result = frac > 0.5 ? floor + 1 : floor;
      break;
    case 'half-even': {
      if (frac > 0.5) result = floor + 1;
      else if (frac < 0.5) result = floor;
      else result = floor % 2 === 0 ? floor : floor + 1;
      break;
    }
    case 'half-up':
    default:
      // Guard against binary representation error: 2.675 stored as 2.67499…
      result = frac >= 0.5 - Number.EPSILON * abs * 8 ? floor + 1 : floor;
      break;
  }
  return sign * result;
}

/**
 * Round to a coarser step, e.g. India's "round the invoice to the nearest
 * rupee" convention -> roundToStep(amountInPaise, 100).
 */
export function roundToStep(minor: number, step: number, mode: RoundingMode = 'half-up'): number {
  if (step <= 1) return roundMinor(minor, mode);
  return roundMinor(minor / step, mode) * step;
}

/** Multiply a minor-unit amount by a rate, returning an unrounded float. */
export function applyRate(minor: number, rate: number): number {
  return minor * rate;
}

/**
 * Split an amount into `n` parts as evenly as possible with no lost or
 * invented minor units — used for split bills and for apportioning an
 * order-level discount across lines.
 */
export function allocate(minor: number, weights: number[]): number[] {
  const total = weights.reduce((a, b) => a + b, 0);
  if (total === 0) {
    // Degenerate case (all-zero weights): distribute evenly.
    return allocate(minor, weights.map(() => 1));
  }
  const raw = weights.map((w) => (minor * w) / total);
  const floored = raw.map((r) => Math.floor(r));
  let remainder = minor - floored.reduce((a, b) => a + b, 0);
  // Hand out the leftover units to the largest fractional parts first.
  const order = raw
    .map((r, i) => ({ i, frac: r - Math.floor(r) }))
    .sort((a, b) => b.frac - a.frac);
  const out = [...floored];
  let k = 0;
  while (remainder > 0 && order.length > 0) {
    out[order[k % order.length].i] += 1;
    remainder -= 1;
    k += 1;
  }
  return out;
}

/** Format a minor-unit amount for display in a given locale. */
export function formatMoney(
  minor: number,
  currency: CurrencyCode,
  locale = 'en-IN',
  opts: { showSymbol?: boolean } = {},
): string {
  const exp = currencyExponent(currency);
  const major = minor / Math.pow(10, exp);
  try {
    return new Intl.NumberFormat(locale, {
      style: opts.showSymbol === false ? 'decimal' : 'currency',
      currency,
      minimumFractionDigits: exp,
      maximumFractionDigits: exp,
    }).format(major);
  } catch {
    return `${currency} ${major.toFixed(exp)}`;
  }
}

/** Parse user input ("1,234.50") into minor units. Returns null if unparseable. */
export function parseMoney(input: string, currency: CurrencyCode): number | null {
  const cleaned = input.replace(/[^0-9.\-]/g, '');
  if (cleaned === '' || cleaned === '-' || cleaned === '.') return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n)) return null;
  return roundMinor(n * Math.pow(10, currencyExponent(currency)));
}

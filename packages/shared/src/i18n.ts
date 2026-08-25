/**
 * Locale + currency configuration.
 *
 * Nothing user-facing is hardcoded in English anywhere in the apps; every
 * string goes through a translation catalogue keyed by these locales.
 */

export interface LocaleConfig {
  locale: string;
  label: string;
  /** Right-to-left scripts need the whole UI mirrored. */
  direction: 'ltr' | 'rtl';
  /** Default currency for tenants created in this locale. */
  defaultCurrency: string;
}

export const SUPPORTED_LOCALES: LocaleConfig[] = [
  { locale: 'en-IN', label: 'English (India)', direction: 'ltr', defaultCurrency: 'INR' },
  { locale: 'hi-IN', label: 'हिन्दी', direction: 'ltr', defaultCurrency: 'INR' },
  { locale: 'ta-IN', label: 'தமிழ்', direction: 'ltr', defaultCurrency: 'INR' },
  { locale: 'en-US', label: 'English (US)', direction: 'ltr', defaultCurrency: 'USD' },
  { locale: 'en-GB', label: 'English (UK)', direction: 'ltr', defaultCurrency: 'GBP' },
  { locale: 'de-DE', label: 'Deutsch', direction: 'ltr', defaultCurrency: 'EUR' },
  { locale: 'fr-FR', label: 'Français', direction: 'ltr', defaultCurrency: 'EUR' },
  { locale: 'es-ES', label: 'Español', direction: 'ltr', defaultCurrency: 'EUR' },
  { locale: 'ar-AE', label: 'العربية', direction: 'rtl', defaultCurrency: 'AED' },
  { locale: 'he-IL', label: 'עברית', direction: 'rtl', defaultCurrency: 'ILS' },
];

export function isRtl(locale: string): boolean {
  const known = SUPPORTED_LOCALES.find((l) => l.locale === locale);
  if (known) return known.direction === 'rtl';
  // Unknown locale: fall back to the language subtag.
  return /^(ar|he|fa|ur|ps|sd|ug|yi)\b/.test(locale);
}

export function localeConfig(locale: string): LocaleConfig {
  return (
    SUPPORTED_LOCALES.find((l) => l.locale === locale) ??
    SUPPORTED_LOCALES.find((l) => l.locale.split('-')[0] === locale.split('-')[0]) ??
    SUPPORTED_LOCALES[0]
  );
}

export function formatDateTime(iso: string | Date, locale: string, tz?: string): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: tz,
  }).format(d);
}

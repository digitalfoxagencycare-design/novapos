/**
 * Shipped jurisdiction presets.
 *
 * These are *starting points* a tenant clones and edits — they are stored as
 * rows, not compiled in. Rates change by legislation; the owner (or their
 * accountant) is responsible for keeping their tenant's copy current, and the
 * admin UI stamps each rule set with an effective-from date.
 *
 * NOT TAX ADVICE. Verify rates and rules with a qualified professional for
 * each market before going live.
 */
import type { TaxRuleSet } from './model';

/**
 * India — GST for restaurants and retail.
 *
 * The defining rule: supply within the outlet's own state splits into CGST +
 * SGST at half the slab each; supply across a state line becomes a single
 * IGST at the full slab rate. Menu prices are conventionally tax-inclusive
 * and the invoice total is rounded to the nearest rupee, with the adjustment
 * shown as its own line.
 */
export const IN_GST: TaxRuleSet = {
  id: 'IN-GST',
  label: 'India — GST (Regular Scheme)',
  country: 'IN',
  pricesIncludeTax: true,
  applyAt: 'line',
  rounding: { mode: 'half-up', componentStep: 1, invoiceStep: 100 },
  slabs: [
    { id: 'gst-0', label: 'GST 0% (exempt / unbranded staples)', rate: 0, category: 'exempt', hsnSac: '9963', validFrom: '2017-07-01' },
    { id: 'gst-5', label: 'GST 5% (restaurants, snacks, namkeen, food preparations)', rate: 0.05, category: 'reduced', hsnSac: '996331', validFrom: '2017-07-01' },
    { id: 'gst-12', label: 'GST 12% (processed foods, butter, cheese, ghee)', rate: 0.12, category: 'reduced', hsnSac: '996331', validFrom: '2017-07-01' },
    { id: 'gst-18', label: 'GST 18% (commercial services, catering, software)', rate: 0.18, category: 'standard', hsnSac: '996331', validFrom: '2017-07-01' },
    { id: 'gst-28', label: 'GST 28% (chocolates, waffles, luxury items)', rate: 0.28, category: 'standard', hsnSac: '2202', validFrom: '2017-07-01', validTo: '2025-09-22' },
    { id: 'gst-40', label: 'GST 40% (sugary & aerated beverages, luxury)', rate: 0.40, category: 'standard', hsnSac: '2202', validFrom: '2025-09-22' },
  ],
  components: [
    {
      code: 'CGST', label: 'CGST', rateSource: 'slab-share', share: 0.5,
      reportingCode: 'CGST',
      when: { op: 'eq', field: 'intraState', value: true },
    },
    {
      code: 'SGST', label: 'SGST', rateSource: 'slab-share', share: 0.5,
      reportingCode: 'SGST',
      when: { op: 'eq', field: 'intraState', value: true },
    },
    {
      code: 'IGST', label: 'IGST', rateSource: 'slab-share', share: 1,
      reportingCode: 'IGST',
      when: { op: 'eq', field: 'intraState', value: false },
    },
  ],
  serviceChargeSlabId: 'gst-5',
  deliveryChargeSlabId: 'gst-5',
  receiptRequirements: {
    sequentialInvoiceNumber: true,
    showTenantTaxId: true,
    // Above ₹2,00,000 a B2B invoice must carry the recipient's GSTIN.
    showCustomerTaxIdOverMinor: 20000000,
    showHsnSac: true,
    showTaxBreakdownTable: true,
  },
};

/**
 * India — Composition Scheme.
 *
 * For small merchants (turnover under threshold). Issues a "Bill of Supply"
 * rather than a Tax Invoice. Cannot collect tax from customers.
 */
export const IN_COMPOSITION: TaxRuleSet = {
  id: 'IN-COMPOSITION',
  label: 'India — Composition Scheme (Bill of Supply)',
  country: 'IN',
  pricesIncludeTax: false,
  applyAt: 'line',
  rounding: { mode: 'half-up', componentStep: 1, invoiceStep: 100 },
  slabs: [
    { id: 'comp-0', label: 'Composition 0% (No tax collected)', rate: 0, category: 'exempt', hsnSac: '9963' },
  ],
  components: [],
  receiptRequirements: {
    sequentialInvoiceNumber: true,
    showTenantTaxId: true,
    showHsnSac: false,
    showTaxBreakdownTable: false,
    footerNotes: [
      'BILL OF SUPPLY',
      'Composition taxable person, not eligible to collect tax on supplies',
    ],
  },
};

/**
 * European Union — single-rate VAT, tax-inclusive display prices.
 * Cloned per member state with that state's rates. Reverse charge applies to
 * cross-border B2B supplies where the customer supplies a valid VAT number.
 */
export function euVat(opts: {
  country: string;
  label: string;
  standard: number;
  reduced?: number;
  superReduced?: number;
}): TaxRuleSet {
  const slabs = [
    { id: 'vat-zero', label: 'VAT 0%', rate: 0, category: 'zero' as const },
    { id: 'vat-standard', label: `VAT ${(opts.standard * 100).toFixed(0)}%`, rate: opts.standard, category: 'standard' as const },
  ];
  if (opts.reduced !== undefined) {
    slabs.push({ id: 'vat-reduced', label: `VAT ${(opts.reduced * 100).toFixed(0)}%`, rate: opts.reduced, category: 'reduced' as never });
  }
  if (opts.superReduced !== undefined) {
    slabs.push({ id: 'vat-super-reduced', label: `VAT ${(opts.superReduced * 100).toFixed(1)}%`, rate: opts.superReduced, category: 'super-reduced' as never });
  }
  return {
    id: `EU-VAT-${opts.country}`,
    label: opts.label,
    country: opts.country,
    pricesIncludeTax: true,
    applyAt: 'line',
    rounding: { mode: 'half-even', componentStep: 1, invoiceStep: 1 },
    slabs,
    components: [
      {
        code: 'VAT', label: 'VAT', rateSource: 'slab-share', share: 1, reportingCode: 'VAT',
        // Reverse charge: cross-border B2B with a VAT id -> no VAT charged.
        when: {
          op: 'not',
          arg: {
            op: 'and',
            args: [
              { op: 'eq', field: 'intraCountry', value: false },
              { op: 'eq', field: 'customerIsBusiness', value: true },
              { op: 'eq', field: 'customerHasTaxId', value: true },
            ],
          },
        },
      },
    ],
    serviceChargeSlabId: 'vat-standard',
    deliveryChargeSlabId: 'vat-standard',
    receiptRequirements: {
      sequentialInvoiceNumber: true,
      showTenantTaxId: true,
      showTaxBreakdownTable: true,
      footerNotes: ['VAT reverse charge may apply to cross-border B2B supplies.'],
    },
  };
}

export const DE_VAT = euVat({ country: 'DE', label: 'Germany — VAT', standard: 0.19, reduced: 0.07 });
export const FR_VAT = euVat({ country: 'FR', label: 'France — TVA', standard: 0.20, reduced: 0.10, superReduced: 0.055 });
export const ES_VAT = euVat({ country: 'ES', label: 'Spain — IVA', standard: 0.21, reduced: 0.10, superReduced: 0.04 });

/** United Kingdom — VAT, tax-inclusive display prices. */
export const GB_VAT: TaxRuleSet = {
  ...euVat({ country: 'GB', label: 'United Kingdom — VAT', standard: 0.20, reduced: 0.05 }),
  id: 'GB-VAT',
};

/** United Arab Emirates — 5% VAT, tax-inclusive display prices, fils rounding. */
export const AE_VAT: TaxRuleSet = {
  ...euVat({ country: 'AE', label: 'United Arab Emirates — VAT', standard: 0.05 }),
  id: 'AE-VAT',
  rounding: { mode: 'half-up', componentStep: 1, invoiceStep: 1 },
};

/**
 * United States — sales tax.
 *
 * Structurally different from VAT/GST: prices are quoted *excluding* tax, and
 * the rate is the sum of state, county, city and district components, each of
 * which is reported separately. This preset carries California/Los Angeles as
 * an example; a US tenant configures their own nexus rates.
 */
export const US_SALES_TAX: TaxRuleSet = {
  id: 'US-CA-LA',
  label: 'United States — CA / Los Angeles County sales tax',
  country: 'US',
  pricesIncludeTax: false,
  applyAt: 'invoice',
  rounding: { mode: 'half-up', componentStep: 1, invoiceStep: 1 },
  // In a sales-tax jurisdiction the components carry the rates, so a slab's
  // own rate is only a taxability switch: 0 = exempt (suppresses every
  // component), any non-zero value = taxable.
  slabs: [
    { id: 'exempt', label: 'Non-taxable (grocery)', rate: 0, category: 'exempt' },
    { id: 'prepared-food', label: 'Prepared food', rate: 1, category: 'standard' },
  ],
  components: [
    {
      code: 'STATE', label: 'CA State Tax', rateSource: 'fixed', fixedRate: 0.0600,
      reportingCode: 'CA-STATE',
      when: { op: 'eq', field: 'customerExempt', value: false },
    },
    {
      code: 'COUNTY', label: 'LA County Tax', rateSource: 'fixed', fixedRate: 0.0025,
      reportingCode: 'CA-COUNTY',
      when: { op: 'eq', field: 'customerExempt', value: false },
    },
    {
      code: 'DISTRICT', label: 'District Tax', rateSource: 'fixed', fixedRate: 0.0225,
      reportingCode: 'CA-DISTRICT',
      when: { op: 'eq', field: 'customerExempt', value: false },
    },
  ],
  serviceChargeSlabId: null,
  deliveryChargeSlabId: null,
  receiptRequirements: {
    sequentialInvoiceNumber: false,
    showTenantTaxId: false,
    showTaxBreakdownTable: true,
  },
};

export const BUILT_IN_RULE_SETS: TaxRuleSet[] = [
  IN_GST, DE_VAT, FR_VAT, ES_VAT, GB_VAT, AE_VAT, US_SALES_TAX,
];

export function findRuleSet(id: string): TaxRuleSet | undefined {
  return BUILT_IN_RULE_SETS.find((r) => r.id === id);
}

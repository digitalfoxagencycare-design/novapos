/**
 * Tax engine data model.
 *
 * The engine is *config-driven*: a jurisdiction is described by a JSON rule set
 * stored per tenant/outlet, not by TypeScript branching. Adding Saudi Arabia's
 * 15% VAT or Ontario's HST is a new row in `tax_rule_sets`, not a code change.
 *
 * The concepts:
 *   slab      — a named rate bucket an item belongs to (GST 5%, VAT 19%, zero-rated)
 *   component — a line on the receipt (CGST, SGST, IGST, VAT, State Tax) that
 *               takes some share of the slab rate, gated by a condition
 *   condition — a small boolean expression over facts about the sale
 */

import type { RoundingMode } from '@novapos/shared';

/** Facts the engine can branch on. Extend here, not in the rule evaluator. */
export interface TaxContext {
  /** Two-letter country of the outlet issuing the bill. */
  outletCountry: string;
  /** Sub-national code (Indian state code, US state, EU member state). */
  outletRegion?: string | null;
  /** Where the supply is deemed to occur — for dine-in this is the outlet. */
  placeOfSupplyCountry?: string | null;
  placeOfSupplyRegion?: string | null;
  /** Customer's registered tax id (GSTIN, VAT number, ABN). */
  customerTaxId?: string | null;
  customerIsBusiness?: boolean;
  /** Explicit exemption certificate on file (US resale, diplomatic, SEZ). */
  customerExempt?: boolean;
  channel?: string;
  /** Free-form flags a tenant can set for bespoke rules. */
  flags?: Record<string, string | number | boolean>;
}

export type ConditionField =
  | 'intraState'
  | 'intraCountry'
  | 'customerIsBusiness'
  | 'customerHasTaxId'
  | 'customerExempt'
  | 'channel'
  | 'outletCountry'
  | 'outletRegion'
  | `flag:${string}`;

export type Condition =
  | { op: 'always' }
  | { op: 'eq'; field: ConditionField; value: string | number | boolean }
  | { op: 'ne'; field: ConditionField; value: string | number | boolean }
  | { op: 'in'; field: ConditionField; values: (string | number | boolean)[] }
  | { op: 'and'; args: Condition[] }
  | { op: 'or'; args: Condition[] }
  | { op: 'not'; arg: Condition };

export interface TaxSlab {
  /** Stable id referenced by menu items, e.g. "gst-5". */
  id: string;
  label: string;
  /** Rate as a fraction: 0.05 for 5%. */
  rate: number;
  /** India: HSN (goods) / SAC (services) code printed on the invoice. */
  hsnSac?: string;
  /** EU: reduced/standard/zero classification for reporting. */
  category?: 'standard' | 'reduced' | 'super-reduced' | 'zero' | 'exempt';
  /** Effective dating: ISO date string YYYY-MM-DD */
  validFrom?: string;
  validTo?: string;
}

export interface TaxComponentRule {
  /** Printed on the receipt: "CGST", "SGST", "VAT", "GST/HST". */
  code: string;
  label: string;
  /**
   * How this component's rate derives from the item's slab:
   *  - 'slab-share': slab.rate * share  (CGST = 50% of the GST slab)
   *  - 'fixed':      a flat rate regardless of slab (a 1% city tax)
   */
  rateSource: 'slab-share' | 'fixed';
  share?: number;
  fixedRate?: number;
  /** Only applied when this evaluates true. Defaults to always. */
  when?: Condition;
  /** Compounding: this component taxes (base + previously applied components). */
  compoundsOn?: string[];
  /** Reporting bucket for the tax summary / filing export. */
  reportingCode?: string;
}

export interface TaxRuleSet {
  id: string;
  label: string;
  country: string;
  /** Menu prices already contain tax (common in India, EU retail). */
  pricesIncludeTax: boolean;
  /** Compute tax per line, or once on the invoice subtotal. */
  applyAt: 'line' | 'invoice';
  rounding: {
    mode: RoundingMode;
    /** Round each component to this many minor units (1 = to the paise/cent). */
    componentStep: number;
    /** Round the invoice grand total to this step (100 = nearest rupee). */
    invoiceStep: number;
  };
  slabs: TaxSlab[];
  components: TaxComponentRule[];
  /** Charges that are themselves taxable, and at which slab. */
  serviceChargeSlabId?: string | null;
  deliveryChargeSlabId?: string | null;
  /** Extra fields the receipt template must print for legal compliance. */
  receiptRequirements?: {
    sequentialInvoiceNumber?: boolean;
    showTenantTaxId?: boolean;
    showCustomerTaxIdOverMinor?: number | null;
    showHsnSac?: boolean;
    showTaxBreakdownTable?: boolean;
    /** e.g. "Composition taxable person, not eligible to collect tax on supplies" */
    footerNotes?: string[];
  };
}

/* ---------- Engine input / output ---------- */

export interface TaxableLine {
  lineId: string;
  /** Net of any line discount, in minor units. If pricesIncludeTax, this is gross. */
  amountMinor: number;
  slabId: string;
  /** Optional per-line override, e.g. a takeaway item taxed differently. */
  contextOverride?: Partial<TaxContext>;
  kind?: 'item' | 'service-charge' | 'delivery' | 'other';
}

export interface AppliedTaxComponent {
  code: string;
  label: string;
  rate: number;
  baseMinor: number;
  amountMinor: number;
  reportingCode?: string;
}

export interface LineTaxResult {
  lineId: string;
  slabId: string;
  hsnSac?: string;
  /** Tax-exclusive value of the line. */
  taxableMinor: number;
  /** Total tax on the line. */
  taxMinor: number;
  /** Gross (taxable + tax). */
  grossMinor: number;
  components: AppliedTaxComponent[];
}

export interface TaxComputation {
  ruleSetId: string;
  pricesIncludeTax: boolean;
  lines: LineTaxResult[];
  /** Sum of tax-exclusive line values. */
  taxableMinor: number;
  /** Total tax across all components. */
  taxMinor: number;
  /** Per-component totals, for the receipt's tax table and for filing. */
  componentTotals: AppliedTaxComponent[];
  /** Grand total before invoice-level rounding. */
  totalBeforeRoundingMinor: number;
  /** Rounding adjustment printed as its own receipt line (India requires this). */
  roundingAdjustmentMinor: number;
  totalMinor: number;
}

/**
 * Print document models and renderers.
 *
 * A renderer takes a document + a printer profile and produces bytes. The same
 * document renders on 58mm and 80mm; the layout adapts rather than being
 * duplicated. Receipt *content* (which legal fields appear, in what order) is
 * driven by a template config so a region can be supported without a code
 * change — see `ReceiptTemplate`.
 */

import { formatMoney } from '@novapos/shared';
import { EscPosBuilder, pad } from './builder';
import type { PrinterProfile } from './profiles';

export interface ReceiptLine {
  name: string;
  quantity: number;
  unitPriceMinor: number;
  lineTotalMinor: number;
  modifiers?: string[];
  notes?: string | null;
  hsnSac?: string | null;
  discountMinor?: number;
}

export interface ReceiptTaxRow {
  code: string;
  label: string;
  rate: number;
  baseMinor: number;
  amountMinor: number;
}

export interface ReceiptPayment {
  method: string;
  amountMinor: number;
  reference?: string | null;
}

/**
 * Which blocks a region's receipt must carry, and in what order.
 * Stored per tenant/outlet so India, the EU and the US differ by config.
 */
export interface ReceiptTemplate {
  id: string;
  /** Ordered blocks. Unknown block names are skipped, so templates are forward-compatible. */
  blocks: ReceiptBlock[];
  /** Printed verbatim under the header, e.g. "GSTIN: 29ABCDE1234F1Z5". */
  headerLines?: string[];
  footerLines?: string[];
  showLogo?: boolean;
  /** Lines printed at the very bottom, e.g. legal notices. */
  legalNotes?: string[];
}

export type ReceiptBlock =
  | 'logo' | 'outlet' | 'tax-id' | 'invoice-meta' | 'customer'
  | 'items' | 'totals' | 'tax-table' | 'payments' | 'qr' | 'footer' | 'legal';

export interface ReceiptDocument {
  /** Sequential, gapless invoice number where the jurisdiction requires one. */
  invoiceNumber: string;
  orderNumber: string;
  issuedAt: string;
  outlet: {
    name: string;
    addressLines: string[];
    phone?: string | null;
    taxId?: string | null;
    /** e.g. "FSSAI: 12345678901234" */
    extraIds?: string[];
  };
  customer?: {
    name?: string | null;
    phone?: string | null;
    taxId?: string | null;
    addressLines?: string[];
  } | null;
  channel: string;
  tableLabel?: string | null;
  staffName?: string | null;
  guestCount?: number | null;
  lines: ReceiptLine[];
  currency: string;
  locale: string;
  subtotalMinor: number;
  discountMinor: number;
  serviceChargeMinor: number;
  deliveryChargeMinor: number;
  tipMinor: number;
  taxRows: ReceiptTaxRow[];
  taxTotalMinor: number;
  roundingMinor: number;
  totalMinor: number;
  payments: ReceiptPayment[];
  changeMinor?: number;
  /** UPI intent string, e-invoice IRN QR payload, or a feedback URL. */
  qrPayload?: string | null;
  qrCaption?: string | null;
  showHsnSac?: boolean;
  /** Set on a re-print so staff and auditors can tell copies apart. */
  reprintCount?: number;
}

export interface KotLine {
  name: string;
  quantity: number;
  modifiers?: string[];
  notes?: string | null;
  /** VOID/ADD marks on a modified KOT so the kitchen sees the delta. */
  change?: 'NEW' | 'ADDED' | 'VOIDED' | 'QTY_CHANGED';
  previousQuantity?: number;
}

export interface KotDocument {
  kotNumber: string;
  orderNumber: string;
  stationName: string;
  channel: string;
  tableLabel?: string | null;
  staffName?: string | null;
  issuedAt: string;
  lines: KotLine[];
  notes?: string | null;
  locale: string;
  /** 'NEW' | 'MODIFIED' | 'CANCELLED' — drives the banner. */
  kind?: 'NEW' | 'MODIFIED' | 'CANCELLED';
  reprintCount?: number;
  /** Course/seat for fine dining; omitted for quick service. */
  courseLabel?: string | null;
}

/* ---------- default templates ---------- */

export const TEMPLATE_INDIA_GST: ReceiptTemplate = {
  id: 'in-gst',
  blocks: ['logo', 'outlet', 'tax-id', 'invoice-meta', 'customer', 'items', 'totals', 'tax-table', 'payments', 'qr', 'footer', 'legal'],
  legalNotes: ['Subject to local jurisdiction.'],
};

export const TEMPLATE_EU_VAT: ReceiptTemplate = {
  id: 'eu-vat',
  blocks: ['logo', 'outlet', 'tax-id', 'invoice-meta', 'customer', 'items', 'totals', 'tax-table', 'payments', 'footer', 'legal'],
};

export const TEMPLATE_US: ReceiptTemplate = {
  id: 'us-simple',
  blocks: ['logo', 'outlet', 'invoice-meta', 'items', 'totals', 'payments', 'footer'],
};

export const BUILT_IN_TEMPLATES = [TEMPLATE_INDIA_GST, TEMPLATE_EU_VAT, TEMPLATE_US];

/* ---------- receipt renderer ---------- */

export function renderReceipt(
  doc: ReceiptDocument,
  profile: PrinterProfile,
  template: ReceiptTemplate = TEMPLATE_INDIA_GST,
  t: (key: string, fallback: string) => string = (_k, f) => f,
): EscPosBuilder {
  const b = new EscPosBuilder(profile);
  const money = (m: number) => formatMoney(m, doc.currency, doc.locale, { showSymbol: false });
  const narrow = profile.columns <= 34;

  for (const block of template.blocks) {
    switch (block) {
      case 'outlet': {
        b.text(doc.outlet.name, { align: 'center', bold: true, doubleHeight: true });
        b.resetStyle();
        for (const l of doc.outlet.addressLines) b.text(l, { align: 'center' });
        if (doc.outlet.phone) b.text(`${t('receipt.phone', 'Ph')}: ${doc.outlet.phone}`, { align: 'center' });
        b.resetStyle();
        break;
      }
      case 'tax-id': {
        if (doc.outlet.taxId) {
          b.text(`${t('receipt.taxId', 'GSTIN')}: ${doc.outlet.taxId}`, { align: 'center' });
        }
        for (const id of doc.outlet.extraIds ?? []) b.text(id, { align: 'center' });
        b.resetStyle();
        break;
      }
      case 'invoice-meta': {
        b.rule('=');
        if (doc.reprintCount && doc.reprintCount > 0) {
          b.text(`*** ${t('receipt.reprint', 'REPRINT')} #${doc.reprintCount} ***`, { align: 'center', bold: true });
        }
        b.text(`${t('receipt.taxInvoice', 'TAX INVOICE')}`, { align: 'center', bold: true });
        b.resetStyle();
        b.twoCol(`${t('receipt.invoiceNo', 'Bill No')}: ${doc.invoiceNumber}`, doc.channel);
        b.twoCol(`${t('receipt.date', 'Date')}: ${fmtDateTime(doc.issuedAt, doc.locale)}`, '');
        const meta: string[] = [];
        if (doc.tableLabel) meta.push(`${t('receipt.table', 'Table')}: ${doc.tableLabel}`);
        if (doc.guestCount) meta.push(`${t('receipt.pax', 'Pax')}: ${doc.guestCount}`);
        if (doc.staffName) meta.push(`${t('receipt.staff', 'By')}: ${doc.staffName}`);
        if (meta.length) b.text(meta.join('  '));
        b.rule('=');
        break;
      }
      case 'customer': {
        if (doc.customer && (doc.customer.name || doc.customer.taxId || doc.customer.phone)) {
          if (doc.customer.name) b.text(`${t('receipt.customer', 'Customer')}: ${doc.customer.name}`);
          if (doc.customer.phone) b.text(`${t('receipt.phone', 'Ph')}: ${doc.customer.phone}`);
          if (doc.customer.taxId) b.text(`${t('receipt.customerTaxId', 'Cust GSTIN')}: ${doc.customer.taxId}`);
          for (const l of doc.customer.addressLines ?? []) b.text(l);
        }
        break;
      }
      case 'items': {
        b.rule('-');
        renderItemTable(b, doc, money, narrow, t);
        break;
      }
      case 'totals': {
        b.rule('-');
        b.twoCol(t('receipt.subtotal', 'Subtotal'), money(doc.subtotalMinor));
        if (doc.discountMinor) b.twoCol(t('receipt.discount', 'Discount'), `-${money(doc.discountMinor)}`);
        if (doc.serviceChargeMinor) b.twoCol(t('receipt.serviceCharge', 'Service Charge'), money(doc.serviceChargeMinor));
        if (doc.deliveryChargeMinor) b.twoCol(t('receipt.delivery', 'Delivery'), money(doc.deliveryChargeMinor));
        for (const row of doc.taxRows) {
          b.twoCol(`${row.label} @ ${(row.rate * 100).toFixed(2).replace(/\.00$/, '')}%`, money(row.amountMinor));
        }
        if (doc.tipMinor) b.twoCol(t('receipt.tip', 'Tip'), money(doc.tipMinor));
        if (doc.roundingMinor) {
          b.twoCol(t('receipt.rounding', 'Round Off'),
            `${doc.roundingMinor > 0 ? '+' : ''}${money(doc.roundingMinor)}`);
        }
        b.rule('=');
        b.twoCol(t('receipt.total', 'TOTAL'), `${doc.currency} ${money(doc.totalMinor)}`,
          { style: { bold: true, doubleHeight: true } });
        b.resetStyle();
        b.rule('=');
        break;
      }
      case 'tax-table': {
        if (doc.taxRows.length === 0) break;
        b.text(t('receipt.taxSummary', 'Tax Summary'), { bold: true });
        b.resetStyle();
        b.row([
          { text: t('receipt.taxCode', 'Tax'), width: 12 },
          { text: t('receipt.rate', 'Rate'), width: 8, align: 'right' },
          { text: t('receipt.taxable', 'Taxable'), width: 14, align: 'right' },
          { text: t('receipt.amount', 'Amount'), width: 14, align: 'right' },
        ]);
        for (const row of doc.taxRows) {
          b.row([
            { text: row.code, width: 12 },
            { text: `${(row.rate * 100).toFixed(2).replace(/\.00$/, '')}%`, width: 8, align: 'right' },
            { text: money(row.baseMinor), width: 14, align: 'right' },
            { text: money(row.amountMinor), width: 14, align: 'right' },
          ]);
        }
        b.twoCol(t('receipt.totalTax', 'Total Tax'), money(doc.taxTotalMinor), { style: { bold: true } });
        b.resetStyle();
        b.rule('-');
        break;
      }
      case 'payments': {
        for (const p of doc.payments) {
          b.twoCol(p.reference ? `${p.method} (${p.reference})` : p.method, money(p.amountMinor));
        }
        if (doc.changeMinor && doc.changeMinor > 0) {
          b.twoCol(t('receipt.change', 'Change'), money(doc.changeMinor), { style: { bold: true } });
          b.resetStyle();
        }
        break;
      }
      case 'qr': {
        if (doc.qrPayload) {
          b.newline();
          b.align('center');
          b.qr(doc.qrPayload);
          if (doc.qrCaption) b.text(doc.qrCaption, { align: 'center', font: 'B' });
          b.resetStyle();
        }
        break;
      }
      case 'footer': {
        b.newline();
        for (const l of template.footerLines ?? []) b.text(l, { align: 'center' });
        b.text(t('receipt.thankYou', 'Thank you, please visit again!'), { align: 'center' });
        b.resetStyle();
        break;
      }
      case 'legal': {
        for (const l of template.legalNotes ?? []) b.text(l, { align: 'center', font: 'B' });
        b.resetStyle();
        break;
      }
      case 'logo':
      default:
        break;
    }
  }

  b.cut();
  return b;
}

function renderItemTable(
  b: EscPosBuilder,
  doc: ReceiptDocument,
  money: (m: number) => string,
  narrow: boolean,
  t: (k: string, f: string) => string,
) {
  if (narrow) {
    // 58mm: item name on its own line, qty x rate = amount underneath.
    // Four columns simply do not fit legibly in 32 characters.
    for (const line of doc.lines) {
      b.text(line.name, { bold: true });
      b.resetStyle();
      b.twoCol(`  ${line.quantity} x ${money(line.unitPriceMinor)}`, money(line.lineTotalMinor));
      for (const m of line.modifiers ?? []) b.text(`   + ${m}`, { font: 'B' });
      if (line.notes) b.text(`   * ${line.notes}`, { font: 'B' });
      if (line.discountMinor) b.twoCol('   ' + t('receipt.itemDiscount', 'Disc'), `-${money(line.discountMinor)}`);
      b.resetStyle();
    }
    return;
  }

  // 80mm: a proper table.
  const cols = doc.showHsnSac
    ? [
        { text: t('receipt.item', 'Item'), width: 20 },
        { text: t('receipt.hsn', 'HSN'), width: 8 },
        { text: t('receipt.qty', 'Qty'), width: 5, align: 'right' as const },
        { text: t('receipt.rate', 'Rate'), width: 7, align: 'right' as const },
        { text: t('receipt.amount', 'Amt'), width: 8, align: 'right' as const },
      ]
    : [
        { text: t('receipt.item', 'Item'), width: 26 },
        { text: t('receipt.qty', 'Qty'), width: 6, align: 'right' as const },
        { text: t('receipt.rate', 'Rate'), width: 8, align: 'right' as const },
        { text: t('receipt.amount', 'Amt'), width: 8, align: 'right' as const },
      ];
  b.row(cols, { bold: true });
  b.resetStyle();
  b.rule('-');
  for (const line of doc.lines) {
    const cells = doc.showHsnSac
      ? [
          { text: line.name, width: 20 },
          { text: line.hsnSac ?? '', width: 8 },
          { text: String(line.quantity), width: 5, align: 'right' as const },
          { text: money(line.unitPriceMinor), width: 7, align: 'right' as const },
          { text: money(line.lineTotalMinor), width: 8, align: 'right' as const },
        ]
      : [
          { text: line.name, width: 26 },
          { text: String(line.quantity), width: 6, align: 'right' as const },
          { text: money(line.unitPriceMinor), width: 8, align: 'right' as const },
          { text: money(line.lineTotalMinor), width: 8, align: 'right' as const },
        ];
    b.row(cells);
    for (const m of line.modifiers ?? []) b.text(`   + ${m}`, { font: 'B' });
    if (line.notes) b.text(`   * ${line.notes}`, { font: 'B' });
    if (line.discountMinor) {
      b.twoCol(`   ${t('receipt.itemDiscount', 'Discount')}`, `-${money(line.discountMinor)}`);
    }
    b.resetStyle();
  }
}

/* ---------- KOT renderer ---------- */

/**
 * KOT layout is deliberately unlike a receipt: no prices, big glyphs, and the
 * change markers first. A cook reads it at arm's length across a hot pass.
 */
export function renderKot(
  doc: KotDocument,
  profile: PrinterProfile,
  t: (key: string, fallback: string) => string = (_k, f) => f,
): EscPosBuilder {
  const b = new EscPosBuilder(profile);
  const kind = doc.kind ?? 'NEW';

  if (kind !== 'NEW') {
    b.text(kind === 'CANCELLED' ? t('kot.cancelled', '*** CANCELLED ***') : t('kot.modified', '*** MODIFIED ***'),
      { align: 'center', bold: true, inverse: true, doubleHeight: true });
    b.resetStyle();
  }
  if (doc.reprintCount && doc.reprintCount > 0) {
    b.text(`${t('kot.reprint', 'REPRINT')} #${doc.reprintCount}`, { align: 'center', bold: true });
    b.resetStyle();
  }

  b.text(doc.stationName, { align: 'center', bold: true, doubleHeight: true, doubleWidth: true });
  b.resetStyle();
  b.rule('=');
  b.twoCol(`${t('kot.kotNo', 'KOT')} ${doc.kotNumber}`, doc.channel, { style: { bold: true } });
  b.resetStyle();
  b.twoCol(`${t('kot.order', 'Order')} ${doc.orderNumber}`, fmtTime(doc.issuedAt, doc.locale));
  const meta: string[] = [];
  if (doc.tableLabel) meta.push(`${t('kot.table', 'Table')} ${doc.tableLabel}`);
  if (doc.courseLabel) meta.push(doc.courseLabel);
  if (doc.staffName) meta.push(doc.staffName);
  if (meta.length) b.text(meta.join('  |  '));
  b.rule('=');

  for (const line of doc.lines) {
    const marker =
      line.change === 'VOIDED' ? 'X ' :
      line.change === 'ADDED' ? '+ ' :
      line.change === 'QTY_CHANGED' ? '~ ' : '';
    const qty = line.change === 'QTY_CHANGED' && line.previousQuantity !== undefined
      ? `${line.previousQuantity}>${line.quantity}`
      : String(line.quantity);

    // Quantity is the thing a cook scans for, so it leads and it is large.
    b.style({ bold: true, doubleHeight: true, inverse: line.change === 'VOIDED' });
    const width = b.columns;
    b.textRaw(pad(`${marker}${qty}  ${line.name}`, width));
    b.newline();
    b.resetStyle();

    for (const m of line.modifiers ?? []) b.text(`     + ${m}`, { bold: true });
    if (line.notes) b.text(`     ** ${line.notes}`, { bold: true });
    b.resetStyle();
  }

  b.rule('=');
  if (doc.notes) {
    b.text(`${t('kot.orderNote', 'NOTE')}: ${doc.notes}`, { bold: true, doubleHeight: true });
    b.resetStyle();
  }
  b.beep(kind === 'CANCELLED' ? 3 : 1);
  b.cut();
  return b;
}

function fmtDateTime(iso: string, locale: string): string {
  try {
    return new Intl.DateTimeFormat(locale, { dateStyle: 'short', timeStyle: 'short' }).format(new Date(iso));
  } catch { return iso; }
}

function fmtTime(iso: string, locale: string): string {
  try {
    return new Intl.DateTimeFormat(locale, { timeStyle: 'short' }).format(new Date(iso));
  } catch { return iso; }
}

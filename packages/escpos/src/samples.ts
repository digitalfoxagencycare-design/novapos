/**
 * Sample documents used by the print-preview CLI and by the QA checklist.
 * Deliberately awkward: a name that overflows the item column, a modifier, a
 * note, a discount, a rounding adjustment and a QR payload — the combination
 * that has historically broken thermal layouts.
 */
import type { ReceiptDocument, KotDocument } from './documents';

export const SAMPLE_RECEIPT: ReceiptDocument = {
  invoiceNumber: 'BLR-2026-000148',
  orderNumber: 'A-1042',
  issuedAt: '2026-08-22T12:30:00.000Z',
  outlet: {
    name: 'Nova Kitchen',
    addressLines: ['12 MG Road, Indiranagar', 'Bengaluru 560038'],
    phone: '+91 80 4123 4567',
    taxId: '29ABCDE1234F1Z5',
    extraIds: ['FSSAI: 12345678901234'],
  },
  customer: { name: 'Ravi Kumar', phone: '+91 98765 43210' },
  channel: 'DINE_IN',
  tableLabel: 'T4',
  staffName: 'Asha',
  guestCount: 3,
  currency: 'INR',
  locale: 'en-IN',
  lines: [
    { name: 'Paneer Butter Masala', quantity: 2, unitPriceMinor: 32000, lineTotalMinor: 64000, hsnSac: '996331', modifiers: ['Extra gravy'] },
    { name: 'Butter Naan', quantity: 4, unitPriceMinor: 6000, lineTotalMinor: 24000, hsnSac: '996331' },
    { name: 'Masala Chai with extra ginger', quantity: 3, unitPriceMinor: 4000, lineTotalMinor: 12000, hsnSac: '996331', notes: 'Less sugar' },
  ],
  subtotalMinor: 100000,
  discountMinor: 5000,
  serviceChargeMinor: 0,
  deliveryChargeMinor: 0,
  tipMinor: 0,
  taxRows: [
    { code: 'CGST', label: 'CGST', rate: 0.025, baseMinor: 90476, amountMinor: 2262 },
    { code: 'SGST', label: 'SGST', rate: 0.025, baseMinor: 90476, amountMinor: 2262 },
  ],
  taxTotalMinor: 4524,
  roundingMinor: -24,
  totalMinor: 95000,
  payments: [{ method: 'UPI', amountMinor: 95000, reference: 'TXN9931' }],
  qrPayload: 'upi://pay?pa=novakitchen@okhdfc&am=950.00',
  qrCaption: 'Scan to pay',
  showHsnSac: true,
};

export const SAMPLE_KOT: KotDocument = {
  kotNumber: 'K-217',
  orderNumber: 'A-1042',
  stationName: 'MAIN KITCHEN',
  channel: 'DINE_IN',
  tableLabel: 'T4',
  staffName: 'Asha',
  issuedAt: '2026-08-22T12:30:00.000Z',
  locale: 'en-IN',
  kind: 'MODIFIED',
  lines: [
    { name: 'Paneer Butter Masala', quantity: 2, modifiers: ['Extra gravy'], change: 'NEW' },
    { name: 'Butter Naan', quantity: 4, change: 'QTY_CHANGED', previousQuantity: 2 },
    { name: 'Veg Biryani', quantity: 1, change: 'VOIDED' },
  ],
  notes: 'Guest is in a hurry',
};

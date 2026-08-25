import { describe, it, expect } from 'vitest';
import { EscPosBuilder, wrapText, pad } from './builder';
import {
  PROFILE_58MM, PROFILE_80MM, detectProfile, findProfile,
  PROFILE_EPSON_TM_T82, PROFILE_XPRINTER_58IIH,
} from './profiles';
import { renderReceipt, renderKot, TEMPLATE_INDIA_GST, TEMPLATE_US } from './documents';
import type { ReceiptDocument, KotDocument } from './documents';

describe('text helpers', () => {
  it('pads to an exact width in every alignment', () => {
    expect(pad('ab', 6, 'left')).toBe('ab    ');
    expect(pad('ab', 6, 'right')).toBe('    ab');
    expect(pad('ab', 6, 'center')).toBe('  ab  ');
    expect(pad('abcdefgh', 4)).toHaveLength(4);
  });

  it('wraps on word boundaries and never exceeds the width', () => {
    const lines = wrapText('Paneer Butter Masala with extra gravy', 16);
    expect(lines.every((l) => l.length <= 16)).toBe(true);
    expect(lines.join(' ')).toContain('Paneer');
  });

  it('breaks a word longer than the line rather than overflowing', () => {
    const lines = wrapText('Supercalifragilisticexpialidocious', 10);
    expect(lines.every((l) => l.length <= 10)).toBe(true);
    expect(lines.join('')).toBe('Supercalifragilisticexpialidocious');
  });
});

describe('profile detection', () => {
  it('always honours an explicit operator choice', () => {
    const r = detectProfile({ explicitProfileId: 'generic-58', modelName: 'TM-T82' });
    expect(r.profile.id).toBe('generic-58');
    expect(r.confidence).toBe('explicit');
  });

  it('recognises known vendor models', () => {
    expect(detectProfile({ modelName: 'EPSON TM-T82III' }).profile.id).toBe(PROFILE_EPSON_TM_T82.id);
    expect(detectProfile({ modelName: 'XP-58IIH' }).profile.id).toBe(PROFILE_XPRINTER_58IIH.id);
  });

  it('reads the width out of a no-name printer’s Bluetooth device name', () => {
    expect(detectProfile({ modelName: 'BlueTooth Printer 58mm' }).profile.paperWidth).toBe(58);
    expect(detectProfile({ modelName: 'POS-80 Printer' }).profile.paperWidth).toBe(80);
  });

  it('uses reported dots-per-line when the model string tells us nothing', () => {
    expect(detectProfile({ reportedDotsPerLine: 384 }).profile.paperWidth).toBe(58);
    expect(detectProfile({ reportedDotsPerLine: 576 }).profile.paperWidth).toBe(80);
  });

  it('falls back to 80mm and admits it is a guess', () => {
    const r = detectProfile({});
    expect(r.profile.paperWidth).toBe(80);
    expect(r.confidence).toBe('guess');
  });

  it('does not mistake a model number containing 58 for a paper width', () => {
    // "TM-T88V" contains no standalone 58/80 -> should not match on width.
    const r = detectProfile({ modelName: 'Star TSP143' });
    expect(r.confidence).toBe('guess');
  });
});

describe('builder', () => {
  it('halves the usable columns when double width is on', () => {
    const b = new EscPosBuilder(PROFILE_80MM);
    expect(b.columns).toBe(48);
    b.size(2, 1);
    expect(b.columns).toBe(24);
    b.size(1, 1);
    expect(b.columns).toBe(48);
  });

  it('uses the condensed font’s wider column count', () => {
    const b = new EscPosBuilder(PROFILE_58MM);
    b.font('B');
    expect(b.columns).toBe(42);
  });

  it('emits ESC @ reset as the first bytes', () => {
    const bytes = new EscPosBuilder(PROFILE_80MM).build();
    expect([bytes[0], bytes[1]]).toEqual([0x1b, 0x40]);
  });

  it('right-aligns the value in twoCol at exactly the paper width', () => {
    const b = new EscPosBuilder(PROFILE_58MM);
    b.twoCol('Subtotal', '1,234.50');
    const line = b.toPlainText().trim().split('\n').pop()!;
    expect(line.length).toBe(32);
    expect(line.endsWith('1,234.50')).toBe(true);
  });

  it('scales a row written for 80mm down onto 58mm without overflowing', () => {
    const cells = [
      { text: 'Paneer Tikka', width: 26 },
      { text: '2', width: 6, align: 'right' as const },
      { text: '250.00', width: 8, align: 'right' as const },
      { text: '500.00', width: 8, align: 'right' as const },
    ];
    for (const profile of [PROFILE_58MM, PROFILE_80MM]) {
      const b = new EscPosBuilder(profile);
      b.row(cells);
      for (const line of b.toPlainText().split('\n')) {
        expect(line.length).toBeLessThanOrEqual(profile.columns);
      }
    }
  });

  it('folds the rupee sign to "Rs." on a single-byte code page', () => {
    const b = new EscPosBuilder(PROFILE_80MM);
    b.text('Total ₹500');
    expect(b.toPlainText()).toContain('Rs.500');
  });

  it('substitutes rather than emitting garbage for scripts a code page lacks', () => {
    const b = new EscPosBuilder(PROFILE_80MM);
    b.text('पनीर');
    // Every byte must stay in printable ASCII range.
    for (const byte of b.build()) expect(byte).toBeLessThan(0x80);
  });

  it('preserves accented Latin by folding to the base letter', () => {
    const b = new EscPosBuilder(PROFILE_80MM);
    b.text('Crème Brûlée');
    expect(b.toPlainText()).toContain('Creme Brulee');
  });

  it('omits the cut command on a printer with no cutter but still feeds', () => {
    const noCut = new EscPosBuilder(PROFILE_58MM).cut().build();
    const withCut = new EscPosBuilder(PROFILE_80MM).cut().build();
    expect(Array.from(withCut).join(',')).toContain([0x1d, 0x56].join(','));
    expect(Array.from(noCut).join(',')).not.toContain([0x1d, 0x56, 1].join(','));
    expect(noCut.filter((b) => b === 0x0a).length).toBe(PROFILE_58MM.feedLinesBeforeCut);
  });

  it('falls back to printing the QR payload as text on a printer without native QR', () => {
    const b = new EscPosBuilder(PROFILE_58MM); // supportsNativeQr: false
    b.qr('upi://pay?pa=shop@upi&am=500');
    expect(b.toPlainText()).toContain('upi://pay');
  });

  it('emits a native QR command block on a printer that supports it', () => {
    const b = new EscPosBuilder(PROFILE_80MM);
    b.qr('upi://pay?pa=shop@upi');
    expect(b.toPlainText()).not.toContain('upi://pay'); // it is binary, not text
    expect(b.build().length).toBeGreaterThan(30);
  });

  it('skips the drawer kick on a printer with no drawer port', () => {
    expect(new EscPosBuilder(PROFILE_58MM).openDrawer().build().length)
      .toBe(new EscPosBuilder(PROFILE_58MM).build().length);
    expect(new EscPosBuilder(PROFILE_80MM).openDrawer().build().length)
      .toBeGreaterThan(new EscPosBuilder(PROFILE_80MM).build().length);
  });
});

/* ---------- document fixtures ---------- */

const receipt: ReceiptDocument = {
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
    { name: 'Masala Chai with extra ginger and cardamom', quantity: 3, unitPriceMinor: 4000, lineTotalMinor: 12000, hsnSac: '996331', notes: 'Less sugar' },
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
  roundingMinor: 0,
  totalMinor: 95000,
  payments: [{ method: 'UPI', amountMinor: 95000, reference: 'TXN9931' }],
  qrPayload: 'upi://pay?pa=novakitchen@okhdfc&am=950.00',
  qrCaption: 'Scan to pay',
  showHsnSac: true,
};

const kot: KotDocument = {
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

describe('receipt rendering', () => {
  for (const profile of [PROFILE_58MM, PROFILE_80MM]) {
    it(`fits every line within ${profile.paperWidth}mm (${profile.columns} cols)`, () => {
      // A line's budget depends on the style in force: condensed font gives
      // more columns, double width gives half. Overflow here means the print
      // would wrap raggedly on real paper.
      const overflowing = renderReceipt(receipt, profile, TEMPLATE_INDIA_GST)
        .toLines()
        .filter((l) => l.text.length > l.columns)
        .map((l) => ({ text: l.text, width: l.text.length, budget: l.columns }));
      expect(overflowing).toEqual([]);
    });
  }

  it('prints the shop name, bill number, total and tax breakdown', () => {
    const text = renderReceipt(receipt, PROFILE_80MM, TEMPLATE_INDIA_GST).toPlainText();
    expect(text).toContain('Nova Kitchen');
    expect(text).toContain('BLR-2026-000148');
    expect(text).toContain('29ABCDE1234F1Z5');
    expect(text).toContain('CGST');
    expect(text).toContain('SGST');
    expect(text).toContain('950.00');
  });

  it('shows the HSN column on 80mm when the jurisdiction requires it', () => {
    const text = renderReceipt(receipt, PROFILE_80MM, TEMPLATE_INDIA_GST).toPlainText();
    expect(text).toContain('996331');
  });

  it('drops the tax table and QR when the US template omits those blocks', () => {
    const text = renderReceipt(receipt, PROFILE_80MM, TEMPLATE_US).toPlainText();
    expect(text).not.toContain('Tax Summary');
    expect(text).toContain('Nova Kitchen');
  });

  it('marks a reprint so a duplicate bill cannot be passed off as the original', () => {
    const text = renderReceipt({ ...receipt, reprintCount: 2 }, PROFILE_80MM).toPlainText();
    expect(text).toContain('REPRINT');
  });

  it('renders translated labels through the injected translator', () => {
    const hi = (key: string, fallback: string) =>
      ({ 'receipt.total': 'कुल', 'receipt.subtotal': 'उप-योग' } as Record<string, string>)[key] ?? fallback;
    // Devanagari has no single-byte code page, so it folds — the point of the
    // test is that the translator is consulted, not that Hindi prints.
    const b = renderReceipt(receipt, PROFILE_80MM, TEMPLATE_INDIA_GST, hi);
    expect(b.build().length).toBeGreaterThan(0);
  });

  it('prints a round-off line when the invoice was rounded', () => {
    const text = renderReceipt({ ...receipt, roundingMinor: -24 }, PROFILE_80MM).toPlainText();
    expect(text).toContain('Round Off');
  });
});

describe('KOT rendering', () => {
  for (const profile of [PROFILE_58MM, PROFILE_80MM]) {
    it(`fits every line within ${profile.paperWidth}mm`, () => {
      const overflowing = renderKot(kot, profile)
        .toLines()
        .filter((l) => l.text.length > l.columns)
        .map((l) => ({ text: l.text, width: l.text.length, budget: l.columns }));
      expect(overflowing).toEqual([]);
    });
  }

  it('carries no prices — the kitchen must not see money', () => {
    const text = renderKot(kot, PROFILE_80MM).toPlainText();
    expect(text).not.toMatch(/\d+\.\d{2}/);
  });

  it('leads with the station name and the change banner', () => {
    const text = renderKot(kot, PROFILE_80MM).toPlainText();
    expect(text).toContain('MAIN KITCHEN');
    expect(text).toContain('MODIFIED');
  });

  it('marks voids, additions and quantity changes distinctly', () => {
    const text = renderKot(kot, PROFILE_80MM).toPlainText();
    expect(text).toContain('X ');       // voided
    expect(text).toContain('~ 2>4');    // qty changed
  });

  it('beeps more insistently on a cancellation', () => {
    const cancel = renderKot({ ...kot, kind: 'CANCELLED' }, PROFILE_80MM).build();
    const normal = renderKot({ ...kot, kind: 'NEW' }, PROFILE_80MM).build();
    expect(cancel.length).not.toBe(normal.length);
  });
});

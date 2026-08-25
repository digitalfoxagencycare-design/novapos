/**
 * ESC/POS command builder.
 *
 * Emits a raw byte stream that can be written to a Bluetooth SPP socket, a
 * TCP socket on port 9100, or a USB endpoint — the transport is the caller's
 * problem, which is what lets the same builder run on the server (network
 * printers) and inside the Flutter app (Bluetooth).
 *
 * Command reference: Epson ESC/POS Command Reference, FS/GS/ESC groups.
 */

import type { PrinterProfile } from './profiles';

const ESC = 0x1b;
const GS = 0x1d;
const LF = 0x0a;

export type Align = 'left' | 'center' | 'right';

export interface TextStyle {
  bold?: boolean;
  underline?: boolean;
  /** Double height/width. Doubling width halves the usable column count. */
  doubleHeight?: boolean;
  doubleWidth?: boolean;
  /** White-on-black, used for KOT headers so they stand out on a busy pass. */
  inverse?: boolean;
  /** Font B is condensed — more columns, smaller glyphs. */
  font?: 'A' | 'B';
  align?: Align;
}

/** Map a code page name to the ESC t argument. */
function encodeText(text: string, profile: PrinterProfile): number[] {
  const out: number[] = [];
  if (profile.encoding === 'utf8') {
    return [...Buffer.from(text, 'utf8')];
  }
  // Single-byte code pages: emit the byte where the character exists, and a
  // sensible ASCII fallback where it does not, so a Devanagari or accented
  // name degrades to something readable instead of garbage.
  for (const ch of text) {
    const code = ch.codePointAt(0)!;
    if (code < 0x80) {
      out.push(code);
    } else {
      const folded = FOLD_MAP[ch] ?? asciiFold(ch);
      for (const f of folded) out.push(f.codePointAt(0)! & 0x7f);
    }
  }
  return out;
}

const FOLD_MAP: Record<string, string> = {
  '₹': 'Rs.', '€': 'EUR', '£': 'GBP', '¥': 'JPY', '₩': 'KRW', '₺': 'TRY', '₽': 'RUB',
  '–': '-', '—': '-', '‘': "'", '’': "'", '“': '"', '”': '"', '…': '...', '•': '*',
};

function asciiFold(ch: string): string {
  const n = ch.normalize('NFD').replace(/[̀-ͯ]/g, '');
  // Anything still non-ASCII (Devanagari, Arabic, CJK) has no single-byte
  // representation; '?' is the honest answer. Callers wanting these scripts
  // must use a UTF-8 profile or render the line as a raster image.
  return /^[\x00-\x7f]+$/.test(n) && n.length > 0 ? n : '?';
}

export class EscPosBuilder {
  private buf: number[] = [];
  /** Tracks double-width so column maths stays correct mid-receipt. */
  private widthMultiplier = 1;
  private currentFont: 'A' | 'B' = 'A';

  constructor(public readonly profile: PrinterProfile) {
    this.init();
  }

  /** Usable character columns given the font and width multiplier in force. */
  get columns(): number {
    const base = this.currentFont === 'B'
      ? (this.profile.columnsFontB ?? this.profile.columns)
      : this.profile.columns;
    return Math.floor(base / this.widthMultiplier);
  }

  private raw(...bytes: number[]): this {
    this.buf.push(...bytes);
    return this;
  }

  init(): this {
    this.raw(ESC, 0x40);                       // ESC @  — reset
    this.raw(ESC, 0x74, this.profile.codePage); // ESC t  — select code page
    this.widthMultiplier = 1;
    this.currentFont = 'A';
    return this;
  }

  align(a: Align): this {
    return this.raw(ESC, 0x61, a === 'left' ? 0 : a === 'center' ? 1 : 2);
  }

  font(f: 'A' | 'B'): this {
    this.currentFont = f;
    return this.raw(ESC, 0x4d, f === 'A' ? 0 : 1);
  }

  bold(on: boolean): this { return this.raw(ESC, 0x45, on ? 1 : 0); }
  underline(on: boolean): this { return this.raw(ESC, 0x2d, on ? 1 : 0); }
  inverse(on: boolean): this { return this.raw(GS, 0x42, on ? 1 : 0); }

  /** GS ! n — n's high nibble is width-1, low nibble is height-1. */
  size(width: 1 | 2 | 3 | 4 = 1, height: 1 | 2 | 3 | 4 = 1): this {
    this.widthMultiplier = width;
    return this.raw(GS, 0x21, ((width - 1) << 4) | (height - 1));
  }

  style(s: TextStyle): this {
    if (s.font) this.font(s.font);
    if (s.align) this.align(s.align);
    this.bold(!!s.bold);
    this.underline(!!s.underline);
    this.inverse(!!s.inverse);
    this.size(s.doubleWidth ? 2 : 1, s.doubleHeight ? 2 : 1);
    return this;
  }

  resetStyle(): this {
    return this.style({ font: 'A', align: 'left' });
  }

  /** Write text, wrapping at the current column width, then newline. */
  text(t: string, s?: TextStyle): this {
    if (s) this.style(s);
    for (const line of wrapText(t, this.columns)) {
      this.buf.push(...encodeText(line, this.profile), LF);
    }
    return this;
  }

  /** Write text with no wrapping and no newline (for building a line piecewise). */
  textRaw(t: string): this {
    this.buf.push(...encodeText(t, this.profile));
    return this;
  }

  newline(n = 1): this {
    for (let i = 0; i < n; i++) this.buf.push(LF);
    return this;
  }

  /** A full-width rule, e.g. '-' or '='. */
  rule(char = '-'): this {
    return this.text(char.repeat(this.columns));
  }

  /**
   * Two columns: label flush left, value flush right, dot-filled if asked.
   * Long labels wrap and keep the value on the first line's right edge.
   */
  twoCol(left: string, right: string, opts: { fill?: string; style?: TextStyle } = {}): this {
    if (opts.style) this.style(opts.style);
    const width = this.columns;
    const r = right.slice(0, width);
    const space = width - r.length;
    const lines = wrapText(left, Math.max(1, space - 1));
    const first = lines[0] ?? '';
    const filler = (opts.fill ?? ' ').repeat(Math.max(0, space - first.length));
    // A blank right cell means there is nothing to align to — do not emit a
    // line of trailing spaces, which wastes ribbon and looks like a defect in
    // the print preview.
    const composed = r === '' && (opts.fill ?? ' ') === ' ' ? first : first + filler + r;
    this.buf.push(...encodeText(composed, this.profile), LF);
    for (const cont of lines.slice(1)) {
      this.buf.push(...encodeText('  ' + cont, this.profile), LF);
    }
    return this;
  }

  /**
   * A row of columns with explicit widths and per-column alignment.
   *
   * Widths are treated as proportions, not absolutes, so one layout written
   * against 48 columns renders correctly on a 32-column roll. A one-character
   * gutter is reserved between columns — without it a name that exactly fills
   * its cell butts against the next value and the row becomes unreadable.
   */
  row(
    cells: { text: string; width: number; align?: Align }[],
    s?: TextStyle,
    opts: { gutter?: number } = {},
  ): this {
    if (s) this.style(s);
    const gutter = opts.gutter ?? 1;
    const target = this.columns;
    const gutterTotal = gutter * Math.max(0, cells.length - 1);
    const budget = Math.max(cells.length, target - gutterTotal);
    const total = cells.reduce((a, c) => a + c.width, 0);

    const widths = cells.map((c) => Math.max(1, Math.round((c.width / total) * budget)));
    // Rounding can drift a column or two; absorb it in the widest cell.
    const drift = budget - widths.reduce((a, b) => a + b, 0);
    if (drift !== 0) {
      const widest = widths.indexOf(Math.max(...widths));
      widths[widest] = Math.max(1, widths[widest] + drift);
    }

    const wrapped = cells.map((c, i) => wrapText(c.text, widths[i]));
    const height = Math.max(...wrapped.map((w) => w.length), 1);
    for (let ln = 0; ln < height; ln++) {
      const parts: string[] = [];
      for (let i = 0; i < cells.length; i++) {
        parts.push(pad(wrapped[i][ln] ?? '', widths[i], cells[i].align ?? 'left'));
      }
      const out = parts.join(' '.repeat(gutter)).slice(0, target).replace(/\s+$/, '');
      this.buf.push(...encodeText(out, this.profile), LF);
    }
    return this;
  }

  /** Barcode (CODE128). Falls back to printing the value as text. */
  barcode(value: string, opts: { height?: number; hri?: boolean } = {}): this {
    if (!this.profile.supportsBarcode) return this.text(value, { align: 'center' });
    this.raw(GS, 0x68, opts.height ?? 60);            // GS h — height
    this.raw(GS, 0x48, opts.hri === false ? 0 : 2);   // GS H — HRI below
    this.raw(GS, 0x77, 2);                            // GS w — module width
    const data = [...Buffer.from(value, 'ascii')];
    this.raw(GS, 0x6b, 73, data.length + 2, 0x7b, 0x42, ...data); // CODE128 subset B
    return this.newline();
  }

  /**
   * QR code. Used for UPI payment links on Indian receipts and for the
   * e-invoice IRN QR that GST requires above the e-invoicing threshold.
   * Printers without native QR get the payload as text so the data is not lost.
   */
  qr(value: string, opts: { size?: number } = {}): this {
    if (!this.profile.supportsNativeQr) {
      return this.text(value, { align: 'center', font: 'B' });
    }
    const size = opts.size ?? 6;
    const data = [...Buffer.from(value, 'utf8')];
    const len = data.length + 3;
    this.raw(GS, 0x28, 0x6b, 4, 0, 49, 65, 50, 0);            // model 2
    this.raw(GS, 0x28, 0x6b, 3, 0, 49, 67, size);             // module size
    this.raw(GS, 0x28, 0x6b, 3, 0, 49, 69, 48);               // error correction L
    this.raw(GS, 0x28, 0x6b, len & 0xff, (len >> 8) & 0xff, 49, 80, 48, ...data);
    this.raw(GS, 0x28, 0x6b, 3, 0, 49, 81, 48);               // print
    return this;
  }

  /**
   * Raster image (GS v 0) from a 1-bit-per-pixel bitmap.
   * `bits` is row-major, one boolean per pixel, true = black.
   */
  raster(bits: boolean[], width: number): this {
    if (!this.profile.supportsRaster) return this;
    const bytesPerRow = Math.ceil(width / 8);
    const height = Math.ceil(bits.length / width);
    const data: number[] = [];
    for (let y = 0; y < height; y++) {
      for (let bx = 0; bx < bytesPerRow; bx++) {
        let byte = 0;
        for (let bit = 0; bit < 8; bit++) {
          const x = bx * 8 + bit;
          if (x < width && bits[y * width + x]) byte |= 0x80 >> bit;
        }
        data.push(byte);
      }
    }
    this.raw(GS, 0x76, 0x30, 0,
      bytesPerRow & 0xff, (bytesPerRow >> 8) & 0xff,
      height & 0xff, (height >> 8) & 0xff,
      ...data);
    return this;
  }

  /** Pop the cash drawer. Ignored on printers with no drawer port. */
  openDrawer(pin: 0 | 1 = 0): this {
    if (!this.profile.supportsDrawerKick) return this;
    return this.raw(ESC, 0x70, pin, 25, 250);
  }

  beep(times = 1): this {
    return this.raw(ESC, 0x42, Math.min(9, times), 3);
  }

  /** Feed clear of the head, then cut (or just feed if there is no cutter). */
  cut(partial = true): this {
    this.newline(this.profile.feedLinesBeforeCut);
    if (!this.profile.supportsCut) return this;
    const mode = partial && this.profile.supportsPartialCut ? 1 : 0;
    return this.raw(GS, 0x56, mode);
  }

  build(): Uint8Array {
    return Uint8Array.from(this.buf);
  }

  /**
   * Replay the byte stream into rendered lines, tracking the font and size
   * state that was in force for each one.
   *
   * This is what the POS "print preview" pane renders, and what the layout
   * tests assert against: a line's budget is not the profile's Font A column
   * count but the columns available under the style actually in force, which
   * condensed font widens and double-width halves.
   */
  toLines(): RenderedLine[] {
    const out: RenderedLine[] = [];
    let line: number[] = [];
    let font: 'A' | 'B' = 'A';
    let widthMul = 1;
    const colsFor = (f: 'A' | 'B', w: number) => Math.floor(
      (f === 'B' ? (this.profile.columnsFontB ?? this.profile.columns) : this.profile.columns) / w,
    );
    let lineFont: 'A' | 'B' = font;
    let lineWidth: number = widthMul;

    for (let i = 0; i < this.buf.length; i++) {
      const b = this.buf[i];
      if (b === ESC || b === GS) {
        const len = skipLength(this.buf, i);
        // ESC M n — select font
        if (b === ESC && this.buf[i + 1] === 0x4d) font = this.buf[i + 2] === 0 ? 'A' : 'B';
        // GS ! n — character size; high nibble is width-1
        if (b === GS && this.buf[i + 1] === 0x21) widthMul = ((this.buf[i + 2] >> 4) & 0x0f) + 1;
        // A style change before any text on this line applies to this line.
        if (line.length === 0) { lineFont = font; lineWidth = widthMul; }
        i += len - 1;
        continue;
      }
      if (b === LF) {
        out.push({
          text: Buffer.from(line).toString('latin1'),
          font: lineFont,
          widthMultiplier: lineWidth,
          columns: colsFor(lineFont, lineWidth),
        });
        line = [];
        lineFont = font;
        lineWidth = widthMul;
        continue;
      }
      line.push(b);
    }
    if (line.length) {
      out.push({
        text: Buffer.from(line).toString('latin1'),
        font: lineFont,
        widthMultiplier: lineWidth,
        columns: colsFor(lineFont, lineWidth),
      });
    }
    return out;
  }

  /** Human-readable render of the text content, for tests and print preview. */
  toPlainText(): string {
    return this.toLines().map((l) => l.text).join('\n');
  }
}

export interface RenderedLine {
  text: string;
  font: 'A' | 'B';
  widthMultiplier: number;
  /** Character budget this line actually had, given its font and size. */
  columns: number;
}

/** How many bytes the command starting at `i` occupies, including its args. */
function skipLength(buf: number[], i: number): number {
  const cmd = buf[i];
  const a = buf[i + 1];
  if (cmd === ESC) {
    if (a === 0x40) return 2;                 // ESC @
    if (a === 0x64 || a === 0x4a) return 3;   // ESC d / ESC J
    if (a === 0x70) return 5;                 // ESC p
    if (a === 0x42) return 4;                 // ESC B
    return 3;                                  // ESC a/M/E/-/t …
  }
  if (cmd === GS) {
    if (a === 0x21 || a === 0x42 || a === 0x56 || a === 0x68 || a === 0x48 || a === 0x77) return 3;
    if (a === 0x6b) {                          // GS k barcode
      const len = buf[i + 3];
      return 4 + len;
    }
    if (a === 0x28) {                          // GS ( k
      const pL = buf[i + 3], pH = buf[i + 4];
      return 5 + pL + pH * 256;
    }
    if (a === 0x76) {                          // GS v 0 raster
      const xL = buf[i + 4], xH = buf[i + 5], yL = buf[i + 6], yH = buf[i + 7];
      return 8 + (xL + xH * 256) * (yL + yH * 256);
    }
    return 3;
  }
  return 1;
}

/* ---------- text helpers, exported because layouts need them ---------- */

export function pad(text: string, width: number, align: Align = 'left'): string {
  const t = text.length > width ? text.slice(0, width) : text;
  const space = width - t.length;
  if (align === 'right') return ' '.repeat(space) + t;
  if (align === 'center') {
    const l = Math.floor(space / 2);
    return ' '.repeat(l) + t + ' '.repeat(space - l);
  }
  return t + ' '.repeat(space);
}

/** Greedy word wrap that breaks over-long words rather than overflowing. */
export function wrapText(text: string, width: number): string[] {
  if (width < 1) return [text];
  const lines: string[] = [];
  for (const paragraph of text.split('\n')) {
    if (paragraph === '') { lines.push(''); continue; }
    let current = '';
    for (const word of paragraph.split(/\s+/)) {
      if (word.length > width) {
        if (current) { lines.push(current); current = ''; }
        for (let i = 0; i < word.length; i += width) lines.push(word.slice(i, i + width));
        continue;
      }
      if (current === '') current = word;
      else if (current.length + 1 + word.length <= width) current += ' ' + word;
      else { lines.push(current); current = word; }
    }
    if (current !== '' || paragraph.trim() === '') lines.push(current);
  }
  return lines.length ? lines : [''];
}

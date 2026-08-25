/**
 * Thermal printer profiles.
 *
 * The two paper widths that matter in this market:
 *   58mm ("2 inch")  — 32 characters at Font A, common on portable/Bluetooth
 *   80mm ("3 inch")  — 48 characters at Font A, the standard counter printer
 *
 * Character *columns*, not millimetres, are what layout code needs, and they
 * differ per printer even at the same paper width (a 58mm Epson gives 32 cols,
 * some 58mm clones give 30). The profile is therefore the unit of truth and is
 * stored per configured printer, with the paper width used only to pick a
 * default profile when auto-detecting.
 */

export type PaperWidth = 58 | 80;

export interface PrinterProfile {
  id: string;
  label: string;
  paperWidth: PaperWidth;
  /** Printable columns at Font A (the normal font). */
  columns: number;
  /** Printable columns at Font B (the condensed font), if supported. */
  columnsFontB?: number;
  /** Dots across the printable area — needed to centre and scale logos. */
  dotsPerLine: number;
  /** Code page for accented/Devanagari fallback; ESC t n. */
  codePage: number;
  /** Encoding used to turn text into bytes. */
  encoding: 'ascii' | 'cp437' | 'cp850' | 'cp1252' | 'utf8';
  /** Some cheap printers have no auto-cutter; we feed instead. */
  supportsCut: boolean;
  supportsPartialCut: boolean;
  /** GS v 0 raster image support (logos, QR fallback). */
  supportsRaster: boolean;
  /** Native GS ( k QR code support. Older firmware lacks it. */
  supportsNativeQr: boolean;
  supportsBarcode: boolean;
  /** Cash drawer kick connector present. */
  supportsDrawerKick: boolean;
  /** Blank lines fed before cutting so the tear-off clears the print head. */
  feedLinesBeforeCut: number;
}

export const PROFILE_58MM: PrinterProfile = {
  id: 'generic-58',
  label: 'Generic 58mm (2 inch)',
  paperWidth: 58,
  columns: 32,
  columnsFontB: 42,
  dotsPerLine: 384,
  codePage: 0,
  encoding: 'cp437',
  supportsCut: false,
  supportsPartialCut: false,
  supportsRaster: true,
  supportsNativeQr: false,
  supportsBarcode: true,
  supportsDrawerKick: false,
  feedLinesBeforeCut: 4,
};

export const PROFILE_80MM: PrinterProfile = {
  id: 'generic-80',
  label: 'Generic 80mm (3 inch)',
  paperWidth: 80,
  columns: 48,
  columnsFontB: 64,
  dotsPerLine: 576,
  codePage: 0,
  encoding: 'cp437',
  supportsCut: true,
  supportsPartialCut: true,
  supportsRaster: true,
  supportsNativeQr: true,
  supportsBarcode: true,
  supportsDrawerKick: true,
  feedLinesBeforeCut: 3,
};

/** Vendor-specific profiles verified against real hardware go here. */
export const PROFILE_EPSON_TM_T82: PrinterProfile = {
  ...PROFILE_80MM,
  id: 'epson-tm-t82',
  label: 'Epson TM-T82 / TM-T88 (80mm)',
  codePage: 16, // WPC1252
  encoding: 'cp1252',
  supportsNativeQr: true,
};

export const PROFILE_XPRINTER_58IIH: PrinterProfile = {
  ...PROFILE_58MM,
  id: 'xprinter-58iih',
  label: 'Xprinter XP-58IIH (58mm)',
  columns: 32,
  supportsCut: true,
  supportsPartialCut: false,
};

export const PROFILE_TVS_RP3200: PrinterProfile = {
  ...PROFILE_80MM,
  id: 'tvs-rp3200',
  label: 'TVS RP 3200 Star (80mm)',
  columns: 42,
  supportsNativeQr: false,
};

export const BUILT_IN_PROFILES: PrinterProfile[] = [
  PROFILE_58MM, PROFILE_80MM, PROFILE_EPSON_TM_T82, PROFILE_XPRINTER_58IIH, PROFILE_TVS_RP3200,
];

export function findProfile(id: string): PrinterProfile | undefined {
  return BUILT_IN_PROFILES.find((p) => p.id === id);
}

/**
 * Pick a profile from whatever the caller managed to learn about the printer.
 *
 * Auto-detection is best-effort by nature — most ESC/POS printers do not
 * report their paper width over Bluetooth SPP at all. In order of reliability:
 *
 *  1. An explicit profile the operator chose in settings (always wins).
 *  2. A model string matched against known vendor profiles — available over
 *     USB descriptors and over Bluetooth device names on most Android stacks.
 *  3. `GS I n` / status-byte width, where firmware supports it.
 *  4. Dots-per-line from a printed calibration line the operator confirms.
 *  5. Fall back to 80mm, the more common counter printer, and surface a
 *     "confirm your paper width" prompt in the app rather than silently
 *     printing a misformatted receipt.
 */
export function detectProfile(hints: {
  explicitProfileId?: string | null;
  modelName?: string | null;
  reportedPaperWidth?: number | null;
  reportedDotsPerLine?: number | null;
}): { profile: PrinterProfile; confidence: 'explicit' | 'model' | 'reported' | 'guess' } {
  if (hints.explicitProfileId) {
    const p = findProfile(hints.explicitProfileId);
    if (p) return { profile: p, confidence: 'explicit' };
  }

  const model = (hints.modelName ?? '').toLowerCase().replace(/[\s_-]/g, '');
  if (model) {
    const matchers: [RegExp, PrinterProfile][] = [
      [/tmt8[028]|tmt82|tmt88/, PROFILE_EPSON_TM_T82],
      [/xp58|58iih|xprinter58/, PROFILE_XPRINTER_58IIH],
      [/rp3200|tvsrp32/, PROFILE_TVS_RP3200],
    ];
    for (const [re, prof] of matchers) {
      if (re.test(model)) return { profile: prof, confidence: 'model' };
    }
    // Many no-name printers advertise their width in the device name.
    if (/(^|[^0-9])58([^0-9]|$)|2inch/.test(model)) {
      return { profile: PROFILE_58MM, confidence: 'model' };
    }
    if (/(^|[^0-9])80([^0-9]|$)|3inch/.test(model)) {
      return { profile: PROFILE_80MM, confidence: 'model' };
    }
  }

  if (hints.reportedDotsPerLine) {
    return {
      profile: hints.reportedDotsPerLine <= 420 ? PROFILE_58MM : PROFILE_80MM,
      confidence: 'reported',
    };
  }
  if (hints.reportedPaperWidth) {
    return {
      profile: hints.reportedPaperWidth <= 65 ? PROFILE_58MM : PROFILE_80MM,
      confidence: 'reported',
    };
  }
  return { profile: PROFILE_80MM, confidence: 'guess' };
}

/**
 * Hardware Terminal Bridge & Peripheral Integration Layer.
 *
 * Provides:
 * 1. Sunmi / iMin / Pax Native Android Service Bridge (Capacitor/WebView)
 * 2. Hardware Barcode Scanner Global Key Listener (<30ms keystroke detection)
 * 3. Soundbox / Audio Voice Confirmation (SpeechSynthesis / Soundbox TTS)
 * 4. Anti-Theft Manager PIN Override & Blind Shift Cash Tally
 */

export interface ScanResult {
  code: string;
  timestamp: number;
}

export interface ShiftTally {
  terminalId: string;
  cashierName: string;
  shiftStartTime: string;
  shiftEndTime: string;
  expectedCashMinor: number;
  actualCashCountedMinor: number;
  varianceMinor: number; // positive = surplus, negative = shortage
  isBalanced: boolean;
  notes?: string;
}

export interface SecurityAuditException {
  id: string;
  timestamp: string;
  type: 'VOID_ITEM' | 'HIGH_DISCOUNT' | 'CASH_VARIANCE' | 'REPRINT_BILL' | 'MANUAL_PRICE';
  operator: string;
  managerPinUsed: string;
  details: string;
  amount?: number;
}

/**
 * 1. Audio Soundbox / Voice Confirmation Engine
 */
export function speakPaymentAlert(amount: number, mode = 'UPI') {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

  try {
    window.speechSynthesis.cancel(); // Cancel any existing speech
    const text = `Payment of ${amount} Rupees received on ${mode.toUpperCase()}`;

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    // Pick Indian voice if available
    const voices = window.speechSynthesis.getVoices();
    const indVoice = voices.find((v) => v.lang.includes('IN') || v.name.includes('India'));
    if (indVoice) utterance.voice = indVoice;

    window.speechSynthesis.speak(utterance);
  } catch (err) {
    console.warn('Speech synthesis alert failed:', err);
  }
}

/**
 * 2. Hardware Barcode Scanner Listener
 * Hardware scanners send keystrokes <30ms apart ending in Enter/Tab.
 */
export function setupBarcodeScanner(onScan: (code: string) => void): () => void {
  if (typeof window === 'undefined') return () => {};

  let buffer = '';
  let lastKeyTime = 0;
  const SCAN_THRESHOLD_MS = 40;

  const handleKeyDown = (e: KeyboardEvent) => {
    // If typing in normal text inputs and gap is large, ignore
    const target = e.target as HTMLElement | null;
    const isInputFocused = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA');

    const now = Date.now();
    const gap = now - lastKeyTime;
    lastKeyTime = now;

    if (e.key === 'Enter') {
      if (buffer.length >= 3 && (!isInputFocused || gap < SCAN_THRESHOLD_MS)) {
        e.preventDefault();
        const scannedCode = buffer.trim();
        buffer = '';
        onScan(scannedCode);
      } else {
        buffer = '';
      }
      return;
    }

    if (e.key.length === 1) {
      if (gap > SCAN_THRESHOLD_MS && buffer.length > 0) {
        // Human typing slowly -> reset buffer
        buffer = e.key;
      } else {
        buffer += e.key;
      }
    }
  };

  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
}

/**
 * 3. Sunmi / Android Native Terminal Check
 */
export function isSunmiTerminal(): boolean {
  if (typeof window === 'undefined') return false;
  const nav = window.navigator as any;
  return Boolean(
    (window as any).SunmiPrinter ||
    (window as any).Android ||
    /Sunmi|iMin|Pax/i.test(nav.userAgent || '')
  );
}

/**
 * Print via Sunmi native Android AIDL interface if running on hardware
 */
export async function printViaSunmiNative(rawEscPos: Uint8Array): Promise<boolean> {
  const win = window as any;
  if (win.SunmiPrinter && typeof win.SunmiPrinter.printRawData === 'function') {
    try {
      win.SunmiPrinter.printRawData(Array.from(rawEscPos));
      return true;
    } catch {
      return false;
    }
  }
  if (win.Android && typeof win.Android.printRaw === 'function') {
    try {
      win.Android.printRaw(Array.from(rawEscPos));
      return true;
    } catch {
      return false;
    }
  }
  return false;
}

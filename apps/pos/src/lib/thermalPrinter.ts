import { registerPlugin, Capacitor } from '@capacitor/core';
import { showPrintPreview } from '../components/PrintPreview';

/**
 * Thermal Printer Driver for 58mm (2-inch / 32 cols) & 80mm (3-inch / 48 cols) ESC/POS Printers.
 *
 * Supports:
 * - Native Android Classic Bluetooth SPP (Ezo, TVS, Everycom, Z91, POS-58, NGX, MPT-II)
 * - Web Bluetooth GATT Fallback (Chrome)
 * - Web Serial & WebUSB APIs
 * - High-speed ESC/POS byte streaming
 * - Formatted HTML Print preview
 */

export type PaperWidth = '58mm' | '80mm';

export interface PrinterDevice {
  connected: boolean;
  type: 'bluetooth' | 'usb' | 'serial' | 'browser';
  name: string;
  address?: string;
}

export interface BillItem {
  name: string;
  quantity: number;
  price: number; // in Rupees
  total: number; // in Rupees
}

export interface BillData {
  restaurantName: string;
  address: string;
  phone: string;
  fssai?: string;
  gstin?: string;
  billNo: string;
  date: string;
  time: string;
  tableNo?: string;
  orderType: string;
  customerName?: string;
  customerPhone?: string;
  items: BillItem[];
  subtotal: number;
  cgst: number;
  sgst: number;
  total: number;
  paymentMode: string;
  cashTendered?: number;
  change?: number;
  isDuplicate?: boolean;
  reprintCount?: number;
  isCompositionScheme?: boolean;
  upiVpa?: string;
  upiPayload?: string;
}

export interface KotData {
  restaurantName: string;
  kotNo: string;
  date: string;
  time: string;
  tableNo?: string;
  orderType: string;
  items: { name: string; quantity: number; notes?: string }[];
}

export { NovaPrint } from './nativePrint';
import { NovaPrint } from './nativePrint';
import { getPaperWidth } from './printerSettings';

let activeBluetoothDevice: any = null;
let activeBluetoothCharacteristic: any = null;
let activeSerialWriter: any = null;
let activeUsbDevice: any = null;
let activeUsbEndpoint: number | null = null;

export const isBluetoothSupported = () => typeof navigator !== 'undefined' && 'bluetooth' in navigator;
export const isSerialSupported = () => typeof navigator !== 'undefined' && 'serial' in navigator;
export const isUsbSupported = () => typeof navigator !== 'undefined' && 'usb' in navigator;

export function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

/**
 * Request Bluetooth permissions on Android
 */
export async function requestNativeBluetoothPermissions(): Promise<boolean> {
  if (Capacitor.isNativePlatform()) {
    try {
      const res = await NovaPrint.requestBluetoothPermissions();
      return res.granted;
    } catch {
      return false;
    }
  }
  return true;
}

/**
 * List paired Bluetooth devices on Android
 */
export async function listPairedBluetoothPrinters(): Promise<Array<{ name: string; address: string }>> {
  if (Capacitor.isNativePlatform()) {
    try {
      // First ensure permissions are requested
      if (!await requestNativeBluetoothPermissions()) throw new Error('Bluetooth permission was denied. Allow Nearby devices in Android Settings.');
      const res = await NovaPrint.listPairedDevices();
      return res?.devices || [];
    } catch (e: any) {
      console.warn('Native listPairedDevices error:', e);
      throw new Error(e?.message || 'Failed to list paired Bluetooth devices.');
    }
  }
  return [];
}

/**
 * Connect to Bluetooth printer by MAC address (Native Android SPP)
 */
export async function connectNativeBluetoothPrinter(macAddress: string): Promise<PrinterDevice> {
  if (Capacitor.isNativePlatform()) {
    const res = await NovaPrint.connectBluetooth({ address: macAddress });
    if (res.connected) {
      localStorage.setItem('novapos_printer_mac', res.address);
      localStorage.setItem('novapos_printer_name', res.name);
      return {
        connected: true,
        type: 'bluetooth',
        name: res.name,
        address: res.address,
      };
    }
  }
  throw new Error('Native Bluetooth SPP is only available on Android app.');
}

/**
 * Disconnect native Bluetooth printer
 */
export async function disconnectNativeBluetoothPrinter(): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    await NovaPrint.disconnectBluetooth().catch(() => undefined);
    localStorage.removeItem('novapos_printer_mac');
    localStorage.removeItem('novapos_printer_name');
  }
}

/**
 * Get active native printer connection state
 */
export async function getActiveNativePrinter(): Promise<PrinterDevice | null> {
  if (Capacitor.isNativePlatform()) {
    try {
      const status = await NovaPrint.isBluetoothConnected();
      if (status.connected && status.address) {
        return {
          connected: true,
          type: 'bluetooth',
          name: status.name || 'Bluetooth Thermal Printer',
          address: status.address,
        };
      }
    } catch {
      // ignore
    }
  }
  const savedMac = localStorage.getItem('novapos_printer_mac');
  const savedName = localStorage.getItem('novapos_printer_name');
  if (savedMac) {
    return {
      connected: false,
      type: 'bluetooth',
      name: savedName || 'Paired Bluetooth Printer',
      address: savedMac,
    };
  }
  return null;
}

/**
 * Connect to 58mm or 80mm Bluetooth Thermal Printer via Web Bluetooth
 */
export async function connectBluetoothPrinter(): Promise<PrinterDevice> {
  if (Capacitor.isNativePlatform()) {
    const paired = await listPairedBluetoothPrinters();
    if (paired.length > 0) {
      return await connectNativeBluetoothPrinter(paired[0].address);
    }
    throw new Error('No paired Bluetooth printers found in Android Settings. Please pair your printer in Phone Bluetooth Settings first.');
  }

  if (!isBluetoothSupported()) {
    throw new Error('Web Bluetooth is not supported on this browser. Use Chrome on Android or PC.');
  }

  const nav = navigator as any;
  const device = await nav.bluetooth.requestDevice({
    acceptAllDevices: true,
    optionalServices: [
      '000018f0-0000-1000-8000-00805f9b34fb', // Standard thermal printer
      'e7810a71-73ae-499d-8c15-faa9aef0c3f2',
      '49535343-fe7d-4ae5-8fa9-9fafd205e455', // ISSC transparent UART
      '0000ff00-0000-1000-8000-00805f9b34fb',
      '0000fee7-0000-1000-8000-00805f9b34fb',
    ],
  });

  const server = await device.gatt.connect();
  let foundChar: any = null;

  const services = await server.getPrimaryServices().catch(() => []);
  for (const s of services) {
    const chars = await s.getCharacteristics().catch(() => []);
    for (const c of chars) {
      if (c.properties.write || c.properties.writeWithoutResponse) {
        foundChar = c;
        break;
      }
    }
    if (foundChar) break;
  }

  if (!foundChar) {
    throw new Error('Connected to Bluetooth device, but no writable print service was found.');
  }

  activeBluetoothDevice = device;
  activeBluetoothCharacteristic = foundChar;

  return {
    connected: true,
    type: 'bluetooth',
    name: device.name || 'Bluetooth Thermal Printer',
  };
}

/**
 * Connect to USB / Serial Thermal Printer
 */
export async function connectUsbOrSerialPrinter(): Promise<PrinterDevice> {
  const nav = navigator as any;
  if (isSerialSupported()) {
    try {
      const port = await nav.serial.requestPort();
      await port.open({ baudRate: 9600 });
      activeSerialWriter = port.writable.getWriter();
      return {
        connected: true,
        type: 'serial',
        name: 'USB / Serial Printer',
      };
    } catch (err: any) {
      if (err.name === 'NotFoundError') throw new Error('No printer selected.');
    }
  }

  if (isUsbSupported()) {
    const device = await nav.usb.requestDevice({ filters: [] });
    await device.open();
    if (device.configuration === null) await device.selectConfiguration(1);
    await device.claimInterface(0);

    const iface = device.configuration.interfaces[0];
    const alternate = iface.alternates[0];
    const outEndpoint = alternate.endpoints.find((e: any) => e.direction === 'out');
    if (!outEndpoint) throw new Error('No USB write endpoint found on printer.');

    activeUsbDevice = device;
    activeUsbEndpoint = outEndpoint.endpointNumber;

    return {
      connected: true,
      type: 'usb',
      name: device.productName || 'USB Thermal Printer',
    };
  }

  throw new Error('Direct USB/Serial printing is not supported in this browser. Use Chrome or Edge.');
}

/**
 * Write raw ESC/POS bytes with chunking / Native SPP
 */
export async function writeEscPosBytes(data: Uint8Array): Promise<boolean> {
  // 1. Native Android Classic Bluetooth SPP (Ezo / TVS / POS-58 / Z91)
  if (Capacitor.isNativePlatform()) {
    const status = await NovaPrint.isBluetoothConnected();
    if (!status.connected) return false;
    const res = await NovaPrint.printRawEscPos({ data: uint8ArrayToBase64(data) });
    if (!res.success || res.bytesPrinted !== data.length) throw new Error('Printer did not confirm all bytes. Check the paper before reprinting.');
    return true;
  }

  // 2. Web Bluetooth GATT
  if (activeBluetoothCharacteristic) {
    const CHUNK_SIZE = 128;
    for (let i = 0; i < data.length; i += CHUNK_SIZE) {
      const chunk = data.slice(i, i + CHUNK_SIZE);
      if (activeBluetoothCharacteristic.writeValueWithoutResponse) {
        await activeBluetoothCharacteristic.writeValueWithoutResponse(chunk);
      } else {
        await activeBluetoothCharacteristic.writeValue(chunk);
      }
      await new Promise((r) => setTimeout(r, 20));
    }
    return true;
  }

  // 3. Serial
  if (activeSerialWriter) {
    await activeSerialWriter.write(data);
    return true;
  }

  // 4. USB
  if (activeUsbDevice && activeUsbEndpoint !== null) {
    const result = await activeUsbDevice.transferOut(activeUsbEndpoint, data);
    if (result.status !== 'ok' || result.bytesWritten !== data.length) throw new Error('USB print incomplete. Check the paper before reprinting.');
    return true;
  }

  return false;
}

/**
 * ESC/POS Command Builder for 58mm (32 cols) & 80mm (48 cols)
 */
export class ThermalBuilder {
  private buffer: number[] = [];
  private cols: number;
  private normalCols: number;

  constructor(paperWidth: PaperWidth = '80mm') {
    this.normalCols = paperWidth === '58mm' ? 32 : 48;
    this.cols = this.normalCols;
    this.init();
  }

  init() {
    this.buffer.push(0x1b, 0x40); // ESC @ (Initialize)
    return this;
  }

  align(align: 'left' | 'center' | 'right') {
    const val = align === 'left' ? 0 : align === 'center' ? 1 : 2;
    this.buffer.push(0x1b, 0x61, val);
    return this;
  }

  bold(enable = true) {
    this.buffer.push(0x1b, 0x45, enable ? 1 : 0);
    return this;
  }

  underline(enable = true) {
    this.buffer.push(0x1b, 0x2d, enable ? 1 : 0);
    return this;
  }

  size(doubleWidth = false, doubleHeight = false) {
    this.cols = doubleWidth ? this.normalCols / 2 : this.normalCols;
    let n = 0;
    if (doubleWidth) n |= 0x10; // Standard ESC/POS 2x width (0x10)
    if (doubleHeight) n |= 0x01; // Standard ESC/POS 2x height (0x01)
    this.buffer.push(0x1d, 0x21, n);
    return this;
  }

  text(str: string) {
    for (let i = 0; i < str.length; i++) {
      const code = str.charCodeAt(i);
      this.buffer.push(code >= 32 && code < 127 ? code : 0x20); // Printable ASCII only; never accept ESC/POS control bytes from user text.
    }
    return this;
  }

  line(str = '') {
    let remaining = str.replace(/[\x00-\x1f\x7f]/g, ' ');
    while (remaining.length > this.cols) {
      const space = remaining.lastIndexOf(' ', this.cols);
      const cut = space > 0 ? space : this.cols;
      this.text(remaining.slice(0, cut)); this.buffer.push(0x0a);
      remaining = remaining.slice(cut).trimStart();
    }
    this.text(remaining);
    this.buffer.push(0x0a); // LF
    return this;
  }

  feed(lines = 1) {
    for (let i = 0; i < lines; i++) this.buffer.push(0x0a);
    return this;
  }

  divider(char = '-') {
    this.line(char.repeat(this.cols));
    return this;
  }

  doubleDivider() {
    this.line('='.repeat(this.cols));
    return this;
  }

  twoColumn(left: string, right: string) {
    if (right.length >= this.cols) { this.line(left); this.line(right); return this; }
    const maxLeft = this.cols - right.length - 1;
    const l = left.length > maxLeft ? left.slice(0, maxLeft) : left;
    const spaces = Math.max(1, this.cols - l.length - right.length);
    this.line(l + ' '.repeat(spaces) + right);
    return this;
  }

  threeColumn(col1: string, col2: string, col3: string, col1Width = 16, col2Width = 6) {
    const c3Width = this.cols - col1Width - col2Width;
    const c1 = (col1.length > col1Width ? col1.slice(0, col1Width) : col1).padEnd(col1Width);
    const c2 = (col2.length > col2Width ? col2.slice(0, col2Width) : col2).padStart(col2Width);
    const c3 = (col3.length > c3Width ? col3.slice(0, c3Width) : col3).padStart(c3Width);
    this.line(c1 + c2 + c3);
    return this;
  }

  fourColumn(col1: string, col2: string, col3: string, col4: string) {
    const widths = this.cols === 32 ? [13, 5, 6, 8] : [22, 6, 9, 11];
    if (col2.length > widths[1] || col3.length > widths[2] || col4.length > widths[3]) {
      this.line(col1).line(`${col2} x ${col3}`).twoColumn('Amount:', col4);
      return this;
    }
    if (this.cols === 32) {
      // 58mm: Item (13) Qty(5) Rate(6) Total(8) = 32
      const c2 = (col2.length > 5 ? col2.slice(0, 5) : col2).padStart(5);
      const c3 = (col3.length > 6 ? col3.slice(0, 6) : col3).padStart(6);
      const c4 = (col4.length > 8 ? col4.slice(0, 8) : col4).padStart(8);
      const c1Width = 32 - c2.length - c3.length - c4.length;
      const c1 = (col1.length > c1Width ? col1.slice(0, c1Width) : col1).padEnd(c1Width);
      this.line(c1 + c2 + c3 + c4);
    } else {
      // 80mm: Item (22) Qty(6) Rate(9) Total(11) = 48
      const c2 = (col2.length > 6 ? col2.slice(0, 6) : col2).padStart(6);
      const c3 = (col3.length > 9 ? col3.slice(0, 9) : col3).padStart(9);
      const c4 = (col4.length > 11 ? col4.slice(0, 11) : col4).padStart(11);
      const c1Width = 48 - c2.length - c3.length - c4.length;
      const c1 = (col1.length > c1Width ? col1.slice(0, c1Width) : col1).padEnd(c1Width);
      this.line(c1 + c2 + c3 + c4);
    }
    return this;
  }

  cut() {
    this.feed(3);
    this.buffer.push(0x1d, 0x56, 0x41, 0x10); // GS V A 16 (Full cut)
    return this;
  }

  kickDrawer() {
    this.buffer.push(0x1b, 0x70, 0x00, 0x19, 0xfa); // ESC p 0 25 250
    return this;
  }

  getBytes(): Uint8Array {
    return new Uint8Array(this.buffer);
  }
}

/**
 * Generate standard Indian GST / Restaurant ESC/POS Receipt Bytes
 */
export function buildEscPosBill(data: BillData, paperWidth: PaperWidth = '80mm'): Uint8Array {
  const b = new ThermalBuilder(paperWidth);

  // Duplicate / Reprint Header
  if (data.isDuplicate) {
    b.align('center').bold(true).line(`*** DUPLICATE BILL #${data.reprintCount || 1} ***`).bold(false);
  }

  // Restaurant Header - Standard Size to prevent wrapping on 58mm / 80mm
  b.align('center');
  const storeName = (data.restaurantName || 'NOVAPOS STORE').trim().toUpperCase();
  if (paperWidth === '58mm') {
    if (storeName.length <= 15) {
      b.bold(true).size(true, false).line(storeName).size(false, false);
    } else {
      // Clean, professional single line standard font with bold
      b.bold(true).size(false, false).line(storeName);
    }
  } else {
    // 80mm
    if (storeName.length <= 22) {
      b.bold(true).size(true, true).line(storeName).size(false, false);
    } else {
      b.bold(true).size(false, true).line(storeName).size(false, false);
    }
  }

  if (data.address) b.bold(false).line(data.address.trim());
  if (data.phone) b.bold(false).line(`Phone: ${data.phone.trim()}`);

  // Tax Info
  if (data.isCompositionScheme) {
    b.bold(true).line('BILL OF SUPPLY').bold(false);
    b.line('Composition Scheme - Not for Tax');
  } else {
    b.bold(true).line('TAX INVOICE').bold(false);
    if (data.gstin) b.line(`GSTIN: ${data.gstin.trim()}`);
    if (data.fssai) b.line(`FSSAI: ${data.fssai.trim()}`);
  }
  b.divider();

  // Invoice Meta
  b.align('left');
  if (paperWidth === '58mm') {
    b.line(`Bill: #${data.billNo}`);
    b.twoColumn(`${data.date}`, `${data.time}`);
    b.twoColumn(`Type: ${data.orderType.toUpperCase()}`, data.tableNo ? `Table: ${data.tableNo}` : '');
  } else {
    b.twoColumn(`Bill: #${data.billNo}`, `${data.date} ${data.time}`);
    b.twoColumn(`Type: ${data.orderType.toUpperCase()}`, data.tableNo ? `Table: ${data.tableNo}` : '');
  }

  if (data.tableNo && paperWidth === '58mm') {
    b.line(`Table: ${data.tableNo}`);
  }

  if (data.customerName && data.customerName !== 'Walk-in Guest') {
    b.twoColumn(`Guest: ${data.customerName}`, data.customerPhone || '');
  }
  b.doubleDivider();

  // Table Header
  b.bold(true);
  b.fourColumn('Item', 'Qty', 'Rate', 'Total');
  b.divider();
  b.bold(false);

  // Item Rows
  for (const item of data.items) {
    const rateStr = item.price < 1 || !Number.isInteger(item.price) ? item.price.toFixed(2) : item.price.toFixed(0);
    b.fourColumn(
      item.name,
      item.quantity.toString(),
      rateStr,
      item.total.toFixed(2)
    );
  }

  b.divider();

  // Totals Breakdown
  b.align('left');
  b.twoColumn('Subtotal:', `Rs.${data.subtotal.toFixed(2)}`);

  if (!data.isCompositionScheme) {
    if (data.cgst > 0) b.twoColumn('CGST:', `Rs.${data.cgst.toFixed(2)}`);
    if (data.sgst > 0) b.twoColumn('SGST:', `Rs.${data.sgst.toFixed(2)}`);
  }

  b.doubleDivider();

  // NET TOTAL - Proportional single-line clean fit
  b.bold(true);
  if (paperWidth === '58mm') {
    // Standard bold font with clear visibility on 58mm
    b.twoColumn('NET TOTAL:', `Rs.${data.total.toFixed(2)}`);
  } else {
    // 80mm - Double width & height
    b.size(`NET TOTAL: Rs.${data.total.toFixed(2)}`.length <= 24, true);
    b.twoColumn('NET TOTAL:', `Rs.${data.total.toFixed(2)}`);
    b.size(false, false);
  }
  b.bold(false);
  b.doubleDivider();

  // Payment Mode
  b.twoColumn('Payment Mode:', data.paymentMode.toUpperCase());
  if (data.cashTendered && data.cashTendered > 0) {
    b.twoColumn('Cash Tendered:', `Rs.${data.cashTendered.toFixed(2)}`);
    if (data.change && data.change > 0) {
      b.twoColumn('Change Returned:', `Rs.${data.change.toFixed(2)}`);
    }
  }

  // Dynamic UPI Payment Section
  if (data.upiVpa || data.upiPayload) {
    b.divider();
    b.align('center');
    b.bold(true).line('SCAN & PAY VIA ANY UPI APP').bold(false);
    if (data.upiVpa) b.line(`UPI ID: ${data.upiVpa}`);
    b.line('GPay / PhonePe / Paytm / BHIM');
    b.divider();
  }

  // Footer
  b.align('center');
  b.bold(true).line('THANK YOU! VISIT AGAIN').bold(false);

  if (data.paymentMode.toUpperCase() === 'CASH') b.kickDrawer();
  b.cut();

  return b.getBytes();
}

export const buildReceiptBytes = buildEscPosBill;

/**
 * Generate KOT ESC/POS payload
 */
export function buildKotBytes(data: KotData, paperWidth: PaperWidth = '80mm'): Uint8Array {
  const b = new ThermalBuilder(paperWidth);

  b.align('center').bold(true).size(paperWidth === '80mm', true).line('*** KOT TICKET ***').size(false, false);
  b.bold(false).line(data.restaurantName);
  b.divider();

  b.align('left').bold(true);
  b.twoColumn(`KOT: #${data.kotNo}`, `${data.time}`);
  b.size(true, false).twoColumn(data.tableNo ? `TABLE: ${data.tableNo}` : 'TAKEAWAY', data.orderType.toUpperCase()).size(false, false);
  b.doubleDivider();

  for (const it of data.items) {
    b.bold(true).size(true, true).twoColumn(it.name, `[ ${it.quantity} ]`).size(false, false);
    if (it.notes) {
      b.bold(false).line(`  * Note: ${it.notes}`);
    }
  }

  b.doubleDivider();
  b.cut();

  return b.getBytes();
}

/**
 * Test Print Slip
 */
export function buildTestSlipBytes(paperWidth: PaperWidth = '58mm', storeName: string = 'NovaPOS Store'): Uint8Array {
  const b = new ThermalBuilder(paperWidth);
  b.align('center');
  const name = storeName.trim().toUpperCase();
  if (paperWidth === '58mm') {
    if (name.length <= 15) {
      b.bold(true).size(true, false).line(name).size(false, false);
    } else {
      b.bold(true).line(name);
    }
  } else {
    b.bold(true).size(name.length <= 24, true).line(name).size(false, false);
  }
  b.bold(false).line('Thermal Printer Connection Test');
  b.divider();
  b.align('left');
  b.twoColumn(`Paper Width: ${paperWidth}`, paperWidth === '58mm' ? '2-Inch (32 Col)' : '3-Inch (48 Col)');
  b.twoColumn(`Date: ${new Date().toLocaleDateString('en-IN')}`, `${new Date().toLocaleTimeString('en-IN')}`);
  b.doubleDivider();
  b.align('center');
  b.bold(true).line('PRINTER IS READY!').bold(false);
  b.line('NovaPOS Mobile Billing System');
  b.divider();
  b.line('ESC/POS Direct Hardware Bridge');
  b.cut();
  return b.getBytes();
}

/**
 * 1-Click Direct Print for Bill via Native Bluetooth SPP or Browser
 */
export async function printBillDirect(data: BillData, paperWidth?: PaperWidth): Promise<boolean> {
  const effectiveWidth = paperWidth ?? getPaperWidth();
  const printed = await writeEscPosBytes(buildEscPosBill(data, effectiveWidth));
  if (printed) return true;
  printReceiptViaBrowser(data, effectiveWidth);
  return false; // Preview opened; physical output is not confirmed.

}

/**
 * Browser fallback print using styled HTML window
 */
export function printReceiptViaBrowser(data: BillData, paperWidth: PaperWidth = getPaperWidth()) {
  const widthMm = paperWidth === '58mm' ? '58mm' : '80mm';
  const widthPx = paperWidth === '58mm' ? '240px' : '320px';

  const itemsHtml = data.items.map((it) => `
    <div style="display:flex; justify-content:space-between; margin: 4px 0;">
      <span style="flex:1; font-weight:600;">${it.name} <span style="font-weight:normal;">x${it.quantity}</span></span>
      <span style="font-weight:bold;">₹${it.total.toFixed(2)}</span>
    </div>
  `).join('');

  showPrintPreview(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Receipt - ${data.billNo}</title>
        <style>
          @page { size: ${widthMm} auto; margin: 0; }
          body {
            font-family: 'Courier New', monospace;
            width: ${widthPx};
            margin: 0 auto;
            padding: 10px 8px;
            color: #000;
            font-size: 13px;
            line-height: 1.25;
          }
          .text-center { text-align: center; }
          .bold { font-weight: bold; }
          .divider { border-bottom: 1px dashed #000; margin: 8px 0; }
          .double-divider { border-bottom: 2px solid #000; margin: 8px 0; }
          .row { display: flex; justify-content: space-between; margin: 3px 0; }
          .title { font-size: 18px; font-weight: 800; letter-spacing: 0.5px; }
        </style>
      </head>
      <body>
        ${data.isDuplicate ? `<div class="text-center bold" style="background:#000; color:#fff; padding:3px; margin-bottom:6px;">*** DUPLICATE COPY #${data.reprintCount || 1} ***</div>` : ''}
        <div class="text-center">
          <div class="title">${data.restaurantName}</div>
          <div>${data.address}</div>
          <div>Phone: ${data.phone}</div>
          ${data.isCompositionScheme ? `
            <div class="bold" style="margin-top:4px;">BILL OF SUPPLY</div>
            <div style="font-size:10px;">Composition taxable person, not eligible to collect tax on supplies</div>
          ` : `
            <div class="bold" style="margin-top:2px;">TAX INVOICE</div>
            ${data.gstin ? `<div>GSTIN: ${data.gstin}</div>` : ''}
            ${data.fssai ? `<div>FSSAI: ${data.fssai}</div>` : ''}
          `}
        </div>
        <div class="divider"></div>
        <div class="row"><span>Bill: ${data.billNo}</span><span>${data.date} ${data.time}</span></div>
        <div class="row"><span>Type: ${data.orderType.toUpperCase()}</span><span>${data.tableNo ? `Table: ${data.tableNo}` : ''}</span></div>
        ${data.customerName && data.customerName !== 'Walk-in Guest' ? `<div class="row"><span>Guest: ${data.customerName}</span><span>${data.customerPhone || ''}</span></div>` : ''}
        <div class="double-divider"></div>
        ${itemsHtml}
        <div class="divider"></div>
        <div class="row"><span>Subtotal:</span><span>₹${data.subtotal.toFixed(2)}</span></div>
        ${!data.isCompositionScheme && data.cgst > 0 ? `<div class="row"><span>CGST:</span><span>₹${data.cgst.toFixed(2)}</span></div>` : ''}
        ${!data.isCompositionScheme && data.sgst > 0 ? `<div class="row"><span>SGST:</span><span>₹${data.sgst.toFixed(2)}</span></div>` : ''}
        <div class="double-divider"></div>
        <div class="row bold" style="font-size: 16px;"><span>NET TOTAL:</span><span>₹${data.total.toFixed(2)}</span></div>
        <div class="double-divider"></div>
        <div class="row"><span>Paid via:</span><span class="bold">${data.paymentMode.toUpperCase()}</span></div>
        ${(data.upiPayload || data.upiVpa) ? `
          <div class="divider"></div>
          <div class="text-center" style="margin: 8px 0;">
            <div class="bold" style="font-size:11px; margin-bottom:4px;">SCAN & PAY VIA ANY UPI APP</div>
            ${data.upiVpa ? `<div style="font-family:monospace; font-size:12px;">${data.upiVpa}</div>` : ''}
          </div>
        ` : ''}
        <div class="divider"></div>
        <div class="text-center bold" style="margin-top: 10px;">THANK YOU! VISIT AGAIN</div>
      </body>
    </html>
  `);
}

/**
 * Browser fallback KOT print
 */
export function printKotViaBrowser(data: KotData, paperWidth: PaperWidth = getPaperWidth()) {
  const widthMm = paperWidth === '58mm' ? '58mm' : '80mm';
  const widthPx = paperWidth === '58mm' ? '240px' : '320px';

  const itemsHtml = data.items.map((it) => `
    <div style="display:flex; justify-content:space-between; margin: 4px 0; font-size:14px; font-weight:bold;">
      <span>${it.name}</span>
      <span>[ ${it.quantity} ]</span>
    </div>
    ${it.notes ? `<div style="font-size:11px; font-style:italic; padding-left:8px;">* ${it.notes}</div>` : ''}
  `).join('');

  showPrintPreview(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>KOT #${data.kotNo}</title>
        <style>
          @page { size: ${widthMm} auto; margin: 0; }
          body {
            font-family: 'Courier New', monospace;
            width: ${widthPx};
            margin: 0 auto;
            padding: 10px 8px;
            color: #000;
            font-size: 13px;
          }
          .text-center { text-align: center; }
          .bold { font-weight: bold; }
          .divider { border-bottom: 2px dashed #000; margin: 8px 0; }
          .double { border-bottom: 3px solid #000; margin: 8px 0; }
          .row { display: flex; justify-content: space-between; margin: 3px 0; }
        </style>
      </head>
      <body>
        <div class="text-center">
          <div style="font-size: 20px; font-weight: 900;">*** KITCHEN ORDER TICKET ***</div>
          <div style="font-size: 18px; font-weight: 800; margin-top: 4px;">KOT #${data.kotNo}</div>
        </div>
        <div class="double"></div>
        <div class="row bold"><span>${data.tableNo ? 'TABLE: ' + data.tableNo : 'TAKEAWAY / PARCEL'}</span><span>${data.orderType.toUpperCase()}</span></div>
        <div class="row"><span>Time: ${data.time}</span><span>${data.date}</span></div>
        <div class="divider"></div>
        ${itemsHtml}
        <div class="double"></div>
        <div class="text-center bold" style="margin-top: 10px;">*** END OF TICKET ***</div>
      </body>
    </html>
  `);
}

/**
 * 1-Click Direct Print for KOT via Native Bluetooth SPP or Browser
 */
export async function printKotDirect(data: KotData, paperWidth: PaperWidth = getPaperWidth()): Promise<boolean> {
  if (await writeEscPosBytes(buildKotBytes(data, paperWidth))) return true;
  printKotViaBrowser(data, paperWidth);
  return false;
}

/**
 * Browser fallback test slip
 */
export function printTestSlipViaBrowser(paperWidth: PaperWidth = '58mm', storeName: string = 'NovaPOS Store') {
  const widthMm = paperWidth === '58mm' ? '58mm' : '80mm';
  const widthPx = paperWidth === '58mm' ? '240px' : '320px';

  showPrintPreview(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Thermal Test Slip - ${paperWidth}</title>
        <style>
          @page { size: ${widthMm} auto; margin: 0; }
          body {
            font-family: 'Courier New', monospace;
            width: ${widthPx};
            margin: 0 auto;
            padding: 10px 8px;
            color: #000;
            font-size: 13px;
          }
          .text-center { text-align: center; }
          .bold { font-weight: bold; }
          .divider { border-bottom: 1px dashed #000; margin: 8px 0; }
          .double { border-bottom: 2px solid #000; margin: 8px 0; }
        </style>
      </head>
      <body>
        <div class="text-center bold" style="font-size: 18px;">${storeName.toUpperCase()}</div>
        <div class="text-center">Thermal Printer Connection Test</div>
        <div class="divider"></div>
        <div>Paper Width: ${paperWidth} (${paperWidth === '58mm' ? '2 Inch' : '3 Inch'})</div>
        <div>Date: ${new Date().toLocaleDateString('en-IN')}</div>
        <div>Time: ${new Date().toLocaleTimeString('en-IN')}</div>
        <div class="double"></div>
        <div class="text-center bold" style="font-size: 15px;">PRINTER IS READY!</div>
        <div class="text-center" style="font-size: 12px; margin-top: 4px;">Fast 1-Tap Mobile Billing Enabled</div>
        <div class="divider"></div>
        <div class="text-center" style="font-size: 11px;">ESC/POS Bluetooth & USB Supported</div>
      </body>
    </html>
  `);
}



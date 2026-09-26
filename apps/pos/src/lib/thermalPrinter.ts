import { showPrintPreview } from '../components/PrintPreview';
/**
 * Thermal Printer Driver for 58mm & 80mm ESC/POS Printers.
 *
 * Supports:
 * - Web Bluetooth API (Android / Mobile Chrome / Tablets)
 * - Web Serial API & WebUSB API (TVS RP 3200, Epson, Everycom USB printers)
 * - Browser Formatted Thermal Print Dialog fallback
 * - Full Indian Restaurant Bill & KOT Formatting with GST & UPI
 */

export type PaperWidth = '58mm' | '80mm';

export interface PrinterDevice {
  connected: boolean;
  type: 'bluetooth' | 'usb' | 'serial' | 'browser';
  name: string;
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

let activeBluetoothDevice: any = null;
let activeBluetoothCharacteristic: any = null;
let activeSerialWriter: any = null;
let activeUsbDevice: any = null;
let activeUsbEndpoint: number | null = null;

export const isBluetoothSupported = () => typeof navigator !== 'undefined' && 'bluetooth' in navigator;
export const isSerialSupported = () => typeof navigator !== 'undefined' && 'serial' in navigator;
export const isUsbSupported = () => typeof navigator !== 'undefined' && 'usb' in navigator;

/**
 * Connect to 58mm or 80mm Bluetooth Thermal Printer
 */
export async function connectBluetoothPrinter(): Promise<PrinterDevice> {
  if (!isBluetoothSupported()) {
    throw new Error('Web Bluetooth is not supported on this browser. Use Google Chrome on Android or PC.');
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
 * Connect to USB / Serial Thermal Printer (e.g. TVS RP 3200)
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
      // If serial fails, fallback to USB
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
 * Write raw ESC/POS bytes with chunking
 */
export async function writeEscPosBytes(data: Uint8Array): Promise<boolean> {
  // 1. Bluetooth
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

  // 2. Serial
  if (activeSerialWriter) {
    await activeSerialWriter.write(data);
    return true;
  }

  // 3. USB
  if (activeUsbDevice && activeUsbEndpoint !== null) {
    await activeUsbDevice.transferOut(activeUsbEndpoint, data);
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

  constructor(paperWidth: PaperWidth = '80mm') {
    this.cols = paperWidth === '58mm' ? 32 : 48;
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

  size(doubleWidth = false, doubleHeight = false) {
    let n = 0;
    if (doubleWidth) n |= 0x20;
    if (doubleHeight) n |= 0x01;
    this.buffer.push(0x1d, 0x21, n);
    return this;
  }

  text(str: string) {
    const folded = str.replace(/[₹]/g, 'Rs.').replace(/[^\x20-\x7e\n]/g, '');
    for (let i = 0; i < folded.length; i++) {
      this.buffer.push(folded.charCodeAt(i));
    }
    return this;
  }

  line(str = '') {
    this.text(str + '\n');
    return this;
  }

  divider(char = '-') {
    this.text(char.repeat(this.cols) + '\n');
    return this;
  }

  doubleDivider() {
    this.divider('=');
    return this;
  }

  twoColumn(left: string, right: string) {
    const cleanLeft = left.replace(/[₹]/g, 'Rs.');
    const cleanRight = right.replace(/[₹]/g, 'Rs.');
    const space = this.cols - cleanLeft.length - cleanRight.length;
    if (space >= 0) {
      this.text(cleanLeft + ' '.repeat(space) + cleanRight + '\n');
    } else {
      this.text(cleanLeft + '\n' + ' '.repeat(Math.max(0, this.cols - cleanRight.length)) + cleanRight + '\n');
    }
    return this;
  }

  itemRow(name: string, qty: number, rate: number, total: number) {
    const qtyStr = `${qty}x`;
    const rateStr = rate.toFixed(2);
    const totalStr = `${total.toFixed(2)}`;

    if (this.cols === 32) {
      // 58mm compact
      // Line 1: Item Name
      this.bold(true).line(name).bold(false);
      // Line 2: Qty x Rate ........ Total
      const detail = `  ${qtyStr} @ ${rateStr}`;
      const space = this.cols - detail.length - totalStr.length;
      this.line(detail + ' '.repeat(Math.max(1, space)) + totalStr);
    } else {
      // 80mm wide
      // Name (26 chars) | Qty (5) | Rate (7) | Total (10)
      const qtyWidth = Math.max(4, String(qty).length);
      const rateWidth = Math.max(7, rateStr.length);
      const totalWidth = Math.max(9, totalStr.length);
      const maxNameLen = Math.max(1, this.cols - qtyWidth - rateWidth - totalWidth - 3);
      const truncName = name.length > maxNameLen ? name.substring(0, maxNameLen - 1) + '.' : name;
      const nameCol = truncName.padEnd(maxNameLen, ' ');
      const qtyCol = String(qty).padStart(qtyWidth, ' ');
      const rateCol = rateStr.padStart(rateWidth, ' ');
      const totalCol = totalStr.padStart(totalWidth, ' ');
      this.line(`${nameCol} ${qtyCol} ${rateCol} ${totalCol}`);
    }
    return this;
  }

  feed(lines = 3) {
    for (let i = 0; i < lines; i++) this.buffer.push(0x0a);
    return this;
  }

  cut() {
    this.feed(3);
    this.buffer.push(0x1d, 0x56, 0x42, 0x00); // GS V 66 0 (Full Cut)
    return this;
  }

  kickDrawer() {
    this.buffer.push(0x1b, 0x70, 0x00, 0x19, 0xfa); // ESC p 0 25 250
    return this;
  }

  qr(payload: string) {
    const raw = payload.replace(/[^\x20-\x7e]/g, '');
    const len = raw.length + 3;
    const pL = len & 0xff;
    const pH = (len >> 8) & 0xff;
    const modSize = this.cols === 32 ? 5 : 7; // 5 for 58mm, 7 for 80mm

    // Model 2
    this.buffer.push(0x1d, 0x28, 0x6b, 0x04, 0x00, 0x31, 0x41, 0x32, 0x00);
    // Module size
    this.buffer.push(0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x43, modSize);
    // Error correction M
    this.buffer.push(0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x45, 0x31);
    // Store data in symbol
    this.buffer.push(0x1d, 0x28, 0x6b, pL, pH, 0x31, 0x50, 0x30);
    for (let i = 0; i < raw.length; i++) {
      this.buffer.push(raw.charCodeAt(i));
    }
    // Print symbol
    this.buffer.push(0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x51, 0x30);
    return this;
  }

  getBytes(): Uint8Array {
    return new Uint8Array(this.buffer);
  }
}

/**
 * Generate full receipt ESC/POS payload
 */
export function buildReceiptBytes(data: BillData, paperWidth: PaperWidth = '80mm'): Uint8Array {
  const b = new ThermalBuilder(paperWidth);

  // Duplicate / Reprint Notice
  if (data.isDuplicate) {
    b.align('center').bold(true).line(`*** DUPLICATE COPY #${data.reprintCount || 1} ***`).bold(false);
  }

  // Header
  b.align('center').bold(true).size(true, true).line(data.restaurantName).size(false, false);
  b.bold(false).line(data.address).line(`Phone: ${data.phone}`);

  if (data.isCompositionScheme) {
    b.bold(true).line('BILL OF SUPPLY').bold(false);
    b.line('Composition taxable person, not eligible to collect tax on supplies');
  } else {
    b.line('TAX INVOICE');
    if (data.gstin) b.line(`GSTIN: ${data.gstin}`);
    if (data.fssai) b.line(`FSSAI: ${data.fssai}`);
  }
  b.divider();

  // Meta
  b.align('left');
  b.twoColumn(`Bill: ${data.billNo}`, `${data.date} ${data.time}`);
  b.twoColumn(`Type: ${data.orderType.toUpperCase()}`, data.tableNo ? `Table: ${data.tableNo}` : '');
  if (data.customerName && data.customerName !== 'Walk-in Guest') {
    b.twoColumn(`Customer: ${data.customerName}`, data.customerPhone || '');
  }
  b.doubleDivider();

  // Column header
  if (paperWidth === '80mm') {
    const maxNameLen = 48 - 23;
    b.bold(true).line(`${'ITEM'.padEnd(maxNameLen, ' ')} ${'QTY'.padStart(4, ' ')} ${'RATE'.padStart(7, ' ')} ${'AMOUNT'.padStart(9, ' ')}`).bold(false);
    b.divider();
  }

  // Items
  for (const it of data.items) {
    b.itemRow(it.name, it.quantity, it.price, it.total);
  }
  b.divider();

  // Totals
  b.align('right');
  b.twoColumn('Subtotal:', `Rs. ${data.subtotal.toFixed(2)}`);
  if (!data.isCompositionScheme) {
    if (data.cgst > 0) b.twoColumn('CGST (2.5%):', `Rs. ${data.cgst.toFixed(2)}`);
    if (data.sgst > 0) b.twoColumn('SGST (2.5%):', `Rs. ${data.sgst.toFixed(2)}`);
  }
  b.doubleDivider();
  b.bold(true).size(false, true).twoColumn('NET PAYABLE:', `Rs. ${data.total.toFixed(2)}`).size(false, false).bold(false);
  b.doubleDivider();

  // Payment
  b.twoColumn('Payment Mode:', data.paymentMode.toUpperCase());
  if (data.cashTendered && data.cashTendered > 0) {
    b.twoColumn('Cash Tendered:', `Rs. ${data.cashTendered.toFixed(2)}`);
    b.twoColumn('Change Due:', `Rs. ${(data.change || 0).toFixed(2)}`);
  }
  b.divider();

  // Dynamic UPI QR Code (Crisp ESC/POS native print)
  const upiPayload = data.upiPayload || (data.upiVpa ? `upi://pay?pa=${data.upiVpa}&pn=${encodeURIComponent(data.restaurantName)}&am=${data.total.toFixed(2)}&tr=${data.billNo}&tn=Bill-${data.billNo}&cu=INR` : null);
  if (upiPayload) {
    b.align('center');
    b.bold(true).line('SCAN TO PAY VIA ANY UPI APP').bold(false);
    b.qr(upiPayload);
    b.line('GPay / PhonePe / Paytm / BHIM');
    b.divider();
  }

  // Footer
  b.align('center');
  b.bold(true).line('THANK YOU! VISIT AGAIN').bold(false);
  b.line('Taste of Authentic Dining');
  b.kickDrawer();
  b.cut();

  return b.getBytes();
}

/**
 * Generate KOT ESC/POS payload
 */
export function buildKotBytes(data: KotData, paperWidth: PaperWidth = '80mm'): Uint8Array {
  const b = new ThermalBuilder(paperWidth);

  b.align('center').bold(true).size(true, true).line('*** KOT TICKET ***').size(false, false);
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
export function buildTestSlipBytes(paperWidth: PaperWidth = '80mm'): Uint8Array {
  const b = new ThermalBuilder(paperWidth);
  b.align('center').bold(true).size(true, true).line('VELPULA MESS').size(false, false);
  b.line('Thermal Printer Connection Test');
  b.divider();
  b.line(`Paper Width: ${paperWidth}`);
  b.line(`Date: ${new Date().toLocaleDateString('en-IN')}`);
  b.line(`Time: ${new Date().toLocaleTimeString('en-IN')}`);
  b.doubleDivider();
  b.bold(true).line('PRINTER IS READY!').bold(false);
  b.line('Fast 1-Tap Billing Enabled');
  b.cut();
  return b.getBytes();
}

/**
 * Browser fallback print using styled HTML window
 */
export function printReceiptViaBrowser(data: BillData, paperWidth: PaperWidth = '80mm') {
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
        ${!data.isCompositionScheme && data.cgst > 0 ? `<div class="row"><span>CGST (2.5%):</span><span>₹${data.cgst.toFixed(2)}</span></div>` : ''}
        ${!data.isCompositionScheme && data.sgst > 0 ? `<div class="row"><span>SGST (2.5%):</span><span>₹${data.sgst.toFixed(2)}</span></div>` : ''}
        <div class="double-divider"></div>
        <div class="row bold" style="font-size: 16px;"><span>NET TOTAL:</span><span>₹${data.total.toFixed(2)}</span></div>
        <div class="double-divider"></div>
        <div class="row"><span>Paid via:</span><span class="bold">${data.paymentMode.toUpperCase()}</span></div>
        ${(data.upiPayload || data.upiVpa) ? `
          <div class="divider"></div>
          <div class="text-center" style="margin: 8px 0;">
            <div class="bold" style="font-size:11px; margin-bottom:4px;">SCAN & PAY VIA ANY UPI APP</div>
            <img src="https://api.qrserver.com/v1/create-qr-code/?size=130x130&data=${encodeURIComponent(data.upiPayload || `upi://pay?pa=${data.upiVpa}&pn=${encodeURIComponent(data.restaurantName)}&am=${data.total.toFixed(2)}&tr=${data.billNo}&tn=Bill-${data.billNo}&cu=INR`)}" width="130" height="130" style="margin:0 auto; display:block;" />
            <div style="font-size:10px; margin-top:2px;">GPay | PhonePe | Paytm | BHIM</div>
          </div>
        ` : ''}
        <div class="divider"></div>
        <div class="text-center bold" style="margin-top: 10px;">THANK YOU! VISIT AGAIN</div>
        <div class="text-center" style="font-size: 11px;">Taste of Authentic Food</div>
      </body>
    </html>
  `);
}

/**
 * Browser fallback print for Kitchen Order Ticket (KOT)
 */
export function printKotViaBrowser(data: KotData, paperWidth: PaperWidth = '80mm') {
  const widthMm = paperWidth === '58mm' ? '58mm' : '80mm';
  const widthPx = paperWidth === '58mm' ? '240px' : '320px';

  const itemsHtml = data.items.map((it) => `
    <div style="display:flex; justify-content:space-between; margin: 8px 0; font-size: 15px; font-weight: bold;">
      <span>${it.name}</span>
      <span style="font-size: 17px;">x ${it.quantity}</span>
    </div>
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

import type { PaperWidth } from './thermalPrinter';
export function getPaperWidth(): PaperWidth {
  const saved = localStorage.getItem('novapos_printer_paper_width') ?? localStorage.getItem('novapos:paper_width');
  return saved === '80mm' ? '80mm' : '58mm';
}
export function setPaperWidth(width: PaperWidth) {
  localStorage.setItem('novapos_printer_paper_width', width);
  localStorage.setItem('novapos:paper_width', width);
}
export function shouldPrintSale(askToPrint: boolean): boolean {
  const primaryEnabled = localStorage.getItem('novapos_primary_printer_enabled') !== 'false';
  if (!primaryEnabled) return false;
  const autoPrint = localStorage.getItem('novapos_auto_print_sale') === 'true';
  if (autoPrint) return true;
  if (askToPrint) return window.confirm('Print receipt bill?');
  return true;
}

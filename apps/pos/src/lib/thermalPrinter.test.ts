import { describe, expect, it } from 'vitest';
import { buildReceiptBytes, type BillData } from './thermalPrinter';

const bill: BillData = {
  restaurantName: 'NovaPOS', address: 'Hyderabad', phone: '12345', billNo: 'VM-T1-2627-00101',
  date: '24/9/2026', time: '12:00', orderType: 'takeaway',
  items: [{ name: 'Turmeric (g)', quantity: 125, price: 0.4, total: 50 },
    { name: 'Rice (kg)', quantity: 0.125, price: 60, total: 7.5 }],
  subtotal: 57.5, cgst: 0, sgst: 0, total: 57.5, paymentMode: 'cash',
};
describe('weighted thermal receipts', () => {
  for (const width of ['58mm', '80mm'] as const) it(`preserves fractional quantity, decimal rate and invoice on ${width}`, () => {
    const text = new TextDecoder().decode(buildReceiptBytes(bill, width));
    expect(text).toContain('0.40');
    expect(text).toContain('0.125');
    expect(text).toContain('VM-T1-2627-00101');
    expect(text).toContain('Rice (kg)');
    const riceRow = text.split('\n').find(line => line.includes('Rice (kg)'))!;
    expect(riceRow.replace(/\x1b[!Ea][\x00-\xff]/g, '').length).toBeLessThanOrEqual(width === '80mm' ? 48 : 32);
  });
});

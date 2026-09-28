import { describe, expect, it } from 'vitest';
import { buildReceiptBytes, ThermalBuilder, type BillData } from './thermalPrinter';

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

it('uses standard 2x width and height bits', () => {
  expect(Array.from(new ThermalBuilder().size(true, false).size(false, true).size(true, true).getBytes()))
    .toEqual([27, 64, 29, 33, 16, 29, 33, 1, 29, 33, 17]);
});
it('fits 80mm totals into the 24 characters available at double width', () => {
  const text = new TextDecoder().decode(new ThermalBuilder('80mm').size(true, true).twoColumn('NET TOTAL:', 'Rs.1234.00').getBytes());
  expect(text.split('\n')[0].replace(/\x1b@|\x1d![\s\S]/g, '').length).toBeLessThanOrEqual(24);
  expect(text).toContain('Rs.1234.00');
});
it('keeps a 32-character business name and the complete total on 58mm', () => {
  const name = 'AVS BUSINESS SOLUTION'.padEnd(32, 'X');
  const text = new TextDecoder().decode(buildReceiptBytes({ ...bill, restaurantName: name, total: 123456.78 }, '58mm'));
  expect(text).toContain(name + '\n');
  expect(text.split('\n').find(line => line.includes('NET TOTAL:'))).toContain('Rs.123456.78');
});
it('does not label mixed custom GST as 2.5 percent or emit injected printer commands', () => {
  const text = new TextDecoder().decode(buildReceiptBytes({ ...bill, restaurantName: 'Shop\x1b@', cgst: 9, sgst: 9 }, '58mm'));
  expect(text).not.toContain('2.5%');
  expect(text).not.toContain('SHOP\x1b@');
});

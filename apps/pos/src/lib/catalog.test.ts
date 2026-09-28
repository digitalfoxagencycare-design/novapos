import { expect, it } from 'vitest';
import { barcodeConflict, findCatalogItemByCode, itemBarcodes } from './catalog';

it('resolves all five barcodes without losing leading zeroes', () => {
  const item = { id: 'a', code: 'RICE', barcode: '001', barcode2: '002', barcode3: '003', barcode4: '004', barcode5: '005' };
  for (const code of ['001', '002', '003', '004', '005', 'rice']) {
    expect(findCatalogItemByCode([item], ` ${code} `)).toBe(item);
  }
  expect(findCatalogItemByCode([item], '')).toBeUndefined();
  expect(itemBarcodes(item)).toHaveLength(5);
});
it('rejects duplicate slots and barcode/quick-code collisions but allows editing the same item', () => {
  const existing = { id: 'a', name: 'Rice', code: 'RICE', barcode5: '005' };
  expect(barcodeConflict([existing], [' 005 '], 'b')).toContain('Rice');
  expect(barcodeConflict([existing], ['rice'], 'b')).toContain('Rice');
  expect(barcodeConflict([existing], ['007', '007'], 'b')).toBeTruthy();
  expect(barcodeConflict([existing], ['005'], 'a')).toBeNull();
  expect(findCatalogItemByCode([existing, { id: 'b', barcode: '005' }], '005')).toBeUndefined();
});

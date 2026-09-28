import { expect, it } from 'vitest';
import { csvContent } from './csv';
it('quotes separators and neutralizes spreadsheet formulas without corrupting numeric values', () => {
  const csv = csvContent(['Item', 'Value'], [['=SUM(1,2)', -12.5], ['a#b\n"c"', 0]]);
  expect(csv).toContain('"\'=SUM(1,2)"');
  expect(csv).toContain('"-12.5"');
  expect(csv).toContain('"a#b\n""c"""');
});

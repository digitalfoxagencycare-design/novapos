import { beforeEach, expect, it } from 'vitest';
import { addDayBookEntry, filterEntriesByPeriod, nextInvoiceNumber, loadDayBookEntries } from './dayBook';
import { mergeCatalog } from './catalog';

beforeEach(() => localStorage.clear());
it('keeps archived presets deleted and edits profile-specific', () => {
  const preset = { id: 'preset:kirana:0', name: 'Rice', archived: false };
  expect(mergeCatalog([preset], [{ ...preset, archived: true }], 'kirana')).toEqual([]);
  expect(mergeCatalog([], [{ ...preset }, { id: 'custom-1', name: 'Cake', businessProfile: 'bakery' }], 'bakery')).toHaveLength(1);
});
it('filters reporting using local midnight, not UTC midnight', () => {
  const now = new Date(2026, 8, 25, 1);
  const entries = [{ timestamp: new Date(2026, 8, 25, 0, 10).toISOString() }, { timestamp: new Date(2026, 8, 24, 23, 59).toISOString() }];
  expect(filterEntriesByPeriod(entries, 'today', now)).toEqual([entries[0]]);
});
it('uses one consecutive annual invoice sequence for every billing screen', () => {
  const now = new Date(2026, 8, 25);
  const first = nextInvoiceNumber(now);
  addDayBookEntry({ type: 'sale', description: 'Sale', amount: 12.5, paymentMode: 'cash', referenceNo: first });
  expect(first).toMatch(/^VM-T1-2627-\d{5}$/);
  expect(Number(nextInvoiceNumber(now).split('-').pop())).toBe(Number(first.split('-').pop()) + 1);
});
it('does not silently drop older bills after 500 transactions', () => {
  localStorage.setItem('novapos:daybook_entries', JSON.stringify(Array.from({length:500}, (_,i)=>({id:`old-${i}`}))));
  addDayBookEntry({ type: 'sale', description: 'Sale', amount: 1, paymentMode: 'cash' });
  expect(loadDayBookEntries()).toHaveLength(501);
});

import type { BusinessProfile } from './business';

interface BarcodeItem {
  id: string; name?: string; code?: string; archived?: boolean;
  barcode?: string; barcode2?: string; barcode3?: string; barcode4?: string; barcode5?: string;
}
export function itemBarcodes(item: BarcodeItem): string[] {
  return [item.barcode, item.barcode2, item.barcode3, item.barcode4, item.barcode5]
    .map(value => value?.trim() ?? '').filter(Boolean);
}
export function findCatalogItemByCode<T extends BarcodeItem>(items: T[], value: string): T | undefined {
  const code = value.trim().toLowerCase();
  if (!code) return undefined;
  const matches = items.filter(item => !item.archived &&
    [...itemBarcodes(item), item.code?.trim() ?? ''].some(candidate => candidate.toLowerCase() === code));
  // Legacy duplicate codes must not silently bill whichever product is first.
  return matches.length === 1 ? matches[0] : undefined;
}
export function barcodeConflict(items: BarcodeItem[], values: string[], editingId?: string): string | null {
  const codes = values.map(value => value.trim().toLowerCase()).filter(Boolean);
  if (new Set(codes).size !== codes.length) return 'Each barcode and quick code must be unique.';
  const conflict = items.find(item => item.id !== editingId && !item.archived &&
    [...itemBarcodes(item), item.code?.trim() ?? ''].some(code => codes.includes(code.toLowerCase())));
  return conflict ? `This code already belongs to ${conflict.name || conflict.id}.` : null;
}

export function mergeCatalog<T extends { id: string; archived?: boolean; businessProfile?: BusinessProfile }>(presets: T[], custom: T[], profile: BusinessProfile): T[] {
  return [...custom, ...presets.filter(item => !custom.some(override => override.id === item.id))]
    .filter(item => !item.archived && (!item.businessProfile || item.businessProfile === profile))
    .filter(item => !item.id.startsWith('preset:') || item.id.startsWith(`preset:${profile}:`));
}

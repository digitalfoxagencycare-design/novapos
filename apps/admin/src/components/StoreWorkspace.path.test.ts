import { describe, expect, it } from 'vitest';
import { resolveStorePath } from './StoreWorkspace';

describe('resolveStorePath', () => {
  it('keeps the page the URL points at on refresh and Back/Forward', () => {
    expect(resolveStorePath('/store/catalog')).toBe('/store/catalog');
    expect(resolveStorePath('/store/dashboard')).toBe('/store/dashboard');
    expect(resolveStorePath('/store/reports')).toBe('/store/reports');
  });
  it('falls back to Live Orders outside /store', () => {
    expect(resolveStorePath('/')).toBe('/store/live-ops');
    expect(resolveStorePath('/dealer')).toBe('/store/live-ops');
    expect(resolveStorePath('')).toBe('/store/live-ops');
  });
});

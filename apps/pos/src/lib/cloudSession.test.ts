import { afterEach, describe, expect, it, vi } from 'vitest';
import { resolvePosApiBase } from './cloudSession';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('resolvePosApiBase', () => {
  it('prefers VITE_API_BASE_URL and normalizes a trailing slash', () => {
    vi.stubEnv('VITE_API_BASE_URL', 'https://api.novasaas.net/');
    expect(resolvePosApiBase()).toBe('https://api.novasaas.net/api/v1');
  });

  it('supports VITE_API_URL as fallback', () => {
    vi.stubEnv('VITE_API_BASE_URL', '');
    vi.stubEnv('VITE_API_URL', 'https://api.novasaas.net');
    expect(resolvePosApiBase()).toBe('https://api.novasaas.net/api/v1');
  });

  it('uses /api/v1 when running on localhost', () => {
    vi.stubEnv('VITE_API_BASE_URL', '');
    vi.stubEnv('VITE_API_URL', '');
    vi.stubGlobal('window', { location: { hostname: 'localhost' } });
    expect(resolvePosApiBase()).toBe('/api/v1');
  });

  it('falls back to https://api.novasaas.net/api/v1 on pos.novasaas.net without env set', () => {
    vi.stubEnv('VITE_API_BASE_URL', '');
    vi.stubEnv('VITE_API_URL', '');
    vi.stubGlobal('window', { location: { hostname: 'pos.novasaas.net' } });
    expect(resolvePosApiBase()).toBe('https://api.novasaas.net/api/v1');
  });
});

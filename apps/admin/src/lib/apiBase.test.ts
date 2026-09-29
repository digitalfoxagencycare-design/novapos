import { afterEach, describe, expect, it, vi } from 'vitest';
import { resolveApiBase } from './apiBase';

afterEach(() => vi.unstubAllEnvs());

describe('resolveApiBase', () => {
  it('prefers VITE_API_BASE_URL and normalizes a trailing slash', () => {
    vi.stubEnv('VITE_API_BASE_URL', 'https://api.example.test/');
    vi.stubEnv('VITE_API_URL', 'https://legacy.example.test');

    expect(resolveApiBase()).toBe('https://api.example.test/api/v1');
  });

  it('supports VITE_API_URL as a fallback', () => {
    vi.stubEnv('VITE_API_BASE_URL', '');
    vi.stubEnv('VITE_API_URL', 'https://legacy.example.test');

    expect(resolveApiBase()).toBe('https://legacy.example.test/api/v1');
  });

  it('uses the relative Vite proxy path when no URL is configured', () => {
    vi.stubEnv('VITE_API_BASE_URL', '');
    vi.stubEnv('VITE_API_URL', '');

    expect(resolveApiBase()).toBe('/api/v1');
  });

  it('falls back to production api.novasaas.net on non-localhost browsers when env is not set', () => {
    vi.stubEnv('VITE_API_BASE_URL', '');
    vi.stubEnv('VITE_API_URL', '');
    vi.stubGlobal('window', { location: { hostname: 'admin.novasaas.net' } });

    expect(resolveApiBase()).toBe('https://api.novasaas.net/api/v1');
    vi.unstubAllGlobals();
  });
});


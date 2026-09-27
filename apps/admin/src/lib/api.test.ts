// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { AdminApi } from './api';

beforeEach(() => localStorage.clear());
afterEach(() => vi.unstubAllGlobals());
it('bounds API requests and turns a timeout into a retryable message', async () => {
  const fetch = vi.fn().mockRejectedValue(new DOMException('Timed out', 'TimeoutError'));
  vi.stubGlobal('fetch', fetch);
  await expect(new AdminApi('/api/v1').outlets()).rejects.toMatchObject({ code: 'TIMEOUT', message: 'The server took too long to respond. Please retry.' });
  expect(fetch.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
});
it('clears tokens immediately on sign out even if the server never answers', () => {
  localStorage.setItem('novapos:admin:tokens', JSON.stringify({ accessToken: 'token', refreshToken: 'refresh' }));
  const fetch = vi.fn().mockReturnValue(new Promise(() => {}));
  vi.stubGlobal('fetch', fetch);
  const client = new AdminApi('/api/v1');
  void client.logout();
  expect(client.isAuthenticated).toBe(false);
  expect(localStorage.getItem('novapos:admin:tokens')).toBeNull();
  expect(fetch.mock.calls[0][1].headers.Authorization).toBe('Bearer token');
});

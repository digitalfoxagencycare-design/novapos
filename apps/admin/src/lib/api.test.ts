// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { AdminApi } from './api';

beforeEach(() => localStorage.clear());
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });
it('bounds API requests and turns a timeout into a retryable message', async () => {
  const timeout = vi.spyOn(AbortSignal, 'timeout');
  const fetch = vi.fn().mockRejectedValue(new DOMException('Timed out', 'TimeoutError'));
  vi.stubGlobal('fetch', fetch);
  await expect(new AdminApi('/api/v1').outlets()).rejects.toMatchObject({ code: 'TIMEOUT', message: 'The server took too long to respond. Please retry.' });
  expect(fetch.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
  expect(timeout).toHaveBeenCalledWith(30000);
});

it('does not resurrect a signed-out session when refresh completes late', async () => {
  localStorage.setItem('novapos:admin:tokens', JSON.stringify({ accessToken: 'old', refreshToken: 'refresh' }));
  let finishRefresh!: (value: Response) => void;
  let refreshStarted!: () => void;
  const started = new Promise<void>(resolve => { refreshStarted = resolve; });
  const fetch = vi.fn().mockImplementation((url: string) => {
    if (url.endsWith('/auth/refresh')) {
      refreshStarted();
      return new Promise<Response>(resolve => { finishRefresh = resolve; });
    }
    return Promise.resolve(new Response('{}', { status: url.endsWith('/auth/logout') ? 200 : 401 }));
  });
  vi.stubGlobal('fetch', fetch);
  const client = new AdminApi('/api/v1');
  const pending = client.outlets().catch(() => undefined);
  await started;
  await client.logout();
  finishRefresh(new Response(JSON.stringify({ accessToken: 'new', refreshToken: 'new-refresh' })));
  await pending;
  expect(client.isAuthenticated).toBe(false);
  expect(localStorage.getItem('novapos:admin:tokens')).toBeNull();
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

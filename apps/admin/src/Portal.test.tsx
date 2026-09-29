// @vitest-environment happy-dom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { Portal } from './Portal';

const mocks = vi.hoisted(() => ({ hasSession: vi.fn(), request: vi.fn(), login: vi.fn(), logout: vi.fn(), beginImpersonation: vi.fn(), tenantLogout: vi.fn() }));
vi.mock('./lib/platformApi', () => ({
  platformApi: { hasSession: mocks.hasSession, request: mocks.request, login: mocks.login, logout: mocks.logout },
}));
vi.mock('./App', () => ({ App: () => <div>Tenant backoffice login</div>, adminApi: { beginImpersonation: mocks.beginImpersonation, logout: mocks.tenantLogout } }));
vi.mock('./components/MerchantsManagement', () => ({ MerchantsManagement: ({ onImpersonate }: any) => <button onClick={() => onImpersonate({ sessionId: 'support-1', accessToken: 'short-lived', expiresAt: '2026-09-29T11:00:00Z', tenant: { id: 'tenant-1', name: 'Sri Krishna Bakery', slug: 'sri-krishna-bakery' } })}>Start test support</button> }));

let root: Root;
let host: HTMLDivElement;
beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  vi.clearAllMocks();
  mocks.hasSession.mockReturnValue(false);
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});

it('defaults to Admin Portal with a single platform login and a store-mode switch', async () => {
  await act(async () => root.render(<Portal />));
  expect(host.textContent).toContain('Admin Portal');
  expect(host.querySelectorAll('input')).toHaveLength(2);
  expect(host.querySelectorAll('button').length).toBe(2);
  expect(host.textContent).toContain('Switch to Store Owner / Cashier Login');
});

it('switches to the tenant backoffice and offers a way back to Admin Portal', async () => {
  await act(async () => root.render(<Portal />));
  const button = Array.from(host.querySelectorAll('button')).find(item => item.textContent?.includes('Store Owner'));
  await act(async () => button?.click());
  expect(host.textContent).toContain('Tenant backoffice login');
  expect(host.textContent).toContain('Switch to Admin Portal');
});

it('shows a persistent support banner and revokes the session on exit', async () => {
  mocks.hasSession.mockReturnValue(true);
  mocks.request.mockResolvedValue({ sub: 'admin', role: 'SUPER_ADMIN', name: 'Super Admin' });
  await act(async () => root.render(<Portal />));
  const start = Array.from(host.querySelectorAll('button')).find(item => item.textContent === 'Start test support');
  await act(async () => start?.click());
  expect(host.textContent).toContain('Support session');
  expect(host.textContent).toContain('Sri Krishna Bakery');
  expect(mocks.beginImpersonation).toHaveBeenCalledWith('short-lived');
  const exit = Array.from(host.querySelectorAll('button')).find(item => item.textContent === 'Exit support view');
  await act(async () => exit?.click());
  expect(mocks.request).toHaveBeenCalledWith('/admin/super/impersonation/support-1/end', 'POST', {});
  expect(mocks.tenantLogout).toHaveBeenCalled();
  expect(host.textContent).toContain('Start test support');
});

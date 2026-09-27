// @vitest-environment happy-dom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { App } from './App';
import { ApiError } from './lib/api';

const mocks = vi.hoisted(() => ({ me: vi.fn(), outlets: vi.fn(), today: vi.fn(), sales: vi.fn(), logout: vi.fn(), items: vi.fn(), categories: vi.fn() }));
vi.mock('./lib/api', async original => ({
  ...await original<typeof import('./lib/api')>(),
  AdminApi: class {
    isAuthenticated = true;
    me = mocks.me; outlets = mocks.outlets; today = mocks.today; sales = mocks.sales;
    logout = mocks.logout; items = mocks.items; categories = mocks.categories;
  },
}));

let root: Root;
let host: HTMLDivElement;
const outlet = { id: 'real-outlet', name: 'Real Store', code: 'MAIN', currency: 'INR', locale: 'en-IN', country: 'IN' };
beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  vi.clearAllMocks();
  mocks.me.mockResolvedValue({ role: 'OWNER', permissions: ['report:read', 'menu:read', 'settings:read'] });
  mocks.outlets.mockResolvedValue([outlet]); mocks.today.mockResolvedValue({ grossMinor: 12300 }); mocks.sales.mockResolvedValue([]);
  mocks.items.mockResolvedValue([]); mocks.categories.mockResolvedValue([]); mocks.logout.mockResolvedValue(undefined);
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });
async function render() { await act(async () => root.render(<App />)); }
async function click(label: string) {
  const button = Array.from(host.querySelectorAll('button')).find(b => b.textContent?.trim() === label);
  expect(button, `button ${label}`).toBeTruthy();
  await act(async () => button!.click());
}

it('shows disabled navigation while permissions load, without requesting invented outlet metrics', async () => {
  mocks.me.mockReturnValue(new Promise(() => {}));
  await render();
  const dashboard = Array.from(host.querySelectorAll('nav button')).find(b => b.textContent?.includes('Dashboard')) as HTMLButtonElement;
  expect(dashboard.disabled).toBe(true);
  expect(host.textContent).toContain('Checking access');
  expect(mocks.today).not.toHaveBeenCalled();
});
it('finishes with an actionable empty state when the account has no outlets', async () => {
  mocks.outlets.mockResolvedValue([]); await render();
  expect(host.textContent).toContain('No outlets assigned');
  expect(mocks.today).not.toHaveBeenCalled();
  expect(host.textContent).not.toContain('Loading…');
});
it('shows API errors and Retry loads the actual outlet', async () => {
  mocks.outlets.mockRejectedValueOnce(new ApiError(503, 'UNAVAILABLE', 'Service unavailable'));
  await render();
  expect(host.querySelector('[role="alert"]')?.textContent).toContain('Service unavailable');
  expect(mocks.today).not.toHaveBeenCalled();
  await click('Retry');
  expect(mocks.today).toHaveBeenCalledWith('real-outlet');
  expect(host.textContent).toContain('Real Store');
});
it('never grants owner access when identity lookup fails', async () => {
  mocks.me.mockRejectedValue(new ApiError(403, 'FORBIDDEN', 'Access denied')); await render();
  expect(host.querySelector('[role="alert"]')?.textContent).toContain('Access denied');
  expect(mocks.today).not.toHaveBeenCalled();
  expect(host.textContent).not.toContain('👤 OWNER');
});
it('returns to sign in on an unrecoverable 401', async () => {
  mocks.me.mockRejectedValue(new ApiError(401, 'UNAUTHORIZED', 'Session expired')); await render();
  expect(host.querySelector('input[autocomplete="username"]')).not.toBeNull();
  expect(host.querySelector('nav')).toBeNull();
});
it('selects an allowed page instead of calling reports for a restricted operator', async () => {
  mocks.me.mockResolvedValue({ role: 'CASHIER', permissions: ['menu:read'] }); await render();
  expect(mocks.today).not.toHaveBeenCalled();
  expect(mocks.items).toHaveBeenCalled();
  expect(host.querySelector('nav')?.textContent).not.toContain('Dashboard');
});
it('renders a no-access state for an empty permission list, including OWNER', async () => {
  mocks.me.mockResolvedValue({ role: 'OWNER', permissions: [] }); await render();
  expect(host.textContent).toContain('No admin access');
  expect(mocks.today).not.toHaveBeenCalled();
});
it('does not turn failed dashboard requests into zero sales and offers retry', async () => {
  mocks.today.mockRejectedValueOnce(new ApiError(503, 'UNAVAILABLE', 'Reports unavailable')); await render();
  expect(host.querySelector('[role="alert"]')?.textContent).toContain('Reports unavailable');
  expect(host.textContent).not.toContain('all settled');
  await click('Retry reports');
  expect(host.textContent).toContain('₹123.00');
});
it('does not repopulate a workspace after sign out during initialization', async () => {
  let resolve!: (value: unknown) => void;
  mocks.me.mockReturnValue(new Promise(r => { resolve = r; }));
  await render(); await click('Sign out');
  await act(async () => resolve({ role: 'OWNER', permissions: ['report:read'] }));
  expect(host.querySelector('nav')).toBeNull();
  expect(mocks.today).not.toHaveBeenCalled();
});
it('shows an error for a malformed permissions response instead of rendering protected pages', async () => {
  mocks.me.mockResolvedValue({ role: 'OWNER' }); await render();
  expect(host.querySelector('[role="alert"]')?.textContent).toContain('valid account permissions');
  expect(mocks.today).not.toHaveBeenCalled();
});

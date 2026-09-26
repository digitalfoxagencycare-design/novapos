import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getSubscriptionDetails, refreshSubscription, restoreSubscriptionCache } from './subscription';
import { cloudApi } from './cloudSession';
import { db } from './db';

describe('offline entitlement cache', () => {
  beforeEach(async () => { localStorage.clear(); cloudApi.setTokens(null); await db.kv.clear(); });
  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });
  it('does not grant a fresh trial on missing local storage', () => {
    expect(getSubscriptionDetails().isExpired).toBe(true);
  });
  it('fails closed on a corrupt or legacy unverified paid license', () => {
    localStorage.setItem('novapos:saas_subscription', JSON.stringify({ plan: 'PRO', expiresAt: Date.now() + 999999999 }));
    expect(getSubscriptionDetails().isExpired).toBe(true);
  });
  function session(tenantId: string) {
    cloudApi.setTokens({ accessToken: `x.${btoa(JSON.stringify({ tenantId }))}.x`, refreshToken: 'test' });
  }
  async function trial() {
    session('tenant-a');
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-09-01T00:00:00Z'));
    vi.spyOn(cloudApi, 'subscriptionStatus').mockResolvedValue({ tenantId: 'tenant-a', plan: 'starter_monthly', status: 'TRIAL', isTrial: true, isExpired: false,
      startedAt: '2026-09-01T00:00:00Z', serverTime: '2026-09-01T00:00:00Z', validUntil: '2026-09-04T00:00:00Z' });
    await refreshSubscription();
  }
  it('expires exactly at 72 hours while offline', async () => {
    await trial();
    vi.setSystemTime(new Date('2026-09-03T23:59:59Z'));
    expect(getSubscriptionDetails().isExpired).toBe(false);
    vi.setSystemTime(new Date('2026-09-04T00:00:00Z'));
    expect(getSubscriptionDetails().isExpired).toBe(true);
  });
  it('never shares an entitlement between tenants', async () => {
    await trial(); session('tenant-b');
    expect(getSubscriptionDetails().isExpired).toBe(true);
  });
  it('requires online confirmation after the clock moves backwards', async () => {
    await trial();
    vi.setSystemTime(new Date('2026-09-02T00:00:00Z')); getSubscriptionDetails();
    vi.setSystemTime(new Date('2026-09-01T00:00:00Z'));
    expect(getSubscriptionDetails().clockRollback).toBe(true);
    expect(getSubscriptionDetails().isExpired).toBe(true);
  });
  it('restores the verified server expiry from IndexedDB without restarting the trial', async () => {
    await trial(); localStorage.removeItem('novapos:entitlement:v2:tenant-a');
    await restoreSubscriptionCache();
    expect(getSubscriptionDetails().remainingMs).toBe(72 * 3600000);
  });
});


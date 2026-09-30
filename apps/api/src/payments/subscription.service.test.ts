import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { createHmac } from 'node:crypto';
import { SubscriptionService, TRIAL_DAYS } from './subscription.service';

describe('subscription security', () => {
  let tenant: any;
  let database: any;
  let service: SubscriptionService;
  const input = { tenantId: 'tenant-a', planKey: 'starter_monthly', orderId: 'order_real', paymentId: 'pay_real', signature: '' };
  beforeEach(() => {
    vi.stubEnv('RAZORPAY_KEY_ID', 'rzp_test_key');
    vi.stubEnv('RAZORPAY_KEY_SECRET', 'secret');
    tenant = { id: 'tenant-a', name: 'Store', createdAt: new Date('2026-01-01'), settings: {} };
    const query: any = { from: () => query, where: () => query, limit: () => query, for: () => query, then: (resolve: any) => Promise.resolve([tenant]).then(resolve) };
    const db = { select: () => query, update: () => ({ set: (value: any) => ({ where: async () => { Object.assign(tenant, value); } }) }) };
    database = { system: (fn: any) => fn(db), txAs: (_id: string, fn: any) => fn(db) };
    service = new SubscriptionService(database);
    input.signature = createHmac('sha256', 'secret').update(`${input.orderId}|${input.paymentId}`).digest('hex');
    vi.stubGlobal('fetch', vi.fn(async (url: string) => ({ ok: true, json: async () => url.includes('/orders/')
      ? { id: input.orderId, amount: 49900, currency: 'INR', notes: { tenantId: 'tenant-a', planKey: 'starter_monthly', type: 'SAAS_SUBSCRIPTION' } }
      : { id: input.paymentId, order_id: input.orderId, amount: 49900, currency: 'INR', status: 'captured' } })));
  });
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
  it('anchors a missing trial to tenant creation plus exactly TRIAL_DAYS (7) days', async () => {
    const status = await service.getStatus('tenant-a');
    expect(TRIAL_DAYS).toBe(7);
    expect(status.validUntil).toBe('2026-01-08T00:00:00.000Z'); // created 2026-01-01 + 7 days
    expect(status.isExpired).toBe(true);
    expect(status.features.offlineBilling).toBe(false);
  });
  it('rejects mock-order signature bypass', async () => {
    await expect(service.verifyAndActivate({ ...input, orderId: 'order_mock_attack', signature: 'anything' })).rejects.toThrow();
  });
  it('fails closed when keys are missing', async () => {
    vi.stubEnv('RAZORPAY_KEY_SECRET', '');
    service = new SubscriptionService(database);
    await expect(service.createOrder('tenant-a', 'starter_monthly')).rejects.toThrow();
  });
  it('does not extend a license twice for the same payment', async () => {
    const first = await service.verifyAndActivate(input);
    const second = await service.verifyAndActivate(input);
    expect(second.validUntil).toBe(first.validUntil);
  });
  it('rejects payment for a different tenant or plan', async () => {
    await expect(service.verifyAndActivate({ ...input, tenantId: 'tenant-b' })).rejects.toThrow();
    await expect(service.verifyAndActivate({ ...input, planKey: 'pro_yearly' })).rejects.toThrow();
  });
  it('rejects authorized but uncaptured payments', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ id: input.paymentId, order_id: input.orderId, status: 'authorized' }) })));
    await expect(service.verifyAndActivate(input)).rejects.toThrow();
  });
});

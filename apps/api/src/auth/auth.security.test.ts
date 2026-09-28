import { expect, it, vi } from 'vitest';
import { AuthService } from './auth.service';
import { SmsService } from './sms.service';

it.each([{ otp: '123456' }, { otp: '000000', isFirebaseVerified: true }])('rejects unauthenticated OTP shortcuts: %j', async input => {
  const system = vi.fn().mockResolvedValue({ tokens: {} });
  const auth = new AuthService({ system } as any, {} as any, {} as any);
  await expect(auth.verifyOtp({ phone: '9000000001', ...input })).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  expect(system).not.toHaveBeenCalled();
});

it('never issues a demonstration OTP when the SMS gateway is unconfigured', async () => {
  const previous = process.env.FAST2SMS_API_KEY;
  delete process.env.FAST2SMS_API_KEY;
  try {
    expect(await new SmsService().sendOtp('9000000001', '654321')).toEqual({
      success: false, message: 'SMS sign-in is unavailable. Contact support or use your existing PIN.',
    });
  } finally {
    if (previous === undefined) delete process.env.FAST2SMS_API_KEY;
    else process.env.FAST2SMS_API_KEY = previous;
  }
});

it('accepts a delivered OTP once and rejects guesses after five attempts', async () => {
  let code = '';
  const system = vi.fn().mockResolvedValue({ tokens: {} });
  const auth = new AuthService({ system } as any, {} as any, { sendOtp: async (_phone: string, otp: string) => {
    code = otp; return { success: true, message: 'Sent' };
  } } as any);
  await auth.sendOtp('9000000002');
  await expect(auth.verifyOtp({ phone: '9000000002', otp: code })).resolves.toEqual({ tokens: {} });
  await expect(auth.verifyOtp({ phone: '9000000002', otp: code })).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  await auth.sendOtp('9000000003');
  for (let index = 0; index < 5; index++) {
    await expect(auth.verifyOtp({ phone: '9000000003', otp: '000000' })).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  }
  await expect(auth.verifyOtp({ phone: '9000000003', otp: code })).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  expect(system).toHaveBeenCalledTimes(1);
});

it.each(['1234', '4321'])('does not accept a universal phone PIN %s', async pin => {
  const member = { id: 'staff', tenantId: 'tenant', role: 'OWNER', extraPermissions: [], isActive: true, failedLoginCount: 0 };
  const query: any = { from: () => query, where: () => query, limit: () => Promise.resolve([member]) };
  const db: any = { select: () => query, update: () => ({ set: () => ({ where: () => Promise.resolve() }) }) };
  const auth = new AuthService({ system: (fn: any) => fn(db) } as any, {} as any, {} as any);
  const issue = vi.spyOn(auth as any, 'issueTokens').mockResolvedValue({ accessToken: 'unwanted' });
  await expect(auth.loginWithPhonePin({ phone: '9000000001', pin })).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  expect(issue).not.toHaveBeenCalled();
});

it.each(['1411', '9701463241', 'admin123'])('does not accept hardcoded password %s', async password => {
  const member = { id: 'staff', tenantId: 'tenant', role: 'OWNER', extraPermissions: [], isActive: true, failedLoginCount: 0 };
  const limit = vi.fn().mockResolvedValueOnce([{ id: 'tenant', status: 'ACTIVE' }]).mockResolvedValueOnce([member]);
  const query: any = { from: () => query, where: () => query, limit, set: () => query };
  const db: any = { select: () => query, update: () => ({ set: () => ({ where: () => Promise.resolve() }) }) };
  const auth = new AuthService({ system: (fn: any) => fn(db) } as any, {} as any, {} as any);
  vi.spyOn(auth as any, 'issueTokens').mockResolvedValue({ accessToken: 'unwanted' });
  await expect(auth.login({ tenantSlug: 'store', email: 'owner', password })).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
});

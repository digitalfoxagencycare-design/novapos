import { describe, expect, it, vi } from 'vitest';
import { UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from './guards';
import type { JwtClaims } from '@novapos/shared';

const claims: JwtClaims = {
  sub: 'owner-id',
  tenantId: 'tenant-id',
  outletId: null,
  role: 'OWNER',
  perms: ['report:read'],
  supportSessionId: 'support-id',
  platformAdminId: 'admin-id',
};

function requestContext(request: Record<string, any>) {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({ getRequest: () => request }),
  } as any;
}

describe('tenant support authentication', () => {
  it('validates and records each support request before allowing it through', async () => {
    const request = {
      headers: { authorization: 'Bearer support-token', 'x-request-id': 'req-1', 'user-agent': 'test-agent' },
      method: 'PATCH',
      path: '/menu/items/item-id',
      route: { path: '/menu/items/:id' },
      ip: '127.0.0.1',
    };
    const auth = { verifyAccessToken: vi.fn(() => claims) };
    const platform = {
      validateImpersonationToken: vi.fn().mockResolvedValue({ sessionId: 'support-id', platformAdminId: 'admin-id', tenantId: 'tenant-id', reason: 'Support case 42' }),
      recordImpersonatedRequest: vi.fn().mockResolvedValue(undefined),
    };
    const guard = new AuthGuard(auth as any, { getAllAndOverride: () => undefined } as any, platform as any);

    await expect(guard.canActivate(requestContext(request))).resolves.toBe(true);
    expect(platform.validateImpersonationToken).toHaveBeenCalledWith(claims);
    expect(platform.recordImpersonatedRequest).toHaveBeenCalledWith(
      expect.objectContaining({ sessionId: 'support-id', platformAdminId: 'admin-id', requestId: 'req-1' }),
      'PATCH',
      '/menu/items/:id',
    );
    expect(request.tenantContext).toMatchObject({
      tenantId: 'tenant-id',
      staffId: 'owner-id',
      role: 'OWNER',
      platformAdminId: 'admin-id',
      impersonationSessionId: 'support-id',
    });
  });

  it('fails closed when the support session is revoked', async () => {
    const auth = { verifyAccessToken: vi.fn(() => claims) };
    const platform = {
      validateImpersonationToken: vi.fn().mockRejectedValue(new UnauthorizedException('Support session is revoked or expired.')),
      recordImpersonatedRequest: vi.fn(),
    };
    const guard = new AuthGuard(auth as any, { getAllAndOverride: () => undefined } as any, platform as any);

    await expect(guard.canActivate(requestContext({ headers: { authorization: 'Bearer support-token' } }))).rejects.toThrow('revoked or expired');
    expect(platform.recordImpersonatedRequest).not.toHaveBeenCalled();
  });

  it('does not make a database support-session check for a standard tenant token', async () => {
    const standardClaims = { ...claims, supportSessionId: undefined, platformAdminId: undefined };
    const platform = {
      validateImpersonationToken: vi.fn(),
      recordImpersonatedRequest: vi.fn(),
    };
    const guard = new AuthGuard({ verifyAccessToken: () => standardClaims } as any, { getAllAndOverride: () => undefined } as any, platform as any);

    await expect(guard.canActivate(requestContext({ headers: { authorization: 'Bearer tenant-token' } }))).resolves.toBe(true);
    expect(platform.validateImpersonationToken).not.toHaveBeenCalled();
    expect(platform.recordImpersonatedRequest).not.toHaveBeenCalled();
  });
});

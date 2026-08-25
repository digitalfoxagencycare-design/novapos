import {
  CanActivate, ExecutionContext, Injectable, SetMetadata, createParamDecorator,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthService } from './auth.service';
import { Errors } from '../common/errors';
import { runWithTenant, type TenantContext } from '../tenancy/tenant-context';
import type { Permission } from '@novapos/shared';
import { randomUUID } from 'node:crypto';

/** Mark a route as reachable without a token (login, health, docs). */
export const PUBLIC_KEY = 'novapos:public';
export const Public = () => SetMetadata(PUBLIC_KEY, true);

/** Require one or more permissions. All listed permissions must be held. */
export const PERMISSIONS_KEY = 'novapos:permissions';
export const RequirePermissions = (...perms: Permission[]) => SetMetadata(PERMISSIONS_KEY, perms);

/**
 * Verifies the bearer token, then runs the whole request inside the tenant
 * context so that every database query below it is automatically scoped.
 *
 * Establishing the context here — at the single entry point — rather than in
 * each controller is what makes it impossible to serve a request without
 * tenant scoping.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly auth: AuthService,
    private readonly reflector: Reflector,
  ) {}

  canActivate(context: ExecutionContext): boolean | Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(PUBLIC_KEY, [
      context.getHandler(), context.getClass(),
    ]);

    const req = context.switchToHttp().getRequest();
    const requestId = req.headers['x-request-id'] ?? randomUUID();
    req.requestId = requestId;

    if (isPublic) return true;

    const header: string | undefined = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) throw Errors.unauthorized('Missing bearer token.');

    const claims = this.auth.verifyAccessToken(header.slice(7));

    // An operator working a specific till can pin the request to an outlet;
    // it must be one they are entitled to.
    const requestedOutlet = req.headers['x-outlet-id'] as string | undefined;
    if (requestedOutlet && claims.outletId && requestedOutlet !== claims.outletId) {
      throw Errors.forbidden('act on behalf of another outlet');
    }

    const ctx: TenantContext = {
      tenantId: claims.tenantId,
      staffId: claims.sub,
      outletId: requestedOutlet ?? claims.outletId,
      role: claims.role,
      permissions: claims.perms,
      requestId,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    };
    req.tenantContext = ctx;

    // The handler and everything it awaits run inside this context.
    return runWithTenant(ctx, () => {
      const required = this.reflector.getAllAndOverride<Permission[]>(PERMISSIONS_KEY, [
        context.getHandler(), context.getClass(),
      ]);
      if (required?.length) {
        const missing = required.filter((p) => !ctx.permissions.includes(p));
        if (missing.length) throw Errors.forbidden(missing.join(', '));
      }
      return true;
    });
  }
}

/** Inject the current tenant context into a controller method. */
export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): TenantContext => {
  return ctx.switchToHttp().getRequest().tenantContext;
});

import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { runWithTenant } from '../tenancy/tenant-context';

/**
 * Re-establishes the tenant context around the handler's observable.
 *
 * The guard runs the *synchronous* permission check inside the context, but a
 * guard's AsyncLocalStorage scope does not extend to the handler that runs
 * afterwards. This interceptor closes that gap, so services can rely on the
 * context being present without every controller re-wrapping.
 */
@Injectable()
export class TenantContextInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest();
    const tenantContext = req?.tenantContext;
    if (!tenantContext) return next.handle();
    return runWithTenant(tenantContext, () => next.handle());
  }
}

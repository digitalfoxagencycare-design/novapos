import { Controller, ForbiddenException, Get, Injectable, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { and, asc, eq, isNull } from 'drizzle-orm';
import { DatabaseService } from '../db/db.service';
import { outlets } from '../db/schema';
import { CurrentUser, RequirePermissions } from '../auth/guards';
import type { TenantContext } from '../tenancy/tenant-context';

@Injectable()
export class OutletsService {
  constructor(private readonly db: DatabaseService) {}

  /**
   * Outlets the caller may work at.
   */
  async listForUser(user: TenantContext) {
    return this.db.tx(async (db) =>
      db.select({
        id: outlets.id, name: outlets.name, code: outlets.code,
        currency: outlets.currency, locale: outlets.locale,
        city: outlets.city, region: outlets.region, country: outlets.country,
      }).from(outlets)
        .where(and(
          eq(outlets.tenantId, user.tenantId),
          eq(outlets.isActive, true),
          isNull(outlets.deletedAt),
          ...(user.outletId ? [eq(outlets.id, user.outletId)] : []),
        ))
        .orderBy(asc(outlets.name)),
    );
  }

  // Tenant permissions never authorize cross-tenant platform operations.
  // Retain explicit 403 responses for old clients until platform auth is implemented.
  async listAllMerchants() {
    throw new ForbiddenException('Platform administration is not available to tenant sessions.');
  }

  async activateMerchant(_tenantId: string) {
    throw new ForbiddenException('Platform administration is not available to tenant sessions.');
  }

  async deactivateMerchant(_tenantId: string) {
    throw new ForbiddenException('Platform administration is not available to tenant sessions.');
  }

}

@ApiTags('outlets')
@Controller('outlets')
export class OutletsController {
  constructor(private readonly outlets: OutletsService) {}

  @Get()
  @RequirePermissions('outlet:read')
  @ApiOperation({ summary: 'Outlets the signed-in operator may work at' })
  list(@CurrentUser() user: TenantContext) {
    return this.outlets.listForUser(user);
  }

  @Get('merchants')
  @RequirePermissions('settings:read')
  @ApiOperation({ summary: 'All registered merchants/stores overview for admin' })
  listMerchants() {
    return this.outlets.listAllMerchants();
  }

  @Post('merchants/:tenantId/activate')
  @RequirePermissions('settings:read')
  @ApiOperation({ summary: 'Activate merchant subscription' })
  activate(@Param('tenantId') tenantId: string) {
    return this.outlets.activateMerchant(tenantId);
  }

  @Post('merchants/:tenantId/deactivate')
  @RequirePermissions('settings:read')
  @ApiOperation({ summary: 'Deactivate / suspend merchant subscription' })
  deactivate(@Param('tenantId') tenantId: string) {
    return this.outlets.deactivateMerchant(tenantId);
  }
}

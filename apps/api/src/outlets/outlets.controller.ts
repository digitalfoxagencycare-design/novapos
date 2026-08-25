import { Controller, Get, Injectable } from '@nestjs/common';
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
   *
   * A staff member pinned to one outlet sees only that one, so a device cannot
   * be bound to a branch its operator has no business at. RLS already confines
   * this to the caller's tenant; the outlet filter narrows it further.
   */
  async listForUser(user: TenantContext) {
    return this.db.tx(async (db) =>
      db.select({
        id: outlets.id, name: outlets.name, code: outlets.code,
        currency: outlets.currency, locale: outlets.locale,
        city: outlets.city, region: outlets.region, country: outlets.country,
      }).from(outlets)
        .where(and(
          eq(outlets.isActive, true),
          isNull(outlets.deletedAt),
          ...(user.outletId ? [eq(outlets.id, user.outletId)] : []),
        ))
        .orderBy(asc(outlets.name)),
    );
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
}

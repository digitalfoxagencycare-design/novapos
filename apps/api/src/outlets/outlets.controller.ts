import { Controller, Get, Injectable } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { and, asc, eq, isNull } from 'drizzle-orm';
import { DatabaseService } from '../db/db.service';
import { outlets, tenants, staff as staffTable } from '../db/schema';
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

  /**
   * System-wide overview of all registered stores & merchants for Admin dashboard.
   */
  async listAllMerchants() {
    return this.db.system(async (db) => {
      const allTenants = await db.select().from(tenants);
      const allStaff = await db.select().from(staffTable);
      const allOutlets = await db.select().from(outlets);

      return allTenants.map((t) => {
        const owner = allStaff.find((s) => s.tenantId === t.id && (s.role === 'OWNER' || s.role === 'MANAGER')) ||
                      allStaff.find((s) => s.tenantId === t.id);
        const tenantOutlets = allOutlets.filter((o) => o.tenantId === t.id);
        const sub = (t.settings as any)?.subscription || {};
        return {
          id: t.id,
          name: t.name,
          slug: t.slug,
          phone: owner?.phone || tenantOutlets[0]?.phone || '—',
          ownerName: owner?.name || 'Store Owner',
          status: t.status,
          plan: sub.plan || 'starter_monthly',
          subscriptionStatus: sub.status || 'TRIAL',
          validUntil: sub.validUntil,
          createdAt: t.createdAt,
          outletsCount: tenantOutlets.length,
        };
      });
    });
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
}

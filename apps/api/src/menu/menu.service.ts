import { Injectable } from '@nestjs/common';
import { and, asc, eq, ilike, isNull, sql } from 'drizzle-orm';
import { DatabaseService } from '../db/db.service';
import {
  categories, menuItems, menuItemVariants, modifierGroups, modifiers,
  stations, restaurantTables, tableSections, outlets,
} from '../db/schema';
import { AuditService } from '../common/audit.service';
import { Errors } from '../common/errors';
import { requireTenantContext } from '../tenancy/tenant-context';

/**
 * Menu management.
 *
 * `snapshot()` is the important one: the POS pulls the whole menu in a single
 * call and caches it locally, which is what lets it keep taking and pricing
 * orders with no network at all.
 */
@Injectable()
export class MenuService {
  constructor(
    private readonly db: DatabaseService,
    private readonly audit: AuditService,
  ) {}

  /** Everything a POS device needs to price an order offline. */
  async snapshot(outletId: string) {
    return this.db.tx(async (db) => {
      const [outlet] = await db.select().from(outlets)
        .where(and(eq(outlets.id, outletId), isNull(outlets.deletedAt))).limit(1);
      if (!outlet) throw Errors.notFound('Outlet', outletId);

      const [cats, items, variants, groups, mods, stns, tables, sections] = await Promise.all([
        db.select().from(categories)
          .where(and(eq(categories.tenantId, outlet.tenantId), eq(categories.isActive, true), isNull(categories.deletedAt)))
          .orderBy(asc(categories.sortOrder)),
        db.select().from(menuItems)
          .where(and(eq(menuItems.tenantId, outlet.tenantId), eq(menuItems.isActive, true), isNull(menuItems.deletedAt)))
          .orderBy(asc(menuItems.sortOrder)),
        db.select().from(menuItemVariants).where(and(eq(menuItemVariants.tenantId, outlet.tenantId), eq(menuItemVariants.isActive, true))),
        db.select().from(modifierGroups).where(and(eq(modifierGroups.tenantId, outlet.tenantId), eq(modifierGroups.isActive, true))),
        db.select().from(modifiers).where(and(eq(modifiers.tenantId, outlet.tenantId), eq(modifiers.isActive, true))).orderBy(asc(modifiers.sortOrder)),
        db.select().from(stations)
          .where(and(eq(stations.outletId, outletId), eq(stations.isActive, true)))
          .orderBy(asc(stations.sortOrder)),
        db.select().from(restaurantTables)
          .where(and(eq(restaurantTables.outletId, outletId), eq(restaurantTables.isActive, true))),
        db.select().from(tableSections)
          .where(eq(tableSections.outletId, outletId))
          .orderBy(asc(tableSections.sortOrder)),
      ]);

      const variantsByItem = new Map<string, typeof variants>();
      for (const v of variants) {
        const list = variantsByItem.get(v.itemId) ?? [];
        list.push(v);
        variantsByItem.set(v.itemId, list);
      }
      const modsByGroup = new Map<string, typeof mods>();
      for (const m of mods) {
        const list = modsByGroup.get(m.groupId) ?? [];
        list.push(m);
        modsByGroup.set(m.groupId, list);
      }

      /**
       * A content version the device can compare before downloading again.
       * The newest updatedAt across the menu tables is enough: any edit moves
       * it, and the device only needs "did anything change", not "what".
       */
      const version = [...cats, ...items].reduce(
        (max, r) => (r.updatedAt > max ? r.updatedAt : max),
        new Date(0),
      ).toISOString();

      return {
        version,
        outlet,
        categories: cats,
        items: items.map((i) => ({ ...i, variants: variantsByItem.get(i.id) ?? [] })),
        modifierGroups: groups.map((g) => ({ ...g, modifiers: modsByGroup.get(g.id) ?? [] })),
        stations: stns,
        tables,
        sections,
      };
    });
  }

  async listItems(filter: { categoryId?: string; search?: string } = {}) {
    return this.db.tx(async (db) => {
      const conditions = [isNull(menuItems.deletedAt)];
      if (filter.categoryId) conditions.push(eq(menuItems.categoryId, filter.categoryId));
      if (filter.search) conditions.push(ilike(menuItems.name, `%${filter.search}%`));
      return db.select().from(menuItems).where(and(...conditions)).orderBy(asc(menuItems.sortOrder));
    });
  }

  async createItem(data: {
    name: string; categoryId: string; priceMinor: number; taxSlabId: string;
    code?: string; hsnSac?: string; stationId?: string; description?: string;
    isVeg?: boolean; prepMinutes?: number; nameI18n?: Record<string, string>;
  }) {
    const ctx = requireTenantContext();
    const item = await this.db.tx(async (db) => {
      const [category] = await db.select().from(categories)
        .where(eq(categories.id, data.categoryId)).limit(1);
      if (!category) throw Errors.notFound('Category', data.categoryId);

      const [created] = await db.insert(menuItems).values({
        tenantId: ctx.tenantId,
        name: data.name,
        categoryId: data.categoryId,
        priceMinor: data.priceMinor,
        taxSlabId: data.taxSlabId,
        code: data.code,
        hsnSac: data.hsnSac,
        stationId: data.stationId,
        description: data.description,
        isVeg: data.isVeg,
        prepMinutes: data.prepMinutes,
        nameI18n: data.nameI18n ?? {},
      }).returning();
      return created;
    });

    await this.audit.record({
      action: 'menu.item.create', entityType: 'MenuItem', entityId: item.id,
      detail: { name: item.name, priceMinor: item.priceMinor },
    });
    return item;
  }

  async updateItem(id: string, data: Record<string, unknown>) {
    const result = await this.db.tx(async (db) => {
      const [before] = await db.select().from(menuItems).where(eq(menuItems.id, id)).limit(1);
      if (!before) throw Errors.notFound('Menu item', id);
      const [after] = await db.update(menuItems)
        .set(data as never)
        .where(eq(menuItems.id, id))
        .returning();
      return { before, after };
    });

    await this.audit.record({
      action: 'menu.item.update', entityType: 'MenuItem', entityId: id,
      detail: {
        before: { priceMinor: result.before.priceMinor, taxSlabId: result.before.taxSlabId },
        after: data,
      },
    });
    return result.after;
  }

  /**
   * Soft-delete only. Menu items are referenced by historical order lines, so
   * a hard delete would make an old bill unreprintable — and in most of the
   * jurisdictions this ships to, that is a records-retention violation.
   */
  async archiveItem(id: string) {
    const item = await this.db.tx(async (db) => {
      const [existing] = await db.select().from(menuItems).where(eq(menuItems.id, id)).limit(1);
      if (!existing) throw Errors.notFound('Menu item', id);
      const [updated] = await db.update(menuItems)
        .set({ deletedAt: new Date(), isActive: false })
        .where(eq(menuItems.id, id))
        .returning();
      return updated;
    });
    await this.audit.record({ action: 'menu.item.archive', entityType: 'MenuItem', entityId: id });
    return item;
  }

  /**
   * Categories with a live item count.
   *
   * A LEFT JOIN rather than a correlated subquery, for two reasons. It is one
   * pass instead of one query per category — but more importantly, Drizzle
   * interpolates a column reference inside a raw `sql` template *unqualified*
   * (`"id"`, not `"categories"."id"`). Inside a subquery over `menu_items`,
   * which has its own `id`, that silently resolved to `mi.category_id = mi.id`
   * and every count came back zero. No error, just wrong numbers on screen.
   */
  async listCategories() {
    return this.db.tx(async (db) =>
      db.select({
        id: categories.id,
        name: categories.name,
        code: categories.code,
        sortOrder: categories.sortOrder,
        colour: categories.colour,
        stationId: categories.stationId,
        isActive: categories.isActive,
        itemCount: sql<number>`count(${menuItems.id})::int`,
      }).from(categories)
        .leftJoin(
          menuItems,
          and(eq(menuItems.categoryId, categories.id), isNull(menuItems.deletedAt)),
        )
        .where(isNull(categories.deletedAt))
        .groupBy(categories.id)
        .orderBy(asc(categories.sortOrder)),
    );
  }

  async createCategory(data: { name: string; sortOrder?: number; stationId?: string; colour?: string; code?: string }) {
    const ctx = requireTenantContext();
    return this.db.tx(async (db) => {
      const [row] = await db.insert(categories)
        .values({ ...data, tenantId: ctx.tenantId })
        .returning();
      return row;
    });
  }
}

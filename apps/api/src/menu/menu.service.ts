import { Injectable } from '@nestjs/common';
import { and, asc, eq, ilike, inArray, isNull, sql } from 'drizzle-orm';
import { DatabaseService } from '../db/db.service';
import type { Db } from '../db/client';
import {
  categories, menuItems, menuItemVariants, modifierGroups, modifiers, menuItemModifierGroups,
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
      const itemGroupLinks = items.length
        ? await db.select().from(menuItemModifierGroups)
          .where(and(
            eq(menuItemModifierGroups.tenantId, outlet.tenantId),
            inArray(menuItemModifierGroups.itemId, items.map(item => item.id)),
          ))
        : [];

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
      const groupIdsByItem = new Map<string, string[]>();
      for (const link of itemGroupLinks) {
        const list = groupIdsByItem.get(link.itemId) ?? [];
        list.push(link.groupId);
        groupIdsByItem.set(link.itemId, list);
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
        items: items.map((i) => ({
          ...i,
          variants: variantsByItem.get(i.id) ?? [],
          modifierGroupIds: groupIdsByItem.get(i.id) ?? [],
        })),
        modifierGroups: groups.map((g) => ({ ...g, modifiers: modsByGroup.get(g.id) ?? [] })),
        stations: stns,
        tables,
        sections,
      };
    });
  }

  async listItems(filter: { categoryId?: string; search?: string } = {}) {
    const ctx = requireTenantContext();
    return this.db.tx(async (db) => {
      const conditions = [eq(menuItems.tenantId, ctx.tenantId), isNull(menuItems.deletedAt)];
      if (filter.categoryId) conditions.push(eq(menuItems.categoryId, filter.categoryId));
      if (filter.search) conditions.push(ilike(menuItems.name, `%${filter.search}%`));
      const rows = await db.select().from(menuItems).where(and(...conditions)).orderBy(asc(menuItems.sortOrder));
      return this.withEditorData(db, rows);
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

  async updateItem(id: string, data: {
    name?: string;
    description?: string | null;
    categoryId?: string;
    priceMinor?: number;
    packagingChargeMinor?: number;
    taxSlabId?: string;
    hsnSac?: string | null;
    isActive?: boolean;
    variants?: {
      id?: string; name: string; priceMinor?: number | null;
      priceDeltaMinor?: number; isDefault?: boolean;
    }[];
    modifierGroups?: {
      id?: string; name: string; minSelect?: number; maxSelect?: number;
      modifiers: { id?: string; name: string; priceMinor?: number }[];
    }[];
  }) {
    const ctx = requireTenantContext();
    const result = await this.db.tx(async (db) => {
      const [before] = await db.select().from(menuItems)
        .where(and(eq(menuItems.id, id), eq(menuItems.tenantId, ctx.tenantId), isNull(menuItems.deletedAt)))
        .limit(1);
      if (!before) throw Errors.notFound('Menu item', id);

      if (data.categoryId) {
        const [category] = await db.select({ id: categories.id }).from(categories)
          .where(and(
            eq(categories.id, data.categoryId),
            eq(categories.tenantId, ctx.tenantId),
            isNull(categories.deletedAt),
          ))
          .limit(1);
        if (!category) throw Errors.notFound('Category', data.categoryId);
      }

      const { variants: variantInputs, modifierGroups: groupInputs, ...itemInput } = data;
      const patch: Partial<typeof menuItems.$inferInsert> = {
        ...itemInput,
        updatedAt: new Date(),
      };
      const [updated] = await db.update(menuItems).set(patch)
        .where(and(eq(menuItems.id, id), eq(menuItems.tenantId, ctx.tenantId)))
        .returning();

      if (variantInputs) {
        if (variantInputs.filter(variant => variant.isDefault).length > 1) {
          throw Errors.validation('Only one variant can be the default option.');
        }
        const seen = new Set<string>();
        for (const variant of variantInputs) {
          if (variant.id && seen.has(variant.id)) throw Errors.validation('A menu variant was submitted more than once.');
          if (variant.id) seen.add(variant.id);
        }
        await db.update(menuItemVariants).set({ isActive: false })
          .where(and(eq(menuItemVariants.itemId, id), eq(menuItemVariants.tenantId, ctx.tenantId)));
        for (const [sortOrder, variant] of variantInputs.entries()) {
          if (variant.id) {
            const [existing] = await db.select({ id: menuItemVariants.id }).from(menuItemVariants)
              .where(and(
                eq(menuItemVariants.id, variant.id),
                eq(menuItemVariants.itemId, id),
                eq(menuItemVariants.tenantId, ctx.tenantId),
              ))
              .limit(1);
            if (!existing) throw Errors.notFound('Menu variant', variant.id);
            await db.update(menuItemVariants).set({
              name: variant.name,
              priceMinor: variant.priceMinor ?? null,
              priceDeltaMinor: variant.priceDeltaMinor ?? 0,
              isDefault: variant.isDefault ?? false,
              isActive: true,
              sortOrder,
            }).where(and(
              eq(menuItemVariants.id, variant.id),
              eq(menuItemVariants.itemId, id),
              eq(menuItemVariants.tenantId, ctx.tenantId),
            ));
          } else {
            await db.insert(menuItemVariants).values({
              tenantId: ctx.tenantId,
              itemId: id,
              name: variant.name,
              priceMinor: variant.priceMinor ?? null,
              priceDeltaMinor: variant.priceDeltaMinor ?? 0,
              isDefault: variant.isDefault ?? false,
              sortOrder,
            });
          }
        }
      }

      if (groupInputs) {
        await db.delete(menuItemModifierGroups).where(and(
          eq(menuItemModifierGroups.itemId, id),
          eq(menuItemModifierGroups.tenantId, ctx.tenantId),
        ));
        const seenGroupIds = new Set<string>();
        for (const [sortOrder, group] of groupInputs.entries()) {
          const minSelect = group.minSelect ?? 0;
          const maxSelect = group.maxSelect ?? 1;
          if (minSelect > maxSelect) {
            throw Errors.validation(`Modifier group "${group.name}" cannot require more selections than its maximum.`);
          }
          if (group.id && seenGroupIds.has(group.id)) throw Errors.validation('A modifier group was submitted more than once.');

          let groupId = group.id;
          if (groupId) {
            seenGroupIds.add(groupId);
            const [existing] = await db.select({ id: modifierGroups.id }).from(modifierGroups)
              .where(and(eq(modifierGroups.id, groupId), eq(modifierGroups.tenantId, ctx.tenantId)))
              .limit(1);
            if (!existing) throw Errors.notFound('Modifier group', groupId);
            await db.update(modifierGroups).set({
              name: group.name,
              minSelect,
              maxSelect,
              isActive: true,
            }).where(and(eq(modifierGroups.id, groupId), eq(modifierGroups.tenantId, ctx.tenantId)));
          } else {
            const [created] = await db.insert(modifierGroups).values({
              tenantId: ctx.tenantId,
              name: group.name,
              minSelect,
              maxSelect,
            }).returning({ id: modifierGroups.id });
            groupId = created.id;
          }
          const optionIds = new Set<string>();
          for (const option of group.modifiers) {
            if (option.id && optionIds.has(option.id)) throw Errors.validation('A modifier was submitted more than once.');
            if (option.id) optionIds.add(option.id);
          }
          await db.update(modifiers).set({ isActive: false })
            .where(and(eq(modifiers.groupId, groupId), eq(modifiers.tenantId, ctx.tenantId)));
          for (const [modifierOrder, option] of group.modifiers.entries()) {
            if (option.id) {
              const [existing] = await db.select({ id: modifiers.id }).from(modifiers)
                .where(and(
                  eq(modifiers.id, option.id),
                  eq(modifiers.groupId, groupId),
                  eq(modifiers.tenantId, ctx.tenantId),
                ))
                .limit(1);
              if (!existing) throw Errors.notFound('Modifier', option.id);
              await db.update(modifiers).set({
                name: option.name,
                priceMinor: option.priceMinor ?? 0,
                sortOrder: modifierOrder,
                isActive: true,
              }).where(and(
                eq(modifiers.id, option.id),
                eq(modifiers.groupId, groupId),
                eq(modifiers.tenantId, ctx.tenantId),
              ));
            } else {
              await db.insert(modifiers).values({
                tenantId: ctx.tenantId,
                groupId,
                name: option.name,
                priceMinor: option.priceMinor ?? 0,
                sortOrder: modifierOrder,
              });
            }
          }
          await db.insert(menuItemModifierGroups).values({
            tenantId: ctx.tenantId, itemId: id, groupId, sortOrder,
          });
        }
      }

      const [after] = await this.withEditorData(db, [updated]);
      return { before, after };
    });

    await this.audit.record({
      action: 'menu.item.update', entityType: 'MenuItem', entityId: id,
      detail: {
        before: { priceMinor: result.before.priceMinor, taxSlabId: result.before.taxSlabId },
        after: {
          ...data,
          variants: data.variants?.length,
          modifierGroups: data.modifierGroups?.length,
        },
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
    const ctx = requireTenantContext();
    const item = await this.db.tx(async (db) => {
      const [existing] = await db.select().from(menuItems)
        .where(and(eq(menuItems.id, id), eq(menuItems.tenantId, ctx.tenantId), isNull(menuItems.deletedAt)))
        .limit(1);
      if (!existing) throw Errors.notFound('Menu item', id);
      const [updated] = await db.update(menuItems)
        .set({ deletedAt: new Date(), isActive: false })
        .where(and(eq(menuItems.id, id), eq(menuItems.tenantId, ctx.tenantId)))
        .returning();
      return updated;
    });
    await this.audit.record({ action: 'menu.item.archive', entityType: 'MenuItem', entityId: id });
    return item;
  }

  private async withEditorData(db: Db, items: (typeof menuItems.$inferSelect)[]) {
    if (!items.length) return [];
    const itemIds = items.map(item => item.id);
    const variants = await db.select().from(menuItemVariants)
      .where(and(inArray(menuItemVariants.itemId, itemIds), eq(menuItemVariants.tenantId, requireTenantContext().tenantId)))
      .orderBy(asc(menuItemVariants.sortOrder));
    const links = await db.select({
      itemId: menuItemModifierGroups.itemId,
      id: modifierGroups.id,
      groupId: modifierGroups.id,
      sortOrder: menuItemModifierGroups.sortOrder,
      name: modifierGroups.name,
      minSelect: modifierGroups.minSelect,
      maxSelect: modifierGroups.maxSelect,
      isActive: modifierGroups.isActive,
    }).from(menuItemModifierGroups)
      .innerJoin(modifierGroups, eq(menuItemModifierGroups.groupId, modifierGroups.id))
      .where(and(
        inArray(menuItemModifierGroups.itemId, itemIds),
        eq(menuItemModifierGroups.tenantId, requireTenantContext().tenantId),
        eq(modifierGroups.tenantId, requireTenantContext().tenantId),
      ))
      .orderBy(asc(menuItemModifierGroups.sortOrder));
    const groupIds = [...new Set(links.map(link => link.groupId))];
    const options = groupIds.length
      ? await db.select().from(modifiers)
        .where(and(inArray(modifiers.groupId, groupIds), eq(modifiers.tenantId, requireTenantContext().tenantId)))
        .orderBy(asc(modifiers.sortOrder))
      : [];
    const optionsByGroup = new Map<string, typeof options>();
    for (const option of options) {
      const rows = optionsByGroup.get(option.groupId) ?? [];
      rows.push(option);
      optionsByGroup.set(option.groupId, rows);
    }
    const variantsByItem = new Map<string, typeof variants>();
    for (const variant of variants) {
      const rows = variantsByItem.get(variant.itemId) ?? [];
      rows.push(variant);
      variantsByItem.set(variant.itemId, rows);
    }
    const linksByItem = new Map<string, typeof links>();
    for (const link of links) {
      const rows = linksByItem.get(link.itemId) ?? [];
      rows.push(link);
      linksByItem.set(link.itemId, rows);
    }
    return items.map(item => ({
      ...item,
      variants: variantsByItem.get(item.id) ?? [],
      modifierGroups: (linksByItem.get(item.id) ?? []).map(group => ({
        ...group,
        modifiers: optionsByGroup.get(group.groupId) ?? [],
      })),
    }));
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

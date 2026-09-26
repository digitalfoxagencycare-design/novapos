import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { findRuleSet } from '@novapos/tax-engine';
import type { TaxRuleSet } from '@novapos/tax-engine';
import type { OrderChannel } from '@novapos/shared';
import { db, enqueue, setSetting, getSetting, type LocalOrder, type LocalLine } from './db';
import { addLine, priceCart, setQuantity, voidLine, unfiredLines } from './cart';
import { ApiClient, OfflineError } from './api';
import { SyncEngine, type SyncStatus } from './sync';

/**
 * Application state.
 *
 * Deliberately plain React state over Dexie rather than a state library: the
 * source of truth is IndexedDB, not memory, because the tab can be closed
 * mid-order and the till must come back with the tab intact.
 */

export interface MenuSnapshot {
  version: string;
  outlet: {
    id: string; name: string; currency: string | null; locale: string | null;
    country: string; region: string | null; taxRuleSetKey: string | null;
    serviceChargePercent: string;
  };
  categories: { id: string; name: string; colour: string | null; sortOrder: number; stationId: string | null }[];
  items: MenuItem[];
  modifierGroups: {
    id: string; name: string; minSelect: number; maxSelect: number;
    modifiers: { id: string; name: string; priceMinor: number }[];
  }[];
  stations: { id: string; name: string; code: string }[];
  tables: { id: string; label: string; seats: number; status: string; sectionId: string | null }[];
  sections: { id: string; name: string }[];
}

export interface MenuItem {
  id: string;
  categoryId: string;
  name: string;
  priceMinor: number;
  taxSlabId: string;
  hsnSac: string | null;
  isVeg: boolean | null;
  stationId: string | null;
  channelPrices: Record<string, number>;
  variants: { id: string; name: string; priceMinor: number | null; priceDeltaMinor: number; isDefault: boolean }[];
}

export function newOrder(outletId: string, channel: OrderChannel, currency: string): LocalOrder {
  const now = new Date().toISOString();
  return {
    clientOrderId: crypto.randomUUID(),
    outletId,
    channel,
    status: 'DRAFT',
    tableIds: [],
    lines: [],
    tipMinor: 0,
    deliveryChargeMinor: 0,
    subtotalMinor: 0,
    discountMinor: 0,
    taxMinor: 0,
    roundingMinor: 0,
    totalMinor: 0,
    currency,
    placedAt: now,
    updatedAt: now,
    synced: false,
  };
}

export function usePos(api: ApiClient) {
  const [menu, setMenu] = useState<MenuSnapshot | null>(null);
  const [order, setOrder] = useState<LocalOrder | null>(null);
  const [openOrders, setOpenOrders] = useState<LocalOrder[]>([]);
  const [sync, setSync] = useState<SyncStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const engineRef = useRef<SyncEngine | null>(null);

  const outletId = menu?.outlet.id ?? null;

  /* ── menu, cached so the till survives a reload with no network ── */

  const loadMenu = useCallback(async (id: string) => {
    const cached = await db.menu.get(id);
    if (cached) setMenu(cached.payload as MenuSnapshot);

    try {
      const fresh = await api.menuSnapshot(id);
      // Skip the write when nothing changed — this runs on every start-up and
      // an unchanged menu is the common case.
      if (!cached || cached.version !== fresh.version) {
        await db.menu.put({
          outletId: id, version: fresh.version,
          fetchedAt: new Date().toISOString(), payload: fresh,
        });
      }
      setMenu(fresh);
    } catch (err) {
      if (!(err instanceof OfflineError)) {
        setError(`Could not refresh the menu: ${(err as Error).message}`);
      }
      // Offline with a cached menu is a working till, not an error state.
      if (!cached) {
        setError('No menu is cached on this device and the server cannot be reached.');
      }
    }
  }, [api]);

  /* ── sync engine ── */

  useEffect(() => {
    if (!outletId) return;
    const engine = new SyncEngine(
      { push: (ops) => api.push(ops), pull: (id, since) => api.pull(id, since) },
      outletId,
    );
    engineRef.current = engine;
    const unsubscribe = engine.subscribe(setSync);
    engine.start();
    return () => { unsubscribe(); engine.stop(); engineRef.current = null; };
  }, [api, outletId]);

  /* ── the running-tabs list, kept live from local storage ── */

  const refreshOpenOrders = useCallback(async () => {
    if (!outletId) return;
    const rows = await db.orders
      .where('outletId').equals(outletId)
      .filter((o) => ['DRAFT', 'OPEN', 'BILLED'].includes(o.status))
      .sortBy('placedAt');
    setOpenOrders(rows);
  }, [outletId]);

  useEffect(() => { void refreshOpenOrders(); }, [refreshOpenOrders, sync?.lastSyncAt]);

  /* ── the tax rule set the local pricer uses ── */

  const ruleSet: TaxRuleSet | null = useMemo(() => {
    if (!menu) return null;
    const key = menu.outlet.taxRuleSetKey ?? 'IN-GST';
    return findRuleSet(key) ?? null;
  }, [menu]);

  const totals = useMemo(() => {
    if (!order || !menu || !ruleSet) return null;
    try {
      const validSlabIds = new Set(ruleSet.slabs.map((s) => s.id));
      const defaultSlab = ruleSet.slabs[0]?.id ?? 'gst-5';
      const sanitizedLines = order.lines.map((l) => ({
        ...l,
        taxSlabId: validSlabIds.has(l.taxSlabId) ? l.taxSlabId : defaultSlab,
      }));

      return priceCart({
        lines: sanitizedLines,
        orderDiscount: order.orderDiscount,
        serviceChargePercent: order.serviceChargePercent ?? Number(menu.outlet.serviceChargePercent ?? 0),
        tipMinor: order.tipMinor,
        deliveryChargeMinor: order.deliveryChargeMinor,
        channel: order.channel,
        currency: order.currency,
        ruleSet,
        taxContext: {
          outletCountry: menu.outlet.country,
          outletRegion: menu.outlet.region,
          channel: order.channel,
        },
      });
    } catch (err) {
      setError((err as Error).message);
      return null;
    }
  }, [order, menu, ruleSet]);

  /* ── mutations. Every one writes locally first, then queues. ── */

  const persist = useCallback(async (next: LocalOrder) => {
    const stamped = { ...next, updatedAt: new Date().toISOString(), synced: false };
    await db.orders.put(stamped);
    setOrder(stamped);
    await refreshOpenOrders();
    return stamped;
  }, [refreshOpenOrders]);

  const startOrder = useCallback(async (channel: OrderChannel, tableIds: string[] = []) => {
    if (!menu) return null;
    const fresh = newOrder(menu.outlet.id, channel, menu.outlet.currency ?? 'INR');
    fresh.tableIds = tableIds;
    return persist(fresh);
  }, [menu, persist]);

  const addItem = useCallback(async (
    item: MenuItem,
    opts: { variantId?: string; modifiers?: { id: string; name: string; priceMinor: number }[]; notes?: string } = {},
  ) => {
    if (!order || !menu) return;
    const variant = opts.variantId ? item.variants.find((v) => v.id === opts.variantId) : null;
    const base = item.channelPrices?.[order.channel] ?? item.priceMinor;
    const unitPriceMinor = variant?.priceMinor ?? base + (variant?.priceDeltaMinor ?? 0);

    const line: LocalLine = {
      clientLineId: crypto.randomUUID(),
      itemId: item.id,
      variantId: variant?.id ?? null,
      name: variant ? `${item.name} (${variant.name})` : item.name,
      quantity: 1,
      unitPriceMinor,
      modifiers: opts.modifiers ?? [],
      taxSlabId: item.taxSlabId,
      hsnSac: item.hsnSac,
      stationId: item.stationId,
      notes: opts.notes ?? null,
      status: 'PENDING',
    };

    await persist({ ...order, lines: addLine(order.lines, line) });
  }, [order, menu, persist]);

  const changeQuantity = useCallback(async (clientLineId: string, quantity: number) => {
    if (!order) return;
    await persist({ ...order, lines: setQuantity(order.lines, clientLineId, quantity) });
  }, [order, persist]);

  const removeLine = useCallback(async (clientLineId: string) => {
    if (!order) return;
    await persist({ ...order, lines: voidLine(order.lines, clientLineId) });
  }, [order, persist]);

  /** Queue the order for the server. Safe to call repeatedly. */
  const saveOrder = useCallback(async () => {
    if (!order || !totals) return;
    const saved = await persist({
      ...order,
      subtotalMinor: totals.subtotalMinor,
      discountMinor: totals.discountMinor,
      taxMinor: totals.taxMinor,
      roundingMinor: totals.roundingMinor,
      totalMinor: totals.totalMinor,
    });

    await enqueue({
      opId: crypto.randomUUID(),
      type: 'order.upsert',
      occurredAt: new Date().toISOString(),
      payload: {
        clientOrderId: saved.clientOrderId,
        outletId: saved.outletId,
        channel: saved.channel,
        tableIds: saved.tableIds,
        customerId: saved.customerId ?? undefined,
        guestCount: saved.guestCount,
        notes: saved.notes ?? undefined,
        orderDiscount: saved.orderDiscount ?? undefined,
        tipMinor: saved.tipMinor,
        deliveryChargeMinor: saved.deliveryChargeMinor,
        placedAt: saved.placedAt,
        lines: saved.lines
          .filter((l) => l.status !== 'VOIDED')
          .map((l) => ({
            clientLineId: l.clientLineId,
            itemId: l.itemId,
            variantId: l.variantId ?? undefined,
            quantity: l.quantity,
            modifierIds: l.modifiers.map((m) => m.id),
            notes: l.notes ?? undefined,
            discount: l.discount ?? undefined,
          })),
      },
      attempts: 0,
    } as never);

    engineRef.current?.nudge();
    return saved;
  }, [order, totals, persist]);

  /**
   * Fire to the kitchen.
   *
   * Marked locally as fired straight away so the screen is truthful even
   * offline — the KOT will print when the link returns, and the operator can
   * see from the sync pill that it has not yet.
   */
  const fireOrder = useCallback(async () => {
    if (!order) return;
    const pending = unfiredLines(order);
    if (pending.length === 0) return;

    const saved = await saveOrder();
    if (!saved) return;

    const now = new Date().toISOString();
    await persist({
      ...saved,
      status: 'OPEN',
      lines: saved.lines.map((l) =>
        pending.some((p) => p.clientLineId === l.clientLineId)
          ? { ...l, status: 'FIRED' as const, firedAt: now }
          : l),
    });

    await enqueue({
      opId: crypto.randomUUID(),
      type: 'order.fire',
      occurredAt: now,
      payload: { clientOrderId: saved.clientOrderId, orderId: saved.serverId },
      attempts: 0,
    } as never);

    engineRef.current?.nudge();
  }, [order, saveOrder, persist]);

  return {
    menu, order, openOrders, sync, totals, error, ruleSet,
    setError,
    setOrder,
    loadMenu,
    startOrder,
    addItem,
    changeQuantity,
    removeLine,
    saveOrder,
    fireOrder,
    persist,
    refreshOpenOrders,
    engine: engineRef,
  };
}

export { getSetting, setSetting };

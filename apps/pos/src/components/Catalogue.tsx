import { useMemo, useState } from 'react';
import { formatMoney } from '@novapos/shared';
import type { MenuItem, MenuSnapshot } from '../lib/store';

/** The item grid — the screen staff spend the whole shift on. */
export function Catalogue({
  menu, onPick,
}: {
  menu: MenuSnapshot;
  onPick: (item: MenuItem) => void;
}) {
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const items = useMemo(() => {
    const q = search.trim().toLowerCase();
    return menu.items.filter((i) => {
      if (categoryId && i.categoryId !== categoryId) return false;
      if (!q) return true;
      return i.name.toLowerCase().includes(q);
    });
  }, [menu.items, categoryId, search]);

  const currency = menu.outlet.currency ?? 'INR';
  const locale = menu.outlet.locale ?? 'en-IN';

  return (
    <div className="catalogue">
      <div className="catalogue__search">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search the menu…"
          aria-label="Search the menu"
          autoComplete="off"
        />
        {search && (
          <button className="btn" onClick={() => setSearch('')} aria-label="Clear search">
            Clear
          </button>
        )}
      </div>

      <div className="categories" role="tablist">
        <button
          role="tab"
          aria-selected={categoryId === null}
          className={`category ${categoryId === null ? 'category--active' : ''}`}
          onClick={() => setCategoryId(null)}
        >
          All
        </button>
        {menu.categories.map((c) => (
          <button
            key={c.id}
            role="tab"
            aria-selected={categoryId === c.id}
            className={`category ${categoryId === c.id ? 'category--active' : ''}`}
            onClick={() => setCategoryId(c.id)}
          >
            {c.name}
          </button>
        ))}
      </div>

      <div className="items">
        {items.map((item) => (
          <button key={item.id} className="item" onClick={() => onPick(item)}>
            <span className="item__head">
              {item.isVeg !== null && (
                <span
                  className={`item__veg ${item.isVeg ? '' : 'item__veg--no'}`}
                  aria-label={item.isVeg ? 'Vegetarian' : 'Non-vegetarian'}
                />
              )}
              <span className="item__name">{item.name}</span>
            </span>
            <span className="item__price">
              {formatMoney(item.priceMinor + (item.packagingChargeMinor ?? 0), currency, locale)}
            </span>
          </button>
        ))}
        {items.length === 0 && (
          <p style={{ color: 'var(--text-faint)', gridColumn: '1 / -1', padding: 20 }}>
            {search ? `Nothing matches “${search}”.` : 'This category has no items yet.'}
          </p>
        )}
      </div>
    </div>
  );
}

import type { MenuSnapshot } from '../lib/store';
import type { LocalOrder } from '../lib/db';
import { formatMoney } from '@novapos/shared';

/**
 * The floor plan.
 *
 * Colour carries the state a waiter needs from across the room: whether a
 * table is running a tab, waiting on payment, or free to seat. Occupied tables
 * show their running total, because "how much is table 4 up to" is the
 * question asked most often.
 */
export function TableFloor({
  menu, orders, onOpen, onSeat,
}: {
  menu: MenuSnapshot;
  orders: LocalOrder[];
  onOpen: (order: LocalOrder) => void;
  onSeat: (tableId: string) => void;
}) {
  const currency = menu.outlet.currency ?? 'INR';
  const locale = menu.outlet.locale ?? 'en-IN';

  const orderByTable = new Map<string, LocalOrder>();
  for (const o of orders) {
    for (const t of o.tableIds) orderByTable.set(t, o);
  }

  const sections = menu.sections.length
    ? menu.sections
    : [{ id: '__all__', name: 'Floor' }];

  return (
    <div className="floor">
      {sections.map((section) => {
        const tables = menu.tables.filter(
          (t) => section.id === '__all__' || t.sectionId === section.id,
        );
        if (tables.length === 0) return null;

        return (
          <section key={section.id}>
            <h2 className="section__name">{section.name}</h2>
            <div className="section__tables">
              {tables.map((table) => {
                const order = orderByTable.get(table.id);
                const state = order
                  ? order.status === 'BILLED' ? 'billed' : 'occupied'
                  : table.status === 'CLEANING' ? 'cleaning' : 'free';

                return (
                  <button
                    key={table.id}
                    className={`table-tile table-tile--${state}`}
                    onClick={() => (order ? onOpen(order) : onSeat(table.id))}
                    aria-label={
                      order
                        ? `Table ${table.label}, running ${formatMoney(order.totalMinor, currency, locale)}`
                        : `Table ${table.label}, free, seats ${table.seats}`
                    }
                  >
                    <span>{table.label}</span>
                    <span className="table-tile__meta">
                      {order
                        ? formatMoney(order.totalMinor, currency, locale)
                        : state === 'cleaning' ? 'Clearing' : `${table.seats} seats`}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}

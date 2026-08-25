import { formatMoney } from '@novapos/shared';
import type { LocalOrder } from '../lib/db';
import type { CartTotals } from '../lib/cart';

/**
 * The bill panel.
 *
 * Shows what has gone to the kitchen and what has not, because that
 * distinction governs what the operator is allowed to do: an unfired line can
 * be edited freely, a fired one can only be voided with a reason, since the
 * cook already has paper for it.
 */
export function Cart({
  order, totals, locale, onQuantity, onRemove, onFire, onBill, onVoid, busy,
}: {
  order: LocalOrder | null;
  totals: CartTotals | null;
  locale: string;
  onQuantity: (lineId: string, qty: number) => void;
  onRemove: (lineId: string) => void;
  onFire: () => void;
  onBill: () => void;
  onVoid: () => void;
  busy?: boolean;
}) {
  if (!order) {
    return (
      <aside className="cart">
        <div className="cart__empty">
          <p>No order open.</p>
          <p style={{ fontSize: 13 }}>Pick a table, or start a quick bill.</p>
        </div>
      </aside>
    );
  }

  const currency = order.currency;
  const money = (m: number) => formatMoney(m, currency, locale);
  const unfired = order.lines.filter((l) => !l.firedAt && l.status !== 'VOIDED');
  const active = order.lines.filter((l) => l.status !== 'VOIDED');
  const settled = order.status === 'PAID' || order.status === 'VOIDED';

  return (
    <aside className="cart">
      <header className="cart__head">
        <div>
          <div className="cart__title">
            {order.orderNumber ? `Order ${order.orderNumber}` : 'New order'}
          </div>
          <div className="cart__meta">
            {order.channel.replace('_', ' ').toLowerCase()}
            {order.guestCount ? ` · ${order.guestCount} guests` : ''}
            {order.invoiceNumber ? ` · ${order.invoiceNumber}` : ''}
          </div>
        </div>
      </header>

      <div className="cart__lines">
        {active.length === 0 && (
          <div className="cart__empty">Tap an item to add it.</div>
        )}

        {order.lines.map((line) => {
          const lineTotal = totals?.lineTotals[line.clientLineId];
          const voided = line.status === 'VOIDED';
          const fired = Boolean(line.firedAt);

          return (
            <div
              key={line.clientLineId}
              className={`line ${voided ? 'line--voided' : fired ? 'line--fired' : ''}`}
            >
              <span className="line__name">{line.name}</span>
              <span className="line__amount">
                {money(lineTotal?.netMinor ?? line.unitPriceMinor * line.quantity)}
              </span>

              {line.modifiers.length > 0 && (
                <span className="line__mod">
                  {line.modifiers.map((m) => `+ ${m.name}`).join('  ')}
                </span>
              )}
              {line.notes && <span className="line__mod">* {line.notes}</span>}

              <div className="line__sub" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {voided ? (
                  <span className="badge badge--void">Voided</span>
                ) : (
                  <>
                    <div className="line__qty">
                      <button
                        className="qty-btn"
                        onClick={() => onQuantity(line.clientLineId, line.quantity - 1)}
                        disabled={settled || (fired && line.quantity <= 1)}
                        aria-label={`Decrease ${line.name}`}
                      >
                        −
                      </button>
                      <span className="qty-value">{line.quantity}</span>
                      <button
                        className="qty-btn"
                        onClick={() => onQuantity(line.clientLineId, line.quantity + 1)}
                        disabled={settled}
                        aria-label={`Increase ${line.name}`}
                      >
                        +
                      </button>
                    </div>
                    {fired && <span className="badge badge--fired">Sent</span>}
                    {line.status === 'READY' && <span className="badge badge--ready">Ready</span>}
                    {!settled && (
                      <button
                        className="qty-btn"
                        onClick={() => onRemove(line.clientLineId)}
                        aria-label={`Remove ${line.name}`}
                        style={{ marginLeft: 'auto' }}
                      >
                        ×
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {totals && active.length > 0 && (
        <div className="totals">
          <div className="totals__row">
            <span>Subtotal</span><span>{money(totals.subtotalMinor)}</span>
          </div>
          {totals.discountMinor > 0 && (
            <div className="totals__row">
              <span>Discount</span><span>−{money(totals.discountMinor)}</span>
            </div>
          )}
          {totals.serviceChargeMinor > 0 && (
            <div className="totals__row">
              <span>Service charge</span><span>{money(totals.serviceChargeMinor)}</span>
            </div>
          )}
          {totals.taxRows.map((t) => (
            <div className="totals__row" key={`${t.code}-${t.rate}`}>
              <span>{t.label} @ {(t.rate * 100).toFixed(2).replace(/\.00$/, '')}%</span>
              <span>{money(t.amountMinor)}</span>
            </div>
          ))}
          {totals.roundingMinor !== 0 && (
            <div className="totals__row">
              <span>Round off</span>
              <span>{totals.roundingMinor > 0 ? '+' : '−'}{money(Math.abs(totals.roundingMinor))}</span>
            </div>
          )}
          <div className="totals__row totals__row--grand">
            <span>Total</span><span>{money(totals.totalMinor)}</span>
          </div>
        </div>
      )}

      {!settled && (
        <div className="actions">
          <button
            className="btn btn--primary"
            onClick={onFire}
            disabled={busy || unfired.length === 0}
          >
            {unfired.length > 0 ? `Send ${unfired.length} to kitchen` : 'Sent'}
          </button>
          <button
            className="btn btn--good"
            onClick={onBill}
            disabled={busy || active.length === 0}
          >
            {order.invoiceNumber ? 'Take payment' : 'Bill'}
          </button>
          <button className="btn btn--danger btn--wide" onClick={onVoid} disabled={busy}>
            Void order
          </button>
        </div>
      )}

      {settled && (
        <div className="actions">
          <div className="warn-banner btn--wide" style={{ gridColumn: '1 / -1' }}>
            This order is {order.status.toLowerCase()} and can no longer be changed.
          </div>
        </div>
      )}
    </aside>
  );
}

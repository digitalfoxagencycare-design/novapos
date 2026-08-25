import { useCallback, useEffect, useState } from 'react';
import { formatMoney } from '@novapos/shared';
import type { PaymentMethod } from '@novapos/shared';
import { ApiClient, ApiError, OfflineError } from './lib/api';
import { usePos } from './lib/store';
import { db, enqueue, getSetting, setSetting, type LocalOrder } from './lib/db';
import { SyncPill } from './components/SyncPill';
import { Catalogue } from './components/Catalogue';
import { Cart } from './components/Cart';
import { PaymentDialog } from './components/PaymentDialog';
import { TableFloor } from './components/TableFloor';

type View = 'tables' | 'order' | 'tabs';

const api = new ApiClient('/api/v1', (tokens) => {
  // Tokens live in localStorage so a reload mid-service does not sign the
  // operator out. The exposure is bounded: access tokens last 15 minutes, and
  // a refresh token presented twice revokes its whole family server-side.
  try {
    if (tokens) localStorage.setItem('novapos:tokens', JSON.stringify(tokens));
    else localStorage.removeItem('novapos:tokens');
  } catch { /* private browsing — the session simply will not survive a reload */ }
});

export function App() {
  const [booted, setBooted] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [view, setView] = useState<View>('tables');
  const [busy, setBusy] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);
  const [outletId, setOutletId] = useState<string | null>(null);

  const pos = usePos(api);

  /* ── boot: restore session and menu ── */

  useEffect(() => {
    void (async () => {
      try {
        const raw = localStorage.getItem('novapos:tokens');
        if (raw) {
          api.setTokens(JSON.parse(raw));
          setSignedIn(true);
        }
      } catch { /* ignore */ }

      const savedOutlet = await getSetting<string | null>('outletId', null);
      if (savedOutlet) {
        setOutletId(savedOutlet);
        api.setOutlet(savedOutlet);
        await pos.loadMenu(savedOutlet);
      }
      setBooted(true);
    })();
    // Intentionally once, at start-up.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const locale = pos.menu?.outlet.locale ?? 'en-IN';
  const currency = pos.menu?.outlet.currency ?? 'INR';

  /* ── actions ── */

  const handleSeat = useCallback(async (tableId: string) => {
    const created = await pos.startOrder('DINE_IN', [tableId]);
    if (created) setView('order');
  }, [pos]);

  const handleOpen = useCallback((order: LocalOrder) => {
    pos.setOrder(order);
    setView('order');
  }, [pos]);

  const handleQuickBill = useCallback(async () => {
    const created = await pos.startOrder('QUICK_BILL');
    if (created) setView('order');
  }, [pos]);

  const handleFire = useCallback(async () => {
    setBusy(true);
    try {
      await pos.fireOrder();
    } finally {
      setBusy(false);
    }
  }, [pos]);

  /**
   * Bill and pay.
   *
   * Billing needs the server, because the invoice number must come from the
   * gapless sequence — a number generated on a device could collide with
   * another till's, and a duplicated invoice number is a compliance problem
   * rather than an inconvenience. So this is the one action that is refused
   * while offline, and it says so plainly.
   */
  const handleBill = useCallback(async () => {
    if (!pos.order) return;
    setBusy(true);
    setPayError(null);
    try {
      const saved = await pos.saveOrder();
      if (!saved) return;

      if (!saved.serverId) {
        // Push what we have and see whether the server picks it up now.
        pos.engine.current?.nudge();
        await new Promise((r) => setTimeout(r, 400));
      }

      const current = await db.orders.get(saved.clientOrderId);
      if (!current?.serverId) {
        setPayError(
          'This order has not reached the server yet, so it cannot be billed — the invoice number ' +
          'has to come from the shared sequence to stay gapless. It will bill automatically once ' +
          'the connection returns; you can keep taking orders in the meantime.',
        );
        setPayOpen(true);
        return;
      }

      if (!current.invoiceNumber) {
        const billed = await api.billOrder(current.serverId);
        await db.orders.update(current.clientOrderId, {
          invoiceNumber: billed.invoiceNumber,
          orderNumber: billed.orderNumber,
          status: 'BILLED',
          totalMinor: billed.totalMinor,
          taxMinor: billed.taxMinor,
          roundingMinor: billed.roundingMinor,
        });
        pos.setOrder({ ...current, ...billed, clientOrderId: current.clientOrderId } as LocalOrder);
      }
      setPayOpen(true);
    } catch (err) {
      setPayError(
        err instanceof OfflineError
          ? 'The server cannot be reached, so this order cannot be billed yet. It is saved on this device.'
          : (err as Error).message,
      );
      setPayOpen(true);
    } finally {
      setBusy(false);
      await pos.refreshOpenOrders();
    }
  }, [pos]);

  const handlePay = useCallback(async (input: {
    method: PaymentMethod; amountMinor: number; tenderedMinor: number;
  }) => {
    const order = pos.order;
    if (!order) return;
    setBusy(true);
    setPayError(null);

    const clientPaymentId = crypto.randomUUID();
    const changeMinor = input.method === 'CASH'
      ? Math.max(0, input.tenderedMinor - input.amountMinor)
      : 0;

    // Record locally first, so a dropped connection mid-payment does not lose
    // the fact that money was taken.
    await db.payments.put({
      clientPaymentId,
      clientOrderId: order.clientOrderId,
      method: input.method,
      amountMinor: input.amountMinor,
      tenderedMinor: input.tenderedMinor,
      changeMinor,
      takenAt: new Date().toISOString(),
      synced: false,
    });

    try {
      const serverId = (await db.orders.get(order.clientOrderId))?.serverId;
      if (!serverId) throw new OfflineError('This order has not reached the server yet.');

      const result = await api.takePayment(serverId, {
        clientPaymentId,
        method: input.method,
        amountMinor: input.amountMinor,
        tenderedMinor: input.tenderedMinor,
      });

      await db.payments.update(clientPaymentId, { synced: true });
      await db.orders.update(order.clientOrderId, {
        status: result.order?.status ?? 'PAID',
      });

      if (result.outstandingMinor > 0) {
        setPayError(`${formatMoney(result.outstandingMinor, currency, locale)} still outstanding.`);
      } else {
        setPayOpen(false);
        pos.setOrder(null);
        setView('tables');
      }
    } catch (err) {
      // Queue it. The money is in the drawer whether or not the server knows.
      await enqueue({
        opId: crypto.randomUUID(),
        type: 'payment.create',
        occurredAt: new Date().toISOString(),
        payload: {
          clientOrderId: order.clientOrderId,
          clientPaymentId,
          method: input.method,
          amountMinor: input.amountMinor,
          tenderedMinor: input.tenderedMinor,
        },
        attempts: 0,
      } as never);

      setPayError(
        err instanceof OfflineError || err instanceof ApiError && err.retryable
          ? 'Recorded on this device and queued — it will reach the server when the connection returns.'
          : (err as Error).message,
      );
      pos.engine.current?.nudge();
    } finally {
      setBusy(false);
      await pos.refreshOpenOrders();
    }
  }, [pos, currency, locale]);

  const handleVoid = useCallback(async () => {
    const order = pos.order;
    if (!order) return;
    const reason = window.prompt('Why is this order being voided? (recorded for audit)');
    if (!reason?.trim()) return;

    setBusy(true);
    try {
      await pos.persist({ ...order, status: 'VOIDED' });
      await enqueue({
        opId: crypto.randomUUID(),
        type: 'order.void',
        occurredAt: new Date().toISOString(),
        payload: { clientOrderId: order.clientOrderId, reason },
        attempts: 0,
      } as never);
      pos.engine.current?.nudge();
      pos.setOrder(null);
      setView('tables');
    } finally {
      setBusy(false);
    }
  }, [pos]);

  /* ── render ── */

  if (!booted) {
    return <div className="login"><p style={{ color: 'var(--text-dim)' }}>Starting…</p></div>;
  }

  if (!signedIn) {
    return <SignIn onSignedIn={async (chosenOutletId) => {
      setSignedIn(true);
      setOutletId(chosenOutletId);
      api.setOutlet(chosenOutletId);
      await setSetting('outletId', chosenOutletId);
      await pos.loadMenu(chosenOutletId);
    }} />;
  }

  if (!pos.menu) {
    return (
      <div className="login">
        <div className="login__card">
          <h1 style={{ marginTop: 0 }}>No menu on this device</h1>
          <p style={{ color: 'var(--text-dim)' }}>
            {pos.error ?? 'Loading the menu…'}
          </p>
          {outletId && (
            <button className="btn btn--primary btn--wide" onClick={() => pos.loadMenu(outletId)}>
              Try again
            </button>
          )}
        </div>
      </div>
    );
  }

  const outstanding = pos.order
    ? Math.max(0, (pos.totals?.totalMinor ?? pos.order.totalMinor))
    : 0;

  return (
    <div className="app">
      <header className="topbar">
        <span className="topbar__brand">NovaPOS</span>
        <span className="cart__meta">{pos.menu.outlet.name}</span>

        <nav className="tabs" style={{ marginLeft: 16 }}>
          <button
            className={`tab ${view === 'tables' ? 'tab--active' : ''}`}
            onClick={() => setView('tables')}
          >
            Tables
          </button>
          <button
            className={`tab ${view === 'order' ? 'tab--active' : ''}`}
            onClick={() => setView('order')}
            disabled={!pos.order}
          >
            Order
          </button>
          <button
            className={`tab ${view === 'tabs' ? 'tab--active' : ''}`}
            onClick={() => setView('tabs')}
          >
            Open tabs{pos.openOrders.length ? ` (${pos.openOrders.length})` : ''}
          </button>
        </nav>

        <span className="topbar__spacer" />
        <button className="btn" style={{ padding: '8px 14px' }} onClick={handleQuickBill}>
          Quick bill
        </button>
        <SyncPill status={pos.sync} onClick={() => pos.engine.current?.nudge()} />
      </header>

      {pos.error && (
        <div className="error-banner" style={{ margin: '10px 14px 0' }}>
          {pos.error}
          <button
            className="btn"
            style={{ marginLeft: 10, minHeight: 0, padding: '2px 8px' }}
            onClick={() => pos.setError(null)}
          >
            Dismiss
          </button>
        </div>
      )}

      {view === 'tables' && (
        <TableFloor
          menu={pos.menu}
          orders={pos.openOrders}
          onOpen={handleOpen}
          onSeat={handleSeat}
        />
      )}

      {view === 'tabs' && (
        <div className="floor">
          {pos.openOrders.length === 0 && (
            <p style={{ color: 'var(--text-faint)' }}>No open tabs.</p>
          )}
          <div className="section__tables">
            {pos.openOrders.map((o) => (
              <button key={o.clientOrderId} className="table-tile" onClick={() => handleOpen(o)}>
                <span>{o.orderNumber ?? 'New'}</span>
                <span className="table-tile__meta">
                  {formatMoney(o.totalMinor, o.currency, locale)}
                </span>
                <span className="table-tile__meta">{o.status.toLowerCase()}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {view === 'order' && (
        <div className="workspace">
          <Catalogue menu={pos.menu} onPick={(item) => void pos.addItem(item)} />
          <Cart
            order={pos.order}
            totals={pos.totals}
            locale={locale}
            busy={busy}
            onQuantity={(id, q) => void pos.changeQuantity(id, q)}
            onRemove={(id) => void pos.removeLine(id)}
            onFire={handleFire}
            onBill={handleBill}
            onVoid={handleVoid}
          />
        </div>
      )}

      {payOpen && pos.order && (
        <PaymentDialog
          totalMinor={pos.totals?.totalMinor ?? pos.order.totalMinor}
          outstandingMinor={outstanding}
          currency={currency}
          locale={locale}
          busy={busy}
          error={payError}
          onClose={() => { setPayOpen(false); setPayError(null); }}
          onPay={handlePay}
        />
      )}
    </div>
  );
}

/* ───────────────────────── sign-in ───────────────────────── */

function SignIn({ onSignedIn }: { onSignedIn: (outletId: string) => void }) {
  const [tenantSlug, setTenantSlug] = useState('nova-kitchen');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [outlets, setOutlets] = useState<{ id: string; name: string }[]>([]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const staff = await api.login(tenantSlug.trim(), email.trim(), password);
      // A staff member pinned to one outlet goes straight there; an owner with
      // access to several has to choose which till they are standing at.
      if (staff.outletId) {
        onSignedIn(staff.outletId);
      } else {
        const me = await api.outlets();
        if (me.length === 1) onSignedIn(me[0].id);
        else setOutlets(me);
      }
    } catch (err) {
      setError(
        err instanceof OfflineError
          ? 'Cannot reach the server. Signing in for the first time needs a connection.'
          : (err as Error).message,
      );
    } finally {
      setBusy(false);
    }
  };

  if (outlets.length > 0) {
    return (
      <div className="login">
        <div className="login__card">
          <h1 style={{ marginTop: 0 }}>Which till is this?</h1>
          <p style={{ color: 'var(--text-dim)' }}>
            This device will be bound to the outlet you pick.
          </p>
          {outlets.map((o) => (
            <button
              key={o.id}
              className="btn btn--primary btn--wide"
              style={{ marginTop: 8 }}
              onClick={() => onSignedIn(o.id)}
            >
              {o.name}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="login">
      <form className="login__card" onSubmit={submit}>
        <h1 style={{ marginTop: 0 }}>NovaPOS</h1>
        <p style={{ color: 'var(--text-dim)', marginTop: 0 }}>Sign in to this till.</p>

        {error && <div className="error-banner">{error}</div>}

        <div className="field">
          <label htmlFor="tenant">Business</label>
          <input id="tenant" value={tenantSlug} onChange={(e) => setTenantSlug(e.target.value)} required />
        </div>
        <div className="field">
          <label htmlFor="email">Email</label>
          <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                 autoComplete="username" required />
        </div>
        <div className="field">
          <label htmlFor="password">Password</label>
          <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                 autoComplete="current-password" required />
        </div>

        <button className="btn btn--primary btn--wide" type="submit" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { ApiClient } from './lib/api';

/**
 * Kitchen Display Screen.
 *
 * Read at arm's length across a hot pass by someone whose hands are full, so
 * the design is unlike the rest of the product:
 *
 *   · Tickets are large tiles, oldest first, left to right. A cook works the
 *     leftmost ticket; nothing else needs explaining.
 *   · Colour encodes elapsed time, not status. "How long has this been
 *     waiting" is the only question that matters on a busy pass, and a ticket
 *     going amber then red is legible from across a kitchen.
 *   · One tap advances a ticket; there is no undo, because a screen operated
 *     with a knuckle collects accidental taps. A mistake is corrected by a
 *     manager on the POS.
 *   · It reconnects and refetches on its own. A kitchen screen that quietly
 *     stops updating is how orders get missed, so a stale connection is
 *     shouted about rather than hidden.
 */

interface KotLine {
  id: string;
  nameSnapshot: string;
  quantity: string | number;
  previousQuantity: string | number | null;
  modifiersSnapshot: string[];
  notes: string | null;
  change: 'NEW' | 'ADDED' | 'VOIDED' | 'QTY_CHANGED';
}

interface Kot {
  id: string;
  kotNumber: string;
  kind: 'NEW' | 'MODIFIED' | 'CANCELLED';
  status: 'PLACED' | 'PREPARING' | 'READY' | 'SERVED' | 'CANCELLED';
  createdAt: string;
  notes: string | null;
  lines: KotLine[];
  order?: { orderNumber: string; channel: string; notes: string | null };
}

const api = new ApiClient('/api/v1', (tokens) => {
  try {
    if (tokens) localStorage.setItem('novapos:kds:tokens', JSON.stringify(tokens));
    else localStorage.removeItem('novapos:kds:tokens');
  } catch { /* ignore */ }
});

/** Minutes after which a ticket turns amber, then red. */
const WARN_MINUTES = 8;
const LATE_MINUTES = 15;

export function Kds() {
  const [tickets, setTickets] = useState<Kot[]>([]);
  const [connected, setConnected] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stationId, setStationId] = useState<string | null>(null);
  const [outletId, setOutletId] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const socketRef = useRef<Socket | null>(null);

  // Re-render once a second so the age colours advance on their own.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('novapos:kds:tokens');
      const cfg = localStorage.getItem('novapos:kds:config');
      if (raw && cfg) {
        api.setTokens(JSON.parse(raw));
        const { stationId: s, outletId: o } = JSON.parse(cfg);
        setStationId(s);
        setOutletId(o);
        setSignedIn(true);
      }
    } catch { /* ignore */ }
  }, []);

  /* ── the live channel ── */

  useEffect(() => {
    if (!signedIn || !stationId || !outletId) return;

    const tokens = JSON.parse(localStorage.getItem('novapos:kds:tokens') ?? '{}');
    const socket = io('/realtime', {
      auth: { token: tokens.accessToken },
      query: { outletId, stationId },
      transports: ['websocket'],
      // A kitchen's wifi is not good. Reconnect forever, quickly at first.
      reconnection: true,
      reconnectionDelay: 500,
      reconnectionDelayMax: 5_000,
    });
    socketRef.current = socket;

    socket.on('connect', () => { setConnected(true); setError(null); });
    socket.on('disconnect', () => setConnected(false));
    socket.on('connect_error', (e) => setError(e.message));

    // The server replays everything live on connect, so a screen that dropped
    // out mid-service comes back correct rather than empty.
    socket.on('kot:snapshot', (payload: { kots: Kot[] }) => {
      setTickets(payload.kots ?? []);
    });

    socket.on('kot:new', (kot: Kot) => {
      setTickets((prev) => (prev.some((k) => k.id === kot.id) ? prev : [...prev, kot]));
      chime();
    });

    socket.on('kot:status', (kot: Kot) => {
      setTickets((prev) =>
        kot.status === 'SERVED' || kot.status === 'CANCELLED'
          ? prev.filter((k) => k.id !== kot.id)
          : prev.map((k) => (k.id === kot.id ? { ...k, status: kot.status } : k)),
      );
    });

    return () => { socket.close(); socketRef.current = null; };
  }, [signedIn, stationId, outletId]);

  /**
   * A safety net for the case that matters most: the socket has silently
   * died and the screen is showing a frozen picture of the kitchen. Polling
   * on a slow interval means a broken connection costs a minute of staleness,
   * not a whole service.
   */
  useEffect(() => {
    if (!signedIn || !stationId) return;
    const poll = setInterval(() => {
      if (connected) return;
      void api.kots(stationId)
        .then((rows: Kot[]) => setTickets(rows))
        .catch(() => undefined);
    }, 20_000);
    return () => clearInterval(poll);
  }, [signedIn, stationId, connected]);

  const advance = useCallback(async (kot: Kot) => {
    const next =
      kot.status === 'PLACED' ? 'PREPARING'
      : kot.status === 'PREPARING' ? 'READY'
      : 'SERVED';

    // Optimistic: the cook has already moved on. If the server disagrees, the
    // next snapshot corrects it.
    setTickets((prev) =>
      next === 'SERVED'
        ? prev.filter((k) => k.id !== kot.id)
        : prev.map((k) => (k.id === kot.id ? { ...k, status: next as Kot['status'] } : k)));

    const socket = socketRef.current;
    if (socket?.connected) {
      socket.emit('kot:update-status', { kotId: kot.id, status: next });
    } else {
      await api.kotStatus(kot.id, next as 'PREPARING' | 'READY' | 'SERVED').catch((err) =>
        setError(`Could not update ticket ${kot.kotNumber}: ${err.message}`));
    }
  }, []);

  const sorted = useMemo(
    () => [...tickets].sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    [tickets],
  );

  if (!signedIn) {
    return <KdsSignIn onReady={(o, s) => {
      setOutletId(o); setStationId(s); setSignedIn(true);
      localStorage.setItem('novapos:kds:config', JSON.stringify({ outletId: o, stationId: s }));
    }} />;
  }

  return (
    <div className="kds">
      <header className="kds__bar">
        <span className="kds__title">Kitchen</span>
        <span className="kds__count">{sorted.length} on the pass</span>
        <span className="topbar__spacer" />
        <span className={`sync ${connected ? 'sync--idle' : 'sync--error'}`}>
          <span className="sync__dot" />
          {connected ? 'Live' : 'Reconnecting…'}
        </span>
      </header>

      {error && <div className="error-banner" style={{ margin: '10px 14px' }}>{error}</div>}

      {sorted.length === 0 && (
        <div className="kds__empty">
          <p>Nothing on the pass.</p>
        </div>
      )}

      <div className="kds__grid">
        {sorted.map((kot) => {
          const ageMs = now - new Date(kot.createdAt).getTime();
          const minutes = Math.floor(ageMs / 60_000);
          const age = minutes >= LATE_MINUTES ? 'late' : minutes >= WARN_MINUTES ? 'warn' : 'ok';

          return (
            <article
              key={kot.id}
              className={`ticket ticket--${age} ticket--${kot.status.toLowerCase()}`}
            >
              <header className="ticket__head">
                <span className="ticket__no">{kot.kotNumber}</span>
                <span className="ticket__age">
                  {minutes}:{String(Math.floor((ageMs % 60_000) / 1000)).padStart(2, '0')}
                </span>
              </header>

              <div className="ticket__meta">
                {kot.order?.orderNumber} · {kot.order?.channel?.replace('_', ' ').toLowerCase()}
              </div>

              {kot.kind !== 'NEW' && (
                <div className="ticket__banner">{kot.kind}</div>
              )}

              <ul className="ticket__lines">
                {kot.lines.map((l) => (
                  <li key={l.id} className={`ticket__line ticket__line--${l.change.toLowerCase()}`}>
                    <span className="ticket__qty">
                      {l.change === 'QTY_CHANGED' && l.previousQuantity != null
                        ? `${Number(l.previousQuantity)}→${Number(l.quantity)}`
                        : Number(l.quantity)}
                    </span>
                    <span className="ticket__name">{l.nameSnapshot}</span>
                    {l.modifiersSnapshot.length > 0 && (
                      <span className="ticket__mods">
                        {l.modifiersSnapshot.map((m) => `+ ${m}`).join('  ')}
                      </span>
                    )}
                    {l.notes && <span className="ticket__note">** {l.notes}</span>}
                  </li>
                ))}
              </ul>

              {kot.notes && <div className="ticket__note ticket__note--order">{kot.notes}</div>}

              <button className="ticket__action" onClick={() => void advance(kot)}>
                {kot.status === 'PLACED' ? 'Start' : kot.status === 'PREPARING' ? 'Ready' : 'Served'}
              </button>
            </article>
          );
        })}
      </div>
    </div>
  );
}

/** A short tone when a ticket lands. A silent kitchen screen gets ignored. */
function chime() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.3);
    setTimeout(() => void ctx.close(), 400);
  } catch {
    // Autoplay policy, or no audio device. The visual cue still lands.
  }
}

function KdsSignIn({ onReady }: { onReady: (outletId: string, stationId: string) => void }) {
  const [tenantSlug, setTenantSlug] = useState('nova-kitchen');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stations, setStations] = useState<{ id: string; name: string; code: string }[]>([]);
  const [outlet, setOutlet] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const staff = await api.login(tenantSlug.trim(), email.trim(), password);
      const outlets = await api.outlets();
      const chosen = staff.outletId ?? outlets[0]?.id;
      if (!chosen) throw new Error('This account has no outlet to display.');
      setOutlet(chosen);
      api.setOutlet(chosen);
      const menu = await api.menuSnapshot(chosen);
      setStations(menu.stations);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (stations.length > 0 && outlet) {
    return (
      <div className="login">
        <div className="login__card">
          <h1 style={{ marginTop: 0 }}>Which station is this screen?</h1>
          <p style={{ color: 'var(--text-dim)' }}>
            This screen will show only tickets routed here.
          </p>
          {stations.map((s) => (
            <button
              key={s.id}
              className="btn btn--primary btn--wide"
              style={{ marginTop: 8 }}
              onClick={() => onReady(outlet, s.id)}
            >
              {s.name}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="login">
      <form className="login__card" onSubmit={submit}>
        <h1 style={{ marginTop: 0 }}>Kitchen screen</h1>
        {error && <div className="error-banner">{error}</div>}
        <div className="field">
          <label htmlFor="t">Business</label>
          <input id="t" value={tenantSlug} onChange={(e) => setTenantSlug(e.target.value)} required />
        </div>
        <div className="field">
          <label htmlFor="e">Email</label>
          <input id="e" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div className="field">
          <label htmlFor="p">Password</label>
          <input id="p" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
        <button className="btn btn--primary btn--wide" type="submit" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}

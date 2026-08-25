import type { SyncStatus } from '../lib/sync';

/**
 * The sync indicator.
 *
 * Deliberately always visible. Staff need to know at a glance whether the till
 * is talking to the server, because that changes what they should do about a
 * bill that has not printed. Hiding it until something breaks means nobody
 * notices until a whole shift has queued up.
 */
export function SyncPill({ status, onClick }: { status: SyncStatus | null; onClick?: () => void }) {
  if (!status) return null;

  const label =
    status.state === 'offline' ? (status.pending ? `Offline · ${status.pending} queued` : 'Offline')
    : status.state === 'syncing' ? 'Syncing…'
    : status.state === 'error' ? `Retrying · ${status.pending} queued`
    : status.pending ? `${status.pending} queued`
    : 'Synced';

  return (
    <button
      className={`sync sync--${status.state}`}
      onClick={onClick}
      title={status.lastError ?? (status.lastSyncAt ? `Last synced ${new Date(status.lastSyncAt).toLocaleTimeString()}` : '')}
    >
      <span className="sync__dot" />
      <span>{label}</span>
      {status.dead > 0 && <span style={{ color: 'var(--bad)' }}>· {status.dead} failed</span>}
    </button>
  );
}

import { useMemo, useState } from 'react';
import { formatMoney, parseMoney } from '@novapos/shared';
import type { PaymentMethod } from '@novapos/shared';

/**
 * Taking payment.
 *
 * The numbers here are the ones a cashier is judged on at close, so the
 * behaviour is conservative:
 *
 *   · Change is computed and shown large, because miscounting it is the most
 *     common till error.
 *   · Card and UPI cannot be over-tendered — an overpayment there means the
 *     amount was keyed wrong, and re-keying is far cheaper than refunding.
 *   · The quick-tender buttons are the notes actually in circulation, which
 *     removes most of the typing.
 */

const METHODS: { key: PaymentMethod; label: string }[] = [
  { key: 'CASH', label: 'Cash' },
  { key: 'UPI', label: 'UPI' },
  { key: 'CARD', label: 'Card' },
  { key: 'WALLET', label: 'Wallet' },
];

export function PaymentDialog({
  totalMinor, outstandingMinor, currency, locale, onClose, onPay, busy, error,
}: {
  totalMinor: number;
  outstandingMinor: number;
  currency: string;
  locale: string;
  onClose: () => void;
  onPay: (input: { method: PaymentMethod; amountMinor: number; tenderedMinor: number }) => void;
  busy?: boolean;
  error?: string | null;
}) {
  const [method, setMethod] = useState<PaymentMethod>('CASH');
  const [entry, setEntry] = useState('');

  const money = (m: number) => formatMoney(m, currency, locale);
  const isCash = method === 'CASH';

  const tenderedMinor = useMemo(() => {
    if (!entry) return outstandingMinor;
    return parseMoney(entry, currency) ?? outstandingMinor;
  }, [entry, currency, outstandingMinor]);

  const appliedMinor = Math.min(tenderedMinor, outstandingMinor);
  const changeMinor = isCash ? Math.max(0, tenderedMinor - outstandingMinor) : 0;
  const shortMinor = Math.max(0, outstandingMinor - tenderedMinor);

  // Round the outstanding amount up to plausible notes.
  const quickTenders = useMemo(() => {
    const major = outstandingMinor / 100;
    const steps = [50, 100, 200, 500, 2000];
    const out = new Set<number>([outstandingMinor]);
    for (const s of steps) {
      const up = Math.ceil(major / s) * s * 100;
      if (up > outstandingMinor) out.add(up);
    }
    return [...out].sort((a, b) => a - b).slice(0, 5);
  }, [outstandingMinor]);

  const canPay = !busy && tenderedMinor > 0 && (isCash || tenderedMinor <= outstandingMinor);

  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label="Take payment">
      <div className="dialog">
        <h2 className="dialog__title">Take payment</h2>
        <p className="dialog__hint">
          {outstandingMinor === totalMinor
            ? `Bill total ${money(totalMinor)}`
            : `${money(outstandingMinor)} outstanding of ${money(totalMinor)}`}
        </p>

        {error && <div className="error-banner">{error}</div>}

        <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
          {METHODS.map((m) => (
            <button
              key={m.key}
              className={`category ${method === m.key ? 'category--active' : ''}`}
              onClick={() => { setMethod(m.key); setEntry(''); }}
            >
              {m.label}
            </button>
          ))}
        </div>

        <div className="tender-display" aria-live="polite">
          {money(tenderedMinor)}
        </div>

        {isCash && (
          <div style={{ display: 'flex', gap: 8, margin: '12px 0', flexWrap: 'wrap' }}>
            {quickTenders.map((t) => (
              <button
                key={t}
                className="btn"
                style={{ flex: 1, minWidth: 90 }}
                onClick={() => setEntry(String(t / 100))}
              >
                {money(t)}
              </button>
            ))}
          </div>
        )}

        <div className="keypad">
          {['1','2','3','4','5','6','7','8','9','.','0','⌫'].map((k) => (
            <button
              key={k}
              onClick={() => setEntry((prev) =>
                k === '⌫' ? prev.slice(0, -1)
                : k === '.' && prev.includes('.') ? prev
                : prev + k)}
            >
              {k}
            </button>
          ))}
        </div>

        {isCash && changeMinor > 0 && (
          <div className="totals__row totals__row--grand" style={{ color: 'var(--good)' }}>
            <span>Change</span><span>{money(changeMinor)}</span>
          </div>
        )}
        {shortMinor > 0 && (
          <div className="totals__row" style={{ color: 'var(--warn)' }}>
            <span>Still outstanding after this</span><span>{money(shortMinor)}</span>
          </div>
        )}
        {!isCash && tenderedMinor > outstandingMinor && (
          <div className="warn-banner" style={{ marginTop: 10 }}>
            A {method.toLowerCase()} payment cannot exceed the amount outstanding.
            Correct the amount, or take the difference as a tip.
          </div>
        )}

        <div className="dialog__actions">
          <button className="btn" onClick={onClose} disabled={busy}>Cancel</button>
          <button
            className="btn btn--good"
            disabled={!canPay}
            onClick={() => onPay({ method, amountMinor: appliedMinor, tenderedMinor })}
          >
            {busy ? 'Taking payment…' : `Take ${money(appliedMinor)}`}
          </button>
        </div>
      </div>
    </div>
  );
}

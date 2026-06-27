import React, { useState } from 'react';
import {
  adminCreateSupplyDrop,
  adminExpireSupplyDrop,
  adminGetSupplyDropClaims,
  adminStartSavvySale,
  adminEndSavvySale,
  adminScoutSupportAddDeal,
  adminScoutSupportSetStreak,
  adminScoutSupportReset,
  adminScoutSupportForceClaim,
} from '../../lib/api';
import '../../styles/LiveEvents.css';

export default function LiveEventsAdminPanel({ onRefresh }) {
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState('');
  const [logs, setLogs] = useState([]);

  async function run(key, fn) {
    setBusy(key);
    setError('');
    try {
      const result = await fn();
      if (result?.adminLog) {
        setLogs((prev) => [result.adminLog, ...prev].slice(0, 12));
      }
      if (typeof onRefresh === 'function') await onRefresh();
    } catch (e) {
      setError(e?.response?.data?.message || e?.message || 'Admin action failed.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="live-events-admin" aria-labelledby="live-events-admin-title">
      <h2 id="live-events-admin-title" className="live-events-admin__title">
        Live Events — Admin Testing
      </h2>
      {error ? <div className="live-events-admin__error">{error}</div> : null}

      <p className="live-events-admin__title" style={{ fontSize: '0.78rem', opacity: 0.85 }}>
        Max Supply Drops
      </p>
      <div className="live-events-admin__actions">
        <button type="button" disabled={busy} onClick={() => void run('drop-user', () => adminCreateSupplyDrop('user'))}>
          Create 10m drop (me)
        </button>
        <button type="button" disabled={busy} onClick={() => void run('drop-global', () => adminCreateSupplyDrop('global'))}>
          Create global 10m drop
        </button>
        <button type="button" disabled={busy} onClick={() => void run('drop-expire', adminExpireSupplyDrop)}>
          Expire active drop
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void run('drop-claims', () => adminGetSupplyDropClaims(15))}
        >
          View recent claims
        </button>
      </div>

      <p className="live-events-admin__title" style={{ fontSize: '0.78rem', opacity: 0.85, marginTop: '0.75rem' }}>
        Savvy Sale
      </p>
      <div className="live-events-admin__actions">
        <button type="button" disabled={busy} onClick={() => void run('sale-5', () => adminStartSavvySale(5))}>
          Start 5 min sale
        </button>
        <button type="button" disabled={busy} onClick={() => void run('sale-15', () => adminStartSavvySale(15))}>
          Start 15 min sale
        </button>
        <button type="button" disabled={busy} onClick={() => void run('sale-30', () => adminStartSavvySale(30))}>
          Start 30 min sale
        </button>
        <button type="button" disabled={busy} onClick={() => void run('sale-end', adminEndSavvySale)}>
          End Savvy Sale
        </button>
      </div>

      <p className="live-events-admin__title" style={{ fontSize: '0.78rem', opacity: 0.85, marginTop: '0.75rem' }}>
        Scout Support
      </p>
      <div className="live-events-admin__actions">
        <button type="button" disabled={busy} onClick={() => void run('ss-add', adminScoutSupportAddDeal)}>
          +1 deal action
        </button>
        <button type="button" disabled={busy} onClick={() => void run('ss-4', () => adminScoutSupportSetStreak(4))}>
          Set streak 4/5
        </button>
        <button type="button" disabled={busy} onClick={() => void run('ss-7', () => adminScoutSupportSetStreak(7))}>
          Set streak 7/8
        </button>
        <button type="button" disabled={busy} onClick={() => void run('ss-reset', adminScoutSupportReset)}>
          Reset Scout Support
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void run('ss-claim-5', () => adminScoutSupportForceClaim(5))}
        >
          Force claim milestone 5
        </button>
      </div>

      {logs.length ? (
        <ul style={{ marginTop: '0.75rem', fontSize: '0.75rem', color: '#94a3b8', paddingLeft: '1rem' }}>
          {logs.map((log) => (
            <li key={`${log.action}-${log.timestamp}`}>
              <strong>{log.action}</strong> · {new Date(log.timestamp).toLocaleString()}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

import React, { useState } from 'react';
import {
  adminPerkMachineClearHistory,
  adminPerkMachineForceLegendary,
  adminPerkMachineForceSpin,
  adminPerkMachineGrantSavvy,
  adminPerkMachineResetFreeSpin,
} from '../../lib/api';

export default function PerkMachineAdminPanel({ onStatusRefresh }) {
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState('');
  const [logs, setLogs] = useState([]);

  function appendLog(entry) {
    if (!entry) return;
    setLogs((prev) => [entry, ...prev].slice(0, 15));
  }

  async function runAction(key, fn) {
    setBusy(key);
    setError('');
    try {
      const result = await fn();
      if (result?.adminLog) appendLog(result.adminLog);
      if (typeof onStatusRefresh === 'function') await onStatusRefresh();
    } catch (e) {
      setError(e?.response?.data?.message || e?.message || 'Admin action failed.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="perk-admin-panel" aria-labelledby="perk-admin-heading">
      <div className="perk-admin-label">Admin Testing</div>
      <h2 id="perk-admin-heading" className="perk-admin-title">
        Perk Machine Test Controls
      </h2>
      {error ? (
        <div className="perk-admin-error" role="alert">
          {error}
        </div>
      ) : null}
      <div className="perk-admin-actions">
        <button type="button" disabled={busy} onClick={() => void runAction('reset', adminPerkMachineResetFreeSpin)}>
          Reset free spin
        </button>
        <button type="button" disabled={busy} onClick={() => void runAction('savvy', () => adminPerkMachineGrantSavvy(500))}>
          Grant 500 Savvy
        </button>
        <button type="button" disabled={busy} onClick={() => void runAction('spin1', () => adminPerkMachineForceSpin(1))}>
          Force 1-slot spin
        </button>
        <button type="button" disabled={busy} onClick={() => void runAction('spin3', () => adminPerkMachineForceSpin(3))}>
          Force 3-slot spin
        </button>
        <button type="button" disabled={busy} onClick={() => void runAction('legendary', adminPerkMachineForceLegendary)}>
          Force Legendary Egg
        </button>
        <button type="button" disabled={busy} onClick={() => void runAction('clear', adminPerkMachineClearHistory)}>
          Clear spin history
        </button>
      </div>
      {logs.length ? (
        <ul className="perk-admin-logs">
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

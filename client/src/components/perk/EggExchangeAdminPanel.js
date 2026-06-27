import React, { useState } from 'react';
import {
  adminEggExchangeGrantEpic,
  adminEggExchangeGrantLegendary,
  adminEggExchangeGrantRare,
  adminEggExchangeGrantSavvy,
  adminEggExchangePresetEpicLegendary,
  adminEggExchangePresetLegendaryMythic,
  adminEggExchangePresetRareEpic,
  adminEggExchangeReset,
} from '../../lib/api';

export default function EggExchangeAdminPanel({ onRefresh }) {
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState('');
  const [logs, setLogs] = useState([]);

  async function run(key, fn) {
    setBusy(key);
    setError('');
    try {
      const result = await fn();
      if (result?.adminLog) setLogs((prev) => [result.adminLog, ...prev].slice(0, 12));
      if (typeof onRefresh === 'function') await onRefresh();
    } catch (e) {
      setError(e?.response?.data?.message || e?.message || 'Admin action failed.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="egg-exchange-admin" aria-labelledby="egg-exchange-admin-title">
      <h2 id="egg-exchange-admin-title" className="egg-exchange-admin__title">
        Egg Exchange — Admin Testing
      </h2>
      {error ? <div className="egg-exchange-admin__error">{error}</div> : null}
      <div className="egg-exchange-admin__actions">
        <button type="button" disabled={busy} onClick={() => void run('rare', adminEggExchangeGrantRare)}>
          +25 Rare eggs
        </button>
        <button type="button" disabled={busy} onClick={() => void run('epic', adminEggExchangeGrantEpic)}>
          +25 Epic eggs
        </button>
        <button type="button" disabled={busy} onClick={() => void run('leg', adminEggExchangeGrantLegendary)}>
          +10 Legendary eggs
        </button>
        <button type="button" disabled={busy} onClick={() => void run('savvy', () => adminEggExchangeGrantSavvy(20000))}>
          +20,000 Savvy
        </button>
        <button type="button" disabled={busy} onClick={() => void run('reset', adminEggExchangeReset)}>
          Reset exchange inventory
        </button>
        <button type="button" disabled={busy} onClick={() => void run('pre-rare', adminEggExchangePresetRareEpic)}>
          Preset Rare→Epic test
        </button>
        <button type="button" disabled={busy} onClick={() => void run('pre-epic', adminEggExchangePresetEpicLegendary)}>
          Preset Epic→Legendary test
        </button>
        <button type="button" disabled={busy} onClick={() => void run('pre-mythic', adminEggExchangePresetLegendaryMythic)}>
          Preset Legendary→Mythic test
        </button>
      </div>
      {logs.length ? (
        <ul className="egg-exchange-admin__logs">
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

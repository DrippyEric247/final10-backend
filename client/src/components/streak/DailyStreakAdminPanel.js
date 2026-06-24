import React, { useState } from 'react';
import {
  adminAdvanceStreakDay,
  adminForceStreakClaim,
  adminSetStreakMilestone,
} from '../../lib/api';
import { CALENDAR_DAYS } from '../../config/dailyStreakRewards';

function formatLogTime(iso) {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso || '';
  }
}

function logSummary(entry) {
  if (!entry) return '';
  const { action, details } = entry;
  switch (action) {
    case 'force_claim':
      return `Force claim · streak ${details?.after?.currentStreak ?? '?'} · +${details?.after?.savvyEarned ?? 0} Savvy`;
    case 'advance_streak':
      return `Advanced ${details?.advancedFrom ?? '?'} → ${details?.advancedTo ?? '?'}`;
    case 'set_milestone':
      return `Set milestone day ${details?.milestoneDay} (${details?.milestoneLabel}) · +${details?.grants?.savvy ?? 0} Savvy`;
    default:
      return action || 'Test action';
  }
}

export default function DailyStreakAdminPanel({ onStatusRefresh, onTestResult }) {
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState('');
  const [logs, setLogs] = useState([]);

  function appendLog(entry) {
    if (!entry) return;
    setLogs((prev) => [entry, ...prev].slice(0, 20));
  }

  async function runAction(key, fn) {
    setBusy(key);
    setError('');
    try {
      const result = await fn();
      if (result?.adminLog) appendLog(result.adminLog);
      if (typeof onStatusRefresh === 'function') {
        await onStatusRefresh(result?.status);
      }
      if (typeof onTestResult === 'function') {
        onTestResult(result);
      }
    } catch (e) {
      setError(e?.response?.data?.message || e?.message || 'Admin test action failed.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="streak-admin-panel" aria-labelledby="streak-admin-heading">
      <div className="streak-admin-label">Admin Testing</div>
      <h2 id="streak-admin-heading" className="streak-admin-title">
        Login Streak Test Controls
      </h2>
      <p className="streak-admin-desc">
        Admin-only tools for QA. Actions apply to your account and are audit-logged on the server.
      </p>

      {error ? (
        <div className="streak-admin-error" role="alert">
          {error}
        </div>
      ) : null}

      <div className="streak-admin-actions">
        <button
          type="button"
          className="streak-admin-btn streak-admin-btn-primary"
          disabled={Boolean(busy)}
          onClick={() => runAction('force', adminForceStreakClaim)}
        >
          {busy === 'force' ? 'Claiming…' : "Force Claim Today's Reward"}
        </button>
        <button
          type="button"
          className="streak-admin-btn"
          disabled={Boolean(busy)}
          onClick={() => runAction('advance', adminAdvanceStreakDay)}
        >
          {busy === 'advance' ? 'Advancing…' : 'Advance Streak +1 Day'}
        </button>
      </div>

      <div className="streak-admin-milestones">
        <span className="streak-admin-milestones-label">Set milestone &amp; grant rewards:</span>
        <div className="streak-admin-milestone-grid">
          {CALENDAR_DAYS.map((day) => (
            <button
              key={day}
              type="button"
              className="streak-admin-milestone-btn"
              disabled={Boolean(busy)}
              onClick={() => runAction(`milestone-${day}`, () => adminSetStreakMilestone(day))}
            >
              {busy === `milestone-${day}` ? '…' : `Day ${day}`}
            </button>
          ))}
        </div>
      </div>

      {logs.length ? (
        <div className="streak-admin-log">
          <h3 className="streak-admin-log-title">Test Action Log</h3>
          <ul className="streak-admin-log-list">
            {logs.map((entry, idx) => (
              <li key={`${entry.timestamp}-${entry.action}-${idx}`} className="streak-admin-log-item">
                <span className="streak-admin-log-time">{formatLogTime(entry.timestamp)}</span>
                <span className="streak-admin-log-action">{entry.action}</span>
                <span className="streak-admin-log-detail">{logSummary(entry)}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

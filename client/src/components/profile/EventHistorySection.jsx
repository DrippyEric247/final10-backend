import React from 'react';
import { Link } from 'react-router-dom';

function formatSavvy(n) {
  return Math.round(Number(n) || 0).toLocaleString();
}

function formatDate(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return '—';
  }
}

export default function EventHistorySection({ history = [], loading = false }) {
  const rows = Array.isArray(history) ? history : [];

  return (
    <section className="f10-profile-card" aria-labelledby="f10-event-history-hd">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem' }}>
        <h2 id="f10-event-history-hd" className="f10-profile-card-hd" style={{ margin: 0 }}>
          Event History
        </h2>
        <Link to="/events" className="scout-missions-panel__log-link">
          Live Events
        </Link>
      </div>
      <p className="f10-profile-stat-label" style={{ marginTop: '0.35rem', lineHeight: 1.45 }}>
        Revisit how much extra Savvy you earned from timed events.
      </p>

      {loading ? (
        <p className="f10-profile-stat-label" style={{ marginTop: '0.65rem' }}>
          Loading event history…
        </p>
      ) : null}

      {!loading && rows.length === 0 ? (
        <p className="f10-profile-stat-label" style={{ marginTop: '0.65rem' }}>
          No completed events yet — join the next Double Points, Savvy Sale, or Supply Drop.
        </p>
      ) : null}

      {!loading && rows.length > 0 ? (
        <ul className="f10-event-history-list">
          {rows.map((row) => (
            <li key={row.summaryId} className="f10-event-history-item">
              <div className="f10-event-history-item__main">
                <strong>{row.eventTitle}</strong>
                <span className="f10-event-history-item__date">{formatDate(row.endedAt)}</span>
              </div>
              <div className="f10-event-history-item__meta">
                <span>+{formatSavvy(row.bonusEarned)} bonus</span>
                <span>{row.timeParticipatedLabel || '—'}</span>
                <span>+{row.increasePercent || 0}%</span>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

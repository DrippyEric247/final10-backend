import React from 'react';

function formatXp(n) {
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

export default function ProgressHistorySection({ history = [], loading = false }) {
  const rows = Array.isArray(history) ? history : [];

  return (
    <section className="f10-profile-card" aria-labelledby="f10-progress-history-hd">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem' }}>
        <h2 id="f10-progress-history-hd" className="f10-profile-card-hd" style={{ margin: 0 }}>
          Progress History
        </h2>
      </div>
      <p className="f10-profile-stat-label" style={{ marginTop: '0.35rem', lineHeight: 1.45 }}>
        Review profile XP recaps, level-ups, and what actions drove your growth.
      </p>

      {loading ? (
        <p className="f10-profile-stat-label" style={{ marginTop: '0.65rem' }}>
          Loading progress history…
        </p>
      ) : null}

      {!loading && rows.length === 0 ? (
        <p className="f10-profile-stat-label" style={{ marginTop: '0.65rem' }}>
          No progression recaps yet — complete events, contracts, or missions to earn profile XP.
        </p>
      ) : null}

      {!loading && rows.length > 0 ? (
        <ul className="f10-progress-history-list">
          {rows.map((row) => (
            <li key={row.recapId} className="f10-progress-history-item">
              <div className="f10-progress-history-item__main">
                <strong>{row.title || 'Profile progression'}</strong>
                <span className="f10-event-history-item__date">{formatDate(row.createdAt)}</span>
              </div>
              <div className="f10-progress-history-item__meta">
                <span>+{formatXp(row.xpEarnedTotal)} XP</span>
                {row.topSource ? <span>Top: {row.topSource.label}</span> : null}
                {row.afterSnapshot?.level ? (
                  <span>Level {row.afterSnapshot.level}</span>
                ) : null}
                {(row.levelUpsCrossed || []).length ? (
                  <span>{row.levelUpsCrossed.length} level-up{row.levelUpsCrossed.length === 1 ? '' : 's'}</span>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

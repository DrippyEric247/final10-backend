import React from 'react';

export default function ScoutSupportPanel({ status, onCallInReady }) {
  if (!status) return null;

  const progressPct =
    status.progressTotal > 0
      ? Math.min(100, Math.round((status.progressCurrent / status.progressTotal) * 100))
      : 100;

  const ready = status.milestonesReady || [];

  return (
    <section className="scout-support-panel" aria-labelledby="scout-support-heading">
      <div className="scout-support-panel__header">
        <span id="scout-support-heading" className="scout-support-panel__title">
          🛰️ Scout Support
        </span>
        <span className="scout-support-panel__count">{status.dealStreakCount} deals tracked</span>
      </div>
      <div className="scout-support-panel__bar" aria-hidden>
        <div className="scout-support-panel__fill" style={{ width: `${progressPct}%` }} />
      </div>
      <p className="scout-support-panel__next">
        {status.nextMilestone ? (
          <>
            {status.progressCurrent} / {status.progressTotal} toward next · Next reward:{' '}
            <strong>
              {status.nextMilestone.icon} {status.nextMilestone.label}
            </strong>
          </>
        ) : (
          <>All Scout Support milestones unlocked for this cycle.</>
        )}
      </p>
      {ready.length > 0 ? (
        <div style={{ marginTop: '0.65rem', display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
          {ready.map((m) => (
            <button
              key={m.milestone}
              type="button"
              className="scout-celebration__call"
              style={{ width: 'auto', padding: '0.45rem 0.85rem', fontSize: '0.82rem' }}
              onClick={() => onCallInReady?.(m)}
            >
              Call In {m.icon} {m.label}
            </button>
          ))}
        </div>
      ) : null}
    </section>
  );
}

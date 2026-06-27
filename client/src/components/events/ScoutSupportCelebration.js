import React, { useState } from 'react';
import { claimScoutSupportMilestone } from '../../lib/api';

export default function ScoutSupportCelebration({ milestone, onComplete, onClaimed }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (!milestone) return null;

  async function handleCallIn() {
    setBusy(true);
    setError('');
    try {
      const result = await claimScoutSupportMilestone(milestone.milestone);
      if (typeof onClaimed === 'function') onClaimed(result);
      if (typeof onComplete === 'function') onComplete();
    } catch (e) {
      setError(e?.response?.data?.message || e?.message || 'Could not call in support.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="scout-celebration-overlay" role="dialog" aria-labelledby="scout-celebration-title">
      <div className="scout-celebration">
        <div className="scout-celebration__icon">{milestone.icon || '🛰️'}</div>
        <h2 id="scout-celebration-title" className="scout-celebration__title">
          Scout Support Milestone!
        </h2>
        <p className="scout-celebration__scout">
          &ldquo;Operator&hellip; Scout Support is ready.&rdquo;
        </p>
        <p style={{ color: '#e2e8f0', marginBottom: '1rem', fontSize: '0.9rem' }}>
          {milestone.icon} {milestone.label}
        </p>
        {error ? <p style={{ color: '#fca5a5', fontSize: '0.82rem' }}>{error}</p> : null}
        <button
          type="button"
          className="scout-celebration__call"
          disabled={busy}
          onClick={() => void handleCallIn()}
        >
          {busy ? 'Calling in…' : 'Call In Support'}
        </button>
      </div>
    </div>
  );
}

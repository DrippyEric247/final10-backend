import React, { useEffect, useState } from 'react';
import '../../styles/InventoryTokens.css';

function formatRemaining(expiresAt, nowMs) {
  const ms = new Date(expiresAt).getTime() - nowMs;
  if (ms <= 0) return 'Expired';
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, '0')} remaining`;
}

/**
 * Reusable active boost strip — uses server expiresAt timestamps.
 */
export default function ActiveBoostsBar({ boosts = [], compact = false, className = '' }) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!boosts?.length) return undefined;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [boosts?.length]);

  const live = (boosts || []).filter(
    (b) => b?.expiresAt && new Date(b.expiresAt).getTime() > now
  );
  if (!live.length) return null;

  return (
    <div className={`f10-active-boosts${compact ? ' f10-active-boosts--compact' : ''} ${className}`.trim()}>
      {!compact ? <p className="f10-active-boosts__title">Active Boosts</p> : null}
      <ul className="f10-active-boosts__list">
        {live.map((b) => (
          <li key={b.key || b.type} className="f10-active-boosts__item">
            <span className="f10-active-boosts__icon" aria-hidden>{b.icon}</span>
            <span className="f10-active-boosts__label">{b.label}</span>
            {b.multiplier ? (
              <span className="f10-active-boosts__mult">{b.multiplier}×</span>
            ) : null}
            <span className="f10-active-boosts__timer">{formatRemaining(b.expiresAt, now)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

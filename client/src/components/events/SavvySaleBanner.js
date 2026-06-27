import React from 'react';
import { formatTimer } from './MaxSupplyDropModal';

export default function SavvySaleBanner({ sale, msRemaining, onClick }) {
  if (!sale?.active) return null;

  const inner = (
    <>
      <span>🔥</span>
      <span>Savvy Sale active — all spins 10 Savvy · {formatTimer(msRemaining)}</span>
    </>
  );

  if (typeof onClick === 'function') {
    return (
      <button type="button" className="live-events-banner live-events-banner--sale" onClick={onClick}>
        {inner}
      </button>
    );
  }

  return <div className="live-events-banner live-events-banner--sale">{inner}</div>;
}

export function SavvySalePerkBadge({ sale, msRemaining, scoutLine }) {
  if (!sale?.active) return null;
  return (
    <>
      <div className="perk-savvy-sale-badge">🔥 SAVVY SALE ACTIVE</div>
      <div className="perk-savvy-sale-timer">Ends in {formatTimer(msRemaining)}</div>
      {scoutLine ? (
        <p className="perk-savvy-sale-scout">
          &ldquo;Operator&hellip; the machine is running at emergency pricing.&rdquo;
        </p>
      ) : null}
    </>
  );
}

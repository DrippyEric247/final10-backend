import React from 'react';
import { formatTimer } from './MaxSupplyDropModal';

export default function SupplyDropBanner({ drop, msRemaining, onOpen }) {
  if (!drop || drop.expired || drop.alreadyClaimed) return null;

  return (
    <button
      type="button"
      className="live-events-banner live-events-banner--drop"
      onClick={onOpen}
      aria-label="Max Supply Drop available"
    >
      <span>📦</span>
      <span>Supply Drop expires in {formatTimer(msRemaining)}</span>
    </button>
  );
}

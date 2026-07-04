import React from 'react';
import { DEAL_PHILOSOPHY_LANES } from '../../lib/primaryNavigation';
import '../../styles/DealPhilosophyBanner.css';

/**
 * Premium helper strip for Alerts, Quick Snipes, and Auctions.
 * @param {{ lane: 'alerts' | 'quickSnipes' | 'auctions', className?: string }} props
 */
export default function DealPhilosophyBanner({ lane, className = '' }) {
  const config = DEAL_PHILOSOPHY_LANES[lane];
  if (!config) return null;

  return (
    <div className={`deal-philosophy-banner deal-philosophy-banner--${lane} ${className}`.trim()} role="note">
      <div className="deal-philosophy-banner__meta">
        <span className="deal-philosophy-banner__step">Step {config.step}</span>
        <span className="deal-philosophy-banner__philosophy">{config.philosophy}</span>
      </div>
      <p className="deal-philosophy-banner__helper">{config.helperText}</p>
    </div>
  );
}

import React from 'react';

/**
 * Single market / intel block (trend, competition, price, timing).
 */
export default function MarketSignalCard({ icon, title, children, pulse }) {
  return (
    <div className={`wsp-signal ${pulse ? 'wsp-signal--pulse' : ''}`}>
      <div className="wsp-signal__head">
        <span className="wsp-signal__icon" aria-hidden>
          {icon}
        </span>
        <span className="wsp-signal__title">{title}</span>
      </div>
      <p className="wsp-signal__body">{children}</p>
    </div>
  );
}

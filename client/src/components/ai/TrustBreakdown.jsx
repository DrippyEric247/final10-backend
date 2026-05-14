import React from 'react';

export default function TrustBreakdown({ bullets }) {
  if (!bullets || !bullets.length) return null;
  return (
    <div className="wsp-trust">
      <div className="wsp-trust__title">
        <span aria-hidden>🛡</span> Trusted Seller Analysis
      </div>
      <ul className="wsp-trust__list">
        {bullets.map((b) => (
          <li key={b}>{b}</li>
        ))}
      </ul>
    </div>
  );
}

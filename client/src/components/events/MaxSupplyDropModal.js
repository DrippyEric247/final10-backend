import React from 'react';

function formatTimer(ms) {
  if (ms == null || ms <= 0) return '00:00';
  const totalSec = Math.ceil(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function MaxSupplyDropModal({
  drop,
  msRemaining,
  claiming,
  onClaim,
  onDismiss,
}) {
  if (!drop || drop.expired || drop.alreadyClaimed) return null;

  return (
    <div className="supply-drop-overlay" role="dialog" aria-labelledby="supply-drop-title">
      <div className="supply-drop-modal">
        <div className="supply-drop-modal__smoke" aria-hidden />
        <div className="supply-drop-modal__crate" aria-hidden>
          📦
        </div>
        <h2 id="supply-drop-title" className="supply-drop-modal__title">
          📦 Max Supply Drop Detected!
        </h2>
        <p className="supply-drop-modal__subtitle">Savvy Scout intercepted a reward crate.</p>
        <div className="supply-drop-modal__timer" aria-live="polite">
          {formatTimer(msRemaining)}
        </div>
        <p className="supply-drop-modal__scout">
          &ldquo;Operator&hellip; I&apos;ve got a supply crate on the scope. Claim it before the window closes.&rdquo;
        </p>
        <button
          type="button"
          className="supply-drop-modal__claim"
          disabled={claiming}
          onClick={() => onClaim(drop.dropId)}
        >
          {claiming ? 'Claiming…' : 'Claim Supply Drop'}
        </button>
        <button type="button" className="supply-drop-modal__dismiss" onClick={onDismiss}>
          Minimize — I&apos;ll grab it from the banner
        </button>
      </div>
    </div>
  );
}

export { formatTimer };

import React from 'react';
import { writePersistedSearchMode } from '../../lib/dealSearchMode';

const MODES = [
  { id: 'best_move', label: 'Best Move', hint: 'Default', icon: '⭐' },
  { id: 'auction', label: 'Auctions', icon: '🔨' },
  { id: 'buy_now', label: 'Buy It Now', icon: '🛒' },
];

export default function DealSearchModeSelector({ mode, onChange, className = '' }) {
  const handleChange = (next) => {
    if (next === mode) return;
    writePersistedSearchMode(next);
    onChange(next);
  };

  return (
    <div className={`qscc-search-mode ${className}`.trim()} role="group" aria-label="Search mode">
      <span className="qscc-search-mode__label">Search Mode</span>
      <div className="qscc-search-mode__options">
        {MODES.map((m) => {
          const active = mode === m.id;
          return (
            <button
              key={m.id}
              type="button"
              aria-pressed={active}
              className={`qscc-search-mode__btn ${active ? 'is-active' : ''}`}
              onClick={() => handleChange(m.id)}
            >
              <span className="qscc-search-mode__icon" aria-hidden>
                {m.icon}
              </span>
              <span className="qscc-search-mode__text">
                {m.label}
                {m.hint ? <span className="qscc-search-mode__hint"> ({m.hint})</span> : null}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

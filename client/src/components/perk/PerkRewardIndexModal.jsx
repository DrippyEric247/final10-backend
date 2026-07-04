import React, { useEffect } from 'react';
import { PERK_REWARD_INDEX } from '../../lib/perkMachineRewardIndex';
import '../../styles/PerkRewardIndex.css';

export default function PerkRewardIndexModal({ open, onClose }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="perk-reward-index-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="perk-reward-index-title"
      onClick={onClose}
    >
      <div className="perk-reward-index-modal" onClick={(e) => e.stopPropagation()}>
        <header className="perk-reward-index-modal__header">
          <h2 id="perk-reward-index-title" className="perk-reward-index-modal__title">
            ℹ️ Reward Index
          </h2>
          <button type="button" className="perk-reward-index-modal__close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </header>
        <p className="perk-reward-index-modal__intro">
          Every possible reward from the Savvy Perk Machine, explained.
        </p>
        <ul className="perk-reward-index-list">
          {PERK_REWARD_INDEX.map((entry) => (
            <li
              key={entry.id}
              className={`perk-reward-index-item ${entry.id === 'multiplier_2x' ? 'perk-reward-index-item--multiplier' : ''}`}
            >
              <div className="perk-reward-index-item__head">
                <span className="perk-reward-index-item__icon" aria-hidden>
                  {entry.icon}
                </span>
                <span className="perk-reward-index-item__title">{entry.title}</span>
              </div>
              <p className="perk-reward-index-item__desc">{entry.description}</p>
              {entry.examples?.length ? (
                <ul className="perk-reward-index-item__examples">
                  {entry.examples.map((ex) => (
                    <li key={ex}>{ex}</li>
                  ))}
                </ul>
              ) : null}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

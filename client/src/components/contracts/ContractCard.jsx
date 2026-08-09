import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

function formatCountdown(ms) {
  if (ms == null) return null;
  if (ms <= 0) return 'Expired';
  const totalMin = Math.ceil(ms / 60000);
  if (totalMin < 60) return `${totalMin}m left`;
  const hours = Math.floor(totalMin / 60);
  const mins = totalMin % 60;
  if (hours < 48) return mins ? `${hours}h ${mins}m left` : `${hours}h left`;
  const days = Math.floor(hours / 24);
  return `${days}d left`;
}

/**
 * Single contract card for the universal Contracts hub.
 * @param {{ contract: object, onClaim?: (id: string) => void, claiming?: boolean }} props
 */
export default function ContractCard({ contract, onClaim, claiming = false }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!contract.expiresAt) return undefined;
    const id = window.setInterval(() => setNow(Date.now()), 30000);
    return () => window.clearInterval(id);
  }, [contract.expiresAt]);

  const pct = contract.target
    ? Math.min(100, Math.round((contract.progress / contract.target) * 100))
    : 0;

  const expiresInMs =
    contract.expiresAt != null
      ? new Date(contract.expiresAt).getTime() - now
      : contract.expiresInMs;
  const countdownLabel =
    contract.expiresLabel || (expiresInMs != null ? formatCountdown(expiresInMs) : null);
  const isExpired = contract.isExpired || (expiresInMs != null && expiresInMs <= 0);
  const isHiddenUndiscovered = contract.isHidden && contract.isDiscovered === false;

  return (
    <motion.article
      className={`f10-contract-card f10-contract-card--${contract.type || 'daily'} ${
        isExpired ? 'is-expired' : contract.isClaimed ? 'is-claimed' : contract.isCompleted ? 'is-complete' : ''
      } ${isHiddenUndiscovered ? 'is-hidden' : ''}`}
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <div className="f10-contract-card__head">
        <span className="f10-contract-card__icon" aria-hidden>
          {contract.icon || '📋'}
        </span>
        <div className="f10-contract-card__titles">
          <h3>{contract.title}</h3>
          <p>{contract.description}</p>
        </div>
        {contract.difficulty ? (
          <span className={`f10-contract-card__diff f10-contract-card__diff--${contract.difficulty}`}>
            {contract.difficulty}
          </span>
        ) : null}
      </div>

      {countdownLabel ? (
        <div
          className={`f10-contract-card__timer ${isExpired ? 'is-expired' : ''}`}
          role="status"
          aria-live="polite"
        >
          {isExpired ? 'Expired' : countdownLabel}
        </div>
      ) : null}

      <div className="f10-contract-card__progress">
        <div className="f10-contract-card__progress-meta">
          <span>
            {isHiddenUndiscovered ? '? / ?' : `${contract.progress} / ${contract.target}`}
          </span>
          <span className="f10-contract-card__type">{String(contract.type || '').replace(/_/g, ' ')}</span>
        </div>
        <div className="f10-camo-card__track" role="presentation">
          <motion.div
            className="f10-camo-card__fill"
            initial={false}
            animate={{ width: isHiddenUndiscovered ? '0%' : `${pct}%` }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
          />
        </div>
      </div>

      <div className="f10-contract-card__reward">
        Reward: <strong>{contract.rewardLabel || contract.reward?.label || 'Savvy'}</strong>
      </div>

      {contract.canClaim ? (
        <button
          type="button"
          className="f10-contract-card__claim"
          disabled={claiming}
          onClick={() => onClaim?.(contract.id)}
        >
          {claiming ? 'CLAIMING…' : 'CLAIM REWARD'}
        </button>
      ) : contract.isClaimed ? (
        <div className="f10-contract-card__status is-claimed">CLAIMED</div>
      ) : isExpired ? (
        <div className="f10-contract-card__status is-expired">EXPIRED</div>
      ) : contract.isCompleted ? (
        <div className="f10-contract-card__status is-complete">COMPLETE</div>
      ) : isHiddenUndiscovered ? (
        <div className="f10-contract-card__status is-hidden">UNDISCOVERED</div>
      ) : null}
    </motion.article>
  );
}

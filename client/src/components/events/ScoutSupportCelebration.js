import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { claimScoutSupportMilestone } from '../../lib/api';
import { playScoutMilestoneSound, playScoutRewardSound } from '../../lib/scoutEventAudio';

function resolveInitialPhase(milestone, milestonesClaimed = []) {
  if (!milestone) return 'unavailable';
  if (milestonesClaimed.includes(Number(milestone.milestone))) return 'already_claimed';
  return 'ready';
}

function primaryLabel(phase, milestone) {
  switch (phase) {
    case 'claiming':
      return 'Claiming…';
    case 'success':
      return milestone?.rewardType === 'supply_drop' ? 'View Supply Drops' : 'Continue';
    case 'already_claimed':
      return 'Continue';
    case 'unavailable':
      return 'Close';
    default:
      if (milestone?.rewardType === 'supply_drop') return 'Call In Support';
      return 'Claim Reward';
  }
}

export default function ScoutSupportCelebration({
  milestone,
  milestonesClaimed = [],
  onComplete,
  onClaimed,
  onViewSupplyDrops,
}) {
  const [phase, setPhase] = useState(() => resolveInitialPhase(milestone, milestonesClaimed));
  const [error, setError] = useState('');
  const [resultLabel, setResultLabel] = useState('');

  useEffect(() => {
    setPhase(resolveInitialPhase(milestone, milestonesClaimed));
    setError('');
    setResultLabel('');
  }, [milestone, milestonesClaimed]);

  const handleClose = useCallback(() => {
    if (typeof onComplete === 'function') onComplete();
  }, [onComplete]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') handleClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleClose]);

  const handlePrimary = useCallback(async () => {
    if (!milestone) return;

    if (phase === 'already_claimed' || phase === 'unavailable') {
      handleClose();
      return;
    }

    if (phase === 'success') {
      if (milestone.rewardType === 'supply_drop' && typeof onViewSupplyDrops === 'function') {
        onViewSupplyDrops();
      }
      handleClose();
      return;
    }

    setError('');
    setPhase('claiming');
    try {
      const result = await claimScoutSupportMilestone(milestone.milestone);
      setResultLabel(result?.label || milestone.label || 'Reward activated');
      setPhase('success');
      playScoutRewardSound();
      if (typeof onClaimed === 'function') await onClaimed(result);
    } catch (e) {
      const code = e?.response?.data?.code || e?.code;
      const message = e?.response?.data?.message || e?.message || 'Could not claim milestone.';
      if (code === 'ALREADY_CLAIMED') {
        setPhase('already_claimed');
        setError('');
      } else {
        setError(message);
        setPhase('ready');
      }
    }
  }, [handleClose, milestone, onClaimed, onViewSupplyDrops, phase]);

  useEffect(() => {
    if (phase === 'ready') playScoutMilestoneSound();
  }, [milestone?.milestone, phase]);

  const scoutLine = useMemo(() => {
    if (phase === 'success') {
      return `"Support deployed, Operator. ${resultLabel} is live."`;
    }
    if (phase === 'already_claimed') {
      return '"This milestone is already in your log, Operator. Moving on."';
    }
    return '"Operator… Scout Support is ready."';
  }, [phase, resultLabel]);

  if (!milestone) return null;

  return (
    <div
      className="scout-celebration-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="scout-celebration-title"
      onClick={handleClose}
    >
      <div
        className={`scout-celebration ${phase === 'success' ? 'scout-celebration--success' : ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className="scout-celebration__close"
          aria-label="Close"
          onClick={handleClose}
        >
          <X size={20} aria-hidden />
        </button>

        <div className="scout-celebration__icon">{phase === 'success' ? '🎉' : milestone.icon || '🛰️'}</div>
        <h2 id="scout-celebration-title" className="scout-celebration__title">
          {phase === 'success' ? 'Milestone Reward Active!' : 'Scout Support Milestone!'}
        </h2>
        <p className="scout-celebration__scout">{scoutLine}</p>
        <p className="scout-celebration__label">
          {milestone.icon} {milestone.label}
        </p>

        {phase === 'success' ? (
          <div className="scout-celebration__reward-card" aria-live="polite">
            <span className="scout-celebration__reward-burst" aria-hidden />
            ✓ {resultLabel}
          </div>
        ) : null}

        {phase === 'already_claimed' ? (
          <p className="scout-celebration__claimed-note">This reward was already claimed.</p>
        ) : null}

        {error ? <p className="scout-celebration__error">{error}</p> : null}

        <button
          type="button"
          className="scout-celebration__call"
          disabled={phase === 'claiming'}
          onClick={() => void handlePrimary()}
        >
          {primaryLabel(phase, milestone)}
        </button>

        {phase === 'ready' ? (
          <button type="button" className="scout-celebration__secondary" onClick={handleClose}>
            Continue later
          </button>
        ) : null}
      </div>
    </div>
  );
}

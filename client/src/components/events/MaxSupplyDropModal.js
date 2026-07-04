import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { playScoutRewardSound } from '../../lib/scoutEventAudio';

function formatTimer(ms) {
  if (ms == null || ms <= 0) return '00:00';
  const totalSec = Math.ceil(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function resolveInitialPhase(drop) {
  if (!drop) return 'unavailable';
  if (drop.alreadyClaimed) return 'already_claimed';
  if (drop.expired) return 'expired';
  return 'available';
}

function primaryLabel(phase) {
  switch (phase) {
    case 'claiming':
      return 'Claiming…';
    case 'success':
      return 'Continue';
    case 'already_claimed':
    case 'expired':
    case 'unavailable':
      return 'Continue';
    default:
      return 'Claim Reward';
  }
}

export default function MaxSupplyDropModal({
  drop,
  msRemaining,
  onClaim,
  onClose,
  onViewEvents,
}) {
  const [phase, setPhase] = useState(() => resolveInitialPhase(drop));
  const [rewardLabel, setRewardLabel] = useState(drop?.rewardPreview?.label || '');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    setPhase(resolveInitialPhase(drop));
    setRewardLabel(drop?.rewardPreview?.label || '');
    setErrorMsg('');
  }, [drop?.dropId, drop?.alreadyClaimed, drop?.expired, drop?.rewardPreview?.label]);

  useEffect(() => {
    if (phase !== 'success') return undefined;
    const id = window.setTimeout(() => {
      /* success confirmation visible before user taps Continue */
    }, 2200);
    return () => window.clearTimeout(id);
  }, [phase]);

  const handleClose = useCallback(() => {
    if (typeof onClose === 'function') onClose();
  }, [onClose]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') handleClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleClose]);

  const handlePrimary = useCallback(async () => {
    if (phase === 'success' || phase === 'already_claimed' || phase === 'expired' || phase === 'unavailable') {
      handleClose();
      return;
    }
    if (phase === 'claiming' || !drop?.dropId) return;

    setErrorMsg('');
    setPhase('claiming');
    try {
      const result = await onClaim(drop.dropId);
      const label = result?.reward?.label || result?.rewardLabel || 'Reward secured';
      setRewardLabel(label);
      setPhase('success');
      playScoutRewardSound();
    } catch (e) {
      const code = e?.response?.data?.code || e?.code;
      const message = e?.response?.data?.message || e?.message || 'Claim failed.';
      if (code === 'ALREADY_CLAIMED') {
        setPhase('already_claimed');
        setErrorMsg('');
      } else if (code === 'DROP_EXPIRED') {
        setPhase('expired');
        setErrorMsg('This supply drop has expired.');
      } else {
        setErrorMsg(message);
        setPhase('available');
      }
    }
  }, [drop?.dropId, handleClose, onClaim, phase]);

  const subtitle = useMemo(() => {
    if (phase === 'success') return 'Reward added to your inventory.';
    if (phase === 'already_claimed') return 'You already claimed this Max Supply Drop.';
    if (phase === 'expired') return 'This crate window has closed.';
    if (phase === 'unavailable') return 'No active supply drop right now.';
    return 'Savvy Scout intercepted a reward crate.';
  }, [phase]);

  const scoutLine = useMemo(() => {
    if (phase === 'success') {
      return `"Crate opened, Operator. ${rewardLabel ? `${rewardLabel} is yours.` : 'Inventory updated.'}"`;
    }
    if (phase === 'already_claimed') {
      return '"Already logged in your manifest, Operator. Nothing left in this crate."';
    }
    if (phase === 'expired') {
      return '"Window closed on that crate. Scout is scanning for the next drop."';
    }
    return '"Operator… I\'ve got a supply crate on the scope. Claim it before the window closes."';
  }, [phase, rewardLabel]);

  if (!drop && phase === 'unavailable') return null;

  const showTimer = phase === 'available' || phase === 'claiming';
  const showCrateAnim = phase === 'available' || phase === 'claiming' || phase === 'success';

  return (
    <div
      className="supply-drop-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="supply-drop-title"
      onClick={handleClose}
    >
      <div
        className={`supply-drop-modal ${phase === 'success' ? 'supply-drop-modal--success' : ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className="supply-drop-modal__close"
          aria-label="Close"
          onClick={handleClose}
        >
          <X size={20} aria-hidden />
        </button>

        <div className="supply-drop-modal__smoke" aria-hidden />
        {showCrateAnim ? (
          <div className={`supply-drop-modal__crate ${phase === 'success' ? 'is-opened' : ''}`} aria-hidden>
            {phase === 'success' ? '🎁' : '📦'}
          </div>
        ) : null}

        <h2 id="supply-drop-title" className="supply-drop-modal__title">
          {phase === 'success' ? '🎉 Reward Claimed!' : '📦 Max Supply Drop Detected!'}
        </h2>
        <p className="supply-drop-modal__subtitle">{subtitle}</p>

        {phase === 'success' && rewardLabel ? (
          <div className="supply-drop-modal__reward-card" aria-live="polite">
            <span className="supply-drop-modal__reward-burst" aria-hidden />
            🎁 {rewardLabel}
          </div>
        ) : null}

        {showTimer ? (
          <div className="supply-drop-modal__timer" aria-live="polite">
            {formatTimer(msRemaining)}
          </div>
        ) : null}

        <p className="supply-drop-modal__scout">{scoutLine}</p>

        {errorMsg ? <p className="supply-drop-modal__error">{errorMsg}</p> : null}

        <button
          type="button"
          className="supply-drop-modal__claim"
          disabled={phase === 'claiming'}
          onClick={() => void handlePrimary()}
        >
          {primaryLabel(phase)}
        </button>

        {phase === 'available' ? (
          <button type="button" className="supply-drop-modal__dismiss" onClick={handleClose}>
            Minimize — grab it from the banner
          </button>
        ) : null}

        {(phase === 'already_claimed' || phase === 'expired') && typeof onViewEvents === 'function' ? (
          <button type="button" className="supply-drop-modal__dismiss" onClick={onViewEvents}>
            View Supply Drops
          </button>
        ) : null}
      </div>
    </div>
  );
}

export { formatTimer };

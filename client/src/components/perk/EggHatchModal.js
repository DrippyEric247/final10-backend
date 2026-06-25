import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  rewardFx,
  resolveRevealLevel,
  scoutRevealLine,
  getEggTier,
} from '../../lib/eggHatchery';

const SCOUT_IMG = '/assets/perk-machine/savvy-scout-alive.png';

// Hatch animation timeline (ms) — tuned to build anticipation (~3.4s).
const STAGE_CRACK_AT = 1600;
const STAGE_FLASH_AT = 2800;
const STAGE_MIN_TOTAL = 3400;

function Particles({ count = 18, className }) {
  const items = useMemo(() => Array.from({ length: count }, (_, i) => i), [count]);
  return (
    <div className={className} aria-hidden>
      {items.map((i) => (
        <span
          key={i}
          style={{
            left: `${(i * 5.4 + 4) % 100}%`,
            animationDelay: `${(i % 9) * 0.4}s`,
            animationDuration: `${6 + (i % 5) * 1.6}s`,
          }}
        />
      ))}
    </div>
  );
}

export default function EggHatchModal({ tier, onHatch, onClose, onStatusUpdate }) {
  const [phase, setPhase] = useState('intro'); // intro | hatching | reveal | error
  const [stage, setStage] = useState('idle'); // charging | cracking | flash
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [remaining, setRemaining] = useState(tier.owned);
  const timers = useRef([]);
  const mounted = useRef(true);

  const eggTier = getEggTier(tier.key);

  const clearTimers = useCallback(() => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
  }, []);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      clearTimers();
    };
  }, [clearTimers]);

  const closeable = phase === 'intro' || phase === 'reveal' || phase === 'error';

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape' && closeable) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [closeable, onClose]);

  const startHatch = useCallback(() => {
    setError('');
    setResult(null);
    setPhase('hatching');
    setStage('charging');

    const apiPromise = Promise.resolve().then(() => onHatch(tier.key));
    const minAnim = new Promise((res) => {
      timers.current.push(window.setTimeout(res, STAGE_MIN_TOTAL));
    });
    timers.current.push(window.setTimeout(() => mounted.current && setStage('cracking'), STAGE_CRACK_AT));
    timers.current.push(window.setTimeout(() => mounted.current && setStage('flash'), STAGE_FLASH_AT));

    Promise.all([apiPromise, minAnim])
      .then(([res]) => {
        if (!mounted.current) return;
        setResult(res);
        const invKey = eggTier.inventoryKey;
        const left = Number(res?.status?.eggInventory?.[invKey]);
        setRemaining(Number.isFinite(left) ? left : Math.max(0, tier.owned - 1));
        setPhase('reveal');
        if (typeof onStatusUpdate === 'function' && res?.status) onStatusUpdate(res.status);
      })
      .catch((e) => {
        if (!mounted.current) return;
        clearTimers();
        setError(e?.response?.data?.message || e?.message || 'Hatch failed. Please try again.');
        setPhase('error');
      });
  }, [onHatch, tier.key, tier.owned, eggTier.inventoryKey, onStatusUpdate, clearTimers]);

  const hatchAnother = useCallback(() => {
    clearTimers();
    setResult(null);
    setStage('idle');
    setPhase('intro');
  }, [clearTimers]);

  const reward = result?.reward;
  const level = reward ? resolveRevealLevel(tier.key, reward.rarity) : 'calm';
  const fx = reward ? rewardFx(reward.rarity) : null;

  const rootStyle = {
    '--egg-color': eggTier.color,
    '--egg-glow': eggTier.glow,
    '--egg-aura': eggTier.aura,
  };

  return (
    <div
      className={`hatch-modal hatch-modal--${phase} hatch-modal--stage-${stage} hatch-modal--lvl-${level}`}
      style={rootStyle}
      role="dialog"
      aria-modal="true"
      aria-label={`${eggTier.name} hatchery`}
      onClick={(e) => {
        if (e.target === e.currentTarget && closeable) onClose();
      }}
    >
      <div className="hatch-modal__backdrop" aria-hidden />
      <Particles count={20} className="hatch-modal__particles" />

      {/* Room-wide reveal effects */}
      <div className="hatch-modal__gold-flash" aria-hidden />
      <div className="hatch-modal__lightning" aria-hidden>
        <span /><span /><span />
      </div>
      {fx?.confetti && phase === 'reveal' ? (
        <div className="hatch-modal__confetti" aria-hidden>
          {Array.from({ length: 28 }, (_, i) => (
            <span
              key={i}
              style={{
                left: `${(i * 3.6 + 2) % 100}%`,
                animationDelay: `${(i % 10) * 0.12}s`,
                background: i % 3 === 0 ? '#fbbf24' : i % 3 === 1 ? '#a855f7' : '#4ade80',
              }}
            />
          ))}
        </div>
      ) : null}

      <button
        type="button"
        className="hatch-modal__close"
        onClick={onClose}
        disabled={!closeable}
        aria-label="Close hatchery"
      >
        ✕
      </button>

      <div className="hatch-modal__stage">
        {/* The egg */}
        {phase !== 'reveal' ? (
          <div className="hatch-modal__egg-wrap">
            <span className="hatch-modal__egg-aura" aria-hidden />
            <span className="hatch-modal__egg" aria-hidden>
              <span className="hatch-modal__egg-energy" />
              <span className="hatch-modal__egg-shine" />
              <span className="hatch-modal__crack hatch-modal__crack--1" />
              <span className="hatch-modal__crack hatch-modal__crack--2" />
              <span className="hatch-modal__crack hatch-modal__crack--3" />
            </span>
            <span className="hatch-modal__steam hatch-modal__steam--1" />
            <span className="hatch-modal__steam hatch-modal__steam--2" />
            <span className="hatch-modal__flash" aria-hidden />
          </div>
        ) : null}

        {/* Reward reveal */}
        {phase === 'reveal' && reward ? (
          <div className={`hatch-reward hatch-reward--${reward.rarity}`}>
            <span className="hatch-reward__spotlight" aria-hidden />
            <div className="hatch-reward__card">
              <span className="hatch-reward__rarity" style={{ color: fx.color }}>
                {fx.label}
              </span>
              <span className="hatch-reward__icon">{reward.icon || '🎁'}</span>
              <span className="hatch-reward__label">{reward.label}</span>
              {reward.savvyGranted ? (
                <span className="hatch-reward__sub">+{reward.savvyGranted} Savvy added</span>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>

      {/* Scout + dialogue / actions */}
      <div className="hatch-modal__footer">
        <div className="hatch-modal__scout">
          <img src={SCOUT_IMG} alt="" className="hatch-modal__scout-img" aria-hidden />
        </div>

        <div className="hatch-modal__dialogue">
          {phase === 'intro' ? (
            <>
              <p className="hatch-modal__line">{eggTier.dialogue}</p>
              <button type="button" className="hatch-modal__hatch-btn" onClick={startHatch}>
                ⚡ Hatch {eggTier.name}
              </button>
            </>
          ) : null}

          {phase === 'hatching' ? (
            <p className="hatch-modal__line hatch-modal__line--busy">
              {stage === 'cracking' || stage === 'flash'
                ? 'Energy peaking... stand by, Operator.'
                : 'Channeling Savvy energy into the egg...'}
            </p>
          ) : null}

          {phase === 'reveal' && reward ? (
            <>
              <p className="hatch-modal__line">{scoutRevealLine(level)}</p>
              <div className="hatch-modal__actions">
                {remaining > 0 ? (
                  <button type="button" className="hatch-modal__hatch-btn" onClick={hatchAnother}>
                    Hatch Another ({remaining})
                  </button>
                ) : null}
                <button type="button" className="hatch-modal__done-btn" onClick={onClose}>
                  Done
                </button>
              </div>
            </>
          ) : null}

          {phase === 'error' ? (
            <>
              <p className="hatch-modal__line hatch-modal__line--error">{error}</p>
              <button type="button" className="hatch-modal__done-btn" onClick={onClose}>
                Close
              </button>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

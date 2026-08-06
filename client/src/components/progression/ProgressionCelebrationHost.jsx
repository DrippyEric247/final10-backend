import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { PROGRESSION_CELEBRATION_EVENT } from '../../lib/progressionCelebrationBus';
import { playPerkRewardRevealSound } from '../../lib/perkMachineSfx';
import { WALLET_AWARD_EVENT } from '../../lib/pointsEngine';
import { BP_TIER_COMPLETE_EVENT } from '../../lib/battlePassConfig';
import { SAVVY_CHANGE_LOG } from '../../lib/applyServerSavvyBalance';
import '../../styles/ProgressionCelebration.css';

function playXpSound() {
  try {
    playPerkRewardRevealSound();
  } catch {
    /* ignore */
  }
}

function playCoinSound() {
  try {
    const ctx = window.AudioContext || window.webkitAudioContext;
    if (!ctx) return;
    const ac = new ctx();
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ac.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1320, ac.currentTime + 0.08);
    gain.gain.setValueAtTime(0.08, ac.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.22);
    osc.connect(gain);
    gain.connect(ac.destination);
    osc.start();
    osc.stop(ac.currentTime + 0.24);
  } catch {
    /* ignore */
  }
}

export default function ProgressionCelebrationHost() {
  const navigate = useNavigate();
  const [bursts, setBursts] = useState([]);
  const [shake, setShake] = useState(false);

  const lastBurstRef = useRef('');

  const pushBurst = useCallback((detail) => {
    const dedupeKey = `${detail.kind}:${detail.amount}:${detail.source}:${Math.floor((detail.ts || Date.now()) / 400)}`;
    if (lastBurstRef.current === dedupeKey) return;
    lastBurstRef.current = dedupeKey;
    const id = `cel-${detail.ts || Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setBursts((prev) => [...prev.slice(-4), { ...detail, id }]);
    if (detail.kind === 'savvy' || detail.kind === 'generic') playCoinSound();
    else playXpSound();
    if (detail.screenShake) {
      setShake(true);
      window.setTimeout(() => setShake(false), 420);
    }
    if (detail.navigateBattlePass) {
      window.setTimeout(() => {
        if (!window.location.pathname.startsWith('/battle-pass')) {
          navigate('/battle-pass');
        }
      }, 900);
    }
    window.setTimeout(() => {
      setBursts((prev) => prev.filter((b) => b.id !== id));
    }, 2800);
  }, [navigate]);

  useEffect(() => {
    const onCelebration = (e) => pushBurst(e.detail || {});
    const onWallet = (e) => {
      const d = e.detail || {};
      if (d.mirrorOnly === false) return;
      const amt = Math.max(0, Math.round(Number(d.amount) || 0));
      if (!amt) return;
      pushBurst({
        kind: 'savvy',
        amount: amt,
        label: `+${amt.toLocaleString()} Savvy`,
        icon: '🪙',
        rarity: d.rarity || 'NORMAL',
        source: d.type || 'wallet',
        screenShake: amt >= 50,
        ts: Date.now(),
      });
    };
    const onSavvyChange = (e) => {
      const d = e.detail || {};
      const added = Math.round(Number(d.amountAdded) || 0);
      if (added <= 0) return;
      pushBurst({
        kind: 'savvy',
        amount: added,
        label: `+${added.toLocaleString()} Savvy`,
        icon: '🪙',
        source: d.source || 'server',
        screenShake: added >= 50,
        ts: Date.now(),
      });
    };
    const onTier = (e) => {
      const d = e.detail || {};
      pushBurst({
        kind: 'tier_unlock',
        amount: 0,
        label: d?.reward?.label || 'Tier Unlocked!',
        icon: '🏆',
        navigateBattlePass: true,
        screenShake: true,
        ts: Date.now(),
      });
    };

    window.addEventListener(PROGRESSION_CELEBRATION_EVENT, onCelebration);
    window.addEventListener(WALLET_AWARD_EVENT, onWallet);
    window.addEventListener(SAVVY_CHANGE_LOG, onSavvyChange);
    window.addEventListener(BP_TIER_COMPLETE_EVENT, onTier);
    return () => {
      window.removeEventListener(PROGRESSION_CELEBRATION_EVENT, onCelebration);
      window.removeEventListener(WALLET_AWARD_EVENT, onWallet);
      window.removeEventListener(SAVVY_CHANGE_LOG, onSavvyChange);
      window.removeEventListener(BP_TIER_COMPLETE_EVENT, onTier);
    };
  }, [pushBurst]);

  const reduceMotion =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;

  return (
    <div
      className={`f10-prog-celebrate-root${shake && !reduceMotion ? ' f10-prog-celebrate-root--shake' : ''}`}
      aria-live="polite"
    >
      <AnimatePresence>
        {bursts.map((b) => (
          <motion.div
            key={b.id}
            className={`f10-prog-celebrate f10-prog-celebrate--${b.rarity || 'NORMAL'} f10-prog-celebrate--${b.kind}`}
            initial={reduceMotion ? false : { opacity: 0, scale: 0.82, y: 24 }}
            animate={{ opacity: 1, scale: 1, y: -12 }}
            exit={{ opacity: 0, scale: 0.9, y: -48 }}
            transition={{ type: 'spring', stiffness: 340, damping: 22 }}
          >
            <span className="f10-prog-celebrate__burst" aria-hidden />
            <span className="f10-prog-celebrate__icon">{b.icon}</span>
            <strong className="f10-prog-celebrate__label">{b.label}</strong>
            {b.subtitle ? <span className="f10-prog-celebrate__sub">{b.subtitle}</span> : null}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

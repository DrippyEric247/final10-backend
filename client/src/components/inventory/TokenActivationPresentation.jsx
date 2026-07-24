import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { resolveInventoryTokenDef } from '../../lib/inventoryTokens';
import { clearActivationPresentation } from '../../lib/inventoryActivationBus';
import { playPerkMultiplierActivationSound } from '../../lib/perkMachineSfx';
import {
  duckAppMusic,
  unduckAppMusic,
} from '../../lib/appMusicCoordinator';
import { MENU_MUSIC_DUCK } from '../../lib/menuMusicEngine';
import { playScoutVoiceLine } from '../../lib/scoutVoiceLines';
import '../../styles/InventoryTokens.css';

function formatTimer(expiresAt) {
  if (!expiresAt) return '30:00';
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return '0:00';
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function TokenActivationPresentation({
  payload,
  progression,
  onDone,
}) {
  const [phase, setPhase] = useState('intro');
  const [timerLabel, setTimerLabel] = useState('30:00');
  const def = useMemo(() => resolveInventoryTokenDef(payload?.itemType), [payload?.itemType]);
  const reduceMotion =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;

  const bp = progression?.battlePass;
  const profile = progression?.profileLevel || progression?.userLevel;
  const pendingXp = payload?.pendingXpBreakdown;

  useEffect(() => {
    duckAppMusic(MENU_MUSIC_DUCK.VOICE_LINE);
    playPerkMultiplierActivationSound();
    if (payload?.itemType === 'battle_pass_xp_token') {
      playScoutVoiceLine('battle_pass_boost');
    } else if (payload?.itemType === 'savvy_level_xp_token') {
      playScoutVoiceLine('savvy_level_boost');
    } else if (payload?.itemType === 'extra_free_spin_egg') {
      playScoutVoiceLine('free_spin_added');
    }
    const t1 = window.setTimeout(() => setPhase('detail'), reduceMotion ? 200 : 900);
    const t2 = window.setTimeout(() => {
      setPhase('done');
      onDone?.();
      clearActivationPresentation();
      unduckAppMusic(MENU_MUSIC_DUCK.VOICE_LINE);
    }, reduceMotion ? 2400 : 5200);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      unduckAppMusic(MENU_MUSIC_DUCK.VOICE_LINE);
    };
  }, [payload?.itemType, onDone, reduceMotion]);

  useEffect(() => {
    if (!payload?.activation?.expiresAt) return undefined;
    const tick = () => setTimerLabel(formatTimer(payload.activation.expiresAt));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [payload?.activation?.expiresAt]);

  if (!payload || !def) return null;

  const title = payload.presentation?.title || `${def.label} activated`;
  const subtitle = payload.presentation?.subtitle || def.activeLabel;

  return (
    <div className="f10-token-present" role="dialog" aria-modal="true" aria-label={title}>
      <div className="f10-token-present__backdrop" aria-hidden />
      <motion.div
        className="f10-token-present__card"
        initial={reduceMotion ? false : { opacity: 0, scale: 0.94, y: 18 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 280, damping: 24 }}
      >
        <p className="f10-token-present__kicker">{def.icon}</p>
        <h2 className="f10-token-present__title">{title}</h2>
        <p className="f10-token-present__subtitle">{subtitle.replace('30:00', timerLabel)}</p>

        {payload.itemType === 'battle_pass_xp_token' && bp ? (
          <div className="f10-token-present__progress">
            <p className="f10-token-present__level">Battle Pass Tier {bp.tier ?? bp.currentTier ?? 1}</p>
            <div className="f10-token-present__bar-track">
              <motion.div
                className="f10-token-present__bar-fill f10-token-present__bar-fill--bp"
                initial={{ width: '0%' }}
                animate={{
                  width: `${Math.min(100, Math.max(8, Number(bp.progressPct ?? bp.xpPercent ?? 35)))}%`,
                }}
                transition={{ duration: reduceMotion ? 0.2 : 1.4, ease: 'easeOut' }}
              />
            </div>
            {pendingXp ? (
              <ul className="f10-token-present__breakdown">
                <li><span>Base XP</span><strong>+{pendingXp.baseXp}</strong></li>
                <li><span>Token Bonus</span><strong>+{pendingXp.tokenBonus}</strong></li>
                <li><span>Total XP</span><strong>+{pendingXp.totalXp}</strong></li>
              </ul>
            ) : (
              <p className="f10-token-present__hint">
                Your next Battle Pass XP earnings will receive a 1.5× boost.
              </p>
            )}
          </div>
        ) : null}

        {payload.itemType === 'savvy_level_xp_token' && profile ? (
          <div className="f10-token-present__progress">
            <p className="f10-token-present__level">Profile Level {profile.level ?? profile.currentLevel ?? 1}</p>
            <div className="f10-token-present__bar-track">
              <motion.div
                className="f10-token-present__bar-fill f10-token-present__bar-fill--profile"
                initial={{ width: '0%' }}
                animate={{
                  width: `${Math.min(100, Math.max(8, Number(profile.xpPercent ?? 40)))}%`,
                }}
                transition={{ duration: reduceMotion ? 0.2 : 1.4, ease: 'easeOut' }}
              />
            </div>
            {pendingXp ? (
              <ul className="f10-token-present__breakdown">
                <li><span>Base Profile XP</span><strong>+{pendingXp.baseXp}</strong></li>
                <li><span>Token Bonus</span><strong>+{pendingXp.tokenBonus}</strong></li>
                <li><span>Total Profile XP</span><strong>+{pendingXp.totalXp}</strong></li>
              </ul>
            ) : (
              <p className="f10-token-present__hint">
                Profile level XP you earn next will receive a 1.5× boost. Savvy Points are unchanged.
              </p>
            )}
          </div>
        ) : null}

        {payload.itemType === 'extra_free_spin_egg' ? (
          <p className="f10-token-present__hint f10-token-present__hint--spin">
            Free Spin Added — {payload.freeSpinsTotal ?? 1} ready to use.
          </p>
        ) : null}

        {phase === 'done' ? (
          <p className="f10-token-present__active">{def.activeLabel || payload.presentation?.activeLabel}</p>
        ) : null}
      </motion.div>
    </div>
  );
}

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { EventActivationParticles } from '../events/EventActivationParticles';
import { playProfileXpAudio } from '../../lib/profileXpAudio';
import { deriveAccountProgression } from '../../lib/accountProgression';

function formatXp(n) {
  return Math.round(Number(n) || 0).toLocaleString();
}

function barPercent(progress, range) {
  const r = Math.max(1, Number(range) || 1);
  return Math.min(100, Math.round(((Number(progress) || 0) / r) * 100));
}

function progressFromTotal(totalXp) {
  const derived = deriveAccountProgression(totalXp);
  return {
    level: derived.level,
    prestige: derived.prestige,
    xpProgress: derived.xpProgress,
    xpRange: derived.xpRange,
  };
}

export default function ProfileXpRecapModal({
  recap,
  eventSummary = null,
  onDismiss,
  onViewProfile,
}) {
  const reduceMotion = useReducedMotion();
  const before = recap?.beforeSnapshot || {};
  const after = recap?.afterSnapshot || {};
  const levelUps = useMemo(() => recap?.levelUpsCrossed || [], [recap?.levelUpsCrossed]);

  const [anim, setAnim] = useState(() => ({
    level: before.level || 1,
    xpProgress: before.xpProgress || 0,
    xpRange: before.xpRange || 100,
    earnedShown: 0,
    phase: 'idle',
    levelUpFlash: false,
  }));
  const levelUpsTriggeredRef = useRef(0);

  useEffect(() => {
    levelUpsTriggeredRef.current = 0;
    if (!recap) return undefined;

    if (reduceMotion) {
      setAnim({
        level: after.level || before.level || 1,
        xpProgress: after.xpProgress || 0,
        xpRange: after.xpRange || 100,
        earnedShown: recap.xpEarnedTotal || 0,
        phase: 'done',
        levelUpFlash: false,
      });
      return undefined;
    }

    playProfileXpAudio('xp_bar_fill');
    const totalEarned = recap.xpEarnedTotal || 0;
    const startTotal = before.totalXp || 0;
    const start = performance.now();
    const duration = Math.min(3400, 1500 + totalEarned * 2.5);
    let raf = 0;

    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - (1 - t) ** 3;
      const earned = Math.round(totalEarned * eased);
      const sim = progressFromTotal(startTotal + earned);

      while (
        levelUps[levelUpsTriggeredRef.current] &&
        sim.level >= levelUps[levelUpsTriggeredRef.current].toLevel &&
        t < 1
      ) {
        levelUpsTriggeredRef.current += 1;
        playProfileXpAudio('level_up');
        setAnim({
          ...sim,
          earnedShown: earned,
          phase: 'level_up',
          levelUpFlash: true,
        });
        window.setTimeout(() => {
          setAnim((prev) => ({ ...prev, levelUpFlash: false, phase: 'filling' }));
        }, 650);
      }

      setAnim({
        level: sim.level,
        xpProgress: sim.xpProgress,
        xpRange: sim.xpRange,
        earnedShown: earned,
        phase: t >= 1 ? 'done' : 'filling',
        levelUpFlash: false,
      });

      if (t < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        playProfileXpAudio('reward_reveal');
      }
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [recap, reduceMotion, before.level, before.totalXp, before.xpProgress, before.xpRange, after.level, after.xpProgress, after.xpRange, levelUps]);

  const pct = barPercent(anim.xpProgress, anim.xpRange);

  const breakdown = useMemo(
    () => (recap?.breakdown || []).slice().sort((a, b) => b.amount - a.amount),
    [recap?.breakdown]
  );

  if (!recap) return null;

  return (
    <div className="f10-profile-xp-recap" role="dialog" aria-modal="true" aria-label="Profile progression recap">
      <div className="f10-profile-xp-recap__backdrop" aria-hidden />

      <motion.article
        className={`f10-profile-xp-recap__card ${anim.levelUpFlash ? 'is-level-up' : ''}`}
        initial={reduceMotion ? false : { opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 320, damping: 30 }}
      >
        <div className="f10-profile-xp-recap__glow" aria-hidden />
        <EventActivationParticles active={anim.levelUpFlash} effect="lightning" particleClass="purple" />

        <header className="f10-profile-xp-recap__header">
          <p className="f10-profile-xp-recap__kicker">Profile Progression</p>
          {eventSummary ? (
            <p className="f10-profile-xp-recap__event-bridge">
              {eventSummary.eventTitle} complete · Profile XP earned:{' '}
              <strong>+{formatXp(recap.xpEarnedTotal)} XP</strong>
            </p>
          ) : (
            <p className="f10-profile-xp-recap__subtitle">{recap.title || 'Your profile grew this session.'}</p>
          )}
        </header>

        <div className="f10-profile-xp-recap__level-block">
          <p className="f10-profile-xp-recap__level-label">PROFILE LEVEL {anim.level}</p>
          <div className="f10-profile-xp-recap__bar-track">
            <motion.div
              className="f10-profile-xp-recap__bar-fill"
              initial={false}
              animate={{ width: `${pct}%` }}
              transition={{ duration: reduceMotion ? 0 : 0.35, ease: 'easeOut' }}
            />
          </div>
          <p className="f10-profile-xp-recap__bar-meta">
            {formatXp(anim.xpProgress)} / {formatXp(anim.xpRange)} XP
          </p>
          <p className="f10-profile-xp-recap__earned">
            +{formatXp(anim.earnedShown)} XP earned
            {anim.phase !== 'done' ? '…' : ''}
          </p>
          <p className="f10-profile-xp-recap__scout">{recap.scoutMessage}</p>
        </div>

        {breakdown.length ? (
          <div className="f10-profile-xp-recap__breakdown">
            <p className="f10-profile-xp-recap__section-title">XP Breakdown</p>
            <ul>
              {breakdown.map((row) => (
                <li key={row.source}>
                  <span>{row.label}</span>
                  <strong>+{formatXp(row.amount)} XP</strong>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {recap.topSource ? (
          <div className="f10-profile-xp-recap__top-source">
            <p className="f10-profile-xp-recap__section-title">Top XP Source</p>
            <p>
              <strong>{recap.topSource.label}</strong> — {formatXp(recap.topSource.amount)} XP
            </p>
            <p className="f10-profile-xp-recap__education">{recap.educationMessage}</p>
            {recap.suggestedNextAction ? (
              <p className="f10-profile-xp-recap__suggestion">{recap.suggestedNextAction}</p>
            ) : null}
          </div>
        ) : null}

        {(recap.milestoneUnlocks || []).length && anim.phase === 'done' ? (
          <div className="f10-profile-xp-recap__unlocks">
            <p className="f10-profile-xp-recap__section-title">Unlocked</p>
            {recap.milestoneUnlocks.map((m) => (
              <div key={m.level} className="f10-profile-xp-recap__milestone">
                <strong>{m.title || `Level ${m.level}`}</strong>
                <ul>
                  {(m.unlocks || []).map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        ) : null}

        <div className="f10-profile-xp-recap__totals">
          <span>Previous: {formatXp(before.totalXp)} XP</span>
          <span>New: {formatXp(after.totalXp)} XP</span>
        </div>

        <div className="f10-profile-xp-recap__actions">
          <button type="button" className="f10-profile-xp-recap__btn f10-profile-xp-recap__btn--primary" onClick={onDismiss}>
            Awesome
          </button>
          <Link to="/profile" className="f10-profile-xp-recap__btn" onClick={onViewProfile}>
            View Profile
          </Link>
        </div>
      </motion.article>
    </div>
  );
}

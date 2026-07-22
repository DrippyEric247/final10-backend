import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { EventActivationParticles } from './EventActivationParticles';
import { playEventActivationWithDuck } from '../../lib/eventActivationAudio';

function formatSavvy(n) {
  return Math.round(Number(n) || 0).toLocaleString();
}

function useCountUp(target, { durationMs = 1400, active = true } = {}) {
  const [value, setValue] = useState(0);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (!active) return undefined;
    const goal = Math.round(Number(target) || 0);
    if (reduceMotion) {
      setValue(goal);
      return undefined;
    }
    let raf = 0;
    const start = performance.now();
    const tick = (now) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - (1 - t) ** 3;
      setValue(Math.round(goal * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, durationMs, active, reduceMotion]);

  return value;
}

function formatCountdown(ms) {
  const total = Math.max(0, Number(ms) || 0);
  const days = Math.floor(total / 86400000);
  const hours = Math.floor((total % 86400000) / 3600000);
  const minutes = Math.floor((total % 3600000) / 60000);
  if (days > 0) return `${days} Day${days === 1 ? '' : 's'} ${hours} Hour${hours === 1 ? '' : 's'}`;
  if (hours > 0) return `${hours} Hour${hours === 1 ? '' : 's'} ${minutes} Min`;
  return `${minutes} Min`;
}

const OPTIONAL_STAT_LABELS = [
  ['alertsCreated', 'Alerts Created'],
  ['dealsWon', 'Deals Won'],
  ['bestMovesUsed', 'Best Moves Used'],
  ['auctionsWon', 'Auctions Won'],
  ['scoutFlightEarnings', 'Scout Flight Earnings'],
  ['contractsCompleted', 'Contracts Completed'],
  ['referralBonuses', 'Referral Bonuses'],
  ['battlePassXpEarned', 'Battle Pass XP Earned'],
  ['eggsCollected', 'Eggs Collected'],
  ['perkSpins', 'Perk Machine Spins'],
  ['savvySaleSavings', 'Savvy Sale Savings'],
];

function particleEffectForEvent(eventKey) {
  if (eventKey === 'triple_points') return { effect: 'lightning', particleClass: 'purple' };
  if (eventKey === 'savvy_sale') return { effect: 'sale_sparkle', particleClass: 'sale' };
  if (eventKey === 'max_supply_drop') return { effect: 'crate_drop', particleClass: 'crate' };
  return { effect: 'coin', particleClass: 'gold' };
}

function audioKeyForEvent(eventKey) {
  if (eventKey === 'triple_points') return 'triple_points';
  if (eventKey === 'savvy_sale') return 'savvy_sale';
  if (eventKey === 'max_supply_drop') return 'max_supply_drop';
  return 'double_points';
}

export default function EventSummaryModal({
  summary,
  profileXpEarned = 0,
  onDismiss,
  onLeaderboard,
  onRewards,
}) {
  const reduceMotion = useReducedMotion();
  const bonusCount = useCountUp(summary?.bonusEarned, { active: Boolean(summary) });
  const eventCount = useCountUp(summary?.eventEarnings, { active: Boolean(summary) });
  const normalCount = useCountUp(summary?.normalEarnings, { active: Boolean(summary) });

  const particles = useMemo(
    () => particleEffectForEvent(summary?.eventKey),
    [summary?.eventKey]
  );

  useEffect(() => {
    if (!summary) return undefined;
    const key = audioKeyForEvent(summary.eventKey);
    void playEventActivationWithDuck(key).catch(() => {});
    return undefined;
  }, [summary]);

  const optionalLines = useMemo(() => {
    const stats = summary?.optionalStats || {};
    return OPTIONAL_STAT_LABELS.filter(([key]) => Number(stats[key]) > 0).map(([key, label]) => ({
      label,
      value: stats[key],
    }));
  }, [summary?.optionalStats]);

  if (!summary) return null;

  const upcoming = summary.upcomingEvent;

  return (
    <div className="f10-event-summary" role="dialog" aria-modal="true" aria-label="Event complete summary">
      <div className="f10-event-summary__backdrop" aria-hidden />

      <motion.article
        className="f10-event-summary__card"
        initial={reduceMotion ? false : { opacity: 0, y: 24, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 320, damping: 28 }}
      >
        <div className="f10-event-summary__glow" aria-hidden />
        <EventActivationParticles active={!reduceMotion} {...particles} />

        <header className="f10-event-summary__header">
          <p className="f10-event-summary__kicker">🎉 Event Complete</p>
          <p className="f10-event-summary__subtitle">
            Here&apos;s how much extra you earned during this event.
          </p>
        </header>

        <div className="f10-event-summary__grid">
          <div className="f10-event-summary__stat">
            <span className="f10-event-summary__stat-icon">⭐</span>
            <div>
              <span className="f10-event-summary__stat-label">Event</span>
              <strong>{summary.eventTitle}</strong>
            </div>
          </div>
          <div className="f10-event-summary__stat">
            <span className="f10-event-summary__stat-icon">⏱</span>
            <div>
              <span className="f10-event-summary__stat-label">Time Participated</span>
              <strong>{summary.timeParticipatedLabel || '—'}</strong>
            </div>
          </div>
          <div className="f10-event-summary__stat">
            <span className="f10-event-summary__stat-icon">💰</span>
            <div>
              <span className="f10-event-summary__stat-label">Normal Earnings</span>
              <strong>{formatSavvy(normalCount)} Savvy</strong>
            </div>
          </div>
          <div className="f10-event-summary__stat">
            <span className="f10-event-summary__stat-icon">⚡</span>
            <div>
              <span className="f10-event-summary__stat-label">Event Earnings</span>
              <strong>{formatSavvy(eventCount)} Savvy</strong>
            </div>
          </div>
          <div className="f10-event-summary__stat f10-event-summary__stat--highlight">
            <span className="f10-event-summary__stat-icon">🎁</span>
            <div>
              <span className="f10-event-summary__stat-label">Bonus Earned</span>
              <strong>+{formatSavvy(bonusCount)} Savvy</strong>
            </div>
          </div>
          {profileXpEarned > 0 ? (
            <div className="f10-event-summary__stat f10-event-summary__stat--xp-bridge">
              <span className="f10-event-summary__stat-icon">🛡</span>
              <div>
                <span className="f10-event-summary__stat-label">Profile XP Earned</span>
                <strong>+{formatSavvy(profileXpEarned)} XP</strong>
              </div>
            </div>
          ) : null}
          <div className="f10-event-summary__stat">
            <span className="f10-event-summary__stat-icon">📈</span>
            <div>
              <span className="f10-event-summary__stat-label">Increase</span>
              <strong>+{summary.increasePercent || 0}%</strong>
            </div>
          </div>
        </div>

        {optionalLines.length ? (
          <ul className="f10-event-summary__optional">
            {optionalLines.map((row) => (
              <li key={row.label}>
                <span>{row.label}</span>
                <strong>{formatSavvy(row.value)}</strong>
              </li>
            ))}
          </ul>
        ) : null}

        <div className="f10-event-summary__celebration">
          <span className="f10-event-summary__celebration-icon" aria-hidden>
            🔥
          </span>
          <p>
            Because you participated in <strong>{summary.eventTitle}</strong>, you earned{' '}
            <strong>+{formatSavvy(summary.bonusEarned)} MORE Savvy</strong> than normal.
          </p>
        </div>

        {upcoming ? (
          <div className="f10-event-summary__upcoming">
            <p className="f10-event-summary__upcoming-label">Upcoming Event</p>
            <p className="f10-event-summary__upcoming-title">
              {upcoming.label || 'Next Weekend'}:
              <br />
              {upcoming.icon ? `${upcoming.icon} ` : ''}
              {upcoming.title}
            </p>
            {upcoming.msUntilStart != null ? (
              <p className="f10-event-summary__upcoming-starts">
                Starts in: <strong>{formatCountdown(upcoming.msUntilStart)}</strong>
              </p>
            ) : null}
          </div>
        ) : null}

        <div className="f10-event-summary__actions">
          <button type="button" className="f10-event-summary__btn f10-event-summary__btn--primary" onClick={onDismiss}>
            Awesome
          </button>
          <button type="button" className="f10-event-summary__btn" onClick={onLeaderboard}>
            View Leaderboard
          </button>
          <Link to="/win-feed" className="f10-event-summary__btn" onClick={onRewards}>
            View Rewards
          </Link>
        </div>
      </motion.article>
    </div>
  );
}

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { claimDailyStreak, getDailyStreakStatus } from '../lib/api';
import { notifyWalletFromLegacyReward } from '../lib/pointsEngine';
import { recordBattlePassXp } from '../lib/battlePassEngine';
import { triggerDailyLoginReward } from '../lib/rewardEngine';
import { SAVVY_AUTH_REFRESH_REQUEST } from '../store/savvyStore';
import { formatMilestoneRewards } from '../config/dailyStreakRewards';
import LoadingState from '../components/ui/states/LoadingState';
import '../styles/DailyStreak.css';

function StreakFlame({ active }) {
  return (
    <div className={`streak-flame ${active ? '' : 'inactive'}`} aria-hidden>
      <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path
          d="M32 8C32 8 22 22 22 34C22 42 26.5 48 32 48C37.5 48 42 42 42 34C42 22 32 8 32 8Z"
          fill="url(#flameGrad)"
        />
        <path
          d="M32 22C32 22 28 30 28 36C28 40 30 43 32 43C34 43 36 40 36 36C36 30 32 22 32 22Z"
          fill="#fef3c7"
          opacity="0.9"
        />
        <defs>
          <linearGradient id="flameGrad" x1="32" y1="8" x2="32" y2="48" gradientUnits="userSpaceOnUse">
            <stop stopColor="#fbbf24" />
            <stop offset="0.5" stopColor="#f97316" />
            <stop offset="1" stopColor="#dc2626" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
}

function buildRewardChips(grants) {
  if (!grants) return [];
  const chips = [];
  if (grants.savvy > 0) chips.push(`+${grants.savvy} Savvy`);
  if (grants.scoutEggs) {
    for (const [tier, count] of Object.entries(grants.scoutEggs)) {
      if (Number(count) > 0) {
        chips.push(`+${count} ${tier} Scout Egg${Number(count) > 1 ? 's' : ''}`);
      }
    }
  }
  if (grants.scoutShields > 0) chips.push(`+${grants.scoutShields} Scout Shield`);
  if (Array.isArray(grants.callingCards) && grants.callingCards.length) {
    chips.push('Calling Card Unlocked');
  }
  if (Array.isArray(grants.badges) && grants.badges.length) {
    chips.push('Badge Earned');
  }
  return chips;
}

function ScoutClaimModal({ open, onClose, scoutMessage, grants, shieldUsed, hiddenAchievements, comeback }) {
  if (!open) return null;

  const greeting =
    typeof scoutMessage === 'string'
      ? scoutMessage
      : scoutMessage?.greeting || 'Welcome back, Operator.';
  const streakLine =
    typeof scoutMessage === 'object' && scoutMessage?.streakLine
      ? scoutMessage.streakLine
      : comeback
        ? comeback.label
        : null;

  const chips = buildRewardChips(grants);

  return (
    <div className="streak-scout-overlay" role="dialog" aria-modal="true" aria-label="Daily streak reward">
      <div className="streak-scout-modal">
        <div className="streak-scout-icon" aria-hidden>
          {comeback ? '🛰️' : '🔥'}
        </div>
        <p className="streak-scout-greeting">{greeting}</p>
        {streakLine ? <p className="streak-scout-line">{streakLine}</p> : null}
        {shieldUsed ? (
          <p className="text-sm text-amber-200/80 mb-3">
            Scout Shield activated — your streak is safe.
          </p>
        ) : null}
        {chips.length ? (
          <div className="streak-reward-burst">
            {chips.map((chip) => (
              <span key={chip} className="streak-reward-chip">
                {chip}
              </span>
            ))}
          </div>
        ) : null}
        {Array.isArray(hiddenAchievements) && hiddenAchievements.length ? (
          <div className="hidden-achievement-toast">
            Hidden achievement unlocked: {hiddenAchievements.map((a) => a.label).join(', ')}
          </div>
        ) : null}
        <button type="button" className="streak-scout-dismiss" onClick={onClose}>
          Continue
        </button>
      </div>
    </div>
  );
}

export default function DailyStreak() {
  const { user, refreshProfile } = useAuth();
  const location = useLocation();
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);
  const [error, setError] = useState('');
  const [claimModal, setClaimModal] = useState(location.state?.streakClaim ?? null);

  useEffect(() => {
    if (location.state?.streakClaim) {
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  const loadStatus = useCallback(async () => {
    setError('');
    try {
      const data = await getDailyStreakStatus();
      setStatus(data);
    } catch (e) {
      setError(e?.response?.data?.message || 'Could not load streak status.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) void loadStatus();
    else setLoading(false);
  }, [user, loadStatus]);

  const currentStreak = status?.currentStreak ?? user?.loginStreakDays ?? user?.currentStreak ?? 0;
  const longestStreak = status?.longestStreak ?? user?.longestStreak ?? currentStreak;
  const canClaim = status?.canClaim ?? false;
  const scoutShields = status?.scoutShields ?? user?.scoutShields ?? 0;

  const nextRewardParts = useMemo(() => {
    const nr = status?.nextReward;
    if (!nr?.rewards) return [];
    return formatMilestoneRewards({
      savvy: nr.rewards.savvy,
      scoutEggs: nr.rewards.scoutEggs,
      scoutShields: nr.rewards.scoutShields,
      callingCardId: nr.rewards.callingCardId,
      badgeId: nr.rewards.badgeId,
    });
  }, [status]);

  async function handleClaim() {
    if (!canClaim || claiming) return;
    setClaiming(true);
    setError('');
    try {
      const result = await claimDailyStreak();
      const added = Number(result?.added ?? result?.totalSavvy ?? 0);
      if (added > 0) {
        recordBattlePassXp('daily_login');
        triggerDailyLoginReward(undefined, result.reward);
        notifyWalletFromLegacyReward({ amount: added, source: 'daily_streak' });
      }
      await refreshProfile();
      try {
        window.dispatchEvent(new CustomEvent(SAVVY_AUTH_REFRESH_REQUEST));
      } catch {
        /* ignore */
      }
      if (result.status) setStatus(result.status);
      else await loadStatus();

      if (result.granted && !result.alreadyClaimed) {
        setClaimModal({
          scoutMessage: result.scoutMessage,
          grants: result.grants,
          shieldUsed: result.shieldUsed,
          hiddenAchievements: result.hiddenAchievements,
          comeback: result.comeback,
        });
      }
    } catch (e) {
      setError(e?.response?.data?.message || 'Claim failed. Try again.');
    } finally {
      setClaiming(false);
    }
  }

  if (!user) {
    return (
      <div className="daily-streak-page card text-center">
        <p>Sign in to track your daily login streak.</p>
        <Link to="/login" className="btn btn-primary mt-4 inline-block">
          Sign in
        </Link>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="daily-streak-page">
        <LoadingState label="Loading streak…" />
      </div>
    );
  }

  return (
    <div className="daily-streak-page">
      <header className="daily-streak-header">
        <h1>Daily Login Streak</h1>
        <p>Claim once per day. Scout Shields protect a missed day.</p>
      </header>

      {error ? (
        <div className="mb-4 rounded-lg border border-red-500/35 bg-red-950/40 px-3 py-2 text-sm text-red-200" role="alert">
          {error}
        </div>
      ) : null}

      {status?.inactiveDays >= 7 ? (
        <div className="comeback-banner">
          Comeback rewards available — claim today to collect your return bonus.
        </div>
      ) : null}

      <div className="streak-hero">
        <div className="streak-stat-card">
          <div className="streak-stat-label">Current Streak</div>
          <div className="streak-stat-value">{currentStreak}</div>
          <div className="streak-flame-wrap">
            <StreakFlame active={currentStreak > 0} />
          </div>
        </div>
        <div className="streak-stat-card longest">
          <div className="streak-stat-label">Longest Streak</div>
          <div className="streak-stat-value">{longestStreak}</div>
        </div>
      </div>

      {status?.nextReward ? (
        <section className="next-reward-panel" aria-labelledby="next-reward-heading">
          <h2 id="next-reward-heading">Next Reward</h2>
          <div className="next-reward-title">{status.nextReward.label}</div>
          <div className="next-reward-meta">
            Day {status.nextReward.day}
            {status.nextReward.daysUntil > 0
              ? ` · ${status.nextReward.daysUntil} day${status.nextReward.daysUntil === 1 ? '' : 's'} to go`
              : ' · ready on next milestone'}
          </div>
          {nextRewardParts.length ? (
            <div className="next-reward-meta mt-2 text-amber-200/90">{nextRewardParts.join(' · ')}</div>
          ) : null}
          <div className="shields-row">
            <span aria-hidden>🛡️</span>
            <span>
              {scoutShields} Scout Shield{scoutShields === 1 ? '' : 's'} in reserve
            </span>
          </div>
        </section>
      ) : null}

      <section className="streak-calendar" aria-labelledby="calendar-heading">
        <h2 id="calendar-heading">Rewards Calendar</h2>
        <div className="streak-calendar-grid">
          {(status?.calendar || []).map((row) => {
            const isCurrent = currentStreak === row.day;
            const rewardText = row.rewards?.savvy ? `+${row.rewards.savvy} Savvy` : '';
            return (
              <div
                key={row.day}
                className={`calendar-day${row.reached ? ' reached' : ''}${isCurrent ? ' current' : ''}`}
              >
                <div className="calendar-day-num">{row.day}</div>
                <div className="calendar-day-label">{row.label}</div>
                {rewardText ? <div className="calendar-day-reward">{rewardText}</div> : null}
              </div>
            );
          })}
        </div>
      </section>

      <button
        type="button"
        className="claim-streak-btn"
        disabled={!canClaim || claiming}
        onClick={handleClaim}
        aria-busy={claiming}
      >
        {claiming ? 'Claiming…' : canClaim ? 'Claim Daily Streak' : 'Claimed Today ✓'}
      </button>

      <ScoutClaimModal
        open={Boolean(claimModal)}
        onClose={() => setClaimModal(null)}
        scoutMessage={claimModal?.scoutMessage}
        grants={claimModal?.grants}
        shieldUsed={claimModal?.shieldUsed}
        hiddenAchievements={claimModal?.hiddenAchievements}
        comeback={claimModal?.comeback}
      />
    </div>
  );
}

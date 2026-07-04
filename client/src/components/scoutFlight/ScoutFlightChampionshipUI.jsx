import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';

function formatCountdown(ms) {
  const total = Math.max(0, Number(ms) || 0);
  const days = Math.floor(total / 86400000);
  const hours = Math.floor((total % 86400000) / 3600000);
  const mins = Math.floor((total % 3600000) / 60000);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

export function ScoutFlightChampionshipScreen({
  championship,
  tournamentStatus,
  onPractice,
  onTournament,
}) {
  const season = championship?.season;
  const messaging = championship?.messaging;
  const monthlyRank = championship?.monthlyRank || tournamentStatus?.monthlyRank;
  const tickets = Number(championship?.ticketsOwned ?? tournamentStatus?.ticketsOwned) || 0;
  const personalBest = Number(
    championship?.personalBest?.score ?? tournamentStatus?.personalBest?.score
  ) || 0;
  const savvySeason = Number(championship?.savvyEarnedSeason) || 0;
  const rewardTiers = championship?.rewardTiers || [];
  const themeColor = season?.theme?.eventColor || '#818cf8';

  const countdown = useMemo(() => formatCountdown(season?.msRemaining), [season?.msRemaining]);

  return (
    <div
      className="scout-flight-overlay scout-flight-overlay--menu scout-flight-overlay--championship"
      style={{ '--sf-champ-color': themeColor }}
    >
      <div className="sf-champ-hero">
        <div className="sf-champ-hero__badge">🏆 World Championship</div>
        <h1 className="sf-champ-hero__title">{season?.name || 'Scout Flight Championship'}</h1>
        <p className="sf-champ-hero__theme">{season?.theme?.bannerTitle || 'Monthly Season'}</p>
        <div className="sf-champ-hero__meta">
          <span className="sf-champ-pill sf-champ-pill--countdown">
            Ends in <strong>{countdown}</strong>
          </span>
          <span className="sf-champ-pill sf-champ-pill--pool">
            Prize pool <strong>{(season?.prizePoolSavvy || 0).toLocaleString()} Savvy</strong>
          </span>
          {season?.isBetaSeason ? (
            <span className="sf-champ-pill sf-champ-pill--beta">Beta Boost Active</span>
          ) : null}
        </div>
      </div>

      {messaging ? (
        <div className="sf-champ-messaging">
          <p className="sf-champ-messaging__headline">{messaging.headline}</p>
          <p className="sf-champ-messaging__body">{messaging.body}</p>
          <p className="sf-champ-messaging__note">{messaging.ticketNote}</p>
          {season?.isBetaSeason ? (
            <p className="sf-champ-messaging__permanent">{messaging.permanentNote}</p>
          ) : null}
        </div>
      ) : null}

      <div className="sf-ticket-pill sf-ticket-pill--champ" aria-label="Tournament tickets">
        <span>🎟️ Tickets: {tickets}</span>
        {tournamentStatus?.activeRun || championship?.activeRun ? (
          <span className="sf-ticket-pill__resume">Active run — tap Tournament to resume</span>
        ) : null}
      </div>

      <div className="sf-champ-stats">
        <div className="sf-stat">
          <span className="sf-stat__label">Season Rank</span>
          <strong className="sf-stat__value">
            {monthlyRank?.rank ? `#${monthlyRank.rank}` : '—'}
          </strong>
        </div>
        <div className="sf-stat">
          <span className="sf-stat__label">Personal Best</span>
          <strong className="sf-stat__value">{personalBest.toLocaleString()}</strong>
        </div>
        <div className="sf-stat">
          <span className="sf-stat__label">Savvy This Season</span>
          <strong className="sf-stat__value">{savvySeason.toLocaleString()}</strong>
        </div>
      </div>

      <div className="sf-mode-grid">
        <button
          type="button"
          className="sf-mode-card sf-mode-card--practice"
          onPointerDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onPractice();
          }}
        >
          <span className="sf-mode-card__icon">🎮</span>
          <span className="sf-mode-card__title">Practice Mode</span>
          <span className="sf-mode-card__desc">Free to play. Scores do not count toward the championship.</span>
          <span className="sf-mode-card__cta">Practice</span>
        </button>
        <button
          type="button"
          className="sf-mode-card sf-mode-card--tournament"
          onPointerDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onTournament();
          }}
        >
          <span className="sf-mode-card__icon">🏆</span>
          <span className="sf-mode-card__title">Tournament Mode</span>
          <span className="sf-mode-card__desc">Official monthly season run. Uses 1 Scout Flight Ticket.</span>
          <span className="sf-mode-card__cta">Use Ticket</span>
        </button>
      </div>

      {rewardTiers.length ? (
        <div className="sf-champ-rewards">
          <h3 className="sf-champ-rewards__title">Season Rewards</h3>
          <ul className="sf-champ-rewards__list">
            {rewardTiers.map((tier) => (
              <li key={tier.label}>
                <span className="sf-champ-rewards__label">{tier.label}</span>
                {tier.savvy > 0 ? (
                  <span className="sf-champ-rewards__savvy">{tier.savvy.toLocaleString()} Savvy</span>
                ) : (
                  <span className="sf-champ-rewards__cosmetic">Exclusive cosmetic</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {championship?.perRunRewardTiers?.length ? (
        <div className="sf-reward-tiers sf-reward-tiers--compact">
          <h3 className="sf-reward-tiers__title">Per-Run Savvy (any tournament score)</h3>
          <ul className="sf-reward-tiers__list">
            {championship.perRunRewardTiers.map((tier) => (
              <li key={tier.minScore}>{tier.label}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <Link to="/scout-flight/hall-of-champions" className="sf-champ-hall-link">
        View Hall of Champions →
      </Link>

      <p className="scout-flight-hint">Select a mode, then tap to launch</p>
    </div>
  );
}

export function ScoutFlightLeaderboardPanel({
  leaderboard,
  period,
  onPeriodChange,
  loading,
  previousSeasonName,
}) {
  const entries = leaderboard?.entries || [];
  const tabs = [
    { id: 'monthly', label: 'This Month' },
    { id: 'previous', label: 'Last Season' },
    { id: 'alltime', label: 'All-Time' },
  ];

  return (
    <section className="sf-leaderboard sf-leaderboard--championship" aria-label="Championship leaderboard">
      <div className="sf-leaderboard__head">
        <h3 className="sf-leaderboard__title">🏆 Championship Leaderboard</h3>
        <div className="sf-leaderboard__tabs" role="tablist">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={period === t.id}
              className={`sf-leaderboard__tab${period === t.id ? ' sf-leaderboard__tab--active' : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                onPeriodChange(t.id);
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>
      {period === 'previous' && previousSeasonName ? (
        <p className="sf-leaderboard__season-label">{previousSeasonName}</p>
      ) : null}
      {loading ? (
        <p className="sf-leaderboard__loading">Loading rankings…</p>
      ) : entries.length ? (
        <ol className="sf-leaderboard__list">
          {entries.slice(0, 15).map((row) => (
            <li
              key={`${row.userId}-${row.rank}`}
              className={`sf-leaderboard__row${row.isCurrentUser ? ' sf-leaderboard__row--me' : ''}${
                row.rank <= 3 ? ` sf-leaderboard__row--top${row.rank}` : ''
              }`}
            >
              <span className="sf-leaderboard__rank">#{row.rank}</span>
              <span className="sf-leaderboard__name">{row.username}</span>
              <span className="sf-leaderboard__score">{row.score?.toLocaleString?.() ?? row.score}</span>
              <span className="sf-leaderboard__runs" title="Runs submitted">
                {row.runsSubmitted || 1}×
              </span>
              <span className="sf-leaderboard__savvy">+{row.savvyEarned || 0}</span>
              {row.badge || row.rewardLabel ? (
                <span className="sf-leaderboard__badge">{row.badge || row.rewardLabel}</span>
              ) : null}
            </li>
          ))}
        </ol>
      ) : (
        <p className="sf-leaderboard__empty">No official tournament runs yet. Be the first!</p>
      )}
      {leaderboard?.currentUser && !entries.some((e) => e.isCurrentUser) ? (
        <p className="sf-leaderboard__me">
          Your best: <strong>{leaderboard.currentUser.score}</strong> · Rank #
          {leaderboard.currentUser.rank} · {leaderboard.currentUser.runsSubmitted || 1} runs
        </p>
      ) : null}
    </section>
  );
}

export function ScoutFlightTournamentResult({
  result,
  score,
  onPlayAgain,
  onReturn,
}) {
  if (!result) return null;
  const savvy = Number(result.savvyEarned) || 0;
  const monthlyRank = result.monthlyRank?.rank ?? result.dailyRank?.rank;
  return (
    <div className="scout-flight-overlay scout-flight-overlay--tournament-result">
      <h2 className="scout-flight-tournament-result__title">🏆 Tournament Complete</h2>
      <div className="scout-flight-tournament-result__stats">
        <div className="scout-flight-tournament-result__stat">
          <span>Score</span>
          <strong>{score.toLocaleString()}</strong>
        </div>
        <div className="scout-flight-tournament-result__stat">
          <span>Season Rank</span>
          <strong>{monthlyRank ? `#${monthlyRank}` : '—'}</strong>
        </div>
        <div className="scout-flight-tournament-result__stat scout-flight-tournament-result__stat--savvy">
          <span>Savvy Earned</span>
          <strong>+{savvy.toLocaleString()}</strong>
        </div>
      </div>
      {result.isNewPersonalBest ? (
        <p className="scout-flight-tournament-result__pb">⭐ New personal best!</p>
      ) : null}
      {result.suspicious ? (
        <p className="scout-flight-tournament-result__flag">
          Run flagged for review — Savvy withheld pending verification.
        </p>
      ) : null}
      <div className="scout-flight-go-actions">
        <button type="button" className="scout-flight-btn scout-flight-btn--primary" onClick={onPlayAgain}>
          Play Again
        </button>
        <button type="button" className="scout-flight-btn scout-flight-btn--ghost" onClick={onReturn}>
          Return to Championship
        </button>
      </div>
    </div>
  );
}

// Re-export modals from tournament UI for backward compatibility
export { ScoutFlightLockedModal, ScoutFlightConfirmModal } from './ScoutFlightTournamentUI';

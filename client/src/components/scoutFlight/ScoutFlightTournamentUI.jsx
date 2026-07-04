import React from 'react';
import { Link } from 'react-router-dom';

export function ScoutFlightLockedModal({ open, onClose }) {
  if (!open) return null;
  return (
    <div className="sf-modal-overlay" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="sf-modal sf-modal--locked" onClick={(e) => e.stopPropagation()}>
        <span className="sf-modal__icon" aria-hidden>🔒</span>
        <h3 className="sf-modal__title">Tournament Locked</h3>
        <p className="sf-modal__text">
          You need a Scout Flight Ticket to enter Tournament Mode.
        </p>
        <p className="sf-modal__sub">
          Earn tickets from the Perk Machine or future events.
        </p>
        <div className="sf-modal__actions">
          <Link to="/perk-machine" className="sf-btn sf-btn--gold">
            Go to Perk Machine
          </Link>
          <button type="button" className="sf-btn sf-btn--ghost" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export function ScoutFlightConfirmModal({ open, onClose, onConfirm, starting }) {
  if (!open) return null;
  return (
    <div className="sf-modal-overlay" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="sf-modal sf-modal--confirm" onClick={(e) => e.stopPropagation()}>
        <span className="sf-modal__icon" aria-hidden>🎟️</span>
        <h3 className="sf-modal__title">Start Tournament Run?</h3>
        <p className="sf-modal__text">This will use 1 Scout Flight Ticket.</p>
        <p className="sf-modal__sub">Tournament runs can earn real Savvy Points.</p>
        <div className="sf-modal__actions">
          <button type="button" className="sf-btn sf-btn--ghost" disabled={starting} onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="sf-btn sf-btn--gold" disabled={starting} onClick={onConfirm}>
            {starting ? 'Starting…' : 'Start Tournament'}
          </button>
        </div>
      </div>
    </div>
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
  const rank = result.dailyRank?.rank;
  return (
    <div className="scout-flight-overlay scout-flight-overlay--tournament-result">
      <h2 className="scout-flight-tournament-result__title">🏆 Tournament Complete</h2>
      <div className="scout-flight-tournament-result__stats">
        <div className="scout-flight-tournament-result__stat">
          <span>Score</span>
          <strong>{score.toLocaleString()}</strong>
        </div>
        <div className="scout-flight-tournament-result__stat">
          <span>Rank Today</span>
          <strong>{rank ? `#${rank}` : '—'}</strong>
        </div>
        <div className="scout-flight-tournament-result__stat scout-flight-tournament-result__stat--savvy">
          <span>Savvy Earned</span>
          <strong>+{savvy.toLocaleString()}</strong>
        </div>
      </div>
      {result.isNewPersonalBest ? (
        <p className="scout-flight-tournament-result__pb">⭐ New personal best!</p>
      ) : null}
      <div className="scout-flight-go-actions">
        <button type="button" className="scout-flight-btn scout-flight-btn--primary" onClick={onPlayAgain}>
          Play Again
        </button>
        <button type="button" className="scout-flight-btn scout-flight-btn--ghost" onClick={onReturn}>
          Return to Scout Flight
        </button>
      </div>
    </div>
  );
}

export function ScoutFlightLeaderboardPanel({ leaderboard, period, onPeriodChange, loading }) {
  const entries = leaderboard?.entries || [];
  return (
    <section className="sf-leaderboard" aria-label="Tournament leaderboard">
      <div className="sf-leaderboard__head">
        <h3 className="sf-leaderboard__title">🏆 Tournament Leaderboard</h3>
        <div className="sf-leaderboard__tabs" role="tablist">
          {['daily', 'weekly', 'alltime'].map((p) => (
            <button
              key={p}
              type="button"
              role="tab"
              aria-selected={period === p}
              className={`sf-leaderboard__tab${period === p ? ' sf-leaderboard__tab--active' : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                onPeriodChange(p);
              }}
            >
              {p === 'daily' ? 'Daily' : p === 'weekly' ? 'Weekly' : 'All-Time'}
            </button>
          ))}
        </div>
      </div>
      {loading ? (
        <p className="sf-leaderboard__loading">Loading rankings…</p>
      ) : entries.length ? (
        <ol className="sf-leaderboard__list">
          {entries.slice(0, 10).map((row) => (
            <li
              key={`${row.userId}-${row.rank}`}
              className={`sf-leaderboard__row${row.isCurrentUser ? ' sf-leaderboard__row--me' : ''}`}
            >
              <span className="sf-leaderboard__rank">#{row.rank}</span>
              <span className="sf-leaderboard__name">{row.username}</span>
              <span className="sf-leaderboard__score">{row.score}</span>
              <span className="sf-leaderboard__savvy">+{row.savvyEarned || 0}</span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="sf-leaderboard__empty">No tournament runs yet. Be the first!</p>
      )}
      {leaderboard?.currentUser && !entries.some((e) => e.isCurrentUser) ? (
        <p className="sf-leaderboard__me">
          Your best: <strong>{leaderboard.currentUser.score}</strong> · Rank #{leaderboard.currentUser.rank}
        </p>
      ) : null}
    </section>
  );
}

export function ScoutFlightModeMenu({
  tournamentStatus,
  onPractice,
  onTournament,
  rewardTiers,
}) {
  const tickets = Number(tournamentStatus?.ticketsOwned) || 0;
  const personalBest = Number(tournamentStatus?.personalBest?.score) || 0;
  const dailyRank = tournamentStatus?.dailyRank?.rank;

  return (
    <div className="scout-flight-overlay scout-flight-overlay--menu">
      <div className="scout-flight-logo">
        <span className="scout-flight-logo__wings">🪽</span>
        <h1>SAVVY SCOUT FLIGHT</h1>
        <span className="scout-flight-logo__wings">🪽</span>
      </div>
      <p className="scout-flight-tagline">Collect Savvy Coins. Dodge the hazards.</p>

      <div className="sf-ticket-pill" aria-label="Tournament tickets">
        <span>🎟️ Tickets: {tickets}</span>
        {tournamentStatus?.activeRun ? (
          <span className="sf-ticket-pill__resume">Active run — tap Tournament to resume</span>
        ) : null}
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
          <span className="sf-mode-card__desc">Free to play. No Savvy awarded. Learn the controls.</span>
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
          <span className="sf-mode-card__desc">Official run. Real leaderboard. Earn Savvy Points.</span>
          <span className="sf-mode-card__cta">Use Ticket</span>
        </button>
      </div>

      <div className="sf-stats-row">
        <div className="sf-stat">
          <span className="sf-stat__label">Personal Best</span>
          <strong className="sf-stat__value">{personalBest.toLocaleString()}</strong>
        </div>
        <div className="sf-stat">
          <span className="sf-stat__label">Daily Rank</span>
          <strong className="sf-stat__value">{dailyRank ? `#${dailyRank}` : '—'}</strong>
        </div>
      </div>

      {rewardTiers?.length ? (
        <div className="sf-reward-tiers">
          <h3 className="sf-reward-tiers__title">Possible Rewards</h3>
          <ul className="sf-reward-tiers__list">
            {rewardTiers.map((tier) => (
              <li key={tier.minScore}>{tier.label}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <p className="scout-flight-hint">Select a mode, then tap to launch</p>
    </div>
  );
}

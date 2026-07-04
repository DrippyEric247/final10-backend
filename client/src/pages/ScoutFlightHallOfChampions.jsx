import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getScoutFlightHallOfChampions } from '../lib/api';
import '../styles/ScoutFlight.css';

export default function ScoutFlightHallOfChampions() {
  const [hall, setHall] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const data = await getScoutFlightHallOfChampions(100);
        if (!cancelled) setHall(data);
      } catch {
        if (!cancelled) setError('Could not load Hall of Champions.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const records = hall?.records || [];

  return (
    <div className="scout-flight-page scout-flight-page--hall">
      <header className="sf-hall-header">
        <Link to="/scout-flight" className="sf-hall-back">
          ← Scout Flight
        </Link>
        <h1 className="sf-hall-title">🏛️ Hall of Champions</h1>
        <p className="sf-hall-subtitle">
          Permanent record of every Scout Flight World Championship season.
        </p>
      </header>

      {loading ? <p className="sf-hall-loading">Loading champions…</p> : null}
      {error ? <p className="sf-hall-error">{error}</p> : null}

      {!loading && !error && records.length === 0 ? (
        <div className="sf-hall-empty">
          <p>No finalized seasons yet.</p>
          <p className="sf-hall-empty__hint">
            Compete in Tournament Mode to claim the first championship title.
          </p>
          <Link to="/scout-flight" className="sf-btn sf-btn--gold">
            Enter Championship
          </Link>
        </div>
      ) : null}

      {records.length > 0 ? (
        <ol className="sf-hall-list">
          {records.map((rec) => (
            <li
              key={rec.seasonId}
              className={`sf-hall-card${rec.isBetaSeason ? ' sf-hall-card--beta' : ''}`}
              style={{ '--sf-hall-accent': rec.theme?.eventColor || '#818cf8' }}
            >
              <div className="sf-hall-card__season">
                <span className="sf-hall-card__month">{rec.seasonName}</span>
                {rec.isBetaSeason ? <span className="sf-hall-card__beta-tag">Beta Season</span> : null}
              </div>
              <div className="sf-hall-card__champion">
                <span className="sf-hall-card__medal" aria-hidden>
                  🥇
                </span>
                <div className="sf-hall-card__champ-meta">
                  <strong className="sf-hall-card__username">
                    {rec.champion?.username || 'Operator'}
                  </strong>
                  <span className="sf-hall-card__score">
                    {(rec.champion?.score || 0).toLocaleString()} pts
                  </span>
                </div>
                <div className="sf-hall-card__reward">
                  <span>{(rec.champion?.savvyEarned || 0).toLocaleString()} Savvy</span>
                  {rec.champion?.callingCardId ? (
                    <span className="sf-hall-card__card">Champion Calling Card</span>
                  ) : null}
                </div>
              </div>
              {rec.finalizedAt ? (
                <time className="sf-hall-card__date" dateTime={rec.finalizedAt}>
                  Finalized{' '}
                  {new Date(rec.finalizedAt).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </time>
              ) : null}
            </li>
          ))}
        </ol>
      ) : null}
    </div>
  );
}

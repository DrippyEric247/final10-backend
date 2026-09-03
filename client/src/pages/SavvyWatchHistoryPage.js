import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getSavvyWatchHistory } from '../lib/api';
import '../styles/SavvyWatch.css';

export default function SavvyWatchHistoryPage() {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const data = await getSavvyWatchHistory();
        if (alive) setHistory(data.history || []);
      } catch (e) {
        if (alive) setError(e?.response?.data?.message || e.message || 'Failed to load history.');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  if (loading) return <div className="sw-page sw-loading">Loading Savvy Watch history…</div>;

  return (
    <div className="sw-page">
      <header className="sw-header">
        <div className="sw-badge">SAVVY WATCH</div>
        <h1>Savvy Watch History</h1>
      </header>

      {error && <div className="sw-alert">{error}</div>}

      {history.length === 0 ? (
        <p className="sw-muted">No Savvy Watch events yet.</p>
      ) : (
        <ul className="sw-history-list">
          {history.map((item) => (
            <li key={`${item.eventId}-${item.joinedAt}`} className="sw-card">
              <h2>{item.title}</h2>
              <p>
                Verified Event Participation: {item.verifiedParticipationMinutes ?? 0} min
              </p>
              <p>Savvy earned: {item.savvyEarned ?? 0}</p>
              <p>Votes cast: {item.votesCast ?? 0}</p>
              <p>Competitions entered: {item.competitionsEntered ?? 0}</p>
              {item.slug && (
                <Link to={`/watch/${item.slug}`}>View event</Link>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getSavvyPredictionsHistory } from '../lib/api';
import '../styles/SavvyWatch.css';

export default function SavvyPredictionsHistoryPage() {
  const [data, setData] = useState({ history: [], stats: {} });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const result = await getSavvyPredictionsHistory();
        if (alive) setData(result);
      } catch (e) {
        if (alive) setError(e?.response?.data?.message || e.message || 'Failed to load history.');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  if (loading) return <div className="sw-page sw-loading">Loading prediction history…</div>;

  const { history = [], stats = {} } = data;

  return (
    <div className="sw-page">
      <header className="sw-header">
        <div className="sw-badge">SAVVY PREDICTIONS</div>
        <h1>Prediction History</h1>
      </header>

      {error && <div className="sw-alert">{error}</div>}

      <section className="sw-card">
        <h2>Your Stats</h2>
        <p>Total predictions: {stats.totalPredictions ?? 0}</p>
        <p>Correct picks: {stats.correctPredictions ?? 0}</p>
        <p>Accuracy: {stats.accuracy ?? 0}%</p>
        <p>Current streak: {stats.currentStreak ?? 0}</p>
        <p>Best streak: {stats.bestStreak ?? 0}</p>
      </section>

      {history.length === 0 ? (
        <p className="sw-muted">No predictions yet.</p>
      ) : (
        <ul className="sw-history-list">
          {history.map((item, idx) => (
            <li key={`${item.predictionTitle}-${idx}`} className="sw-card">
              <h3>{item.eventTitle}</h3>
              <p>{item.predictionTitle}</p>
              <p>Your pick: {item.pick || '—'}</p>
              <p>Official result: {item.officialResult || '—'}</p>
              <p>Outcome: {item.outcome}</p>
              <p>Savvy earned: {item.savvyEarned ?? 0}</p>
              {item.eventSlug && <Link to={`/watch/${item.eventSlug}`}>View event</Link>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

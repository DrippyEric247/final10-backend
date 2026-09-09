import React from 'react';
import { Link } from 'react-router-dom';

export default function SavvyWatchEndedRoom({ event, competitions = [], predictions = [] }) {
  const titleUpper = String(event?.title || 'Savvy Watch Event').toUpperCase();
  const lockedComps = competitions.filter((c) =>
    ['results_locked', 'voting_closed'].includes(c.status)
  );
  const resolvedPredictions = predictions.filter((p) => p.status === 'resolved');

  return (
    <div className="sw-page sw-lifecycle sw-ended">
      <header className="sw-lifecycle-header">
        <div className="sw-badge">SAVVY WATCH</div>
        <h1 className="sw-event-title">{titleUpper}</h1>
        <div className="sw-status-pill sw-status-ended">EVENT ENDED</div>
      </header>

      <section className="sw-lifecycle-card">
        <p className="sw-lifecycle-lead">Thanks for watching.</p>

        {(lockedComps.length > 0 || resolvedPredictions.length > 0) && (
          <div className="sw-ended-results">
            <h2>Results</h2>
            {lockedComps.map((comp) => (
              <div key={comp.competitionId || comp.slug} className="sw-ended-result-block">
                <h3>{comp.title}</h3>
                <p className="sw-muted">Final status: {comp.status?.replace(/_/g, ' ')}</p>
              </div>
            ))}
            {resolvedPredictions.map((pred) => (
              <div key={pred.predictionId} className="sw-ended-result-block">
                <h3>{pred.title || pred.question}</h3>
                <p className="sw-muted">Prediction resolved</p>
              </div>
            ))}
          </div>
        )}

        <div className="sw-admin-actions sw-ended-actions">
          {(lockedComps.length > 0 || resolvedPredictions.length > 0) && (
            <Link className="sw-btn sw-btn-primary" to={`/watch/${event.slug}`}>
              VIEW RESULTS
            </Link>
          )}
          <Link className="sw-btn" to="/">
            RETURN TO FINAL10
          </Link>
        </div>
      </section>
    </div>
  );
}

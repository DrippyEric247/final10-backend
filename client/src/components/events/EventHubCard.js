import React from 'react';
import { Link } from 'react-router-dom';
import { formatTimer } from './MaxSupplyDropModal';

function TimerPill({ ms, label }) {
  if (ms == null) return null;
  return (
    <span className="events-card__timer">
      {label ? `${label} ` : ''}
      {formatTimer(ms)}
    </span>
  );
}

export default function EventHubCard({ event, onClaim, claiming, compact }) {
  if (!event) return null;

  const busy = claiming && (
    event.claimAction?.type === 'supply_drop'
      ? claiming === event.claimAction.dropId
      : claiming === `scout_${event.claimAction?.milestone}`
  );

  return (
    <article className={`events-card events-card--${event.status} ${compact ? 'events-card--compact' : ''}`}>
      <div className="events-card__head">
        <span className="events-card__icon" aria-hidden>
          {event.icon}
        </span>
        <div className="events-card__titles">
          <h3 className="events-card__title">{event.title}</h3>
          {!compact && event.description ? (
            <p className="events-card__desc">{event.description}</p>
          ) : null}
        </div>
        {event.msRemaining != null && event.msRemaining > 0 ? (
          <TimerPill ms={event.msRemaining} label={event.timerLabel} />
        ) : event.timerLabel && event.status === 'upcoming' ? (
          <span className="events-card__eta">{event.timerLabel}</span>
        ) : null}
      </div>

      <div className="events-card__actions">
        {event.claimable && event.claimAction ? (
          <button
            type="button"
            className="events-card__btn events-card__btn--claim"
            disabled={busy}
            onClick={() => onClaim?.(event)}
          >
            {busy ? 'Claiming…' : event.ctaLabel || 'Claim'}
          </button>
        ) : event.ctaPath ? (
          <Link to={event.ctaPath} className="events-card__btn">
            {event.ctaLabel || 'Open'}
          </Link>
        ) : null}
      </div>
    </article>
  );
}

export function EventHistoryRow({ row }) {
  if (!row) return null;
  const when = row.claimedAt ? new Date(row.claimedAt).toLocaleString() : 'Completed';
  return (
    <li className="events-history-row">
      <span className="events-history-row__icon">{row.icon}</span>
      <div className="events-history-row__body">
        <strong>{row.title}</strong>
        <span>{row.description}</span>
      </div>
      <time className="events-history-row__time">{when}</time>
    </li>
  );
}

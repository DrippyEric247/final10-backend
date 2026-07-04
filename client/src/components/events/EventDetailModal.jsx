import React from 'react';
import { Link } from 'react-router-dom';
import { formatTimer } from './MaxSupplyDropModal';
import { EventIconVisual } from './EventIconVisual';

export function EventDetailModal({ event, onClose, onOpenSupplyDrop }) {
  if (!event) return null;

  const isDrop = event.eventKey === 'max_supply_drop';
  const isSale = event.eventKey === 'savvy_sale';

  return (
    <div className="f10-event-detail-overlay" role="dialog" aria-modal="true" onClick={onClose}>
      <div className={`f10-event-detail f10-event-detail--${event.theme}`} onClick={(e) => e.stopPropagation()}>
        <button type="button" className="f10-event-detail__close" onClick={onClose} aria-label="Close">
          ✕
        </button>
        <EventIconVisual theme={event.theme} iconKey={event.iconKey} size="medium" pulsing />
        <h2 className="f10-event-detail__title">{event.detailTitle || event.title}</h2>
        <p className="f10-event-detail__body">{event.detailBody}</p>
        {event.msRemaining > 0 ? (
          <p className="f10-event-detail__timer">
            Remaining: <strong>{formatTimer(event.msRemaining)}</strong>
          </p>
        ) : null}
        <div className="f10-event-detail__actions">
          {isDrop ? (
            <button type="button" className="f10-event-detail__cta" onClick={onOpenSupplyDrop}>
              Open Supply Drop
            </button>
          ) : null}
          {isSale ? (
            <Link to="/perk-machine" className="f10-event-detail__cta" onClick={onClose}>
              Open Perk Machine
            </Link>
          ) : null}
          {!isDrop && !isSale ? (
            <Link to="/events" className="f10-event-detail__cta f10-event-detail__cta--ghost" onClick={onClose}>
              View Events Hub
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}

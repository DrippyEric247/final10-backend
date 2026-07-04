import React, { useCallback, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getEventExplanationCard } from '../../lib/eventExplanationCards';
import { getEventActivationProfile } from '../../lib/eventActivationProfiles';
import { EventIconVisual } from './EventIconVisual';

export function EventExplanationCard({
  event,
  onDismiss,
  onPrimaryAction,
  showFromHud = false,
}) {
  const navigate = useNavigate();
  const card = getEventExplanationCard(event);
  const profile = getEventActivationProfile(event);

  const handleDismiss = useCallback(() => {
    if (typeof onDismiss === 'function') onDismiss(event);
  }, [event, onDismiss]);

  const handlePrimary = useCallback(() => {
    if (card.primaryAction === 'supply_drop') {
      if (typeof onPrimaryAction === 'function') onPrimaryAction(event);
      handleDismiss();
      return;
    }
    if (card.primaryPath) {
      navigate(card.primaryPath);
    }
    handleDismiss();
  }, [card.primaryAction, card.primaryPath, event, handleDismiss, navigate, onPrimaryAction]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') handleDismiss();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleDismiss]);

  if (!event) return null;

  return (
    <div
      className={[
        'f10-event-explanation',
        `f10-event-explanation--${card.theme}`,
        showFromHud ? 'f10-event-explanation--hud' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      role="dialog"
      aria-modal="true"
      aria-label={card.title}
    >
      <div className="f10-event-explanation__backdrop" aria-hidden onClick={handleDismiss} />

      <article
        className="f10-event-explanation__card"
        style={{ '--f10-event-accent': profile.color, '--f10-event-glow': profile.glowColor }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="f10-event-explanation__glow" aria-hidden />

        <div className="f10-event-explanation__icon-wrap">
          <EventIconVisual theme={card.theme} iconKey={event.iconKey} size="medium" pulsing={false} />
        </div>

        <p className="f10-event-explanation__kicker">
          {showFromHud ? 'Live Event Details' : 'Event Activated'}
        </p>
        <h2 className="f10-event-explanation__title">{card.title}</h2>

        <p className="f10-event-explanation__intro">{card.intro}</p>
        {card.body ? <p className="f10-event-explanation__body">{card.body}</p> : null}

        {Array.isArray(card.examples) && card.examples.length ? (
          <ul className="f10-event-explanation__examples">
            {card.examples.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        ) : null}

        <div className="f10-event-explanation__actions">
          {card.primaryAction === 'supply_drop' ? (
            <button type="button" className="f10-event-explanation__cta" onClick={handlePrimary}>
              {card.primaryCta}
            </button>
          ) : (
            <Link to={card.primaryPath || '/events'} className="f10-event-explanation__cta" onClick={handleDismiss}>
              {card.primaryCta}
            </Link>
          )}
          <button type="button" className="f10-event-explanation__secondary" onClick={handleDismiss}>
            {card.secondaryCta}
          </button>
        </div>
      </article>
    </div>
  );
}

export default EventExplanationCard;

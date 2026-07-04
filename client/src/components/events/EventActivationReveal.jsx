import React, { useEffect, useRef, useState } from 'react';
import { EventIconVisual } from './EventIconVisual';
import { playEventAudio } from '../../lib/eventActivationAudio';

export function EventActivationReveal({ event, onActivated, onSkip }) {
  const [phase, setPhase] = useState('idle');
  const [flyStyle, setFlyStyle] = useState(null);
  const cardRef = useRef(null);

  useEffect(() => {
    setPhase('idle');
    setFlyStyle(null);
  }, [event?.activationId]);

  if (!event) return null;

  const handleTap = () => {
    if (phase !== 'idle') return;
    setPhase('announce');
    playEventAudio(event.audioKey);

    window.setTimeout(() => {
      const anchor =
        document.getElementById('f10-event-hud-anchor') ||
        document.getElementById('savvy-wallet-root');
      const card = cardRef.current;
      if (anchor && card) {
        const a = anchor.getBoundingClientRect();
        const c = card.getBoundingClientRect();
        const dx = a.left + a.width / 2 - (c.left + c.width / 2);
        const dy = a.top + a.height / 2 - (c.top + c.height / 2);
        setFlyStyle({
          '--fly-x': `${dx}px`,
          '--fly-y': `${dy}px`,
        });
      }
      setPhase('fly');
    }, 900);

    window.setTimeout(() => {
      if (typeof onActivated === 'function') onActivated(event);
    }, 1650);
  };

  return (
    <div className="f10-event-reveal" role="dialog" aria-modal="true" aria-label={`Activate ${event.title}`}>
      <div className="f10-event-reveal__backdrop" />
      <div className="f10-event-reveal__content">
        <button
          type="button"
          className={`f10-event-reveal__card f10-event-reveal__card--${event.theme} f10-event-reveal__card--${phase}`}
          ref={cardRef}
          style={flyStyle || undefined}
          onClick={handleTap}
          disabled={phase !== 'idle'}
        >
          <EventIconVisual theme={event.theme} iconKey={event.iconKey} size="large" pulsing={phase === 'idle'} />
          <h2 className="f10-event-reveal__title">{event.title}</h2>
          <p className="f10-event-reveal__subtitle">{event.subtitle}</p>
          {phase === 'idle' ? (
            <span className="f10-event-reveal__cta">Tap to Activate</span>
          ) : (
            <p className="f10-event-reveal__announce">{event.detailBody}</p>
          )}
        </button>
        {phase === 'idle' ? (
          <button type="button" className="f10-event-reveal__skip" onClick={onSkip}>
            Skip for now
          </button>
        ) : null}
      </div>
    </div>
  );
}

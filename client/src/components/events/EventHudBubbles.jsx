import React, { useEffect, useState } from 'react';
import { formatTimer } from './MaxSupplyDropModal';
import { EventIconVisual } from './EventIconVisual';

function patchBubbleTimers(bubbles, tickMs) {
  return (bubbles || []).map((b) => {
    const ms = Number(b.msRemaining);
    if (!Number.isFinite(ms) || ms <= 0) return b;
    return { ...b, msRemaining: Math.max(0, ms - tickMs) };
  }).filter((b) => (b.msRemaining == null || b.msRemaining > 0));
}

export function EventHudBubbles({ bubbles, onSelect }) {
  const [local, setLocal] = useState(bubbles || []);

  useEffect(() => {
    setLocal(bubbles || []);
  }, [bubbles]);

  useEffect(() => {
    if (!local.length) return undefined;
    const id = window.setInterval(() => {
      setLocal((prev) => patchBubbleTimers(prev, 1000));
    }, 1000);
    return () => window.clearInterval(id);
  }, [local.length]);

  if (!local.length) return null;

  return (
    <div className="f10-event-hud-bubbles" aria-label="Active live events">
      {local.map((event) => (
        <button
          key={event.activationId}
          type="button"
          className={`f10-event-hud-bubble f10-event-hud-bubble--${event.theme}`}
          onClick={() => onSelect?.(event)}
          aria-label={`${event.title}${event.msRemaining ? `, ${formatTimer(event.msRemaining)} remaining` : ''}`}
        >
          <EventIconVisual theme={event.theme} iconKey={event.iconKey} size="small" pulsing />
          <span className="f10-event-hud-bubble__label">
            {event.shortLabel}
            {event.msRemaining > 0 ? ` · ${formatTimer(event.msRemaining)}` : ''}
          </span>
        </button>
      ))}
    </div>
  );
}

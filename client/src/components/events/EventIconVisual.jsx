import React from 'react';

export function EventIconVisual({ theme, iconKey, size = 'large', pulsing = false }) {
  const cls = [
    'f10-event-icon',
    `f10-event-icon--${theme || 'gold'}`,
    `f10-event-icon--${size}`,
    iconKey ? `f10-event-icon--key-${iconKey}` : '',
    pulsing ? 'f10-event-icon--pulse' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={cls} aria-hidden>
      <div className="f10-event-icon__aura" />
      <div className="f10-event-icon__ring">
        {theme === 'gold' || iconKey === 'double_points' ? (
          <span className="f10-event-icon__coin f10-event-icon__coin--2x">2×</span>
        ) : null}
        {theme === 'purple' || iconKey === 'triple_points' ? (
          <span className="f10-event-icon__coin f10-event-icon__coin--3x">3×</span>
        ) : null}
        {theme === 'red' || iconKey === 'savvy_sale' ? (
          <span className="f10-event-icon__tag">$</span>
        ) : null}
        {theme === 'blue' || iconKey === 'max_supply_drop' ? (
          <span className="f10-event-icon__crate">📦</span>
        ) : null}
        <span className="f10-event-icon__savvy-coin">S</span>
      </div>
      <div className="f10-event-icon__sparks" />
    </div>
  );
}

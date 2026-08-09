import React from 'react';
import { Lock } from 'lucide-react';
import CamoImage from '../camo/CamoImage';

/**
 * Premium Egg Camo collection card — mirrors Camo Locker card patterns.
 */
export default function EggCamoCard({ item, onOpenDetail, onPreview }) {
  const unlocked = Boolean(item.unlocked);

  return (
    <div
      className={`f10-egg-camo-card f10-egg-camo-card--${item.rarity} ${
        unlocked ? 'f10-egg-camo-card--unlocked' : 'f10-egg-camo-card--locked'
      }`}
      style={{ '--camo-accent': item.accentColor, '--camo-accent-alt': item.accentColorAlt }}
    >
      <button
        type="button"
        className="f10-egg-camo-card__art"
        onClick={() => (unlocked ? onOpenDetail?.(item) : onPreview?.(item))}
        aria-label={`${item.name} — ${unlocked ? 'unlocked' : 'locked'}`}
      >
        <CamoImage
          src={item.imageUrl}
          alt={item.name}
          accentColor={item.accentColor}
          glyph="🥚"
          dimmed={!unlocked}
        />
        {!unlocked ? (
          <span className="f10-egg-camo-card__lock" aria-hidden>
            <Lock size={16} strokeWidth={2.4} />
          </span>
        ) : null}
        {unlocked ? (
          <span className="f10-egg-camo-card__badge f10-egg-camo-card__badge--unlocked">UNLOCKED</span>
        ) : (
          <span className="f10-egg-camo-card__badge f10-egg-camo-card__badge--locked">LOCKED</span>
        )}
      </button>

      <div className="f10-egg-camo-card__body">
        <div className="f10-egg-camo-card__name">{item.name.toUpperCase()}</div>
        <div className="f10-egg-camo-card__mastery">{item.masteryLabel.toUpperCase()}</div>
        <div className="f10-egg-camo-card__count">
          {item.eggRarityLabel.toUpperCase()} EGGS COLLECTED
          <strong>
            {item.current} / {item.target}
          </strong>
        </div>
        <p className="f10-egg-camo-card__req">{item.requirementText}</p>
        {!item.gatesMet && item.requiresAllPriorCamos ? (
          <p className="f10-egg-camo-card__gate">Master all prior Egg Camos first</p>
        ) : null}
        <div className="f10-camo-card__track" role="presentation">
          <div className="f10-camo-card__fill" style={{ width: `${item.progress}%` }} />
        </div>
        <div className="f10-egg-camo-card__actions">
          <button type="button" className="f10-camo-btn--ghost" onClick={() => onPreview?.(item)}>
            PREVIEW
          </button>
          {unlocked ? (
            <button type="button" className="f10-camo-btn--primary" onClick={() => onOpenDetail?.(item)}>
              VIEW
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

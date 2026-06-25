import React from 'react';

/**
 * A single owned-egg card: floating animated egg, rarity glow + badge,
 * quantity, and a Hatch button. Hover lifts/rotates/glows.
 */
export default function EggCard({ tier, onHatch, disabled }) {
  const style = {
    '--egg-color': tier.color,
    '--egg-glow': tier.glow,
    '--egg-aura': tier.aura,
    animationDelay: `${(tier.rank % 5) * 0.35}s`,
  };

  return (
    <div className={`egg-card egg-card--${tier.key}`} style={style}>
      <span className="egg-card__badge">{tier.name.replace(' Egg', '')}</span>

      <button
        type="button"
        className="egg-card__egg-btn"
        onClick={() => onHatch(tier)}
        disabled={disabled}
        aria-label={`Open ${tier.name}`}
      >
        <span className="egg-card__glow" aria-hidden />
        <span className="egg-card__egg" aria-hidden>
          <span className="egg-card__egg-shine" />
          <span className="egg-card__egg-spots" />
        </span>
      </button>

      <div className="egg-card__name">{tier.name}</div>
      <div className="egg-card__owned">
        Owned: <strong>{tier.owned}</strong>
      </div>

      <button
        type="button"
        className="egg-card__hatch"
        onClick={() => onHatch(tier)}
        disabled={disabled}
      >
        Hatch
      </button>
    </div>
  );
}

import React from 'react';
import { useSavvyMultiplier } from '../../hooks/useSavvyMultiplier';
import '../../styles/savvy-multiplier-breakdown.css';

function formatMult(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '1.00×';
  return `${n.toFixed(2)}×`;
}

function formatBonus(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return `+${n.toFixed(2)}×`;
}

/**
 * Server-authoritative Savvy earnings multiplier breakdown.
 */
export default function SavvyMultiplierBreakdown({ compact = false, className = '' }) {
  const mult = useSavvyMultiplier({ refreshEvents: true });

  const globalEvent = mult.specialMultipliers?.find((s) => s.type === 'global_event');
  const mythic = mult.specialMultipliers?.find((s) => s.type === 'mythic_3x');

  return (
    <div className={`savvy-mult-breakdown${compact ? ' savvy-mult-breakdown--compact' : ''} ${className}`.trim()}>
      <div className="savvy-mult-breakdown__head">
        <span className="savvy-mult-breakdown__title">Current Earning Power</span>
        <strong className="savvy-mult-breakdown__core">{formatMult(mult.coreMultiplier)}</strong>
      </div>

      <ul className="savvy-mult-breakdown__list">
        <li>
          <span>Power</span>
          <span>{formatMult(mult.powerMultiplier)}</span>
        </li>
        {(mult.additiveBonuses || []).map((bonus) => (
          <li key={`${bonus.type}-${bonus.source}`}>
            <span>{bonus.label}</span>
            <span>{formatBonus(bonus.amount)}</span>
          </li>
        ))}
      </ul>

      {mult.capApplied ? (
        <p className="savvy-mult-breakdown__cap">Core capped at {formatMult(mult.coreMultiplierCap || 3)}</p>
      ) : null}

      {globalEvent ? (
        <div className="savvy-mult-breakdown__event">
          <span className="savvy-mult-breakdown__event-label">{globalEvent.label} Active</span>
        </div>
      ) : null}

      {mythic ? (
        <div className="savvy-mult-breakdown__event savvy-mult-breakdown__event--mythic">
          <span className="savvy-mult-breakdown__event-label">{mythic.label} Active</span>
        </div>
      ) : null}

      {(globalEvent || mythic) && mult.effectiveMultiplier > mult.coreMultiplier + 0.001 ? (
        <div className="savvy-mult-breakdown__final">
          <span>Final Multiplier</span>
          <strong>{formatMult(mult.effectiveMultiplier)}</strong>
        </div>
      ) : null}
    </div>
  );
}

export { formatMult, formatBonus };

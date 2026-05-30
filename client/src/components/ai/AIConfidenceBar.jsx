import React from 'react';
import { SCOUT_LABELS } from '../../config/savvyScoutBranding';

const TIERS = ['low', 'medium', 'high', 'elite'];

const TIER_LABELS = { low: 'LOW', medium: 'MEDIUM', high: 'HIGH', elite: 'ELITE' };

/**
 * Glowing segmented AI confidence meter (mock tiers).
 */
export default function AIConfidenceBar({ tier, percent }) {
  const activeIdx = Math.max(0, TIERS.indexOf(tier));

  return (
    <div className="wsp-confidence" aria-label={`${SCOUT_LABELS.confidence} ${tier}`}>
      <div className="wsp-confidence__label-row">
        <span className="wsp-confidence__title">{SCOUT_LABELS.confidenceTitle}</span>
        <span className="wsp-confidence__pct">{Math.round(Number(percent) || 0)}%</span>
      </div>
      <div className="wsp-confidence__segments">
        {TIERS.map((t, i) => (
          <div
            key={t}
            className={`wsp-confidence__seg wsp-confidence__seg--${t} ${i <= activeIdx ? 'wsp-confidence__seg--on' : ''}`}
          >
            <span className="wsp-confidence__seg-label">{TIER_LABELS[t]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

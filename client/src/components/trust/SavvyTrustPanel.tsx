import React from 'react';
import type { TrustScoreResult } from '../../types/trustScore';
import { SCOUT_LABELS } from '../../config/savvyScoutBranding';
import SellerTrustEvidence from './SellerTrustEvidence';
import '../../styles/SavvyTrustPanel.css';

export type SavvyTrustPanelProps = {
  trust: TrustScoreResult;
  listing?: Record<string, unknown> | null;
  className?: string;
  compact?: boolean;
};

/**
 * Savvy Trust — seller reputation (evidence-first) and deal signals stay separate.
 */
export default function SavvyTrustPanel({
  trust,
  listing = null,
  className = '',
  compact = false,
}: SavvyTrustPanelProps) {
  const rootClass = `savvy-trust-panel savvy-trust-panel--${trust.trustLevel} ${className}`.trim();

  return (
    <div className={rootClass} role="region" aria-label="Savvy seller and deal assessment">
      {trust.savvyVerifiedSeller ? (
        <div className="savvy-trust-panel__verified">Savvy Verified Seller</div>
      ) : null}

      <SellerTrustEvidence trust={trust} listing={listing || undefined} compact={compact} />

      {trust.dealHighlights.length > 0 ? (
        <div className="savvy-trust-panel__chips" aria-label="Deal signals">
          {trust.dealHighlights.map((h) => (
            <span key={h} className="savvy-trust-panel__chip savvy-trust-panel__chip--deal">
              {h.toLowerCase().includes('under') && h.toLowerCase().includes('market')
                ? '🟡 Under Market Value'
                : h.toLowerCase().includes('strong') || h.toLowerCase().includes('imagery')
                  ? '🔥 Strong Deal Opportunity'
                  : `✨ ${h}`}
            </span>
          ))}
        </div>
      ) : null}

      {trust.dealWarningHeadline ? (
        <p className="savvy-trust-panel__deal-warn" role="note">
          ⚠️ {trust.dealWarningHeadline}
        </p>
      ) : null}

      <div className="savvy-trust-panel__row savvy-trust-panel__row--meta">
        <span className="savvy-trust-panel__ai">
          {SCOUT_LABELS.confidence} <strong>{trust.aiConfidence}%</strong>
        </span>
      </div>

      {!trust.safeToRecommend ? (
        <p className="savvy-trust-panel__cooldown">
          Savvy cooled auto-boosts here — review listing terms before you buy.
        </p>
      ) : null}
    </div>
  );
}

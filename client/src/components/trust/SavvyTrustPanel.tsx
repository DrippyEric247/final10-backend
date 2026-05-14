import React from 'react';
import type { TrustScoreResult } from '../../types/trustScore';
import '../../styles/SavvyTrustPanel.css';

const SELLER_BADGE: Record<
  TrustScoreResult['sellerTrustBand'],
  { emoji: string; label: string }
> = {
  elite: { emoji: '🟢', label: 'Elite Verified Seller' },
  high: { emoji: '🟢', label: 'Trusted Seller' },
  medium: { emoji: '🟡', label: 'Established Seller' },
  low: { emoji: '🔴', label: 'Limited Seller History' },
  unknown: { emoji: '🟡', label: 'Seller profile partial' },
};

export type SavvyTrustPanelProps = {
  trust: TrustScoreResult;
  className?: string;
};

/**
 * Savvy Trust — seller reputation and deal signals are **never** merged into one label.
 */
export default function SavvyTrustPanel({ trust, className = '' }: SavvyTrustPanelProps) {
  const sellerBadge = SELLER_BADGE[trust.sellerTrustBand];
  const sellerExplain =
    trust.sellerTrustReasons[0] ||
    trust.trustReasons[0] ||
    'Seller trust is based on marketplace reputation — not listing price.';

  const rootClass = `savvy-trust-panel savvy-trust-panel--${trust.trustLevel} ${className}`.trim();

  return (
    <div className={rootClass} role="region" aria-label="Savvy seller and deal assessment">
      <div className="savvy-trust-panel__row">
        <span className="savvy-trust-panel__badge">
          {sellerBadge.emoji} {sellerBadge.label}{' '}
          <span className="savvy-trust-panel__score">· {trust.sellerTrustScore}/100</span>
        </span>
        <span className="savvy-trust-panel__ai">
          AI confidence <strong>{trust.aiConfidence}%</strong>
        </span>
      </div>

      {trust.savvyVerifiedSeller ? (
        <div className="savvy-trust-panel__verified">Savvy Verified Seller</div>
      ) : null}

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

      {trust.savvyWarningHeadline ? (
        <p className="savvy-trust-panel__warn">{trust.savvyWarningHeadline}</p>
      ) : null}

      <p className="savvy-trust-panel__explain">{sellerExplain}</p>

      {!trust.safeToRecommend ? (
        <p className="savvy-trust-panel__cooldown">
          Savvy cooled auto-boosts here — review listing terms before you buy.
        </p>
      ) : null}
    </div>
  );
}

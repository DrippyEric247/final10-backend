import React from 'react';
import type { SellerTrustDisplay } from '../../types/trustScore';
import '../../styles/SellerTrustStats.css';

export type SellerTrustStatsProps = {
  display: SellerTrustDisplay;
  /** @deprecated Internal score — not shown in evidence-first UI. */
  score?: number;
  compact?: boolean;
};

/** @deprecated Prefer SellerTrustEvidence — stats grid without proprietary score. */
export default function SellerTrustStats({ display, compact = false }: SellerTrustStatsProps) {
  return (
    <dl
      className={`seller-trust-stats${compact ? ' seller-trust-stats--compact' : ''}`}
      aria-label="Seller marketplace details"
    >
      <div className="seller-trust-stats__cell">
        <dt>Feedback</dt>
        <dd>{display.feedbackPercent}</dd>
      </div>
      <div className="seller-trust-stats__cell">
        <dt>Reviews</dt>
        <dd>{display.feedbackCount}</dd>
      </div>
      <div className="seller-trust-stats__cell">
        <dt>Account</dt>
        <dd>{display.accountAge}</dd>
      </div>
      {display.isTopRated ? (
        <div className="seller-trust-stats__cell seller-trust-stats__cell--badge">
          <dt className="sr-only">Top Rated</dt>
          <dd>
            <span className="seller-trust-stats__top-rated">⭐ Top Rated</span>
          </dd>
        </div>
      ) : null}
    </dl>
  );
}

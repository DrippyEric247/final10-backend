import React from 'react';
import type { SellerTrustDisplay } from '../../types/trustScore';
import '../../styles/SellerTrustStats.css';

export type SellerTrustStatsProps = {
  display: SellerTrustDisplay;
  score: number;
  compact?: boolean;
};

export default function SellerTrustStats({ display, score, compact = false }: SellerTrustStatsProps) {
  return (
    <dl
      className={`seller-trust-stats${compact ? ' seller-trust-stats--compact' : ''}`}
      aria-label="Seller trust details"
    >
      <div className="seller-trust-stats__cell">
        <dt>Score</dt>
        <dd>{score}/100</dd>
      </div>
      <div className="seller-trust-stats__cell">
        <dt>Band</dt>
        <dd>{display.bandLabel}</dd>
      </div>
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

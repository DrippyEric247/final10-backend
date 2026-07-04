import React, { useMemo } from 'react';
import { buildBestMovePickReasons } from '../../lib/bestMovePickReasons';
import type { BestMoveResult } from '../../types/bestMove';
import type { TrustScoreResult } from '../../types/trustScore';
import type { DealListing } from './DealCard';
import '../../styles/best-move-insights.css';

type Props = {
  item: DealListing;
  decision: BestMoveResult;
  trustResult: TrustScoreResult;
  effectiveSavings: number;
  maxReasons?: number;
};

/**
 * Always-visible “Why Savvy Picked This” — top signals before opening the listing.
 */
export default function WhySavvyPickedSection({
  item,
  decision,
  trustResult,
  effectiveSavings,
  maxReasons = 4,
}: Props) {
  const reasons = useMemo(
    () =>
      buildBestMovePickReasons(
        {
          item: item as Record<string, unknown>,
          decision,
          trustResult,
          effectiveSavings,
        },
        maxReasons
      ),
    [item, decision, trustResult, effectiveSavings, maxReasons]
  );

  if (!reasons.length) return null;

  return (
    <section className="bm-why-picked" aria-label="Why Savvy picked this">
      <div className="bm-why-picked__head">
        <span className="bm-why-picked__spark" aria-hidden>
          ✦
        </span>
        <h4 className="bm-why-picked__title">Why Savvy Picked This</h4>
      </div>
      <ul className="bm-why-picked__list">
        {reasons.map((reason) => (
          <li key={reason} className="bm-why-picked__item">
            <span className="bm-why-picked__tick" aria-hidden>
              ✓
            </span>
            <span>{reason}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

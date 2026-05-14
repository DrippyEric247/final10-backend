import React, { useMemo } from 'react';
import { evaluateBestMove } from '../../lib/bestMoveEngine';
import { evaluateTrustScore, trustScoreInputFromListing } from '../../lib/trustScoreEngine';
import SavvyDealRewardsIntegration from '../rewards/SavvyDealRewardsIntegration';
import { formatPrice, toEstimatedPoints, type DealListing } from './DealCard';

type Props = {
  item: DealListing;
  effectiveSavings: number;
};

/**
 * Quick Snipes grid: wires enriched listing into shared Savvy rewards rail.
 */
export default function QuickSnipeSavvyRewards({ item, effectiveSavings }: Props) {
  const trustResult = useMemo(
    () => evaluateTrustScore(trustScoreInputFromListing(item as unknown as Record<string, unknown>)),
    [item]
  );

  const decision = useMemo(
    () =>
      evaluateBestMove({
        currentBid: item.currentBidPrice,
        buyNowPrice: item.buyNowPrice,
        marketValue: item.marketValue,
        marketConfidence: item.marketConfidence,
        trustScore: trustResult.trustScore,
        bidCount: item.bidCount,
        secondsRemaining: item.secondsRemaining,
        condition: item.condition,
        shippingCost: item.shippingCost,
        isAuction: item.isAuction,
        isBuyNow: item.isBuyNow,
      }),
    [item, trustResult.trustScore]
  );

  const basePoints = useMemo(() => toEstimatedPoints(item), [item]);

  return (
    <div className="qscc-savvy-rewards-embed mt-3">
      <SavvyDealRewardsIntegration
        item={item}
        trustResult={trustResult}
        decision={decision}
        basePoints={basePoints}
        listingMultiplierOverride={
          Number(item.pointsMultiplier) > 1 ? Number(item.pointsMultiplier) : undefined
        }
        effectiveSavings={effectiveSavings}
        formatPrice={formatPrice}
        currency={item.currency || 'USD'}
      />
    </div>
  );
}

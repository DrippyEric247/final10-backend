import React, { useMemo } from 'react';
import { evaluateBestMove } from '../../lib/bestMoveEngine';
import { evaluateTrustScore, trustScoreInputFromListing } from '../../lib/trustScoreEngine';
import SavvyDealRewardsIntegration from '../rewards/SavvyDealRewardsIntegration';
import { formatPrice, toEstimatedPoints, type DealListing } from '../deals/DealCard';

type Props = {
  item: Record<string, unknown>;
  effectiveSavings: number;
  currency: string;
};

/** Savvy rewards rail for marketplace listing cards (compact eBay variant). */
export default function EbayDealCardSavvyRewards({ item, effectiveSavings, currency }: Props) {
  const listing = item as unknown as DealListing;

  const trustResult = useMemo(
    () => evaluateTrustScore(trustScoreInputFromListing(item as Record<string, unknown>)),
    [item]
  );

  const decision = useMemo(
    () =>
      evaluateBestMove({
        currentBid: listing.currentBidPrice,
        buyNowPrice: listing.buyNowPrice,
        marketValue: listing.marketValue,
        marketConfidence: listing.marketConfidence,
        trustScore: trustResult.trustScore,
        bidCount: listing.bidCount,
        secondsRemaining: listing.secondsRemaining,
        condition: listing.condition,
        shippingCost: listing.shippingCost,
        isAuction: listing.isAuction,
        isBuyNow: listing.isBuyNow,
      }),
    [listing, trustResult.trustScore]
  );

  const basePoints = useMemo(() => toEstimatedPoints(listing), [listing]);

  return (
    <SavvyDealRewardsIntegration
      item={listing}
      trustResult={trustResult}
      decision={decision}
      basePoints={basePoints}
      listingMultiplierOverride={
        listing.pointsMultiplier != null && Number(listing.pointsMultiplier) > 1
          ? Number(listing.pointsMultiplier)
          : undefined
      }
      effectiveSavings={effectiveSavings}
      formatPrice={formatPrice}
      currency={currency}
    />
  );
}

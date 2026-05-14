import React from 'react';
import type { BestMoveResult } from '../../types/bestMove';
import type { TrustScoreResult } from '../../types/trustScore';
import { mergeDealAndTrustDecision } from '../../lib/trustScoreEngine';
import { DealCardShell, type DealListing } from './DealCard';

type Props = {
  item: DealListing;
  decision: BestMoveResult;
  trustResult: TrustScoreResult;
  onMeaningfulView?: (item: DealListing, action: string) => void;
  boostedPower?: boolean;
  hideCreateAlert?: boolean;
};

export default function AuctionOpportunityCard({
  item,
  decision,
  trustResult,
  onMeaningfulView,
  boostedPower = false,
  hideCreateAlert = false,
}: Props) {
  const merged = mergeDealAndTrustDecision(decision, trustResult);
  const bidCount = Number(item.bidCount) || 0;
  const chipText = bidCount <= 3 ? '📈 Low Competition' : 'Auction Opportunity';
  return (
    <DealCardShell
      item={item}
      decision={decision}
      trustResult={trustResult}
      chipText={merged.caution ? merged.headline : chipText === 'Auction Opportunity' ? '🔥 Best Move: Bid' : chipText}
      chipTone="bg-purple-500/20 text-purple-100 border-purple-400/45"
      cardTone="border-purple-500/35 shadow-[0_0_26px_rgba(139,92,246,0.16)]"
      typeTone="bg-black/60 border-purple-300/40 text-purple-100"
      boostedPower={boostedPower}
      hideCreateAlert={hideCreateAlert}
      onMeaningfulView={onMeaningfulView}
    />
  );
}


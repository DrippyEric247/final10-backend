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

export default function BuyNowDealCard({
  item,
  decision,
  trustResult,
  onMeaningfulView,
  boostedPower = false,
  hideCreateAlert = false,
}: Props) {
  const merged = mergeDealAndTrustDecision(decision, trustResult);
  return (
    <DealCardShell
      item={item}
      decision={decision}
      trustResult={trustResult}
      chipText={merged.caution ? '🔥 Best Move: Buy Now — caution advised' : '⚡ Best Move: Buy Now'}
      chipTone="bg-orange-500/25 text-orange-100 border-orange-400/60"
      cardTone="border-orange-400/40 shadow-[0_0_30px_rgba(251,146,60,0.2)]"
      typeTone="bg-black/60 border-orange-300/45 text-orange-100"
      emphasize
      boostedPower={boostedPower}
      hideCreateAlert={hideCreateAlert}
      onMeaningfulView={onMeaningfulView}
    />
  );
}


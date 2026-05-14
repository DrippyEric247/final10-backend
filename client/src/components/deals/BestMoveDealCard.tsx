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

export default function BestMoveDealCard({
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
      chipText={merged.headline}
      chipTone="bg-amber-500/25 text-amber-100 border-amber-400/60"
      cardTone="border-amber-400/50 shadow-[0_0_34px_rgba(251,191,36,0.23)]"
      typeTone="bg-black/60 border-amber-300/45 text-amber-100"
      emphasize
      boostedPower={boostedPower}
      hideCreateAlert={hideCreateAlert}
      onMeaningfulView={onMeaningfulView}
    />
  );
}


import React from 'react';
import type { BestMoveResult } from '../../types/bestMove';
import type { TrustScoreResult } from '../../types/trustScore';
import { DealCardShell, type DealListing } from './DealCard';

type Props = {
  item: DealListing;
  decision: BestMoveResult;
  trustResult: TrustScoreResult;
  onMeaningfulView?: (item: DealListing, action: string) => void;
  boostedPower?: boolean;
  hideCreateAlert?: boolean;
};

export default function PassDealCard({
  item,
  decision,
  trustResult,
  onMeaningfulView,
  boostedPower = false,
  hideCreateAlert = false,
}: Props) {
  return (
    <DealCardShell
      item={item}
      decision={decision}
      trustResult={trustResult}
      chipText="⚠️ Best Move: Pass"
      chipTone="bg-gray-700/80 text-gray-200 border-gray-500/45"
      cardTone="border-gray-700 opacity-90"
      typeTone="bg-black/60 border-gray-400/35 text-gray-200"
      boostedPower={boostedPower}
      hideCreateAlert={hideCreateAlert}
      onMeaningfulView={onMeaningfulView}
    />
  );
}


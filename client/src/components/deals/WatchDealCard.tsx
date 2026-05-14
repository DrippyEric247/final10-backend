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

export default function WatchDealCard({
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
      chipText="👀 Best Move: Watch"
      chipTone="bg-blue-500/20 text-blue-100 border-blue-400/45"
      cardTone="border-blue-500/35 shadow-[0_0_22px_rgba(59,130,246,0.14)]"
      typeTone="bg-black/60 border-blue-300/40 text-blue-100"
      boostedPower={boostedPower}
      hideCreateAlert={hideCreateAlert}
      onMeaningfulView={onMeaningfulView}
    />
  );
}


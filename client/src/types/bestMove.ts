export type BestMove = 'bid' | 'buy_now' | 'watch' | 'pass';

export type BestMoveConfidence = 'high' | 'medium' | 'low';

export type DealCardVariant =
  | 'best_move'
  | 'auction_opportunity'
  | 'buy_now'
  | 'watch'
  | 'pass';

export type BestMoveInput = {
  currentBid?: number | string | null;
  buyNowPrice?: number | string | null;
  marketValue?: number | string | null;
  /** True Market Value confidence from the engine (sold-comp data). */
  marketConfidence?: 'high' | 'medium' | 'low' | string | null;
  /** Trust score 0-100 used to break ties on the score → confidence mapping. */
  trustScore?: number | string | null;
  bidCount?: number | string | null;
  secondsRemaining?: number | string | null;
  condition?: string | null;
  shippingCost?: number | string | null;
  isAuction?: boolean;
  isBuyNow?: boolean;
};

export type BestMoveResult = {
  bestMove: BestMove;
  confidence: BestMoveConfidence;
  reason: string;
  estimatedSavings: number;
  cardVariant: DealCardVariant;
  dealScore: number;
  recommendationType: 'buy_now_better' | 'auction_better' | 'wait_and_watch' | 'pass';
  recommendationReason: string;
  confidenceScore: number;
};


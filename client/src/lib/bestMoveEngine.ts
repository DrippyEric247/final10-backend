import type { BestMoveInput, BestMoveResult, DealCardVariant } from '../types/bestMove';

function toNum(value: number | string | null | undefined): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function normalizeConditionBoost(condition: string | null | undefined): number {
  const c = String(condition || '').toLowerCase();
  if (!c) return 0;
  if (c.includes('new')) return 0.04;
  if (c.includes('refurbished')) return 0.02;
  if (c.includes('used')) return -0.02;
  return 0;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function toPercent(value: number): number {
  return Math.round(value * 100);
}

function mapScoreToBestMove(score: number): BestMoveResult['bestMove'] {
  if (score >= 85) return 'buy_now';
  if (score >= 65) return 'bid';
  if (score >= 45) return 'watch';
  return 'pass';
}

function mapBestMoveToRecommendationType(bestMove: BestMoveResult['bestMove']): BestMoveResult['recommendationType'] {
  if (bestMove === 'buy_now') return 'buy_now_better';
  if (bestMove === 'bid') return 'auction_better';
  if (bestMove === 'watch') return 'wait_and_watch';
  return 'pass';
}

function mapScoreToConfidence(score: number): BestMoveResult['confidence'] {
  if (score >= 75) return 'high';
  if (score >= 50) return 'medium';
  return 'low';
}

type ScoringContext = {
  bidCount: number;
  secondsRemaining: number;
  isAuction: boolean;
  bidTotal: number | null;
  buyTotal: number | null;
  comparablePrice: number | null;
  effectiveMarket: number | null;
  valueGapPct: number;
  buyNowGapPct: number;
  marketConfidence: 'high' | 'medium' | 'low' | null;
};

type FactorScores = {
  valueVsMarket: number;
  timeRemaining: number;
  bidCompetition: number;
  buyNowVsBidGap: number;
};

function normalizeConfidence(raw: unknown): 'high' | 'medium' | 'low' | null {
  const v = String(raw || '').toLowerCase();
  if (v === 'high' || v === 'medium' || v === 'low') return v;
  return null;
}

function buildScoringContext(input: BestMoveInput): ScoringContext {
  const currentBid = toNum(input.currentBid);
  const buyNowPrice = toNum(input.buyNowPrice);
  const marketValue = toNum(input.marketValue);
  const bidCount = Math.max(0, Number(input.bidCount) || 0);
  const secondsRemaining = Math.max(0, Number(input.secondsRemaining) || 0);
  const shippingCost = Math.max(0, toNum(input.shippingCost) || 0);
  const conditionBoost = normalizeConditionBoost(input.condition);

  const bidTotal = currentBid != null ? currentBid + shippingCost : null;
  const buyTotal = buyNowPrice != null ? buyNowPrice + shippingCost : null;
  const comparablePrice = buyTotal ?? bidTotal;
  const effectiveMarket = marketValue != null ? marketValue * (1 + conditionBoost) : null;

  const valueGapPct =
    effectiveMarket != null && comparablePrice != null && effectiveMarket > 0
      ? (effectiveMarket - comparablePrice) / effectiveMarket
      : 0;

  const buyNowGapPct =
    buyTotal != null && bidTotal != null && bidTotal > 0
      ? (buyTotal - bidTotal) / bidTotal
      : 0;

  return {
    bidCount,
    secondsRemaining,
    isAuction: Boolean(input.isAuction),
    bidTotal,
    buyTotal,
    comparablePrice,
    effectiveMarket,
    valueGapPct,
    buyNowGapPct,
    marketConfidence: normalizeConfidence(input.marketConfidence),
  };
}

function scoreValueVsMarket(ctx: ScoringContext): number {
  if (ctx.effectiveMarket == null || ctx.comparablePrice == null || ctx.effectiveMarket <= 0) return 45;
  // Reward savings ≥15% with a steeper curve, and penalize listings that are
  // priced above True Market Value. Clamp to [-0.3, +0.5] before normalizing.
  let gap = clamp(ctx.valueGapPct, -0.3, 0.5);
  if (gap >= 0.15) gap += 0.05; // savings ≥15% nudge
  if (gap < 0) gap = gap * 1.4; // amplify above-market penalty
  // Soften the score when comp confidence is low so we don't strongly act on
  // a noisy market signal.
  const confidenceFactor =
    ctx.marketConfidence === 'high' ? 1 : ctx.marketConfidence === 'medium' ? 0.85 : 0.7;
  const normalized = ((clamp(gap, -0.42, 0.55) + 0.3) / 0.85) * confidenceFactor;
  return Math.max(0, Math.min(100, toPercent(normalized)));
}

function scoreTimeRemaining(ctx: ScoringContext): number {
  if (!ctx.isAuction || ctx.secondsRemaining <= 0) return 60;
  if (ctx.secondsRemaining <= 15 * 60) return 92;
  if (ctx.secondsRemaining <= 60 * 60) return 78;
  if (ctx.secondsRemaining <= 6 * 60 * 60) return 63;
  if (ctx.secondsRemaining <= 24 * 60 * 60) return 52;
  return 40;
}

function scoreBidCompetition(ctx: ScoringContext): number {
  if (!ctx.isAuction) return 58;
  if (ctx.bidCount <= 1) return 84;
  if (ctx.bidCount <= 4) return 72;
  if (ctx.bidCount <= 8) return 55;
  if (ctx.bidCount <= 12) return 42;
  return 30;
}

function scoreBuyNowVsBidGap(ctx: ScoringContext): number {
  if (ctx.buyTotal == null) return 55;
  if (ctx.bidTotal == null || ctx.bidTotal <= 0) return 80;
  if (ctx.buyNowGapPct <= 0.03) return 92;
  if (ctx.buyNowGapPct <= 0.08) return 80;
  if (ctx.buyNowGapPct <= 0.15) return 65;
  if (ctx.buyNowGapPct <= 0.25) return 45;
  return 28;
}

function buildReason(ctx: ScoringContext, factors: FactorScores): string {
  const valueLine =
    ctx.valueGapPct >= 0.1
      ? `Priced about ${Math.round(ctx.valueGapPct * 100)}% under market`
      : ctx.valueGapPct > 0
        ? `Slight value edge at roughly ${Math.max(1, Math.round(ctx.valueGapPct * 100))}% under market`
        : 'Limited value edge against current market';

  const competitionLine =
    factors.bidCompetition >= 70
      ? 'competition is still manageable'
      : factors.bidCompetition >= 50
        ? 'competition is moderate'
        : 'competition is heavy';

  const urgencyLine =
    factors.timeRemaining >= 80
      ? 'ending soon, so urgency is high'
      : factors.timeRemaining >= 55
        ? 'timing is active but not critical'
        : 'there is still runway to wait';

  return `${valueLine}; ${competitionLine}; ${urgencyLine}.`;
}

function mapVariant(bestMove: BestMoveResult['bestMove'], forceBestMove: boolean): DealCardVariant {
  if (bestMove === 'pass') return 'pass';
  if (bestMove === 'watch') return 'watch';
  if (bestMove === 'buy_now') return forceBestMove ? 'best_move' : 'buy_now';
  return forceBestMove ? 'best_move' : 'auction_opportunity';
}

export function evaluateBestMove(input: BestMoveInput): BestMoveResult {
  const ctx = buildScoringContext(input);
  const estimatedSavings =
    ctx.effectiveMarket != null && ctx.comparablePrice != null
      ? Math.max(0, ctx.effectiveMarket - ctx.comparablePrice)
      : 0;

  const factors: FactorScores = {
    valueVsMarket: scoreValueVsMarket(ctx),
    timeRemaining: scoreTimeRemaining(ctx),
    bidCompetition: scoreBidCompetition(ctx),
    buyNowVsBidGap: scoreBuyNowVsBidGap(ctx),
  };

  const trustSignal = clamp(toNum(input.trustScore) ?? 52, 0, 100);

  const weightedScore =
    factors.valueVsMarket * 0.34 +
    factors.timeRemaining * 0.16 +
    factors.bidCompetition * 0.16 +
    factors.buyNowVsBidGap * 0.16 +
    trustSignal * 0.18;

  let dealScore = clamp(Math.round(weightedScore * 0.42 + trustSignal * 0.58), 0, 100);

  if (trustSignal < 42 && dealScore > 64) {
    dealScore = clamp(Math.round(dealScore * 0.86 + trustSignal * 0.14), 0, 100);
  }

  let bestMove = mapScoreToBestMove(dealScore);

  // Savvy Trust Engine: never let raw “deal math” auto-greenlight sketchy sellers.
  if (trustSignal < 38 && (bestMove === 'buy_now' || bestMove === 'bid')) {
    bestMove = 'watch';
    dealScore = Math.min(dealScore, 72);
  }

  const confidence = mapScoreToConfidence(dealScore);
  const confidenceScore = clamp(Number((dealScore / 100).toFixed(2)), 0, 1);
  const recommendationType = mapBestMoveToRecommendationType(bestMove);
  const recommendationReason = buildReason(ctx, factors);
  const forceBestMove = confidence === 'high' && (bestMove === 'buy_now' || bestMove === 'bid');

  return {
    bestMove,
    confidence,
    reason: recommendationReason,
    estimatedSavings,
    cardVariant: mapVariant(bestMove, forceBestMove),
    dealScore,
    recommendationType,
    recommendationReason,
    confidenceScore,
  };
}


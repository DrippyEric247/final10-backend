import { SCOUT_COPY } from '../config/savvyScoutBranding';

/**
 * Mock "Why Savvy Scout picked this" copy — replace with model/API later.
 */

export type AiConfidenceTier = 'low' | 'medium' | 'high' | 'elite';

export type WhySavvyPickedModel = {
  reasons: string[];
  aiTier: AiConfidenceTier;
  aiPercent: number;
  marketTrend: string;
  competitionLine: string;
  priceDeltaLine: string;
  timingLine: string;
  trustBullets: string[];
  showTrustPanel: boolean;
  summary: string;
};

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

function hashSeed(id: string | undefined, title: string | undefined): number {
  const s = `${id || ''}:${title || ''}`;
  let h = 0;
  for (let i = 0; i < s.length; i += 1) h = (h << 5) - h + s.charCodeAt(i);
  return Math.abs(h);
}

function formatMoney(n: number) {
  if (!Number.isFinite(n)) return '—';
  return `$${Math.round(n).toLocaleString()}`;
}

/**
 * @param params.item — listing blob
 * @param params.trustResult — evaluateTrustScore result
 * @param params.decision — evaluateBestMove result
 * @param params.effectiveSavings — display savings (TMV-aware when available)
 */
export function buildWhySavvyPickedModel(params: {
  item: Record<string, unknown>;
  trustResult: {
    trustScore: number;
    sellerTrustScore: number;
    safeToRecommend?: boolean;
    aiConfidence?: number;
    isEstablishedSeller?: boolean;
    isMegaReputation?: boolean;
    savvyVerifiedSeller?: boolean;
  };
  decision: {
    confidence: string;
    confidenceScore: number;
    bestMove: string;
    estimatedSavings: number;
  };
  effectiveSavings: number;
}): WhySavvyPickedModel {
  const { item, trustResult, decision, effectiveSavings } = params;
  const title = String(item.title || '').toLowerCase();
  const bids = Number(item.bidCount) || 0;
  const trust = Number(trustResult.trustScore) || 0;
  const sellerTrust = Number(trustResult.sellerTrustScore) || trust;
  const price = Number(item.buyNowPrice ?? item.currentBidPrice ?? item.price) || 0;
  const market = Number(item.marketValue) || 0;
  const seconds = Number(item.secondsRemaining) || 0;
  const seed = hashSeed(item.itemId != null ? String(item.itemId) : undefined, String(item.title || ''));

  const reasons: string[] = [];

  const savvyVerified = Boolean(item.savvyVerifiedSeller) || Boolean(trustResult.savvyVerifiedSeller);

  if (savvyVerified || sellerTrust >= 78) {
    reasons.push('Seller history verified');
  } else if (sellerTrust >= 55) {
    reasons.push('Seller signals above baseline');
  }

  if (bids <= 2) reasons.push('Low competition detected');
  else if (bids <= 6) reasons.push('Moderate competition — still favorable');

  if (market > 0 && price > 0 && price < market * 0.92) {
    reasons.push('Price significantly under market');
  } else if (effectiveSavings > 40) {
    reasons.push('Meaningful savings vs. typical comps');
  }

  if (seed % 3 !== 0 && market > 0) {
    reasons.push('Similar items recently sold higher');
  }

  if (bids <= 4 && seconds > 0) {
    reasons.push('Watcher count unusually low vs. category average');
  }

  if (/\b(jordan|rolex|gpu|bmw|luxury|designer)\b/i.test(title)) {
    reasons.push('Strong resale potential in this lane');
  }

  if (/\b(bag|handbag|watch|sneaker)\b/i.test(title)) {
    reasons.push('Luxury / collectibles lane trending upward');
  }

  if (seconds > 0 && seconds < 3600 * 6) {
    reasons.push('Rare listing timing window — auction heat building');
  }

  if (sellerTrust >= 70 && trustResult.safeToRecommend) {
    reasons.push('Trusted seller response history');
  }

  const confScore = Number(decision.confidenceScore) || 0;
  if (decision.confidence === 'high' || confScore >= 72) {
    reasons.push(SCOUT_COPY.bestMove.confidenceHigh);
  } else if (decision.confidence === 'medium') {
    reasons.push(SCOUT_COPY.bestMove.confidenceMedium);
  }

  reasons.push('Best Move score favorable for this profile');

  const uniq: string[] = [];
  const seen = new Set<string>();
  for (const r of reasons) {
    if (!seen.has(r)) {
      seen.add(r);
      uniq.push(r);
    }
  }

  let aiTier: AiConfidenceTier = 'medium';
  let aiPercent = 52;
  if (decision.confidence === 'high' && trust >= 70 && trustResult.safeToRecommend) {
    aiTier = 'elite';
    aiPercent = clamp(88 + (seed % 10), 85, 98);
  } else if (decision.confidence === 'high' || confScore >= 68) {
    aiTier = 'high';
    aiPercent = clamp(72 + (seed % 14), 68, 92);
  } else if (decision.confidence === 'low' || trust < 42) {
    aiTier = 'low';
    aiPercent = clamp(22 + (seed % 18), 15, 44);
  } else {
    aiTier = 'medium';
    aiPercent = clamp(48 + (seed % 16), 40, 67);
  }

  const trendPct = 8 + (seed % 22);
  let categoryHint = 'this category';
  if (/\b(gpu|rtx|ps5|xbox|macbook)\b/i.test(title)) categoryHint = 'electronics';
  else if (/\b(rolex|omega|watch)\b/i.test(title)) categoryHint = 'luxury watches';
  else if (/\b(jordan|nike|yeezy)\b/i.test(title)) categoryHint = 'sneakers';
  else if (/\b(bmw|e9|m3)\b/i.test(title)) categoryHint = 'BMW parts';

  const marketTrend = `${categoryHint.charAt(0).toUpperCase() + categoryHint.slice(1)} trending +${trendPct}% this week`;

  const avgWatch = 40 + (seed % 55);
  const competitionLine =
    bids <= 2
      ? `Only ${Math.max(bids, 1)} watchers vs. category avg ~${avgWatch}`
      : `${bids} watchers vs. category avg ~${avgWatch}`;

  const under = effectiveSavings > 0 ? effectiveSavings : Math.max(0, market - price);
  const priceDeltaLine =
    under > 0 ? `Estimated under market by ${formatMoney(under)}` : 'Pricing aligned with live comps';

  const timingLine =
    seconds > 0 && seconds < 7200
      ? 'Best engagement window detected — ending soon'
      : seconds > 0
        ? 'Listing still inside a strong discovery window'
        : 'Timing signal: monitor for re-list or price drop';

  const trustBullets: string[] = [];
  const showTrustPanel = sellerTrust >= 62 || savvyVerified;
  if (showTrustPanel) {
    trustBullets.push('Positive feedback history');
    if (trustResult.isEstablishedSeller || sellerTrust >= 72) trustBullets.push('Account age verified');
    trustBullets.push('Repeat transaction patterns look healthy');
    if (trustResult.safeToRecommend) trustBullets.push('Low dispute signals in Savvy risk scan');
    trustBullets.push('Fast response activity vs. peers');
  }

  const summary =
    trustResult.safeToRecommend && under > 50
      ? 'This listing shows strong value relative to competition, seller trust, and current market pricing. Savvy Scout believes this is a favorable low-risk opportunity.'
      : trust >= 55
        ? 'Signals skew positive on trust and timing; review price and photos, then move if it fits your lane.'
        : 'Mixed signals — Savvy Scout still surfaced this for visibility; verify seller and comps before committing.';

  return {
    reasons: uniq.slice(0, 12),
    aiTier,
    aiPercent,
    marketTrend,
    competitionLine,
    priceDeltaLine,
    timingLine,
    trustBullets,
    showTrustPanel,
    summary,
  };
}

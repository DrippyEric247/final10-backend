import type { BestMoveResult } from '../types/bestMove';
import type { TrustScoreResult } from '../types/trustScore';

export type PickReasonInput = {
  item: Record<string, unknown>;
  decision: Pick<BestMoveResult, 'confidence' | 'confidenceScore' | 'estimatedSavings' | 'bestMove'>;
  trustResult: Pick<
    TrustScoreResult,
    'trustScore' | 'sellerTrustScore' | 'safeToRecommend' | 'sellerTrustBand'
  > & { savvyVerifiedSeller?: boolean };
  effectiveSavings?: number;
};

type ScoredReason = { text: string; score: number };

function toNum(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function formatMoney(n: number, currency = 'USD') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(n);
}

/**
 * Build the top factual reasons Savvy selected this listing as a Best Move.
 * Prioritizes urgency, competition, value, and trust — never generic filler.
 */
export function buildBestMovePickReasons(input: PickReasonInput, max = 5): string[] {
  const { item, decision, trustResult } = input;
  const effectiveSavings = Number(input.effectiveSavings ?? decision.estimatedSavings) || 0;
  const seconds = Math.max(0, toNum(item.secondsRemaining) ?? 0);
  const bids = Math.max(0, toNum(item.bidCount) ?? 0);
  const price =
    toNum(item.buyNowPrice) ?? toNum(item.currentBidPrice) ?? toNum(item.price) ?? null;
  const market = toNum(item.marketValue) ?? null;
  const sellerTrust = toNum(trustResult.sellerTrustScore) ?? toNum(trustResult.trustScore) ?? 0;
  const savvyVerified = Boolean(item.savvyVerifiedSeller) || Boolean(trustResult.savvyVerifiedSeller);
  const isAuction = Boolean(item.isAuction);
  const reasons: ScoredReason[] = [];

  if (isAuction && seconds > 0) {
    if (seconds <= 60) {
      reasons.push({ text: `Ends in ${seconds} second${seconds === 1 ? '' : 's'}`, score: 100 });
    } else if (seconds < 600) {
      const m = Math.floor(seconds / 60);
      const s = seconds % 60;
      reasons.push({
        text: `Ends in under 10 minutes (${m}m ${s}s)`,
        score: 95,
      });
    } else if (seconds < 3600) {
      reasons.push({ text: 'Ending within the hour — timing is active', score: 72 });
    } else if (seconds < 6 * 3600) {
      reasons.push({ text: 'Auction still in a strong closing window today', score: 55 });
    }
  }

  if (isAuction) {
    if (bids <= 1) reasons.push({ text: 'Only 1 bid so far', score: 88 });
    else if (bids === 2) reasons.push({ text: 'Only 2 bids', score: 86 });
    else if (bids <= 4) reasons.push({ text: 'Low competition', score: 82 });
    else if (bids <= 8) reasons.push({ text: 'Moderate competition — still winnable', score: 58 });
  }

  if (market != null && price != null && market > 0 && price < market) {
    const pct = Math.round(((market - price) / market) * 100);
    if (pct >= 20) {
      reasons.push({ text: `${pct}% below market`, score: 90 });
    } else if (pct >= 10) {
      reasons.push({ text: `${pct}% under True Market Value`, score: 84 });
    } else if (pct >= 5) {
      reasons.push({ text: 'Priced below live market comps', score: 70 });
    }
  } else if (effectiveSavings >= 75) {
    reasons.push({ text: `Save ${formatMoney(effectiveSavings)} vs typical comps`, score: 78 });
  }

  if (savvyVerified) {
    reasons.push({ text: 'Savvy verified seller', score: 80 });
  } else if (sellerTrust >= 78 || trustResult.sellerTrustBand === 'elite') {
    reasons.push({ text: `High trust seller (${Math.round(sellerTrust)}/100)`, score: 76 });
  } else if (sellerTrust >= 65 || trustResult.sellerTrustBand === 'high') {
    reasons.push({ text: 'Established seller with strong signals', score: 62 });
  }

  if (
    isAuction &&
    seconds > 0 &&
    seconds < 900 &&
    bids <= 4 &&
    (decision.confidence === 'high' || decision.bestMove === 'bid')
  ) {
    reasons.push({ text: 'Rare opportunity — heat + low bids', score: 74 });
  }

  if (decision.confidence === 'high' && trustResult.safeToRecommend) {
    reasons.push({ text: 'High-confidence Best Move score', score: 52 });
  }

  if (toNum(item.savingsPct) != null && Number(item.savingsPct) >= 15) {
    reasons.push({ text: 'Strong savings signal on this listing', score: 48 });
  }

  const listedHours = toNum(item.listingAgeHours);
  const createdMs = item.itemCreationDate ? Date.parse(String(item.itemCreationDate)) : NaN;
  if (
    (listedHours != null && listedHours > 0 && listedHours <= 24) ||
    (Number.isFinite(createdMs) && Date.now() - createdMs <= 24 * 3600 * 1000)
  ) {
    reasons.push({ text: 'Recently listed', score: 66 });
  }

  const seen = new Set<string>();
  return reasons
    .sort((a, b) => b.score - a.score)
    .filter((r) => {
      if (seen.has(r.text)) return false;
      seen.add(r.text);
      return true;
    })
    .slice(0, max)
    .map((r) => r.text);
}

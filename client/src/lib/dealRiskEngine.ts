/**
 * Deal / listing risk — independent from seller reputation.
 * (Price vs market, shipping, imagery, metadata — not “seller is unverified”.)
 */

import type { DealRiskFlag, TrustScoreInput } from '../types/trustScore';

export type DealRiskResult = {
  dealRiskScore: number;
  flags: DealRiskFlag[];
  warnings: string[];
  /** UX chips separate from seller trust, e.g. “Under market value”. */
  dealHighlights: string[];
};

function toNum(value: number | string | null | undefined): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function hasUsefulTitle(title: string): boolean {
  const trimmed = title.trim();
  if (trimmed.length < 10) return false;
  if (/^(item|listing|good deal|great deal|for sale)$/i.test(trimmed)) return false;
  return true;
}

function inferImageCount(input: TrustScoreInput): number | null {
  const direct = toNum(input.imageCount);
  if (direct != null && direct >= 0) return direct;
  return null;
}

function listingLooksHiRes(url: string): boolean {
  const u = url.toLowerCase();
  return /s-l1600|s-l1400|s-l1280|\/zoom\//i.test(u);
}

function getComparablePrice(input: TrustScoreInput): number | null {
  return toNum(input.buyNowPrice) ?? toNum(input.currentBidPrice) ?? toNum(input.price);
}

export function evaluateDealRisk(input: TrustScoreInput): DealRiskResult {
  const flags: DealRiskFlag[] = [];
  const warnings: string[] = [];
  const dealHighlights: string[] = [];
  let score = 78;

  const comparablePrice = getComparablePrice(input);
  const marketValue = toNum(input.marketValue);
  const shippingCost = Math.max(0, toNum(input.shippingCost) || 0);
  const imageUrl = String(input.imageUrl || '').trim();
  const hasImage = Boolean(imageUrl);
  const title = String(input.title || '');
  const hasCondition = Boolean(String(input.condition || '').trim());
  const imageCount = inferImageCount(input);

  let belowMarketPct: number | null = null;
  if (marketValue != null && comparablePrice != null && marketValue > 0) {
    belowMarketPct = (marketValue - comparablePrice) / marketValue;
    if (belowMarketPct > 0.12 && belowMarketPct <= 0.38) {
      dealHighlights.push('Under typical market range');
      score += 2;
    }
    if (belowMarketPct > 0.35) {
      score -= 14;
      flags.push('price_far_below_market');
      warnings.push('Price is unusually low vs market — double-check listing details.');
    }
    if (belowMarketPct > 0.5) {
      score -= 10;
      if (!flags.includes('price_far_below_market')) flags.push('price_far_below_market');
      warnings.push('Deep discount vs comps — verify item and terms.');
    }
    if (belowMarketPct <= 0.08) {
      dealHighlights.push('Priced near market');
    }
  }

  if (comparablePrice != null && comparablePrice > 0 && shippingCost / comparablePrice > 0.35) {
    score -= 12;
    flags.push('high_shipping');
    warnings.push('Shipping is high relative to item price.');
  }

  if (!hasImage) {
    score -= 18;
    flags.push('missing_image');
    warnings.push('Listing is missing photos.');
  } else if (imageCount != null && imageCount >= 3 && listingLooksHiRes(imageUrl)) {
    dealHighlights.push('Strong listing imagery');
    score += 4;
  }

  if (!hasUsefulTitle(title)) {
    score -= 8;
    flags.push('suspicious_title');
    warnings.push('Title looks sparse or generic.');
  }

  if (!hasCondition) {
    score -= 6;
    flags.push('incomplete_metadata');
    warnings.push('Condition not specified.');
  }

  if (/wholesale|replica|100% authentic guarantee|wire only|cashapp/i.test(title)) {
    score -= 12;
    flags.push('suspicious_title');
    warnings.push('Listing wording warrants extra scrutiny.');
  }

  score = clamp(Math.round(score), 5, 100);

  return { dealRiskScore: score, flags, warnings, dealHighlights };
}

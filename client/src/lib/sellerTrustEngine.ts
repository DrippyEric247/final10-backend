/**
 * Seller Trust Engine — reputation only (no price / listing “deal” signals).
 */

import type { SellerTrustBand, TrustScoreInput } from '../types/trustScore';

export type SellerTrustResult = {
  /** 0–100 display score; not collapsed to zero when some API fields are missing. */
  sellerTrustScore: number;
  band: SellerTrustBand;
  reasons: string[];
  /** Strict rule: >98% feedback, >1000 volume, 2+ year account. */
  isEstablishedSeller: boolean;
  /** Strong reputation even if registration date missing from payload. */
  isMegaReputation: boolean;
};

function toNum(value: number | string | null | undefined): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function parseFeedbackPercent(raw: unknown): number | null {
  if (raw == null || raw === '') return null;
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  const s = String(raw).replace(/%/g, '').trim();
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function isTopRated(value: TrustScoreInput['sellerTopRated']): boolean {
  if (typeof value === 'boolean') return value;
  const s = String(value || '').trim().toLowerCase();
  return s === 'true' || s === 'yes' || s === 'top-rated' || s === 'top_rated';
}

function isBusinessStore(value: unknown): boolean {
  const s = String(value || '').toUpperCase();
  return s === 'BUSINESS' || s === 'STORE';
}

function bandFromScore(score: number): SellerTrustBand {
  if (score >= 61) return 'elite';
  if (score >= 41) return 'high';
  if (score >= 21) return 'medium';
  if (score >= 1) return 'low';
  return 'unknown';
}

/**
 * Established eBay-style seller: must never be labeled “unverified” or trust 0
 * from missing listing fields alone.
 */
export function isEstablishedSellerProfile(input: {
  feedbackPct: number | null;
  feedbackCount: number | null;
  itemsSold: number | null;
  accountAgeDays: number | null;
}): boolean {
  const { feedbackPct, feedbackCount, itemsSold, accountAgeDays } = input;
  const vol = Math.max(feedbackCount ?? 0, itemsSold ?? 0);
  if (feedbackPct == null || accountAgeDays == null) return false;
  return feedbackPct > 98 && vol > 1000 && accountAgeDays > 365 * 2;
}

/** 99%+ and very large volume — never treat as “unverified” even if account-age is absent. */
export function isMegaReputationSeller(input: {
  feedbackPct: number | null;
  feedbackCount: number | null;
  itemsSold: number | null;
}): boolean {
  const { feedbackPct, feedbackCount, itemsSold } = input;
  const vol = Math.max(feedbackCount ?? 0, itemsSold ?? 0);
  if (feedbackPct == null) return false;
  return feedbackPct >= 99 && vol >= 5000;
}

export function evaluateSellerTrust(input: TrustScoreInput): SellerTrustResult {
  const reasons: string[] = [];

  const rawPct = input.sellerFeedbackPercent;
  const feedbackPct =
    typeof rawPct === 'string' && /%/.test(rawPct)
      ? parseFeedbackPercent(rawPct)
      : toNum(rawPct) ?? parseFeedbackPercent(rawPct as unknown);
  const feedbackCount =
    toNum(input.sellerFeedbackCount) ??
    toNum((input as { sellerFeedbackScore?: number | string }).sellerFeedbackScore);
  const itemsSold =
    toNum(input.sellerCompletedSalesCount) ?? feedbackCount ?? null;
  const accountAgeDays = toNum(input.sellerAccountAgeDays);
  const responseHrs = toNum(input.sellerResponseHours);
  const topRated = isTopRated(input.sellerTopRated);
  const storeBiz = isBusinessStore((input as { sellerAccountType?: string }).sellerAccountType);
  const returnFriendly =
    (input as { sellerReturnsAccepted?: boolean | string }).sellerReturnsAccepted === true ||
    String((input as { sellerReturnsAccepted?: string }).sellerReturnsAccepted || '')
      .toLowerCase()
      === 'true';
  const repeatRate = toNum(input.sellerRepeatBuyerRate);

  const sellerName = String(input.seller || '').trim();
  const hasNamedSeller = Boolean(sellerName && !/^(unknown|ebay seller)$/i.test(sellerName));

  const hasAnySellerSignal =
    hasNamedSeller ||
    feedbackPct != null ||
    feedbackCount != null ||
    itemsSold != null ||
    accountAgeDays != null;

  // Baseline: never default to “0” — neutral prior when marketplace omits fields.
  let score = hasAnySellerSignal ? 32 : 24;
  if (hasNamedSeller) score += 4;

  if (accountAgeDays != null && accountAgeDays >= 365 * 5) {
    score += 10;
    reasons.push('Seller account over five years old.');
  } else if (accountAgeDays != null && accountAgeDays >= 365 * 2) {
    score += 7;
    reasons.push('Established seller account (2+ years).');
  } else if (accountAgeDays != null && accountAgeDays >= 365) {
    score += 4;
  }

  if (feedbackPct != null && feedbackPct > 99) {
    score += 10;
    reasons.push('Feedback above 99% positive.');
  } else if (feedbackPct != null && feedbackPct >= 98) {
    score += 7;
    reasons.push('Very strong positive feedback.');
  } else if (feedbackPct != null && feedbackPct >= 95) {
    score += 3;
  } else if (feedbackPct != null && feedbackPct < 90) {
    score -= 12;
    reasons.push('Feedback percentage is weaker than typical trusted sellers.');
  }

  if (feedbackCount != null && feedbackCount > 10_000) {
    score += 10;
    reasons.push('Very high feedback volume.');
  } else if (feedbackCount != null && feedbackCount > 1000) {
    score += 8;
    reasons.push('Large feedback history.');
  } else if (feedbackCount != null && feedbackCount > 100) {
    score += 5;
  } else if (feedbackCount != null && feedbackCount < 20) {
    score -= 6;
    reasons.push('Limited feedback history so far.');
  }

  if (itemsSold != null && itemsSold > 50_000) {
    score += 10;
    reasons.push('Extremely high lifetime sales volume.');
  } else if (itemsSold != null && itemsSold > 5000) {
    score += 7;
  } else if (itemsSold != null && itemsSold > 500) {
    score += 4;
  }

  if (responseHrs != null && responseHrs >= 0 && responseHrs <= 6) {
    score += 5;
    reasons.push('Fast response-time signal.');
  }

  if (topRated) {
    score += 5;
    reasons.push('Top Rated Seller / strong detailed ratings.');
  }

  if (storeBiz) {
    score += 4;
    reasons.push('Business / store seller.');
  }

  if (returnFriendly) {
    score += 3;
    reasons.push('Clear return policy signal.');
  }

  if (repeatRate != null && repeatRate >= 0.25) {
    score += 5;
    reasons.push('Strong repeat-buyer signal.');
  } else if (repeatRate != null && repeatRate >= 0.15) {
    score += 2;
  }

  const established = isEstablishedSellerProfile({
    feedbackPct,
    feedbackCount,
    itemsSold,
    accountAgeDays,
  });

  const mega = isMegaReputationSeller({ feedbackPct, feedbackCount, itemsSold });

  score = clamp(Math.round(score), 8, 100);

  if (established) {
    score = Math.max(score, 72);
    if (!reasons.some((r) => /established|feedback/i.test(r))) {
      reasons.unshift('Established high-reputation seller.');
    }
  } else if (mega) {
    score = Math.max(score, 68);
    if (!reasons.some((r) => /volume|feedback/i.test(r))) {
      reasons.unshift('Very strong seller reputation (feedback + volume).');
    }
  }

  let band = bandFromScore(score);
  if (!hasAnySellerSignal && band === 'unknown') {
    band = 'medium';
    score = Math.max(score, 30);
  }

  if (hasNamedSeller && score < 36) {
    score = 36;
    band = bandFromScore(score);
  }

  if (!established && !mega && feedbackCount != null && feedbackCount <= 10) {
    band = 'low';
  }

  return {
    sellerTrustScore: score,
    band,
    reasons,
    isEstablishedSeller: established,
    isMegaReputation: mega,
  };
}

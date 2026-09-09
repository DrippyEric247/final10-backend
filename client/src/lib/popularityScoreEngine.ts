/**
 * Client popularity / relevance layer for Best Move ranking.
 * Mirror of server/lib/listingRanking/popularityScoreEngine.js
 */

import {
  LOW_INTEREST_PATTERNS,
  getCategoryInterestProfile,
  normalizeInterestCategory,
  type CategoryInterestProfile,
} from "./categoryInterestProfiles";

export const POPULARITY_RANK_WEIGHTS = Object.freeze({
  profileMatch: 0.52,
  marketplaceActivity: 0.28,
  keywordRelevance: 0.2,
  compositeBoost: 0.16,
  finalistBoost: 0.11,
  maxBoostWhenWeakDeal: 7,
  weakDealScoreFloor: 45,
  strongSavingsPct: 14,
  diversityPenaltyPerDuplicate: 11,
  diversityWindow: 10,
});

export type PopularitySignals = {
  profileMatch: {
    value: number;
    source: "inferred";
    matchedBrand: string | null;
    matchedFamily: string | null;
    matchedKeyword: string | null;
    lowInterest?: boolean;
  };
  marketplaceActivity: {
    value: number;
    source: "observed";
    bidCount: number;
  };
  keywordRelevance: {
    value: number;
    source: "inferred";
  };
};

export type PopularityScoreResult = {
  score: number;
  category: string;
  signals: PopularitySignals;
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function normalizeTitle(title: unknown): string {
  return String(title || "").trim().toLowerCase();
}

function titleMatchesTerm(title: string, term: string): boolean {
  const t = normalizeTitle(title);
  const needle = String(term || "").trim().toLowerCase();
  if (!needle) return false;
  if (needle.includes(" ")) return t.includes(needle);
  const re = new RegExp(`\\b${needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
  return re.test(t);
}

export function isLowInterestTitle(title: string): boolean {
  const t = String(title || "");
  return LOW_INTEREST_PATTERNS.some((pat) => pat.test(t));
}

function scoreProfileMatch(title: string, profile: CategoryInterestProfile | null) {
  if (!profile) {
    return { score: 35, matchedBrand: null, matchedFamily: null, matchedKeyword: null, lowInterest: false };
  }
  if (isLowInterestTitle(title)) {
    return { score: 8, matchedBrand: null, matchedFamily: null, matchedKeyword: null, lowInterest: true };
  }

  let matchedBrand: string | null = null;
  for (const brand of profile.brands) {
    if (titleMatchesTerm(title, brand)) {
      matchedBrand = brand;
      break;
    }
  }

  let matchedFamily: string | null = null;
  for (const family of profile.productFamilies) {
    if (titleMatchesTerm(title, family)) {
      matchedFamily = family;
      break;
    }
  }

  let matchedKeyword: string | null = null;
  for (const keyword of profile.keywords) {
    if (titleMatchesTerm(title, keyword)) {
      matchedKeyword = keyword;
      break;
    }
  }

  let score = 28;
  if (matchedBrand) score += 38;
  if (matchedFamily) score += 24;
  if (matchedKeyword) score += 14;
  if (matchedBrand && matchedFamily) score += 6;

  return {
    score: clamp(score, 0, 100),
    matchedBrand,
    matchedFamily,
    matchedKeyword,
    lowInterest: false,
  };
}

function scoreMarketplaceActivity(listing: Record<string, unknown>) {
  const bidCount = Math.max(0, Number(listing?.bidCount) || 0);
  const activity = clamp(bidCount * 8 + Math.min(bidCount, 10) * 3, 0, 100);
  return { score: activity, bidCount, source: "observed" as const };
}

function scoreKeywordRelevance(title: string, profile: CategoryInterestProfile | null) {
  if (!profile?.keywords?.length) return { score: 40, source: "inferred" as const };
  const hit = profile.keywords.some((kw) => titleMatchesTerm(title, kw));
  return { score: hit ? 88 : 32, source: "inferred" as const };
}

export function computePopularityScore(
  listing: Record<string, unknown>,
  category: string
): PopularityScoreResult {
  const normalizedCategory = normalizeInterestCategory(category);
  const profile = getCategoryInterestProfile(normalizedCategory);
  const title = normalizeTitle(listing?.title);

  const profileMatch = scoreProfileMatch(title, profile);
  const marketplaceActivity = scoreMarketplaceActivity(listing);
  const keywordRelevance = scoreKeywordRelevance(title, profile);

  const w = POPULARITY_RANK_WEIGHTS;
  const score = clamp(
    profileMatch.score * w.profileMatch +
      marketplaceActivity.score * w.marketplaceActivity +
      keywordRelevance.score * w.keywordRelevance,
    0,
    100
  );

  return {
    score: Math.round(score * 10) / 10,
    category: normalizedCategory,
    signals: {
      profileMatch: {
        value: profileMatch.score,
        source: "inferred",
        matchedBrand: profileMatch.matchedBrand,
        matchedFamily: profileMatch.matchedFamily,
        matchedKeyword: profileMatch.matchedKeyword,
        lowInterest: profileMatch.lowInterest,
      },
      marketplaceActivity: {
        value: marketplaceActivity.score,
        source: marketplaceActivity.source,
        bidCount: marketplaceActivity.bidCount,
      },
      keywordRelevance: {
        value: keywordRelevance.score,
        source: keywordRelevance.source,
      },
    },
  };
}

export function computePopularityBoost(
  popularityScore: number,
  opts: { dealScore?: number; savingsPct?: number } = {}
): number {
  const w = POPULARITY_RANK_WEIGHTS;
  const base = (Number(popularityScore) || 0) * w.compositeBoost;
  const deal = Number(opts.dealScore) || 0;
  const savings = Number(opts.savingsPct) || 0;

  if (deal >= 65 || savings >= w.strongSavingsPct) {
    return Math.round(base * 10) / 10;
  }
  if (deal < w.weakDealScoreFloor && savings < 8) {
    return Math.round(Math.min(base, w.maxBoostWhenWeakDeal) * 10) / 10;
  }
  return Math.round(base * 0.65 * 10) / 10;
}

export function extractDiversityKey(
  listing: Record<string, unknown>,
  category: string
): string {
  const title = normalizeTitle(listing?.title);
  const profile = getCategoryInterestProfile(normalizeInterestCategory(category));
  if (!profile) return title.slice(0, 40) || "unknown";

  for (const brand of profile.brands) {
    if (titleMatchesTerm(title, brand)) return `brand:${brand}`;
  }
  for (const family of profile.productFamilies) {
    if (titleMatchesTerm(title, family)) return `family:${family}`;
  }
  const words = title.split(/\s+/).filter(Boolean).slice(0, 3);
  return words.join("-") || "generic";
}

export function applyDiversityRanking<T extends Record<string, unknown>>(
  rows: T[],
  opts: { scoreKey?: string; categoryKey?: string; limit?: number } = {}
): T[] {
  const scoreKey = opts.scoreKey || "rankScore";
  const categoryKey = opts.categoryKey || "category";
  const limit = opts.limit ?? POPULARITY_RANK_WEIGHTS.diversityWindow;
  const list = Array.isArray(rows) ? [...rows] : [];
  if (list.length <= 1) return list;

  const penalty = POPULARITY_RANK_WEIGHTS.diversityPenaltyPerDuplicate;
  const selected: T[] = [];
  const pool = list.sort(
    (a, b) => (Number(b[scoreKey]) || 0) - (Number(a[scoreKey]) || 0)
  );
  const familyCounts = new Map<string, number>();

  while (pool.length && selected.length < limit) {
    let bestIdx = 0;
    let bestAdjusted = -Infinity;

    for (let i = 0; i < pool.length; i += 1) {
      const row = pool[i];
      const listing = (row.listing || row.item || row) as Record<string, unknown>;
      const category = String(row[categoryKey] || row.interest || row.category || "");
      const base = Number(row[scoreKey]) || 0;
      const key = extractDiversityKey(listing, category);
      const dupes = familyCounts.get(key) || 0;
      const adjusted = base - dupes * penalty;
      if (adjusted > bestAdjusted) {
        bestAdjusted = adjusted;
        bestIdx = i;
      }
    }

    const [pick] = pool.splice(bestIdx, 1);
    const listing = (pick.listing || pick.item || pick) as Record<string, unknown>;
    const category = String(pick[categoryKey] || pick.interest || pick.category || "");
    const key = extractDiversityKey(listing, category);
    familyCounts.set(key, (familyCounts.get(key) || 0) + 1);
    selected.push(pick);
  }

  const remainder = pool.sort(
    (a, b) => (Number(b[scoreKey]) || 0) - (Number(a[scoreKey]) || 0)
  );
  return [...selected, ...remainder];
}

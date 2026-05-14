/**
 * Instant Best Move
 *
 * After a freshly-onboarded user picks 1–3 interests we fan out a small
 * number of eBay searches, score every candidate with a single composite
 * formula, and return the single highest-trust / highest-value deal to
 * render as their first personalized surface.
 *
 *   instantBestMoveScore =
 *     (trustScore   * 0.45) +
 *     (savingsPct   * 0.30) +
 *     (dealScore    * 0.15) +
 *     (urgencyScore * 0.10)
 *
 * All factors are normalized to the 0–100 range so the composite score
 * itself is 0–100 and comparable across categories.
 */

import { evaluateBestMove } from "./bestMoveEngine";
import { evaluateTrustScore } from "./trustScoreEngine";
import type { BestMoveResult } from "../types/bestMove";
import type { TrustScoreResult } from "../types/trustScore";
import { getInterestConfig, labelForInterest } from "./onboardingInterests";
import type { InterestId } from "./onboardingPreferences";
import { getBestListingImageUrl } from "./listingImageUrl";

const API_ROOT = (process.env.REACT_APP_API_URL || "/api").replace(/\/$/, "");
const API_BASE = `${API_ROOT}/ebay`;
const DEFAULT_PER_CATEGORY_LIMIT = 20;
const MIN_ACCEPTABLE_SCORE = 50;
const HIGH_TRUST_FLOOR = 60;

export type RawListing = Record<string, unknown> & {
  id?: string | number;
  itemId?: string | number;
  title?: string;
  imageUrl?: string;
  image?: string;
  itemWebUrl?: string;
  url?: string;
  price?: number | string;
  currentBid?: number | string;
  currentBidPrice?: number | string;
  buyNowPrice?: number | string;
  marketValue?: number | string;
  bidCount?: number | string;
  timeRemaining?: number | string;
  secondsRemaining?: number | string;
  condition?: string;
  shippingCost?: number | string;
  currency?: string;
  isAuction?: boolean;
  isBuyNow?: boolean;
  seller?: string;
  sellerFeedbackPercent?: number | string;
  sellerFeedbackCount?: number | string;
  sellerTopRated?: boolean | string;
  sellerAccountAgeDays?: number | string;
};

export type InstantBestMoveCandidate = {
  listing: RawListing;
  interest: InterestId;
  trust: TrustScoreResult;
  decision: BestMoveResult;
  savingsPercent: number;
  savingsAmount: number;
  urgencyScore: number;
  instantScore: number;
};

export type InstantBestMoveResult = {
  pick: InstantBestMoveCandidate | null;
  alternates: InstantBestMoveCandidate[];
  matchType:
    | "exact"
    | "next_best_win"
    | "closest_strong_match"
    | "global_next_best_win"
    | "watching";
  matchLabel:
    | "Exact Match"
    | "Next Best Win"
    | "Closest Strong Match"
    | "Global Next Best Win"
    | "Savvy Watching";
  matchMessage: string;
  pickedReason: string;
  /** Interests the engine was actually able to search. */
  searchedInterests: InterestId[];
  /** Interests that returned zero listings. */
  emptyInterests: InterestId[];
  totalCandidates: number;
};

function toNum(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function pickComparablePrice(item: RawListing): number | null {
  return (
    toNum(item.buyNowPrice) ??
    toNum(item.currentBidPrice ?? item.currentBid) ??
    toNum(item.price)
  );
}

function pickSecondsRemaining(item: RawListing): number | null {
  return toNum(item.secondsRemaining) ?? toNum(item.timeRemaining);
}

function urgencyFromSeconds(secondsRemaining: number | null): number {
  if (secondsRemaining == null || secondsRemaining <= 0) return 35;
  if (secondsRemaining <= 10 * 60) return 100;
  if (secondsRemaining <= 30 * 60) return 92;
  if (secondsRemaining <= 60 * 60) return 82;
  if (secondsRemaining <= 6 * 60 * 60) return 65;
  if (secondsRemaining <= 24 * 60 * 60) return 50;
  if (secondsRemaining <= 3 * 24 * 60 * 60) return 38;
  return 25;
}

function computeSavings(
  item: RawListing,
  decision: BestMoveResult
): { savingsAmount: number; savingsPercent: number } {
  const price = pickComparablePrice(item);
  const market = toNum(item.marketValue);
  if (!price || !market || market <= 0) {
    return {
      savingsAmount: Math.max(0, Number(decision.estimatedSavings) || 0),
      savingsPercent: 0,
    };
  }
  const savings = Math.max(0, market - price);
  const pct = clamp((savings / market) * 100, 0, 90);
  return {
    savingsAmount: Math.round(savings * 100) / 100,
    savingsPercent: Math.round(pct * 10) / 10,
  };
}

function composeInstantScore(
  trustScore: number,
  savingsPercent: number,
  dealScore: number,
  urgencyScore: number
): number {
  // Savings can reasonably saturate around ~60% under market; clamp to 100
  // so mega-low-trust gigantic "too good to be true" listings cannot runaway
  // score purely on savings.
  const normalizedSavings = clamp(savingsPercent * 1.5, 0, 100);
  const composite =
    trustScore * 0.58 +
    normalizedSavings * 0.18 +
    dealScore * 0.14 +
    urgencyScore * 0.1;
  return Math.round(composite * 10) / 10;
}

function listingIdentity(item: RawListing): string {
  const raw = item.itemId ?? item.id;
  if (raw != null) return String(raw);
  return String(item.itemWebUrl ?? item.url ?? item.title ?? Math.random());
}

function normalizeListing(item: RawListing): RawListing {
  const withUrl =
    item.imageUrl || !item.image ? item : { ...item, imageUrl: String(item.image).trim() };
  const best = getBestListingImageUrl(withUrl);
  if (!best) return withUrl;
  return { ...withUrl, imageUrl: best };
}

function hasValidTitle(item: RawListing): boolean {
  return typeof item.title === "string" && item.title.trim().length >= 4;
}

function hasValidImage(item: RawListing): boolean {
  const image = String(item.imageUrl || "").trim();
  return image.length > 0;
}

function hasValidPrice(item: RawListing): boolean {
  const price = pickComparablePrice(item);
  return Number.isFinite(price) && (price as number) > 0;
}

function isRenderableListing(item: RawListing): boolean {
  return hasValidTitle(item) && hasValidImage(item) && hasValidPrice(item);
}

async function searchInterest(
  interest: InterestId,
  signal?: AbortSignal,
  limit: number = DEFAULT_PER_CATEGORY_LIMIT
): Promise<RawListing[]> {
  const cfg = getInterestConfig(interest);
  if (!cfg) return [];
  const params = new URLSearchParams({ q: cfg.query, limit: String(limit) });
  debugLog("api_request", {
    engine: "interest_search",
    interest,
    category: interest,
    query: cfg.query,
    limit,
  });
  const headers: Record<string, string> = {};
  try {
    const token =
      typeof window !== "undefined"
        ? window.localStorage.getItem("f10_token")
        : null;
    if (token) headers.Authorization = `Bearer ${token}`;
  } catch {
    /* ignore */
  }
  const res = await fetch(`${API_BASE}/search?${params.toString()}`, {
    headers,
    signal,
  });
  if (!res.ok) {
    throw new Error(`search_failed_${res.status}`);
  }
  const data = await res.json();
  const raw = Array.isArray(data?.items) ? (data.items as RawListing[]) : [];
  debugLog("api_results", {
    engine: "interest_search",
    interest,
    query: cfg.query,
    resultCount: raw.length,
  });
  return raw.map(normalizeListing);
}

async function searchQuickSnipesGlobal(
  interestHint: InterestId,
  signal?: AbortSignal,
  limit: number = DEFAULT_PER_CATEGORY_LIMIT
): Promise<RawListing[]> {
  const cfg = getInterestConfig(interestHint);
  const q = cfg?.query || "electronics";
  const params = new URLSearchParams({ q, limit: String(limit) });
  const headers: Record<string, string> = {};
  try {
    const token =
      typeof window !== "undefined"
        ? window.localStorage.getItem("f10_token")
        : null;
    if (token) headers.Authorization = `Bearer ${token}`;
  } catch {
    /* ignore */
  }
  debugLog("api_request", {
    engine: "quick_snipes_global",
    query: q,
    limit,
  });
  const res = await fetch(`${API_BASE}/final10?${params.toString()}`, {
    headers,
    signal,
  });
  if (!res.ok) return [];
  const data = await res.json();
  const raw = Array.isArray(data?.items) ? (data.items as RawListing[]) : [];
  debugLog("api_results", {
    engine: "quick_snipes_global",
    query: q,
    resultCount: raw.length,
  });
  return raw.map(normalizeListing);
}

async function searchTrendingGlobal(
  interestHint: InterestId,
  signal?: AbortSignal,
  limit: number = DEFAULT_PER_CATEGORY_LIMIT
): Promise<RawListing[]> {
  const category = TRENDING_CATEGORY_BY_INTEREST[interestHint] || "all";
  const params = new URLSearchParams({ category, limit: String(limit) });
  const headers: Record<string, string> = {};
  try {
    const token =
      typeof window !== "undefined"
        ? window.localStorage.getItem("f10_token")
        : null;
    if (token) headers.Authorization = `Bearer ${token}`;
  } catch {
    /* ignore */
  }
  debugLog("api_request", {
    engine: "trending_global",
    category,
    limit,
  });
  const res = await fetch(`${API_BASE}/trending?${params.toString()}`, {
    headers,
    signal,
  });
  if (!res.ok) return [];
  const data = await res.json();
  const raw = Array.isArray(data?.items) ? (data.items as RawListing[]) : [];
  debugLog("api_results", {
    engine: "trending_global",
    category,
    resultCount: raw.length,
  });
  return raw.map(normalizeListing);
}

export function scoreListing(
  listing: RawListing,
  interest: InterestId
): InstantBestMoveCandidate {
  const trust = evaluateTrustScore({
    title: listing.title,
    imageUrl: listing.imageUrl,
    marketValue: listing.marketValue,
    price: listing.price,
    currentBidPrice: listing.currentBidPrice ?? listing.currentBid,
    buyNowPrice: listing.buyNowPrice,
    shippingCost: listing.shippingCost,
    condition: listing.condition,
    seller: listing.seller,
    sellerFeedbackPercent: listing.sellerFeedbackPercent,
    sellerFeedbackCount: listing.sellerFeedbackCount,
    sellerTopRated: listing.sellerTopRated,
    sellerAccountAgeDays: listing.sellerAccountAgeDays,
  });

  const decision = evaluateBestMove({
    currentBid: listing.currentBidPrice ?? listing.currentBid,
    buyNowPrice: listing.buyNowPrice,
    marketValue: listing.marketValue,
    marketConfidence: (listing as any).marketConfidence,
    trustScore: trust.trustScore,
    bidCount: listing.bidCount,
    secondsRemaining: pickSecondsRemaining(listing),
    condition: listing.condition,
    shippingCost: listing.shippingCost,
    isAuction: listing.isAuction,
    isBuyNow: listing.isBuyNow,
  });

  const { savingsAmount, savingsPercent } = computeSavings(listing, decision);
  const urgencyScore = urgencyFromSeconds(pickSecondsRemaining(listing));

  const instantScore = composeInstantScore(
    trust.trustScore,
    savingsPercent,
    decision.dealScore,
    urgencyScore
  );

  return {
    listing,
    interest,
    trust,
    decision,
    savingsPercent,
    savingsAmount,
    urgencyScore,
    instantScore,
  };
}

export function rankCandidates(
  candidates: InstantBestMoveCandidate[]
): InstantBestMoveCandidate[] {
  return [...candidates].sort((a, b) => {
    // Gate: exclude 'pass' recommendations from the top slot whenever a
    // non-pass candidate exists.
    const aPass = a.decision.bestMove === "pass" ? 1 : 0;
    const bPass = b.decision.bestMove === "pass" ? 1 : 0;
    if (aPass !== bPass) return aPass - bPass;
    if (b.instantScore !== a.instantScore) return b.instantScore - a.instantScore;
    // Tie-breakers: higher trust, then cheaper comparable price.
    if (b.trust.trustScore !== a.trust.trustScore) {
      return b.trust.trustScore - a.trust.trustScore;
    }
    const ap = pickComparablePrice(a.listing) ?? Infinity;
    const bp = pickComparablePrice(b.listing) ?? Infinity;
    return ap - bp;
  });
}

function isAcceptableFirstImpression(c: InstantBestMoveCandidate): boolean {
  if (!isRenderableListing(c.listing)) return false;
  if (!c.trust.safeToRecommend) return false;
  if (c.trust.trustScore < HIGH_TRUST_FLOOR) return false;
  if (c.decision.bestMove === "pass") return false;
  return c.instantScore >= MIN_ACCEPTABLE_SCORE;
}

function pickBestCandidate(
  ranked: InstantBestMoveCandidate[]
): InstantBestMoveCandidate | null {
  const strict = ranked.filter(
    (c) =>
      isAcceptableFirstImpression(c) &&
      c.trust.trustScore >= HIGH_TRUST_FLOOR &&
      c.savingsAmount > 0
  );
  if (strict.length > 0) return strict[0];

  const trustFirst = ranked.filter(
    (c) => isAcceptableFirstImpression(c) && c.trust.trustScore >= HIGH_TRUST_FLOOR
  );
  if (trustFirst.length > 0) return trustFirst[0];

  return null;
}

type InterestSearchResult = {
  searchedInterests: InterestId[];
  emptyInterests: InterestId[];
  candidates: InstantBestMoveCandidate[];
};

const RELATED_FALLBACK_MAP: Record<InterestId, InterestId[]> = {
  gaming: ["tech", "collectibles"],
  tech: ["gaming", "home"],
  sneakers: ["fashion", "collectibles"],
  fashion: ["sneakers"],
  collectibles: ["gaming", "gaming", "sneakers"],
  home: ["tech"],
  auto: ["tech", "collectibles"],
};

const TRENDING_CATEGORY_BY_INTEREST: Record<InterestId, string> = {
  gaming: "electronics",
  tech: "electronics",
  sneakers: "fashion",
  fashion: "fashion",
  collectibles: "collectibles",
  home: "home",
  auto: "automotive",
};

function debugLog(stage: string, detail: Record<string, unknown>): void {
  // eslint-disable-next-line no-console
  console.info(`[OnboardingBestMove] ${stage}`, detail);
}

async function searchInterestSet(
  interests: InterestId[],
  options: FetchInstantBestMoveOptions
): Promise<InterestSearchResult> {
  const { signal, perCategoryLimit } = options;
  const settled = await Promise.allSettled(
    interests.map((interest) =>
      searchInterest(interest, signal, perCategoryLimit).then((items) => ({
        interest,
        items,
      }))
    )
  );

  const searchedInterests: InterestId[] = [];
  const emptyInterests: InterestId[] = [];
  const candidates: InstantBestMoveCandidate[] = [];
  const seen = new Set<string>();

  settled.forEach((entry, idx) => {
    const interest = interests[idx];
    if (entry.status !== "fulfilled") return;
    searchedInterests.push(interest);
    const { items } = entry.value;
    if (!items.length) {
      emptyInterests.push(interest);
      return;
    }
    for (const raw of items) {
      const id = listingIdentity(raw);
      if (seen.has(id)) continue;
      seen.add(id);
      candidates.push(scoreListing(raw, interest));
    }
  });

  return { searchedInterests, emptyInterests, candidates };
}

export type FetchInstantBestMoveOptions = {
  signal?: AbortSignal;
  /** Per-category listing cap. */
  perCategoryLimit?: number;
};

export async function fetchInstantBestMove(
  interests: ReadonlyArray<InterestId>,
  options: FetchInstantBestMoveOptions = {}
): Promise<InstantBestMoveResult> {
  const unique = Array.from(new Set(interests));
  debugLog("selected_interests", { selectedInterests: unique });
  if (unique.length === 0) {
    return {
      pick: null,
      alternates: [],
      matchType: "watching",
      matchLabel: "Savvy Watching",
      matchMessage: "Want us to watch this category for you?",
      pickedReason: "No interests were selected yet.",
      searchedInterests: [],
      emptyInterests: [],
      totalCandidates: 0,
    };
  }

  const exactSearch = await searchInterestSet(unique, options);
  const exactRanked = rankCandidates(exactSearch.candidates);
  const exactPick = pickBestCandidate(exactRanked);
  if (exactPick) {
    debugLog("fallback_step_used", {
      step: 1,
      label: "exact_match",
      totalResults: exactSearch.candidates.length,
    });
    const alternates = exactRanked
      .filter((c) => c !== exactPick && isAcceptableFirstImpression(c))
      .slice(0, 4);
    return {
      pick: exactPick,
      alternates,
      matchType: "exact",
      matchLabel: "Exact Match",
      matchMessage: "Great match in your selected category.",
      pickedReason: `Best trust + savings pick in ${labelForInterest(exactPick.interest)}.`,
      searchedInterests: exactSearch.searchedInterests,
      emptyInterests: exactSearch.emptyInterests,
      totalCandidates: exactSearch.candidates.length,
    };
  }

  const relatedInterests = Array.from(
    new Set(
      unique.flatMap((id) => RELATED_FALLBACK_MAP[id] ?? getInterestConfig(id)?.neighbors ?? [])
    )
  ).filter((id) => !unique.includes(id));

  const relatedSearch =
    relatedInterests.length > 0
      ? await searchInterestSet(relatedInterests, options)
      : { searchedInterests: [], emptyInterests: [], candidates: [] };
  const relatedRanked = rankCandidates(relatedSearch.candidates);
  const relatedPick = pickBestCandidate(relatedRanked);
  if (relatedPick) {
    debugLog("fallback_step_used", {
      step: 2,
      label: "related_category",
      relatedInterests,
      totalResults: relatedSearch.candidates.length,
    });
    const alternates = relatedRanked
      .filter((c) => c !== relatedPick && isAcceptableFirstImpression(c))
      .slice(0, 4);
    return {
      pick: relatedPick,
      alternates,
      matchType: "next_best_win",
      matchLabel: "Next Best Win",
      matchMessage: `Nothing strong in ${interestLabelList(unique)} right now — so we found your next best win.`,
      pickedReason: `Closest strong option in related category ${labelForInterest(relatedPick.interest)}.`,
      searchedInterests: [
        ...exactSearch.searchedInterests,
        ...relatedSearch.searchedInterests,
      ],
      emptyInterests: [...exactSearch.emptyInterests, ...relatedSearch.emptyInterests],
      totalCandidates: exactSearch.candidates.length + relatedSearch.candidates.length,
    };
  }

  const quickSnipesItems = await searchQuickSnipesGlobal(
    unique[0],
    options.signal,
    options.perCategoryLimit
  );
  const trendingItems = await searchTrendingGlobal(
    unique[0],
    options.signal,
    options.perCategoryLimit
  );
  const globalCandidates = [...quickSnipesItems, ...trendingItems].map((item) =>
    scoreListing(item, unique[0])
  );
  const globalRanked = rankCandidates(globalCandidates);
  const globalPick = pickBestCandidate(globalRanked);
  const searchedInterests = [
    ...exactSearch.searchedInterests,
    ...relatedSearch.searchedInterests,
  ];
  const emptyInterests = [
    ...exactSearch.emptyInterests,
    ...relatedSearch.emptyInterests,
  ];
  if (globalPick) {
    debugLog("fallback_step_used", {
      step: 3,
      label: "global_next_best_win",
      quickSnipesResults: quickSnipesItems.length,
      trendingResults: trendingItems.length,
    });
    const alternates = globalRanked
      .filter((c) => c !== globalPick && isAcceptableFirstImpression(c))
      .slice(0, 4);
    return {
      pick: globalPick,
      alternates,
      matchType: "global_next_best_win",
      matchLabel: "Global Next Best Win",
      matchMessage: `Nothing strong in ${interestLabelList(unique)} right now — here is the strongest global win.`,
      pickedReason: `Strongest deal from Quick Snipes / Trending in ${labelForInterest(globalPick.interest)}.`,
      searchedInterests,
      emptyInterests,
      totalCandidates: globalRanked.length,
    };
  }

  debugLog("fallback_step_used", {
    step: 4,
    label: "create_alert_fallback",
    totalResults: globalRanked.length,
  });
  return {
    pick: null,
    alternates: [],
    matchType: "watching",
    matchLabel: "Savvy Watching",
    matchMessage: "Nothing strong in your picks yet — want Final10 to watch this for you?",
    pickedReason: "No deal met trust, value, and listing-quality standards right now.",
    searchedInterests,
    emptyInterests,
    totalCandidates: globalRanked.length,
  };
}

export function interestLabelList(ids: ReadonlyArray<InterestId>): string {
  if (!ids.length) return "";
  if (ids.length === 1) return labelForInterest(ids[0]);
  if (ids.length === 2) return `${labelForInterest(ids[0])} & ${labelForInterest(ids[1])}`;
  const head = ids.slice(0, -1).map(labelForInterest).join(", ");
  return `${head} & ${labelForInterest(ids[ids.length - 1])}`;
}

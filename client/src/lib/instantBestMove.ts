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
import { buildApiUrl } from "./runtimeApi";

const ebayApi = (path: string) => buildApiUrl(`/ebay${path.startsWith("/") ? path : `/${path}`}`);
const DEFAULT_PER_CATEGORY_LIMIT = 20;
const MIN_ACCEPTABLE_SCORE = 50;
const HIGH_TRUST_FLOOR = 60;
const MEDIUM_TRUST_FLOOR = 55;

/** Broad live queries when interest/category searches return thin results. */
export const DEFAULT_TRENDING_QUERIES = [
  "PlayStation 5 console",
  "Air Jordan sneakers",
  "NVIDIA RTX 4070 graphics card",
  "BMW wheels",
] as const;

export const WIDENED_SEARCH_MESSAGE =
  "Savvy Scout widened the search to find a safer Best Move.";

type SearchFilters = {
  listingMode?: string;
};

type EbayListingsFetchResult = {
  items: RawListing[];
  ok: boolean;
  status: number;
  error?: string;
};

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
    | "cached_fallback"
    | "watching";
  /** True when a broader query/category retry produced the pick. */
  widenedSearch?: boolean;
  matchLabel:
    | "Exact Match"
    | "Next Best Win"
    | "Closest Strong Match"
    | "Global Next Best Win"
    | "Savvy Pick"
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

function isValidEbayCategoryId(categoryId?: string): boolean {
  const cat = String(categoryId || "").trim();
  return /^\d+$/.test(cat);
}

function authHeaders(): Record<string, string> {
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
  return headers;
}

function sellerFeedbackCount(listing: RawListing): number {
  return toNum(listing.sellerFeedbackCount) ?? 0;
}

function isUnderMarket(c: InstantBestMoveCandidate): boolean {
  if (c.savingsAmount > 0) return true;
  const market = toNum(c.listing.marketValue);
  const price = pickComparablePrice(c.listing);
  return Boolean(market && price && market > price);
}

function isLowCompetition(listing: RawListing): boolean {
  const bids = toNum(listing.bidCount);
  if (bids == null) return true;
  return bids <= 12;
}

type QualityTier = "strict" | "standard" | "relaxed";

function meetsBestMoveQuality(
  c: InstantBestMoveCandidate,
  tier: QualityTier
): boolean {
  if (!isRenderableListing(c.listing)) return false;
  if (c.decision.bestMove === "pass") return false;
  if (!c.trust.safeToRecommend) return false;

  const trust = c.trust.trustScore;
  const level = c.trust.trustLevel;
  const feedback = sellerFeedbackCount(c.listing);
  const sellerOk =
    feedback > 0 ||
    Boolean(c.trust.isEstablishedSeller) ||
    Boolean(c.trust.isMegaReputation);
  const bandOk = level === "high" || level === "medium";

  if (tier === "strict") {
    return isAcceptableFirstImpression(c);
  }

  if (tier === "standard") {
    return (
      trust >= HIGH_TRUST_FLOOR &&
      bandOk &&
      sellerOk &&
      isUnderMarket(c) &&
      isLowCompetition(c.listing) &&
      c.instantScore >= MIN_ACCEPTABLE_SCORE
    );
  }

  return trust >= MEDIUM_TRUST_FLOOR && bandOk && sellerOk;
}

async function fetchEbaySearchListings(opts: {
  q: string;
  categoryId?: string;
  limit?: number;
  signal?: AbortSignal;
  engine: string;
  interest?: InterestId;
  filters?: SearchFilters;
}): Promise<EbayListingsFetchResult> {
  const limit = opts.limit ?? DEFAULT_PER_CATEGORY_LIMIT;
  const query = String(opts.q || "").trim() || "electronics";
  const catRaw = String(opts.categoryId || "").trim();
  const params = new URLSearchParams({ q: query, limit: String(limit) });
  if (isValidEbayCategoryId(catRaw)) {
    params.set("categoryId", catRaw);
  }
  if (opts.filters?.listingMode) {
    params.set("listingMode", opts.filters.listingMode);
  }

  const url = `${ebayApi("/search")}?${params.toString()}`;
  debugLog("api_request", {
    engine: opts.engine,
    interest: opts.interest,
    query,
    categoryId: isValidEbayCategoryId(catRaw) ? catRaw : "",
    categoryIdSkipped: catRaw && !isValidEbayCategoryId(catRaw) ? catRaw : undefined,
    filters: opts.filters ?? {},
    url,
  });

  try {
    const res = await fetch(url, { headers: authHeaders(), signal: opts.signal });
    let payload: Record<string, unknown> | null = null;
    try {
      payload = await res.json();
    } catch {
      payload = null;
    }
    const items = Array.isArray(payload?.items)
      ? (payload.items as RawListing[]).map(normalizeListing)
      : [];
    debugLog("api_response", {
      engine: opts.engine,
      interest: opts.interest,
      query,
      categoryId: isValidEbayCategoryId(catRaw) ? catRaw : "",
      status: res.status,
      ok: res.ok,
      resultCount: items.length,
      error: res.ok
        ? undefined
        : String(payload?.error || payload?.message || res.statusText),
    });
    if (!res.ok) {
      return {
        items: [],
        ok: false,
        status: res.status,
        error: String(payload?.error || payload?.message || res.statusText),
      };
    }
    return { items, ok: true, status: res.status };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    debugLog("api_response", {
      engine: opts.engine,
      interest: opts.interest,
      query,
      categoryId: isValidEbayCategoryId(catRaw) ? catRaw : "",
      status: 0,
      ok: false,
      resultCount: 0,
      error: message,
    });
    return { items: [], ok: false, status: 0, error: message };
  }
}

/** User query + category, then same query with all categories (no categoryId). */
async function searchWithCategoryFallback(opts: {
  q: string;
  categoryId?: string;
  limit?: number;
  signal?: AbortSignal;
  engine: string;
  interest?: InterestId;
}): Promise<{ items: RawListing[]; widened: boolean }> {
  const cat = String(opts.categoryId || "").trim();
  if (cat && isValidEbayCategoryId(cat)) {
    const narrow = await fetchEbaySearchListings({ ...opts, categoryId: cat });
    if (narrow.items.length) {
      return { items: narrow.items, widened: false };
    }
    debugLog("category_retry", {
      query: opts.q,
      droppedCategoryId: cat,
      reason: "empty_or_failed",
    });
    const broad = await fetchEbaySearchListings({ ...opts, categoryId: undefined });
    return { items: broad.items, widened: true };
  }

  if (cat && !isValidEbayCategoryId(cat)) {
    debugLog("category_retry", {
      query: opts.q,
      droppedCategoryId: cat,
      reason: "invalid_non_numeric",
    });
  }
  const res = await fetchEbaySearchListings({ ...opts, categoryId: undefined });
  return { items: res.items, widened: Boolean(cat) };
}

async function searchInterest(
  interest: InterestId,
  signal?: AbortSignal,
  limit: number = DEFAULT_PER_CATEGORY_LIMIT,
  categoryId?: string
): Promise<{ items: RawListing[]; widened: boolean }> {
  const cfg = getInterestConfig(interest);
  if (!cfg) return { items: [], widened: false };
  return searchWithCategoryFallback({
    q: cfg.query,
    categoryId,
    limit,
    signal,
    engine: "interest_search",
    interest,
  });
}

async function searchQuickSnipesGlobal(
  interestHint: InterestId,
  signal?: AbortSignal,
  limit: number = DEFAULT_PER_CATEGORY_LIMIT
): Promise<RawListing[]> {
  const cfg = getInterestConfig(interestHint);
  const q = cfg?.query || "electronics";
  const params = new URLSearchParams({ q, limit: String(limit) });
  debugLog("api_request", { engine: "quick_snipes_global", query: q, limit });
  try {
    const res = await fetch(`${ebayApi("/final10")}?${params.toString()}`, {
      headers: authHeaders(),
      signal,
    });
    let payload: Record<string, unknown> | null = null;
    try {
      payload = await res.json();
    } catch {
      payload = null;
    }
    const raw = Array.isArray(payload?.items) ? (payload.items as RawListing[]) : [];
    debugLog("api_response", {
      engine: "quick_snipes_global",
      query: q,
      status: res.status,
      ok: res.ok,
      resultCount: raw.length,
    });
    if (!res.ok) return [];
    return raw.map(normalizeListing);
  } catch (err) {
    debugLog("api_response", {
      engine: "quick_snipes_global",
      query: q,
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    });
    return [];
  }
}

async function searchTrendingGlobal(
  interestHint: InterestId,
  signal?: AbortSignal,
  limit: number = DEFAULT_PER_CATEGORY_LIMIT
): Promise<RawListing[]> {
  const category = TRENDING_CATEGORY_BY_INTEREST[interestHint] || "all";
  const params = new URLSearchParams({ category, limit: String(limit) });
  debugLog("api_request", { engine: "trending_global", category, limit });
  try {
    const res = await fetch(`${ebayApi("/trending")}?${params.toString()}`, {
      headers: authHeaders(),
      signal,
    });
    let payload: Record<string, unknown> | null = null;
    try {
      payload = await res.json();
    } catch {
      payload = null;
    }
    const raw = Array.isArray(payload?.items) ? (payload.items as RawListing[]) : [];
    debugLog("api_response", {
      engine: "trending_global",
      category,
      status: res.status,
      ok: res.ok,
      resultCount: raw.length,
    });
    if (!res.ok) return [];
    return raw.map(normalizeListing);
  } catch (err) {
    debugLog("api_response", {
      engine: "trending_global",
      category,
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    });
    return [];
  }
}

async function searchDefaultTrendingQueries(
  signal?: AbortSignal,
  limit: number = DEFAULT_PER_CATEGORY_LIMIT
): Promise<RawListing[]> {
  const seen = new Set<string>();
  const merged: RawListing[] = [];
  for (const q of DEFAULT_TRENDING_QUERIES) {
    const { items } = await searchWithCategoryFallback({
      q,
      signal,
      limit: Math.max(8, Math.floor(limit / 2)),
      engine: "trending_default_query",
    });
    for (const item of items) {
      const id = listingIdentity(item);
      if (seen.has(id)) continue;
      seen.add(id);
      merged.push(item);
    }
  }
  debugLog("trending_default_queries_merged", { resultCount: merged.length });
  return merged;
}

function buildMockSafeDeal(interest: InterestId): InstantBestMoveCandidate {
  const listing = normalizeListing({
    id: "f10-mock-safe-best-move",
    itemId: "f10-mock-safe-best-move",
    title: "Sony PS5 Console Bundle — Savvy starter Best Move",
    imageUrl:
      "https://via.placeholder.com/960x720/111827/22D3EE?text=Final10+Best+Move",
    itemWebUrl: "https://www.ebay.com/sch/i.html?_nkw=playstation+5+console",
    buyNowPrice: 449.99,
    marketValue: 519.99,
    currency: "USD",
    isBuyNow: true,
    seller: "verified_marketplace_seller",
    sellerFeedbackPercent: 99.4,
    sellerFeedbackCount: 2840,
    sellerTopRated: true,
    bidCount: 3,
    condition: "Used",
    shippingCost: 0,
  });
  return scoreListing(listing, interest);
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
  ranked: InstantBestMoveCandidate[],
  tiers: QualityTier[] = ["strict", "standard", "relaxed"]
): InstantBestMoveCandidate | null {
  for (const tier of tiers) {
    const hit = ranked.find((c) => meetsBestMoveQuality(c, tier));
    if (hit) return hit;
  }
  return null;
}

type InterestSearchResult = {
  searchedInterests: InterestId[];
  emptyInterests: InterestId[];
  candidates: InstantBestMoveCandidate[];
  widened: boolean;
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
  options: FetchInstantBestMoveOptions,
  categoryId?: string
): Promise<InterestSearchResult> {
  const { signal, perCategoryLimit } = options;
  const settled = await Promise.allSettled(
    interests.map((interest) =>
      searchInterest(interest, signal, perCategoryLimit, categoryId).then((result) => ({
        interest,
        ...result,
      }))
    )
  );

  const searchedInterests: InterestId[] = [];
  const emptyInterests: InterestId[] = [];
  const candidates: InstantBestMoveCandidate[] = [];
  const seen = new Set<string>();
  let widened = false;

  settled.forEach((entry, idx) => {
    const interest = interests[idx];
    if (entry.status !== "fulfilled") return;
    searchedInterests.push(interest);
    const { items, widened: wasWidened } = entry.value;
    if (wasWidened) widened = true;
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

  return { searchedInterests, emptyInterests, candidates, widened };
}

function mergeCandidates(
  target: InstantBestMoveCandidate[],
  seen: Set<string>,
  items: RawListing[],
  interest: InterestId
) {
  for (const raw of items) {
    const id = listingIdentity(raw);
    if (seen.has(id)) continue;
    seen.add(id);
    target.push(scoreListing(raw, interest));
  }
}

function buildSuccessResult(
  pick: InstantBestMoveCandidate,
  ranked: InstantBestMoveCandidate[],
  base: {
    matchType: InstantBestMoveResult["matchType"];
    matchLabel: InstantBestMoveResult["matchLabel"];
    matchMessage: string;
    pickedReason: string;
    searchedInterests: InterestId[];
    emptyInterests: InterestId[];
    totalCandidates: number;
    widenedSearch?: boolean;
  }
): InstantBestMoveResult {
  const alternates = ranked
    .filter((c) => c !== pick && meetsBestMoveQuality(c, "standard"))
    .slice(0, 4);
  return {
    pick,
    alternates,
    matchType: base.matchType,
    matchLabel: base.matchLabel,
    matchMessage: base.matchMessage,
    pickedReason: base.pickedReason,
    searchedInterests: base.searchedInterests,
    emptyInterests: base.emptyInterests,
    totalCandidates: base.totalCandidates,
    widenedSearch: Boolean(base.widenedSearch),
  };
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
  const primary = unique[0] ?? "gaming";
  debugLog("best_move_run", { selectedInterests: unique, options });

  if (unique.length === 0) {
    const mock = buildMockSafeDeal("gaming");
    return buildSuccessResult(mock, [mock], {
      matchType: "cached_fallback",
      matchLabel: "Savvy Pick",
      matchMessage: WIDENED_SEARCH_MESSAGE,
      pickedReason: "Showing a safe starter pick while you choose interests.",
      searchedInterests: [],
      emptyInterests: [],
      totalCandidates: 1,
      widenedSearch: true,
    });
  }

  try {
    let widened = false;
    let searchedInterests: InterestId[] = [];
    let emptyInterests: InterestId[] = [];
    const allCandidates: InstantBestMoveCandidate[] = [];
    const seen = new Set<string>();

    // 1) User interests (query + optional category retry → all categories)
    const exactSearch = await searchInterestSet(unique, options);
    widened = widened || exactSearch.widened;
    searchedInterests = [...searchedInterests, ...exactSearch.searchedInterests];
    emptyInterests = [...emptyInterests, ...exactSearch.emptyInterests];
    for (const c of exactSearch.candidates) {
      const id = listingIdentity(c.listing);
      if (seen.has(id)) continue;
      seen.add(id);
      allCandidates.push(c);
    }

    let ranked = rankCandidates(allCandidates);
    let pick = pickBestCandidate(ranked);
    if (pick) {
      debugLog("fallback_step_used", { step: 1, label: "interest_query", totalResults: allCandidates.length });
      return buildSuccessResult(pick, ranked, {
        matchType: "exact",
        matchLabel: "Exact Match",
        matchMessage: "Great match in your selected category.",
        pickedReason: `Best trust + savings pick in ${labelForInterest(pick.interest)}.`,
        searchedInterests,
        emptyInterests,
        totalCandidates: allCandidates.length,
        widenedSearch: widened,
      });
    }

    // 2) Same interest queries — explicitly all categories (no categoryId)
    const broadSearch = await searchInterestSet(unique, options, "");
    widened = true;
    searchedInterests = Array.from(new Set([...searchedInterests, ...broadSearch.searchedInterests]));
    emptyInterests = [...emptyInterests, ...broadSearch.emptyInterests];
    const beforeBroad = allCandidates.length;
    for (const c of broadSearch.candidates) {
      const id = listingIdentity(c.listing);
      if (seen.has(id)) continue;
      seen.add(id);
      allCandidates.push(c);
    }
    ranked = rankCandidates(allCandidates);
    pick = pickBestCandidate(ranked);
    if (pick) {
      debugLog("fallback_step_used", {
        step: 2,
        label: "interest_all_categories",
        newResults: allCandidates.length - beforeBroad,
      });
      return buildSuccessResult(pick, ranked, {
        matchType: "closest_strong_match",
        matchLabel: "Closest Strong Match",
        matchMessage: `Expanded beyond ${interestLabelList(unique)} to find a safer live deal.`,
        pickedReason: `Strongest trusted pick after widening categories in ${labelForInterest(pick.interest)}.`,
        searchedInterests,
        emptyInterests,
        totalCandidates: allCandidates.length,
        widenedSearch: true,
      });
    }

    // 3) Default trending queries (PS5, Jordan, RTX, BMW wheels, …)
    const trendingItems = await searchDefaultTrendingQueries(
      options.signal,
      options.perCategoryLimit
    );
    const beforeTrending = allCandidates.length;
    mergeCandidates(allCandidates, seen, trendingItems, primary);
    ranked = rankCandidates(allCandidates);
    pick = pickBestCandidate(ranked, ["standard", "relaxed"]);
    if (pick) {
      debugLog("fallback_step_used", {
        step: 3,
        label: "trending_default_queries",
        newResults: allCandidates.length - beforeTrending,
      });
      return buildSuccessResult(pick, ranked, {
        matchType: "next_best_win",
        matchLabel: "Next Best Win",
        matchMessage: `Nothing strong in ${interestLabelList(unique)} right now — found a high-trust trending win.`,
        pickedReason: "Picked from Savvy’s widened trending search.",
        searchedInterests,
        emptyInterests,
        totalCandidates: allCandidates.length,
        widenedSearch: true,
      });
    }

    // 4) Related interest categories
    const relatedInterests = Array.from(
      new Set(
        unique.flatMap((id) => RELATED_FALLBACK_MAP[id] ?? getInterestConfig(id)?.neighbors ?? [])
      )
    ).filter((id) => !unique.includes(id));

    if (relatedInterests.length > 0) {
      const relatedSearch = await searchInterestSet(relatedInterests, options);
      widened = true;
      searchedInterests = Array.from(
        new Set([...searchedInterests, ...relatedSearch.searchedInterests])
      );
      emptyInterests = [...emptyInterests, ...relatedSearch.emptyInterests];
      const beforeRelated = allCandidates.length;
      for (const c of relatedSearch.candidates) {
        const id = listingIdentity(c.listing);
        if (seen.has(id)) continue;
        seen.add(id);
        allCandidates.push(c);
      }
      ranked = rankCandidates(allCandidates);
      pick = pickBestCandidate(ranked, ["standard", "relaxed"]);
      if (pick) {
        debugLog("fallback_step_used", {
          step: 4,
          label: "related_category",
          newResults: allCandidates.length - beforeRelated,
        });
        return buildSuccessResult(pick, ranked, {
          matchType: "next_best_win",
          matchLabel: "Next Best Win",
          matchMessage: `Nothing strong in ${interestLabelList(unique)} — found your next best win nearby.`,
          pickedReason: `Closest strong option in related category ${labelForInterest(pick.interest)}.`,
          searchedInterests,
          emptyInterests,
          totalCandidates: allCandidates.length,
          widenedSearch: true,
        });
      }
    }

    // 5) Quick Snipes + Trending global lanes
    const quickSnipesItems = await searchQuickSnipesGlobal(
      primary,
      options.signal,
      options.perCategoryLimit
    );
    const trendingGlobalItems = await searchTrendingGlobal(
      primary,
      options.signal,
      options.perCategoryLimit
    );
    const beforeGlobal = allCandidates.length;
    mergeCandidates(allCandidates, seen, quickSnipesItems, primary);
    mergeCandidates(allCandidates, seen, trendingGlobalItems, primary);
    ranked = rankCandidates(allCandidates);
    pick = pickBestCandidate(ranked, ["standard", "relaxed"]);
    if (pick) {
      debugLog("fallback_step_used", {
        step: 5,
        label: "global_next_best_win",
        quickSnipesResults: quickSnipesItems.length,
        trendingResults: trendingGlobalItems.length,
      });
      return buildSuccessResult(pick, ranked, {
        matchType: "global_next_best_win",
        matchLabel: "Global Next Best Win",
        matchMessage: `Nothing strong in ${interestLabelList(unique)} — here is the strongest global win.`,
        pickedReason: `Strongest deal from Quick Snipes / Trending in ${labelForInterest(pick.interest)}.`,
        searchedInterests,
        emptyInterests,
        totalCandidates: allCandidates.length,
        widenedSearch: true,
      });
    }

    // 6) Last resort — cached safe deal card (never dead-end the user)
    debugLog("fallback_step_used", {
      step: 6,
      label: "cached_mock_safe_deal",
      totalResults: allCandidates.length,
    });
    const mock = buildMockSafeDeal(primary);
    return buildSuccessResult(mock, [mock, ...ranked.slice(0, 3)], {
      matchType: "cached_fallback",
      matchLabel: "Savvy Pick",
      matchMessage: "Live inventory is thin — Savvy Scout selected a safe starter Best Move while scanning new lanes.",
      pickedReason: "Cached safe deal so you always get a trusted first move.",
      searchedInterests,
      emptyInterests,
      totalCandidates: Math.max(allCandidates.length, 1),
      widenedSearch: true,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    debugLog("best_move_fatal", { error: message });
    const mock = buildMockSafeDeal(primary);
    return buildSuccessResult(mock, [mock], {
      matchType: "cached_fallback",
      matchLabel: "Savvy Pick",
      matchMessage: WIDENED_SEARCH_MESSAGE,
      pickedReason: "Recovered with a safe offline pick after a live search error.",
      searchedInterests: unique,
      emptyInterests: unique,
      totalCandidates: 1,
      widenedSearch: true,
    });
  }
}

export function interestLabelList(ids: ReadonlyArray<InterestId>): string {
  if (!ids.length) return "";
  if (ids.length === 1) return labelForInterest(ids[0]);
  if (ids.length === 2) return `${labelForInterest(ids[0])} & ${labelForInterest(ids[1])}`;
  const head = ids.slice(0, -1).map(labelForInterest).join(", ");
  return `${head} & ${labelForInterest(ids[ids.length - 1])}`;
}

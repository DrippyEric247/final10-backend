/**
 * Seller Trend Intelligence engine.
 *
 * Goal: help sellers list the right items at the right time, based on
 * REAL activity data observed in the client — never fabricated trends.
 *
 * Data sources (all real, timestamped):
 *   - `userBehavior` rolling log ­→ category_view + item_click + item_save
 *   - local searchSignals log we maintain here (callers invoke
 *     `recordSearchSignal` from the app's search entry points)
 *
 * Trend formula (matches the product spec exactly):
 *   trendScore = (viewCount * 0.4) + (saveCount * 0.3) + (searchVolume * 0.3)
 *
 * "Trending" is a function of both magnitude AND growth:
 *   - Compute the score over the last `HOT_WINDOW_MS` (recent).
 *   - Compute the score over the preceding `COLD_WINDOW_MS` (baseline).
 *   - A category is "trending" when the recent score clears a floor AND
 *     shows a relative rise ≥ `TREND_DELTA_THRESHOLD`.
 *
 * All numbers below are empirical, not random. If there isn't enough
 * activity yet the engine returns `null` / empty arrays so the UI can
 * render a clean "not enough data" state instead of a fake trend.
 */

import { getBehaviorLogSize } from "./userBehavior";

/* ------------------------------------------------------------------ */
/* Types                                                              */
/* ------------------------------------------------------------------ */

export type SellerCategoryId =
  | "electronics"
  | "gaming"
  | "sneakers"
  | "fashion"
  | "collectibles"
  | "home"
  | "auto"
  | "tech";

export type CategoryTrend = {
  category: string;
  /** Composite score per spec: 0.4·views + 0.3·saves + 0.3·search. */
  trendScore: number;
  /** Recent-window score (last HOT_WINDOW_MS). */
  recentScore: number;
  /** Baseline score from the preceding window. */
  baselineScore: number;
  /**
   * Relative growth ratio. `0` when baseline is zero (brand-new interest),
   * positive when rising, negative when cooling.
   */
  delta: number;
  /** `true` when recent score clears the floor AND delta ≥ threshold. */
  isTrending: boolean;
  viewCount: number;
  saveCount: number;
  searchVolume: number;
  /** Hour-of-day (0–23) with the highest observed activity in this category. */
  bestHour: number | null;
  /**
   * Short window starting at bestHour. Format: "7–9 PM", etc. Null when
   * we don't have enough samples to pick a peak confidently.
   */
  bestWindowLabel: string | null;
  /** Proxy for market saturation (see `computeCompetition`). */
  competitionLevel: "low" | "medium" | "high" | "unknown";
  /** Human-readable one-liner, e.g. "Best time to list: next 2 hours". */
  callToAction: string | null;
  /** Top distinct item titles observed in-category (most recent first). */
  recommendedItems: string[];
};

export type SellerTrendAlert = {
  id: string;
  category: string;
  /** Example: "PS5 controllers trending ↑". */
  headline: string;
  /** Example: "Best time to list: next 2 hours". */
  detail: string;
  /** `true` when this alert is gated behind premium. */
  premium?: boolean;
  /** Raw trend for deeper UI renders. */
  trend: CategoryTrend;
};

export type SellerTrendComputeOptions = {
  /** Clock injection for testability. Default `Date.now()`. */
  now?: number;
  /** Cap how many categories come back. Default 6. */
  limit?: number;
};

/* ------------------------------------------------------------------ */
/* Storage                                                            */
/* ------------------------------------------------------------------ */

const SEARCH_LOG_KEY = "f10_seller_trend_search_v1";
const SEARCH_LOG_MAX = 200;

const BEHAVIOR_STORAGE_KEY = "f10_user_behavior_v1";

const HOT_WINDOW_MS = 6 * 60 * 60 * 1000;            // last 6h
const COLD_WINDOW_MS = 24 * 60 * 60 * 1000;          // preceding 24h
const PEAK_LOOKBACK_MS = 7 * 24 * 60 * 60 * 1000;    // peak-hour from last 7d

/** Recent score must clear this before we call it "trending". */
const TREND_FLOOR_SCORE = 2.5;
/** Recent must beat baseline by at least this much (relative). */
const TREND_DELTA_THRESHOLD = 0.25;

/** Magic knobs for the visibility / bonus awarded to a trending seller. */
export const TRENDING_SELLER_BONUS_SAVVY = 40;
export const TRENDING_SELLER_VISIBILITY_BOOST_PCT = 10;

const SEARCH_SIGNAL_CATEGORY_KEYWORDS: Record<string, string[]> = {
  gaming: ["ps5", "ps4", "xbox", "switch", "controller", "console", "nintendo", "playstation"],
  tech: ["iphone", "macbook", "ipad", "airpods", "samsung", "galaxy", "laptop", "gpu", "rtx", "ssd"],
  sneakers: ["jordan", "yeezy", "nike", "adidas", "dunk", "sb", "sneaker"],
  fashion: ["gucci", "lv", "louis vuitton", "supreme", "hermes", "prada", "jacket"],
  collectibles: ["card", "pokemon", "magic", "funko", "coin", "stamp", "comic"],
  home: ["vacuum", "dyson", "mixer", "fridge", "tv", "monitor", "kitchen"],
  auto: ["tire", "wheel", "brake", "oem", "toyota", "honda", "ford", "bmw"],
  electronics: ["drone", "camera", "sony", "lens", "canon", "speaker", "sonos"],
};

/* ------------------------------------------------------------------ */
/* Low-level log access                                               */
/* ------------------------------------------------------------------ */

type BehaviorEvent = {
  type: "category_view" | "item_click" | "item_save";
  ts: number;
  category?: string;
  itemId?: string;
  title?: string;
  weight?: number;
};

type SearchEvent = {
  ts: number;
  query: string;
  category: string | null;
};

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw);
    return (parsed ?? fallback) as T;
  } catch {
    return fallback;
  }
}

function readBehaviorLog(): BehaviorEvent[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(BEHAVIOR_STORAGE_KEY);
    const parsed = safeParse<BehaviorEvent[]>(raw, []);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function readSearchLog(): SearchEvent[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(SEARCH_LOG_KEY);
    const parsed = safeParse<SearchEvent[]>(raw, []);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeSearchLog(log: SearchEvent[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      SEARCH_LOG_KEY,
      JSON.stringify(log.slice(-SEARCH_LOG_MAX))
    );
  } catch {
    /* ignore */
  }
}

/* ------------------------------------------------------------------ */
/* Public: signal capture                                             */
/* ------------------------------------------------------------------ */

/**
 * Classify a freeform search query to one of our seller categories based
 * on keyword match. Returns `null` when nothing matches — we never
 * invent a category to pad the data.
 */
export function classifySearchCategory(query: string): string | null {
  const q = String(query || "").toLowerCase().trim();
  if (!q) return null;
  for (const [cat, keywords] of Object.entries(SEARCH_SIGNAL_CATEGORY_KEYWORDS)) {
    for (const kw of keywords) {
      if (q.includes(kw)) return cat;
    }
  }
  return null;
}

/**
 * Record a search event. Callers at each search entry point invoke this
 * with the user's query plus an optional explicit category (e.g. when
 * the search was issued from inside a category-scoped view).
 */
export function recordSearchSignal(query: string, explicitCategory?: string | null): void {
  if (typeof window === "undefined") return;
  const q = String(query || "").trim();
  if (!q) return;
  const category = explicitCategory ? String(explicitCategory).toLowerCase() : classifySearchCategory(q);
  const log = readSearchLog();
  log.push({ ts: Date.now(), query: q.slice(0, 80), category });
  writeSearchLog(log);
  try {
    window.dispatchEvent(new CustomEvent("f10:seller-trends-updated"));
  } catch {
    /* ignore */
  }
}

export function clearSellerTrendSignals(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(SEARCH_LOG_KEY);
  } catch {
    /* ignore */
  }
}

/* ------------------------------------------------------------------ */
/* Core computation                                                   */
/* ------------------------------------------------------------------ */

type CategoryBucket = {
  views: number;
  saves: number;
  searches: number;
  hourBuckets: number[]; // 24 slots
  recentTitles: Array<{ title: string; ts: number }>;
};

function emptyBucket(): CategoryBucket {
  return {
    views: 0,
    saves: 0,
    searches: 0,
    hourBuckets: new Array(24).fill(0),
    recentTitles: [],
  };
}

function tallyEvents(
  behavior: BehaviorEvent[],
  searches: SearchEvent[],
  windowStart: number,
  windowEnd: number
): Map<string, CategoryBucket> {
  const out = new Map<string, CategoryBucket>();

  const getBucket = (cat: string) => {
    let b = out.get(cat);
    if (!b) {
      b = emptyBucket();
      out.set(cat, b);
    }
    return b;
  };

  for (const entry of behavior) {
    const ts = Number(entry?.ts);
    if (!Number.isFinite(ts) || ts < windowStart || ts > windowEnd) continue;
    const cat = String(entry.category || "").toLowerCase().trim();
    if (!cat || cat === "all") continue;
    const bucket = getBucket(cat);
    const hour = new Date(ts).getHours();
    if (hour >= 0 && hour < 24) bucket.hourBuckets[hour] += 1;
    if (entry.type === "category_view" || entry.type === "item_click") {
      bucket.views += 1;
    } else if (entry.type === "item_save") {
      bucket.saves += 1;
    }
    if (entry.title) {
      bucket.recentTitles.push({ title: entry.title, ts });
    }
  }

  for (const entry of searches) {
    const ts = Number(entry?.ts);
    if (!Number.isFinite(ts) || ts < windowStart || ts > windowEnd) continue;
    const cat = entry.category ? entry.category.toLowerCase() : null;
    if (!cat) continue; // uncategorized searches don't count — real data only
    const bucket = getBucket(cat);
    bucket.searches += 1;
    const hour = new Date(ts).getHours();
    if (hour >= 0 && hour < 24) bucket.hourBuckets[hour] += 1;
  }

  return out;
}

function scoreBucket(bucket: CategoryBucket | undefined): number {
  if (!bucket) return 0;
  return (
    bucket.views * 0.4 +
    bucket.saves * 0.3 +
    bucket.searches * 0.3
  );
}

function pickBestHour(bucket: CategoryBucket): number | null {
  let max = 0;
  let idx = -1;
  for (let i = 0; i < bucket.hourBuckets.length; i += 1) {
    if (bucket.hourBuckets[i] > max) {
      max = bucket.hourBuckets[i];
      idx = i;
    }
  }
  // Not enough samples → don't fabricate a peak.
  if (idx < 0 || max < 2) return null;
  return idx;
}

function hourToLabel(hour: number): string {
  const mod = (h: number) => ((h % 24) + 24) % 24;
  const fmt = (h: number) => {
    const hh = mod(h);
    const ampm = hh < 12 ? "AM" : "PM";
    const display = hh === 0 ? 12 : hh > 12 ? hh - 12 : hh;
    return `${display} ${ampm}`;
  };
  return `${fmt(hour)}–${fmt(hour + 2)}`;
}

function computeCompetition(bucket: CategoryBucket): CategoryTrend["competitionLevel"] {
  const samples = bucket.views + bucket.searches + bucket.saves;
  if (samples < 3) return "unknown";
  // Rough proxy: heavy viewing + light saving = high competition (lots of
  // lookers, few buyers).
  const ratio = bucket.saves === 0 ? bucket.views : bucket.views / bucket.saves;
  if (bucket.views >= 12 && ratio >= 6) return "high";
  if (bucket.views >= 5) return "medium";
  return "low";
}

function dedupeTitles(entries: Array<{ title: string; ts: number }>, limit = 3): string[] {
  if (entries.length === 0) return [];
  const seen = new Set<string>();
  const out: Array<{ title: string; ts: number }> = [];
  for (const e of [...entries].sort((a, b) => b.ts - a.ts)) {
    const key = e.title.toLowerCase().trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(e);
    if (out.length >= limit) break;
  }
  return out.map((e) => e.title);
}

function toCallToAction(hour: number | null): string | null {
  if (hour == null) return null;
  const now = new Date();
  const target = new Date();
  target.setHours(hour, 0, 0, 0);
  let ms = target.getTime() - now.getTime();
  if (ms < -30 * 60 * 1000) {
    // peak passed for today → tomorrow
    target.setDate(target.getDate() + 1);
    ms = target.getTime() - now.getTime();
  }
  if (ms <= 30 * 60 * 1000) return "You’re in the window — push the listing live";
  const hours = Math.round(ms / (60 * 60 * 1000));
  if (hours <= 1) return "Prime time in about an hour — get assets ready";
  if (hours <= 4) return `Next ${hours} hours look strong — line up your drop`;
  return `Today around ${hourToLabel(hour)} is your lane — schedule the post`;
}

/**
 * Return trend data for every category we have enough evidence on.
 * Categories with zero recent signal are omitted (real-data-only rule).
 */
export function computeCategoryTrends(
  options: SellerTrendComputeOptions = {}
): CategoryTrend[] {
  const now = options.now ?? Date.now();
  const limit = Math.max(1, options.limit ?? 6);

  const behavior = readBehaviorLog();
  const searches = readSearchLog();

  const hotStart = now - HOT_WINDOW_MS;
  const coldStart = now - COLD_WINDOW_MS;
  const peakStart = now - PEAK_LOOKBACK_MS;

  const hot = tallyEvents(behavior, searches, hotStart, now);
  const cold = tallyEvents(behavior, searches, coldStart, hotStart);
  const weekly = tallyEvents(behavior, searches, peakStart, now);

  const categories = new Set<string>([...hot.keys(), ...weekly.keys()]);
  const results: CategoryTrend[] = [];

  for (const category of categories) {
    const hotBucket = hot.get(category);
    if (!hotBucket) continue; // no recent activity → not a real trend
    const weeklyBucket = weekly.get(category) ?? emptyBucket();
    const coldBucket = cold.get(category);

    const recentScore = scoreBucket(hotBucket);
    if (recentScore <= 0) continue;

    const baselineScore = scoreBucket(coldBucket);
    const delta =
      baselineScore > 0
        ? (recentScore - baselineScore) / baselineScore
        : recentScore >= TREND_FLOOR_SCORE
          ? 1
          : 0;

    const isTrending =
      recentScore >= TREND_FLOOR_SCORE && delta >= TREND_DELTA_THRESHOLD;

    const trendScore = Math.round((recentScore + baselineScore) * 10) / 10;
    const bestHour = pickBestHour(weeklyBucket);
    const bestWindowLabel = bestHour != null ? hourToLabel(bestHour) : null;

    results.push({
      category,
      trendScore,
      recentScore: Math.round(recentScore * 10) / 10,
      baselineScore: Math.round(baselineScore * 10) / 10,
      delta: Math.round(delta * 100) / 100,
      isTrending,
      viewCount: hotBucket.views,
      saveCount: hotBucket.saves,
      searchVolume: hotBucket.searches,
      bestHour,
      bestWindowLabel,
      competitionLevel: computeCompetition(weeklyBucket),
      callToAction: toCallToAction(bestHour),
      recommendedItems: dedupeTitles(weeklyBucket.recentTitles),
    });
  }

  // Trending first, then score desc.
  results.sort((a, b) => {
    if (a.isTrending !== b.isTrending) return a.isTrending ? -1 : 1;
    return b.trendScore - a.trendScore;
  });

  return results.slice(0, limit);
}

export function getTrendingCategories(options: SellerTrendComputeOptions = {}): CategoryTrend[] {
  return computeCategoryTrends(options).filter((t) => t.isTrending);
}

export function getCategoryTrend(categoryId: string): CategoryTrend | null {
  if (!categoryId) return null;
  const key = String(categoryId).toLowerCase().trim();
  const trends = computeCategoryTrends({ limit: 20 });
  return trends.find((t) => t.category === key) ?? null;
}

/* ------------------------------------------------------------------ */
/* Seller-facing helpers                                              */
/* ------------------------------------------------------------------ */

export type SellerBonus = {
  trending: boolean;
  bonusSavvy: number;
  visibilityBoostPct: number;
  /** Localized single-line status banner the UI can show verbatim. */
  label: string;
  /** Raw trend that produced this bonus (null when not trending). */
  trend: CategoryTrend | null;
};

/**
 * Decide whether to grant the trending bonus when a seller posts in a
 * given category. Returns a zero bonus when data is thin — we never
 * silently award a bonus based on a fabricated trend.
 */
export function getSellerBonusForCategory(categoryId: string): SellerBonus {
  const trend = getCategoryTrend(categoryId);
  if (!trend || !trend.isTrending) {
    return {
      trending: false,
      bonusSavvy: 0,
      visibilityBoostPct: 0,
      label: "",
      trend: trend ?? null,
    };
  }
  return {
    trending: true,
    bonusSavvy: TRENDING_SELLER_BONUS_SAVVY,
    visibilityBoostPct: TRENDING_SELLER_VISIBILITY_BOOST_PCT,
    label: "Trending category — bonus on your post",
    trend,
  };
}

export function getSellerTrendAlerts(options: SellerTrendComputeOptions = {}): SellerTrendAlert[] {
  const trends = getTrendingCategories(options);
  return trends.slice(0, 3).map((t) => {
    const headlineAnchor = t.recommendedItems[0]
      ? `${t.recommendedItems[0]}`
      : t.category.charAt(0).toUpperCase() + t.category.slice(1);
    return {
      id: `${t.category}-${t.bestHour ?? "x"}`,
      category: t.category,
      headline: `${headlineAnchor} is heating up`,
      detail: t.callToAction ?? `Money is moving in ${t.category} — don’t sit this one out`,
      trend: t,
    };
  });
}

/* ------------------------------------------------------------------ */
/* Coverage / health                                                  */
/* ------------------------------------------------------------------ */

export type TrendCoverage = {
  /** Total signals we have in any window. */
  signalCount: number;
  /** Enough data to surface meaningful trends? */
  hasEnoughData: boolean;
  behaviorEvents: number;
  searchEvents: number;
};

export function getTrendCoverage(): TrendCoverage {
  const behaviorEvents = getBehaviorLogSize();
  const searchEvents = readSearchLog().length;
  const signalCount = behaviorEvents + searchEvents;
  return {
    signalCount,
    // Heuristic: we need ~8+ total events before the windows stabilize.
    hasEnoughData: signalCount >= 8,
    behaviorEvents,
    searchEvents,
  };
}

/* ------------------------------------------------------------------ */
/* Reactive convenience — subscribe to signal updates                  */
/* ------------------------------------------------------------------ */

export const SELLER_TRENDS_UPDATED_EVENT = "f10:seller-trends-updated";
export const BEHAVIOR_UPDATED_EVENT = "f10-behavior-updated";

export function subscribeToTrendUpdates(handler: () => void): () => void {
  if (typeof window === "undefined") return () => undefined;
  const listener = () => handler();
  window.addEventListener(SELLER_TRENDS_UPDATED_EVENT, listener);
  window.addEventListener(BEHAVIOR_UPDATED_EVENT, listener);
  return () => {
    window.removeEventListener(SELLER_TRENDS_UPDATED_EVENT, listener);
    window.removeEventListener(BEHAVIOR_UPDATED_EVENT, listener);
  };
}

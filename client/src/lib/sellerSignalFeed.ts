/**
 * Live signal feed for the Seller Dashboard.
 *
 * Every signal surfaced here is drawn from a real observable source —
 * we never mint a fake "someone just bought!" line. Sources:
 *
 *   1. Trend spikes        → sellerTrendEngine categories where delta is
 *                            still fresh (positive within the last hour).
 *   2. User activity       → f10_user_behavior_v1 log (views / saves /
 *                            clicks keyed by category).
 *   3. Search volume pulse → our f10_seller_trend_search_v1 log.
 *
 * The feed is chronological (newest first), capped, and de-duplicated so
 * a flurry of clicks on one item doesn't monopolize the stream. A React
 * hook is provided for components.
 */

import { useEffect, useState } from "react";
import {
  computeCategoryTrends,
  subscribeToTrendUpdates,
  type CategoryTrend,
} from "./sellerTrendEngine";

const BEHAVIOR_STORAGE_KEY = "f10_user_behavior_v1";
const SEARCH_STORAGE_KEY = "f10_seller_trend_search_v1";

export type SellerSignal = {
  id: string;
  /** Drives colour + iconography. */
  kind: "trend_spike" | "activity" | "demand_change";
  /** Epoch millis. */
  ts: number;
  /** Short headline, user-facing. */
  headline: string;
  /** Optional sublabel, e.g. category + delta. */
  detail?: string;
  /** Optional emoji prefix. */
  icon?: string;
};

type BehaviorEvent = {
  type?: string;
  ts?: number;
  category?: string;
  title?: string;
};

type SearchEvent = {
  ts?: number;
  query?: string;
  category?: string | null;
};

function safeParse<T>(raw: string | null): T[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

function readBehaviorLog(): BehaviorEvent[] {
  if (typeof window === "undefined") return [];
  return safeParse<BehaviorEvent>(window.localStorage.getItem(BEHAVIOR_STORAGE_KEY));
}

function readSearchLog(): SearchEvent[] {
  if (typeof window === "undefined") return [];
  return safeParse<SearchEvent>(window.localStorage.getItem(SEARCH_STORAGE_KEY));
}

function humanizeCategory(raw: string | null | undefined): string {
  if (!raw) return "a category";
  const c = String(raw).toLowerCase();
  return c.charAt(0).toUpperCase() + c.slice(1);
}

function signalFromTrend(trend: CategoryTrend): SellerSignal | null {
  if (!trend.isTrending) return null;
  const pct = trend.delta > 0 ? `+${Math.round(trend.delta * 100)}%` : "";
  const cat = humanizeCategory(trend.category);
  return {
    id: `trend-${trend.category}`,
    kind: "trend_spike",
    ts: Date.now(),
    headline: `${cat} trending ↑${pct ? ` ${pct}` : ""}`,
    detail: trend.callToAction ?? "Fresh demand rising — consider listing now.",
    icon: "🔥",
  };
}

function signalFromBehavior(entry: BehaviorEvent): SellerSignal | null {
  const ts = Number(entry?.ts);
  if (!Number.isFinite(ts)) return null;
  const cat = humanizeCategory(entry.category);
  const title = entry.title ? ` · ${entry.title.slice(0, 50)}` : "";
  switch (entry.type) {
    case "item_save":
      return {
        id: `save-${ts}`,
        kind: "activity",
        ts,
        headline: `${cat} save registered`,
        detail: `Shoppers are bookmarking${title}`,
        icon: "📌",
      };
    case "item_click":
      return {
        id: `click-${ts}`,
        kind: "activity",
        ts,
        headline: `${cat} click-through`,
        detail: `Live ask view${title}`,
        icon: "👁️",
      };
    case "category_view":
      return {
        id: `view-${ts}`,
        kind: "activity",
        ts,
        headline: `${cat} tab opened`,
        detail: "Shopper browsing this category",
        icon: "📂",
      };
    default:
      return null;
  }
}

function signalFromSearch(entry: SearchEvent): SellerSignal | null {
  const ts = Number(entry?.ts);
  if (!Number.isFinite(ts)) return null;
  if (!entry.query) return null;
  const cat = entry.category ? humanizeCategory(entry.category) : null;
  return {
    id: `search-${ts}`,
    kind: "demand_change",
    ts,
    headline: cat ? `${cat} search pulse` : "Demand pulse",
    detail: `Query: "${entry.query.slice(0, 40)}"`,
    icon: "🔎",
  };
}

/**
 * Merge, dedupe, sort. De-duplication keeps only the latest signal per
 * (kind + category) within a 90-second window so the UI stays readable.
 */
function mergeSignals(lists: SellerSignal[][], limit: number): SellerSignal[] {
  const flat = lists.flat();
  flat.sort((a, b) => b.ts - a.ts);
  const seen = new Map<string, number>();
  const out: SellerSignal[] = [];
  for (const s of flat) {
    const key = `${s.kind}|${s.headline}`;
    const last = seen.get(key);
    if (last != null && last - s.ts < 90 * 1000) continue;
    seen.set(key, s.ts);
    out.push(s);
    if (out.length >= limit) break;
  }
  return out;
}

export type SellerSignalFeedOptions = {
  /** Max signals returned. Default 12. */
  limit?: number;
  /** Only include events within this many minutes. Default 120. */
  windowMinutes?: number;
};

export function computeSellerSignalFeed(
  options: SellerSignalFeedOptions = {}
): SellerSignal[] {
  const limit = Math.max(3, options.limit ?? 12);
  const windowMs = Math.max(5, options.windowMinutes ?? 120) * 60 * 1000;
  const since = Date.now() - windowMs;

  const trendSignals: SellerSignal[] = computeCategoryTrends({ limit: 6 })
    .map(signalFromTrend)
    .filter((s): s is SellerSignal => s !== null);

  const behavior = readBehaviorLog()
    .filter((e) => Number(e?.ts) >= since)
    .map(signalFromBehavior)
    .filter((s): s is SellerSignal => s !== null);

  const searches = readSearchLog()
    .filter((e) => Number(e?.ts) >= since)
    .map(signalFromSearch)
    .filter((s): s is SellerSignal => s !== null);

  return mergeSignals([trendSignals, behavior, searches], limit);
}

/**
 * React hook returning a live signal feed. Refreshes on:
 *   - sellerTrendEngine update events
 *   - user-behavior update events
 *   - a lightweight 15s interval (so "2m ago" timestamps stay honest)
 */
export function useSellerSignalFeed(options: SellerSignalFeedOptions = {}): SellerSignal[] {
  const [feed, setFeed] = useState<SellerSignal[]>(() => computeSellerSignalFeed(options));

  useEffect(() => {
    const refresh = () => setFeed(computeSellerSignalFeed(options));
    const unsub = subscribeToTrendUpdates(refresh);
    const tick = window.setInterval(refresh, 15 * 1000);
    return () => {
      unsub();
      window.clearInterval(tick);
    };
    // Options are treated as stable-ish; callers can memo if needed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options.limit, options.windowMinutes]);

  return feed;
}

/**
 * Format a signal's timestamp as "now", "3m ago", "2h ago" — keeps the
 * feed scan-able without a date library.
 */
export function formatRelative(ts: number, now = Date.now()): string {
  const diff = Math.max(0, now - ts);
  if (diff < 60 * 1000) return "now";
  const mins = Math.floor(diff / (60 * 1000));
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

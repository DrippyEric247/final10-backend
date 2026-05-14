/**
 * Lightweight localStorage-backed cache of recent search queries. Used by
 * GlobalSmartSearch to surface "recent" suggestions and to avoid re-typing
 * the same query when switching between Trending / Auctions / Quick Snipes /
 * Savvy Offers tabs.
 */

const STORAGE_KEY = "f10_smart_search_recent_v1";
const MAX_ENTRIES = 8;

export type RecentQuery = {
  q: string;
  /** ms epoch of last use. */
  at: number;
};

function safeParse(raw: string | null): RecentQuery[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((x) => x && typeof x.q === "string" && typeof x.at === "number")
      .map((x) => ({ q: String(x.q), at: Number(x.at) }));
  } catch {
    return [];
  }
}

export function getRecentQueries(): RecentQuery[] {
  if (typeof window === "undefined") return [];
  try {
    return safeParse(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    return [];
  }
}

export function pushRecentQuery(query: string): RecentQuery[] {
  const trimmed = String(query || "").trim();
  if (!trimmed) return getRecentQueries();
  if (typeof window === "undefined") return [];
  try {
    const existing = getRecentQueries().filter((entry) => entry.q.toLowerCase() !== trimmed.toLowerCase());
    const next: RecentQuery[] = [{ q: trimmed, at: Date.now() }, ...existing].slice(0, MAX_ENTRIES);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    return next;
  } catch {
    return getRecentQueries();
  }
}

export function clearRecentQueries(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* noop */
  }
}

/**
 * Persist recent successful Auctions market payloads locally when live fetch fails.
 */
const STORAGE_KEY = "f10_ebay_auction_search_cache_v1";
const MAX_ENTRIES = 10;
const MAX_AGE_MS = 48 * 60 * 60 * 1000;

function safeParse(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function cacheKeyForAuctions(query, categorySlug) {
  const q = String(query || "").trim().toLowerCase();
  const c = String(categorySlug || "").trim().toLowerCase();
  return `${q}@@${c}`;
}

export function readAuctionSearchCache(key) {
  if (typeof window === "undefined" || !key) return null;
  try {
    const parsed = safeParse(window.localStorage.getItem(STORAGE_KEY) || "");
    const entries = Array.isArray(parsed?.entries) ? parsed.entries : [];
    const now = Date.now();
    const hit = entries.find((e) => e?.key === key && now - (Number(e.ts) || 0) < MAX_AGE_MS);
    if (!hit || !Array.isArray(hit.items)) return null;
    return { items: hit.items, ts: Number(hit.ts) || 0 };
  } catch {
    return null;
  }
}

export function writeAuctionSearchCache(key, items) {
  if (typeof window === "undefined" || !key || !Array.isArray(items) || items.length === 0) return;
  try {
    const parsed = safeParse(window.localStorage.getItem(STORAGE_KEY) || "");
    const prev = Array.isArray(parsed?.entries) ? parsed.entries : [];
    const next = [
      { key, ts: Date.now(), items },
      ...prev.filter((e) => e?.key !== key),
    ].slice(0, MAX_ENTRIES);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ entries: next }));
  } catch {
    /* quota */
  }
}

/**
 * Watch-intent store: when Savvy AI sees a weak board, the user can tap
 * "Notify Me" and we save the intent so future deal scans can surface a match.
 *
 * Shape of a stored intent:
 *   { id, category, query, priceMax, createdAt, active }
 *
 * Intents auto-expire after 7 days so stale requests don't haunt the user.
 */

const STORAGE_KEY = "f10_savvy_watch_intents_v1";
const MAX_ACTIVE = 12;
const TTL_MS = 7 * 24 * 60 * 60 * 1000;

function hasWindow() {
  return typeof window !== "undefined";
}

function ls() {
  try {
    if (typeof localStorage === "undefined") return null;
    return localStorage;
  } catch {
    return null;
  }
}

function readAll() {
  const store = ls();
  if (!store) return [];
  try {
    const raw = JSON.parse(store.getItem(STORAGE_KEY) || "[]");
    if (!Array.isArray(raw)) return [];
    const now = Date.now();
    return raw.filter(
      (row) =>
        row &&
        typeof row === "object" &&
        row.active !== false &&
        now - Number(row.createdAt || 0) < TTL_MS
    );
  } catch {
    return [];
  }
}

function writeAll(list) {
  const store = ls();
  if (!store) return;
  try {
    store.setItem(STORAGE_KEY, JSON.stringify(list.slice(-MAX_ACTIVE)));
  } catch {
    /* ignore */
  }
}

function slug(raw) {
  return String(raw || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64);
}

/**
 * Save a watch intent for a query/category. Dedupes by normalized fingerprint.
 * Returns the stored intent (new or existing).
 */
export function saveWatchIntent({ query, category, priceMax } = {}) {
  const q = String(query || "").trim();
  const cat = String(category || "").toLowerCase().trim();
  if (!q && !cat) return null;
  const fp = `${slug(cat) || "any"}|${slug(q)}`;
  const list = readAll();
  const existing = list.find((i) => i.fp === fp);
  if (existing) {
    existing.createdAt = Date.now();
    writeAll(list);
    return existing;
  }
  const intent = {
    id: `watch_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    fp,
    query: q || null,
    category: cat || null,
    priceMax: Number.isFinite(Number(priceMax)) ? Number(priceMax) : null,
    createdAt: Date.now(),
    active: true,
  };
  list.push(intent);
  writeAll(list);
  if (hasWindow()) {
    try {
      window.dispatchEvent(new CustomEvent("f10-watch-intent-updated"));
    } catch {
      /* ignore */
    }
  }
  return intent;
}

export function getActiveWatchIntents() {
  return readAll();
}

export function removeWatchIntent(id) {
  const list = readAll().filter((i) => i.id !== id);
  writeAll(list);
  if (hasWindow()) {
    try {
      window.dispatchEvent(new CustomEvent("f10-watch-intent-updated"));
    } catch {
      /* ignore */
    }
  }
}

function textIncludes(haystack, needle) {
  if (!haystack || !needle) return false;
  return haystack.toLowerCase().includes(needle.toLowerCase());
}

/**
 * Does this deal match any active watch intent? Returns the first matching
 * intent or null. Matching is lenient: any keyword from the query appearing
 * in the item title is enough; category-only intents match on category.
 */
export function matchWatchIntent(item) {
  if (!item || typeof item !== "object") return null;
  const list = readAll();
  if (!list.length) return null;
  const title = String(item.title || "");
  const category = String(item.category || item.categoryName || "").toLowerCase();
  const price = Number(
    item.currentBidPrice ?? item.buyNowPrice ?? item.price ?? item.currentPrice
  );
  for (const intent of list) {
    if (intent.priceMax && Number.isFinite(price) && price > intent.priceMax) continue;
    if (intent.category && category.includes(intent.category)) return intent;
    if (intent.query) {
      // Split query into tokens ≥3 chars, require at least one hit.
      const tokens = intent.query
        .split(/\s+/)
        .map((t) => t.trim())
        .filter((t) => t.length >= 3);
      if (tokens.some((t) => textIncludes(title, t))) return intent;
    }
  }
  return null;
}

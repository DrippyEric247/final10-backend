/**
 * Lightweight user-behavior tracker for predictive Savvy suggestions.
 *
 * Pages call:
 *   trackItemClick(item) / trackItemSave(item) / trackCategoryView(categoryId)
 *
 * State lives in localStorage under `f10_user_behavior_v1` as a rolling log
 * (max 120 entries). Categories are weighted with a time-decay so last-week
 * interest doesn't out-vote this-session interest.
 */

import { awardPoints } from "./pointsEngine";

const STORAGE_KEY = "f10_user_behavior_v1";
let lastSaveSavvyAt = 0;
const LOG_LIMIT = 120;
const HALF_LIFE_MS = 3 * 24 * 60 * 60 * 1000; // weight halves every 3 days

const EVENT_WEIGHTS = {
  category_view: 1,
  item_click: 3,
  item_save: 6,
};

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

function readLog() {
  const store = ls();
  if (!store) return [];
  try {
    const raw = JSON.parse(store.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

function writeLog(log) {
  const store = ls();
  if (!store) return;
  try {
    store.setItem(STORAGE_KEY, JSON.stringify(log.slice(-LOG_LIMIT)));
  } catch {
    /* ignore */
  }
}

function normalizeCategory(raw) {
  return String(raw || "").toLowerCase().trim() || "all";
}

function shortId(item) {
  if (!item || typeof item !== "object") return "";
  return String(item.itemId || item.id || item._id || "");
}

function pushEvent(type, payload = {}) {
  if (!hasWindow()) return;
  const weight = EVENT_WEIGHTS[type] || 1;
  const log = readLog();
  log.push({
    type,
    weight,
    ts: Date.now(),
    category: normalizeCategory(payload.category),
    itemId: String(payload.itemId || ""),
    title: payload.title ? String(payload.title).slice(0, 120) : "",
  });
  writeLog(log);
  try {
    window.dispatchEvent(new CustomEvent("f10-behavior-updated"));
  } catch {
    /* ignore */
  }
}

// ----- public api -----------------------------------------------------------

export function trackCategoryView(categoryId) {
  const cat = normalizeCategory(categoryId);
  if (!cat || cat === "all") return;
  pushEvent("category_view", { category: cat });
}

export function trackItemClick(item) {
  if (!item) return;
  pushEvent("item_click", {
    category: item.category || item.categoryName,
    itemId: shortId(item),
    title: item.title,
  });
}

export function trackItemSave(item) {
  if (!item) return;
  pushEvent("item_save", {
    category: item.category || item.categoryName,
    itemId: shortId(item),
    title: item.title,
  });
  const now = Date.now();
  if (now - lastSaveSavvyAt > 2600) {
    lastSaveSavvyAt = now;
    try {
      if (typeof localStorage !== "undefined" && localStorage.getItem("f10_token")) {
        awardPoints("save_item");
      }
    } catch {
      /* ignore */
    }
  }
}

/**
 * Return categories ranked by time-decayed interaction weight.
 * @param {number} limit max entries returned (default 3)
 * @returns {{ category: string, score: number, events: number }[]}
 */
export function getTopCategories(limit = 3) {
  const log = readLog();
  if (log.length === 0) return [];
  const now = Date.now();
  const tally = new Map();
  for (const entry of log) {
    const cat = normalizeCategory(entry.category);
    if (!cat || cat === "all") continue;
    const ageMs = Math.max(0, now - Number(entry.ts || now));
    const decay = Math.pow(0.5, ageMs / HALF_LIFE_MS);
    const weight = Number(entry.weight) || 1;
    const prev = tally.get(cat) || { score: 0, events: 0 };
    tally.set(cat, {
      score: prev.score + weight * decay,
      events: prev.events + 1,
    });
  }
  return Array.from(tally.entries())
    .map(([category, v]) => ({ category, score: v.score, events: v.events }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

/** Recent item interactions (click/save) newest-first. */
export function getRecentItems(limit = 8) {
  const log = readLog();
  const rel = log.filter(
    (e) => e.type === "item_click" || e.type === "item_save"
  );
  return rel.slice(-limit).reverse();
}

export function getBehaviorLogSize() {
  return readLog().length;
}

export function clearBehaviorLog() {
  const store = ls();
  if (!store) return;
  try {
    store.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

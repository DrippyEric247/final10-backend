/**
 * Win Feed service — client-side store + scoring helpers.
 *
 * Storage (localStorage):
 *   f10_win_feed_v1      → array of Win posts (most recent first)
 *   f10_win_feed_rate_v1 → array of submission timestamps (for daily cap)
 *
 * All data is local today. The public shape is modeled to migrate to a real
 * `/api/wins` endpoint with zero component changes — the WinFeed page only
 * consumes the exports from this module.
 */

import { triggerReward } from "./rewardEngine";
import { recordBattlePassXp } from "./battlePassEngine";
import {
  findCallingCard,
  findEmblem,
  getEquippedCallingCardId,
  getEquippedEmblemId,
} from "./customizationCatalog";

const STORAGE_KEY = "f10_win_feed_v1";
const RATE_KEY = "f10_win_feed_rate_v1";
const MAX_POSTS = 200;
const MAX_PER_DAY = 3;
const DAY_MS = 24 * 60 * 60 * 1000;

// Points economy for posting a win.
const BASE_POINTS = 100;
const BONUS_SAVINGS_SMALL = { threshold: 100, points: 50 };
const BONUS_SAVINGS_BIG = { threshold: 500, points: 100 };
const BONUS_VERIFIED = 75;
const BONUS_SCREENSHOT = 25;
const BONUS_TRUST_HIGH = 30; // trust score >= 85

export const WIN_VERIFICATION = Object.freeze({
  VERIFIED: "verified",
  SCREENSHOT: "screenshot",
  UNVERIFIED: "unverified",
});

export const WIN_CATEGORIES = [
  "gaming",
  "electronics",
  "sneakers",
  "fashion",
  "collectibles",
  "home",
  "auto",
  "luxury",
  "other",
];

export const WIN_CATEGORY_LABELS = {
  gaming: "Gaming",
  electronics: "Electronics",
  sneakers: "Sneakers",
  fashion: "Fashion",
  collectibles: "Collectibles",
  home: "Home",
  auto: "Auto",
  luxury: "Luxury",
  other: "Other",
};

// ----- utils ----------------------------------------------------------------

function safeLS() {
  try {
    if (typeof localStorage === "undefined") return null;
    return localStorage;
  } catch {
    return null;
  }
}

function read(key, fallback) {
  const ls = safeLS();
  if (!ls) return fallback;
  try {
    const raw = JSON.parse(ls.getItem(key) || "null");
    return raw == null ? fallback : raw;
  } catch {
    return fallback;
  }
}

function write(key, value) {
  const ls = safeLS();
  if (!ls) return;
  try {
    ls.setItem(key, JSON.stringify(value));
  } catch {
    /* quota / serialization — best-effort */
  }
}

function toNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

// Cheap, deterministic FNV-1a hash used to detect duplicate image uploads.
// Operates on a string (image data URL) so it works for any upload format.
export function hashString(input) {
  const s = String(input || "");
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

function slugifyTag(raw) {
  const t = String(raw || "")
    .replace(/^#+/, "")
    .replace(/[^a-zA-Z0-9]+/g, "")
    .slice(0, 24);
  return t ? `#${t}` : null;
}

export function normalizeTags(tags) {
  if (!tags) return [];
  const list = Array.isArray(tags)
    ? tags
    : String(tags).split(/[\s,]+/).filter(Boolean);
  const cleaned = list.map(slugifyTag).filter(Boolean);
  return Array.from(new Set(cleaned)).slice(0, 6);
}

// ----- seed data ------------------------------------------------------------

// A handful of mock wins so the feed never looks empty on first visit. Real
// submissions are prepended in front of these.
const SEED_WINS = [
  {
    id: "seed_ps5_elite",
    username: "Zyra_Sniper",
    title: "Saved $187 on PS5 Bundle",
    category: "gaming",
    savings: 187,
    purchasePrice: 362,
    marketValue: 549,
    trustScore: 93,
    verification: WIN_VERIFICATION.VERIFIED,
    tags: ["#PS5", "#Gaming", "#Savvy"],
    image: null,
    imageHash: null,
    source: "internal",
    createdAt: Date.now() - 2 * 60 * 60 * 1000,
    pointsAwarded: 260,
    secondsToWin: 38,
    emblemId: "sigil_verified_badge",
    callingCardId: "card_verified_buyer",
  },
  {
    id: "seed_jordan_hot",
    username: "HeelClicks_Ana",
    title: "Saved $94 on Air Jordan 1 Mocha",
    category: "sneakers",
    savings: 94,
    purchasePrice: 216,
    marketValue: 310,
    trustScore: 88,
    verification: WIN_VERIFICATION.SCREENSHOT,
    tags: ["#Sneakers", "#Jordan", "#SavvyWins"],
    image: null,
    imageHash: null,
    source: "internal",
    createdAt: Date.now() - 6 * 60 * 60 * 1000,
    pointsAwarded: 175,
    secondsToWin: 14,
    emblemId: "sigil_lightning_deal",
    callingCardId: "card_stack_master",
  },
  {
    id: "seed_switch_snipe",
    username: "MiloBidsLate",
    title: "Saved $62 on Nintendo Switch OLED",
    category: "gaming",
    savings: 62,
    purchasePrice: 269,
    marketValue: 331,
    trustScore: 81,
    verification: WIN_VERIFICATION.VERIFIED,
    tags: ["#Switch", "#Gaming"],
    image: null,
    imageHash: null,
    source: "internal",
    createdAt: Date.now() - 23 * 60 * 60 * 1000,
    pointsAwarded: 205,
    secondsToWin: 9,
    emblemId: "sigil_coupon_scissor",
    callingCardId: "card_coupon_sniper",
  },
  {
    id: "seed_rolex_elite",
    username: "TickTock_Reese",
    title: "Saved $1,240 on Rolex Submariner",
    category: "luxury",
    savings: 1240,
    purchasePrice: 9260,
    marketValue: 10500,
    trustScore: 96,
    verification: WIN_VERIFICATION.VERIFIED,
    tags: ["#Rolex", "#Luxury"],
    image: null,
    imageHash: null,
    source: "internal",
    createdAt: Date.now() - 40 * 60 * 60 * 1000,
    pointsAwarded: 330,
    secondsToWin: 72,
    emblemId: "sigil_growth_chart",
    callingCardId: "card_brand_insider",
  },
  {
    id: "seed_pokemon",
    username: "VintageVault_Kai",
    title: "Saved $48 on Pokémon Charizard",
    category: "collectibles",
    savings: 48,
    purchasePrice: 182,
    marketValue: 230,
    trustScore: 79,
    verification: WIN_VERIFICATION.SCREENSHOT,
    tags: ["#Pokemon", "#TradingCards"],
    image: null,
    imageHash: null,
    source: "external",
    createdAt: Date.now() - 3 * 24 * 60 * 60 * 1000,
    pointsAwarded: 150,
    secondsToWin: 25,
    emblemId: "sigil_gift_box",
    callingCardId: "card_hidden_discount",
  },
];

/**
 * Resolve the cosmetics attached to a win (with sensible fallbacks).
 * Pure read — safe to call during render.
 */
export function resolveWinCosmetics(win) {
  const emblem = findEmblem(win?.emblemId);
  const callingCard = findCallingCard(win?.callingCardId);
  return { emblem, callingCard };
}

// ----- public helpers -------------------------------------------------------

export function listWins() {
  const stored = read(STORAGE_KEY, []);
  const arr = Array.isArray(stored) ? stored : [];
  // Prepend user submissions, followed by seed data (deduped by id).
  const seen = new Set(arr.map((w) => w.id));
  const combined = [...arr];
  for (const seed of SEED_WINS) {
    if (!seen.has(seed.id)) combined.push(seed);
  }
  return combined;
}

export function readTodaySubmissionCount(username) {
  const log = read(RATE_KEY, []);
  const cutoff = Date.now() - DAY_MS;
  return (Array.isArray(log) ? log : []).filter(
    (entry) =>
      entry &&
      toNum(entry.ts) >= cutoff &&
      (!username || entry.username === username)
  ).length;
}

function recordSubmission(username) {
  const log = read(RATE_KEY, []);
  const cleaned = (Array.isArray(log) ? log : []).filter(
    (entry) => entry && toNum(entry.ts) >= Date.now() - 3 * DAY_MS
  );
  cleaned.push({ ts: Date.now(), username: username || "" });
  write(RATE_KEY, cleaned.slice(-60));
}

/**
 * Compute badges + priority score for a win so the feed can highlight and
 * sort with one lookup instead of re-deriving in the component.
 */
export function decorateWin(win) {
  const savings = toNum(win.savings);
  const trust = toNum(win.trustScore);
  const verified = win.verification === WIN_VERIFICATION.VERIFIED;
  const screenshot = win.verification === WIN_VERIFICATION.SCREENSHOT;
  const isElite = savings >= 500 || trust >= 92;
  const isHot = savings >= 100 && savings < 500;
  const isFastSnipe = toNum(win.secondsToWin) > 0 && win.secondsToWin <= 20;

  // Priority: verified first, then savings, then recency.
  const priority =
    (verified ? 5000 : screenshot ? 2000 : 0) +
    savings +
    (isElite ? 250 : 0) +
    (isHot ? 75 : 0) +
    Math.max(0, 100 - Math.floor((Date.now() - toNum(win.createdAt)) / (60 * 60 * 1000)));

  return {
    ...win,
    isElite,
    isHot,
    isFastSnipe,
    priority,
  };
}

/**
 * Auto-title generator so users don't have to write "Saved $X on Y" by hand.
 */
export function autoTitle({ savings, productName, category }) {
  const amount = Number(savings) > 0 ? Math.round(Number(savings)) : 0;
  const subject =
    String(productName || "").trim() ||
    (category ? WIN_CATEGORY_LABELS[category] || category : "this listing");
  return amount > 0 ? `Saved $${amount} on ${subject}` : `Won ${subject}`;
}

/**
 * Points economy: base + conditional bonuses. Returns { total, breakdown[] }.
 */
export function computeReward({ savings, trustScore, verification }) {
  const breakdown = [{ label: "Base", points: BASE_POINTS }];
  let total = BASE_POINTS;

  const s = toNum(savings);
  if (s >= BONUS_SAVINGS_BIG.threshold) {
    breakdown.push({ label: "$500+ save", points: BONUS_SAVINGS_BIG.points });
    total += BONUS_SAVINGS_BIG.points;
  } else if (s >= BONUS_SAVINGS_SMALL.threshold) {
    breakdown.push({ label: "$100+ save", points: BONUS_SAVINGS_SMALL.points });
    total += BONUS_SAVINGS_SMALL.points;
  }

  if (verification === WIN_VERIFICATION.VERIFIED) {
    breakdown.push({ label: "Verified purchase", points: BONUS_VERIFIED });
    total += BONUS_VERIFIED;
  } else if (verification === WIN_VERIFICATION.SCREENSHOT) {
    breakdown.push({ label: "Screenshot proof", points: BONUS_SCREENSHOT });
    total += BONUS_SCREENSHOT;
  }

  if (toNum(trustScore) >= 85) {
    breakdown.push({ label: "Trust 85+", points: BONUS_TRUST_HIGH });
    total += BONUS_TRUST_HIGH;
  }

  return { total, breakdown };
}

export class WinSubmissionError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

/**
 * Persist a new win. Enforces the daily cap and duplicate-image guard.
 * On success: fires a reward toast + Battle Pass XP + dispatches an update
 * event so the feed component can refresh.
 *
 * @returns {{ win, reward }} the stored win + reward payload
 */
export function submitWin(input, { user } = {}) {
  const username =
    input.username ||
    user?.username ||
    (user?.firstName ? String(user.firstName) : "SavvyUser");

  if (readTodaySubmissionCount(username) >= MAX_PER_DAY) {
    throw new WinSubmissionError(
      "daily_cap",
      `Daily limit reached (${MAX_PER_DAY}/day). Come back tomorrow.`
    );
  }

  const existing = listWins();
  const imageHash = input.image ? hashString(input.image) : null;
  if (imageHash && existing.some((w) => w.imageHash === imageHash)) {
    throw new WinSubmissionError(
      "duplicate_image",
      "That image has already been posted. Upload a fresh screenshot."
    );
  }

  const savings = Math.max(0, toNum(input.savings));
  const verification = Object.values(WIN_VERIFICATION).includes(input.verification)
    ? input.verification
    : WIN_VERIFICATION.UNVERIFIED;
  const category = WIN_CATEGORIES.includes(input.category) ? input.category : "other";
  const title =
    String(input.title || "").trim() ||
    autoTitle({ savings, productName: input.productName, category });
  const tags = normalizeTags(input.tags);
  const trustScore = Math.min(100, Math.max(0, Math.round(toNum(input.trustScore))));

  const { total: points, breakdown } = computeReward({
    savings,
    trustScore,
    verification,
  });

  // Snapshot the poster's equipped cosmetics so the card shows their identity
  // even if they re-equip later.
  const emblemId = getEquippedEmblemId();
  const callingCardId = getEquippedCallingCardId();

  const win = {
    id: `win_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    username,
    title,
    category,
    savings,
    purchasePrice: toNum(input.purchasePrice) || null,
    marketValue: toNum(input.marketValue) || null,
    trustScore,
    verification,
    tags,
    image: input.image || null,
    imageHash,
    proofUrl: input.proofUrl || null,
    secondsToWin: toNum(input.secondsToWin) || null,
    source: input.source || "internal",
    createdAt: Date.now(),
    pointsAwarded: points,
    emblemId,
    callingCardId,
  };

  const storeList = Array.isArray(read(STORAGE_KEY, [])) ? read(STORAGE_KEY, []) : [];
  const next = [win, ...storeList].slice(0, MAX_POSTS);
  write(STORAGE_KEY, next);
  recordSubmission(username);

  // Fire UI reward toast + XP.
  try {
    triggerReward({
      icon: verification === WIN_VERIFICATION.VERIFIED ? "💎" : "🔥",
      title: `+${points} POINTS`,
      subtitle: "Win posted to the feed",
      foot: breakdown
        .filter((b) => b.label !== "Base")
        .map((b) => `+${b.points} ${b.label}`)
        .join(" · ") || "Keep stacking saves",
      accent: "points",
      big: points >= 250,
      durationMs: 2100,
    });
  } catch {
    /* ignore — reward is decorative */
  }
  try {
    recordBattlePassXp("win_feed_post", Math.max(10, Math.round(points / 4)));
  } catch {
    /* ignore */
  }

  if (typeof window !== "undefined") {
    try {
      window.dispatchEvent(new CustomEvent("f10-win-feed-updated", { detail: { id: win.id } }));
    } catch {
      /* ignore */
    }
  }

  return { win, reward: { total: points, breakdown } };
}

// ----- leaderboards ---------------------------------------------------------

function withinWeek(ts) {
  return Date.now() - toNum(ts) <= 7 * DAY_MS;
}

export function computeWeeklyHighlights(wins) {
  const list = (Array.isArray(wins) ? wins : []).filter((w) => withinWeek(w.createdAt));

  const biggestSave = [...list]
    .sort((a, b) => toNum(b.savings) - toNum(a.savings))[0] || null;

  const fastestSnipe = list
    .filter((w) => toNum(w.secondsToWin) > 0)
    .sort((a, b) => toNum(a.secondsToWin) - toNum(b.secondsToWin))[0] || null;

  const weeklyTop = (() => {
    const agg = new Map();
    for (const w of list) {
      const key = w.username || "anon";
      const prev = agg.get(key) || { username: key, wins: 0, totalSavings: 0, lastTs: 0 };
      prev.wins += 1;
      prev.totalSavings += toNum(w.savings);
      prev.lastTs = Math.max(prev.lastTs, toNum(w.createdAt));
      agg.set(key, prev);
    }
    const ranked = Array.from(agg.values()).sort(
      (a, b) => b.totalSavings - a.totalSavings || b.wins - a.wins
    );
    return ranked[0] || null;
  })();

  return { biggestSave, fastestSnipe, weeklyTop };
}

export function computeFeedStats(wins) {
  const list = (Array.isArray(wins) ? wins : []).filter((w) => withinWeek(w.createdAt));
  return {
    totalWins: list.length,
    totalSavings: list.reduce((acc, w) => acc + toNum(w.savings), 0),
    verifiedCount: list.filter((w) => w.verification === WIN_VERIFICATION.VERIFIED).length,
  };
}

export const _internal = {
  MAX_PER_DAY,
  BASE_POINTS,
  STORAGE_KEY,
  RATE_KEY,
};

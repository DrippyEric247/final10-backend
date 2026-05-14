/**
 * Dynamic Trending Feed — composition, rotation (last_shown_at / show_count),
 * cooldown 24–72h per item, similar-item fallbacks, historical pool, session shuffle.
 */

const STORAGE_ROTATION = "f10_dynamic_feed_rotation_v1";
const STORAGE_HISTORICAL = "f10_dynamic_feed_historical_v1";
const STORAGE_SESSION_SEED = "f10_feed_session_shuffle_v1";

export const STILL_WORTH_LOOK_LABEL = "Still worth a look 👀";

function toNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export function itemFeedId(it) {
  return String(it?.id || it?.itemId || "").trim();
}

function hashStr(s) {
  let h = 0;
  const str = String(s);
  for (let i = 0; i < str.length; i++) {
    h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

/** Per-item cooldown between 24 and 72 hours (ms). */
export function cooldownMsForId(id) {
  const h = hashStr(id);
  const hours = 24 + (h % 49);
  return hours * 3600 * 1000;
}

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function rng() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function getOrCreateSessionShuffleSeed() {
  try {
    let raw = sessionStorage.getItem(STORAGE_SESSION_SEED);
    if (!raw) {
      raw = String((Date.now() ^ (Math.random() * 0x7fffffff)) >>> 0);
      sessionStorage.setItem(STORAGE_SESSION_SEED, raw);
    }
    const n = parseInt(raw, 10);
    return Number.isFinite(n) ? n : (Date.now() >>> 0);
  } catch {
    return Date.now() >>> 0;
  }
}

export function bumpSessionShuffleSeed() {
  try {
    const next = String((Date.now() ^ (Math.random() * 0x7fffffff)) >>> 0);
    sessionStorage.setItem(STORAGE_SESSION_SEED, next);
    return parseInt(next, 10) >>> 0;
  } catch {
    return Date.now() >>> 0;
  }
}

function readRotation() {
  try {
    const raw = localStorage.getItem(STORAGE_ROTATION);
    if (!raw) return { byId: {} };
    const parsed = JSON.parse(raw);
    return { byId: parsed?.byId && typeof parsed.byId === "object" ? parsed.byId : {} };
  } catch {
    return { byId: {} };
  }
}

function writeRotation(rotation) {
  try {
    localStorage.setItem(STORAGE_ROTATION, JSON.stringify({ byId: rotation.byId }));
  } catch {
    /* ignore quota */
  }
}

export function markDynamicFeedItemsShown(ids) {
  const now = Date.now();
  const rot = readRotation();
  for (const id of ids) {
    if (!id) continue;
    const cur = rot.byId[id] || { lastShownAt: 0, showCount: 0 };
    rot.byId[id] = {
      lastShownAt: now,
      showCount: (Number(cur.showCount) || 0) + 1,
    };
  }
  writeRotation(rot);
}

function canShowAgain(id, now, rot) {
  const rec = rot.byId[id];
  if (!rec || !rec.lastShownAt) return true;
  const gap = now - Number(rec.lastShownAt);
  return gap >= cooldownMsForId(id);
}

function dedupeItems(items) {
  const seen = new Set();
  return (Array.isArray(items) ? items : []).filter((it) => {
    const id = itemFeedId(it);
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

function keywordTokens(title) {
  return String(title || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2)
    .slice(0, 8);
}

function similarityToAnchors(title, anchorTitles) {
  const wa = new Set(keywordTokens(title));
  if (wa.size === 0 || !anchorTitles.length) return 0;
  let best = 0;
  for (const at of anchorTitles) {
    const wb = new Set(keywordTokens(at));
    let n = 0;
    for (const w of wa) {
      if (wb.has(w)) n += 1;
    }
    if (n > best) best = n;
  }
  return best;
}

function leanListing(it) {
  const id = itemFeedId(it);
  if (!id) return null;
  return {
    id,
    itemId: it.itemId,
    title: it.title,
    image: it.image,
    url: it.url,
    category: it.category,
    trendingScore: it.trendingScore,
    trendingLabel: it.trendingLabel,
    trendingReason: it.trendingReason,
    trustScore: it.trustScore,
    feedSavings: it.feedSavings,
    feedPrice: it.feedPrice,
    marketValue: it.marketValue,
    bids: it.bids ?? it.bidCount,
    bidCount: it.bidCount ?? it.bids,
    endsIn: it.endsIn,
    endsAtHuman: it.endsAtHuman,
    timeRemaining: it.timeRemaining ?? it.secondsRemaining,
    secondsRemaining: it.secondsRemaining ?? it.timeRemaining,
    auctionId: it.auctionId,
    sellerId: it.sellerId,
    sellerUsername: it.sellerUsername,
    competition: it.competition,
    condition: it.condition,
    isBuyNow: it.isBuyNow,
    isAuction: it.isAuction,
    aiScore: it.aiScore,
  };
}

export function mergeHistoricalPoolFromSorted(sortedItems) {
  const deduped = dedupeItems(sortedItems);
  let historical = [];
  try {
    const raw = localStorage.getItem(STORAGE_HISTORICAL);
    if (raw) {
      const p = JSON.parse(raw);
      historical = Array.isArray(p?.items) ? p.items : [];
    }
  } catch {
    historical = [];
  }
  const byId = new Map();
  for (const h of historical) {
    const id = itemFeedId(h);
    if (id) byId.set(id, h);
  }
  for (const it of deduped) {
    const lean = leanListing(it);
    if (lean) byId.set(lean.id, { ...byId.get(lean.id), ...lean });
  }
  const merged = [...byId.values()].sort((a, b) => {
    const sa = toNum(a.feedSavings) + toNum(a.trustScore) * 0.4;
    const sb = toNum(b.feedSavings) + toNum(b.trustScore) * 0.4;
    return sb - sa;
  });
  const capped = merged.slice(0, 120);
  try {
    localStorage.setItem(STORAGE_HISTORICAL, JSON.stringify({ items: capped, updatedAt: Date.now() }));
  } catch {
    /* ignore */
  }
}

function moverScore(it) {
  const bids = toNum(it.bids ?? it.bidCount);
  const sec = toNum(it.timeRemaining ?? it.secondsRemaining);
  const ending = sec > 0 && sec < 7200 ? 22 : sec > 0 && sec < 86400 ? 10 : 0;
  const tr = toNum(it.trendingScore ?? it.aiScore?.trendingScore);
  return bids * 3.2 + ending + tr * 0.18;
}

function weeklyScore(it) {
  return toNum(it.feedSavings) * 0.22 + toNum(it.trustScore) * 0.48 + toNum(it.trendingScore) * 0.32;
}

function gemScore(it) {
  const sec = toNum(it.timeRemaining ?? it.secondsRemaining);
  const hours = sec > 0 ? sec / 3600 : 48;
  const calm = hours > 8 ? 18 : hours > 2 ? 8 : 0;
  return toNum(it.trustScore) * 1.05 + toNum(it.feedSavings) * 0.06 + calm - moverScore(it) * 0.25;
}

function forYouScore(it, preferredCat) {
  const cat = String(it.category || "").toLowerCase();
  const pref = String(preferredCat || "").toLowerCase();
  let bonus = 0;
  if (pref && pref !== "all" && cat === pref) bonus = 40;
  return bonus + weeklyScore(it) * 0.85 + (hashStr(itemFeedId(it)) % 17) * 0.01;
}

function shuffleLight(arr, rng) {
  const out = [...arr];
  const swaps = Math.max(2, Math.ceil(out.length * 0.35));
  for (let k = 0; k < swaps; k++) {
    const i = Math.floor(rng() * out.length);
    const j = Math.floor(rng() * out.length);
    if (i !== j) [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function readHistoricalItems() {
  try {
    const raw = localStorage.getItem(STORAGE_HISTORICAL);
    if (!raw) return [];
    const p = JSON.parse(raw);
    return Array.isArray(p?.items) ? p.items : [];
  } catch {
    return [];
  }
}

/**
 * Pick up to `count` items from `pool` (ordered by scoreFn desc) respecting `used`,
 * cooldown first, then show_count, then score. Fills gaps with cooldown-off items,
 * then keyword-similar from `similarSource`, then historical with stillWorthLook.
 */
function pickBucket({
  pool,
  count,
  used,
  rot,
  now,
  scoreFn,
  similarSource,
  anchorTitles,
  historical,
  stillWorthLookIds,
}) {
  const picked = [];
  const tryPush = (it, forceStillLook) => {
    const id = itemFeedId(it);
    if (!id || used.has(id)) return false;
    used.add(id);
    picked.push(it);
    if (forceStillLook) stillWorthLookIds.add(id);
    return true;
  };

  const ranked = pool
    .map((it) => {
      const id = itemFeedId(it);
      return {
        it,
        id,
        score: scoreFn(it),
        showCount: toNum(rot.byId[id]?.showCount),
        cooldownOk: canShowAgain(id, now, rot),
      };
    })
    .filter((r) => r.id);

  const sortKey = (a, b) =>
    a.showCount - b.showCount ||
    (b.cooldownOk ? 1 : 0) - (a.cooldownOk ? 1 : 0) ||
    b.score - a.score;

  const primary = [...ranked].filter((r) => !used.has(r.id)).sort(sortKey);
  for (const r of primary) {
    if (picked.length >= count) break;
    if (!r.cooldownOk) continue;
    tryPush(r.it, false);
  }

  const secondary = [...ranked].filter((r) => !used.has(r.id)).sort(sortKey);
  for (const r of secondary) {
    if (picked.length >= count) break;
    tryPush(r.it, false);
  }

  if (picked.length < count && anchorTitles.length && similarSource.length) {
    const simRanked = similarSource
      .map((it) => ({
        it,
        id: itemFeedId(it),
        sim: similarityToAnchors(it.title, anchorTitles),
        showCount: toNum(rot.byId[itemFeedId(it)]?.showCount),
        score: scoreFn(it),
      }))
      .filter((x) => x.id && !used.has(x.id))
      .sort((a, b) => b.sim - a.sim || a.showCount - b.showCount || b.score - a.score);

    for (const x of simRanked) {
      if (picked.length >= count) break;
      if (x.sim < 1) break;
      tryPush(x.it, true);
    }
  }

  if (picked.length < count && historical.length) {
    const histRanked = historical
      .map((it) => ({
        it: { ...it },
        id: itemFeedId(it),
        showCount: toNum(rot.byId[itemFeedId(it)]?.showCount),
      }))
      .filter((x) => x.id && !used.has(x.id))
      .sort((a, b) => a.showCount - b.showCount);

    for (const x of histRanked) {
      if (picked.length >= count) break;
      tryPush(x.it, true);
    }
  }

  if (picked.length < count) {
    const any = [...ranked].sort((a, b) => a.showCount - b.showCount || b.score - a.score);
    for (const r of any) {
      if (picked.length >= count) break;
      if (!used.has(r.id)) tryPush(r.it, false);
    }
  }

  return picked.slice(0, count);
}

/**
 * @param {object[]} sortedItems — enriched feed listings (trust, savings, trending).
 * @param {{ activeCategory?: string, sessionSeed?: number, remixKey?: number }} opts
 */
export function buildDynamicFeedSections(sortedItems, opts = {}) {
  const now = Date.now();
  const rot = readRotation();
  const activeCategory = opts.activeCategory || "all";
  const sessionSeed = Number(opts.sessionSeed) || getOrCreateSessionShuffleSeed();
  const remixKey = Number(opts.remixKey) || 0;

  const deduped = dedupeItems(sortedItems);
  const historical = readHistoricalItems();

  const budget = Math.min(48, Math.max(deduped.length, 8));
  const nMovers = Math.max(2, Math.round(budget * 0.4));
  const nWeekly = Math.max(2, Math.round(budget * 0.3));
  const nGems = Math.max(1, Math.round(budget * 0.2));
  const nForYou = Math.max(1, budget - nMovers - nWeekly - nGems);

  const moversPool = [...deduped].sort((a, b) => moverScore(b) - moverScore(a));
  const weeklyPool = [...deduped].sort((a, b) => weeklyScore(b) - weeklyScore(a));
  const gemsPool = [...deduped].sort((a, b) => gemScore(b) - gemScore(a));
  const forYouPool = [...deduped].sort(
    (a, b) => forYouScore(b, activeCategory) - forYouScore(a, activeCategory)
  );

  const used = new Set();
  const stillWorthLookIds = new Set();

  const moverAnchors = moversPool.slice(0, 6).map((it) => String(it.title || ""));
  const movers = pickBucket({
    pool: moversPool,
    count: nMovers,
    used,
    rot,
    now,
    scoreFn: moverScore,
    similarSource: deduped,
    anchorTitles: moverAnchors,
    historical,
    stillWorthLookIds,
  });

  const weeklyAnchors = weeklyPool.slice(0, 6).map((it) => String(it.title || ""));
  const weekly = pickBucket({
    pool: weeklyPool,
    count: nWeekly,
    used,
    rot,
    now,
    scoreFn: weeklyScore,
    similarSource: deduped,
    anchorTitles: weeklyAnchors,
    historical,
    stillWorthLookIds,
  });

  const gemAnchors = gemsPool.slice(0, 6).map((it) => String(it.title || ""));
  const gems = pickBucket({
    pool: gemsPool,
    count: nGems,
    used,
    rot,
    now,
    scoreFn: gemScore,
    similarSource: deduped,
    anchorTitles: gemAnchors,
    historical,
    stillWorthLookIds,
  });

  const forYouAnchors = forYouPool.slice(0, 6).map((it) => String(it.title || ""));
  const personalized = pickBucket({
    pool: forYouPool,
    count: nForYou,
    used,
    rot,
    now,
    scoreFn: (it) => forYouScore(it, activeCategory),
    similarSource: deduped,
    anchorTitles: forYouAnchors,
    historical,
    stillWorthLookIds,
  });

  const sectionDefs = [
    { id: "trending", title: "Trending Now", subtitle: "Recent activity, bids, and momentum", items: movers },
    { id: "weekly", title: "Best This Week", subtitle: "Strong value and trust signals", items: weekly },
    { id: "gems", title: "You Missed These", subtitle: "Resurfaced picks worth another glance", items: gems },
    { id: "foryou", title: "For You", subtitle: "Matched to your category focus", items: personalized },
  ];

  const sections = sectionDefs.map((sec, idx) => {
    const rng = mulberry32((sessionSeed + remixKey * 977 + idx * 0x9e3779b9 + hashStr(sec.id)) >>> 0);
    const shuffled = shuffleLight(sec.items, rng);
    return {
      ...sec,
      items: shuffled,
    };
  });

  const flatIds = sections.flatMap((s) => s.items.map((it) => itemFeedId(it)).filter(Boolean));

  return {
    sections,
    stillWorthLookIds,
    flatIds,
    meta: { budget, nMovers, nWeekly, nGems, nForYou },
  };
}

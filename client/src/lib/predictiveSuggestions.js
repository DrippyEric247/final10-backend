/**
 * Predictive Savvy suggestions.
 *
 * Combines tracked user behavior with live eBay data to surface 2–3 high-value
 * opportunities proactively. Three suggestion flavors, scored against what we
 * know about the user:
 *
 *   trending_in_category : top picks in the user's most-viewed category
 *   low_competition      : few bids + savings headroom
 *   high_reward          : strong dealScore + market delta
 *
 * Caches results for 10 minutes to avoid re-hitting the eBay API every time
 * the panel opens.
 */

import ebayService from "../services/ebayService";
import { getTopCategories, getRecentItems } from "./userBehavior";

const CACHE_TTL_MS = 10 * 60 * 1000;

const CATEGORY_SEEDS = {
  electronics: ["electronics", "gadget", "headphones"],
  gaming: ["ps5", "xbox series", "nintendo switch", "gaming"],
  sneakers: ["sneakers", "nike", "jordan", "adidas"],
  fashion: ["designer", "streetwear", "jacket"],
  collectibles: ["pokemon", "trading cards", "vintage"],
  home: ["kitchen", "furniture", "smart home"],
  auto: ["car parts", "automotive", "detailing"],
  luxury: ["rolex", "omega", "luxury watch"],
};

const CATEGORY_LABELS = {
  electronics: "Electronics",
  gaming: "Gaming",
  sneakers: "Sneakers",
  fashion: "Fashion",
  collectibles: "Collectibles",
  home: "Home",
  auto: "Auto",
  luxury: "Luxury",
};

let cache = { ts: 0, payload: null, fingerprint: "" };

function toNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function pickSeed(category) {
  const seeds = CATEGORY_SEEDS[category] || [category];
  return seeds[Math.floor(Math.random() * seeds.length)];
}

function labelFor(category) {
  return CATEGORY_LABELS[category] || category.replace(/^\w/, (c) => c.toUpperCase());
}

function readItemCore(it) {
  if (!it || typeof it !== "object") return null;
  const id = String(it.itemId || it.id || it._id || "");
  if (!id) return null;
  const title = String(it.title || "Listing");
  const url = it.itemWebUrl || it.url || it.viewItemURL || null;
  const image = it.imageUrl || it.image || it.galleryURL || "";
  const priceRaw =
    it.currentBidPrice ?? it.buyNowPrice ?? it.price ?? it.currentPrice ?? null;
  const priceNum = toNum(priceRaw);
  const currency = it.currency || "USD";
  const priceText =
    priceNum > 0
      ? new Intl.NumberFormat("en-US", { style: "currency", currency }).format(priceNum)
      : "—";
  return {
    id,
    title,
    url,
    image,
    price: priceNum,
    priceText,
    bids: toNum(it.bids ?? it.bidCount),
    secondsRemaining: toNum(
      it.secondsRemaining ?? it.timeRemaining ?? it.timeLeftSeconds
    ),
    dealScore: toNum(
      it.dealScore ?? it.trendingScore ?? it.score ?? it.aiScore?.trendingScore
    ),
    savingsPct: toNum(it.savingsPercentage ?? it.savingsPct),
    isAuction: Boolean(it.isAuction),
  };
}

function shortTitle(title, max = 38) {
  const t = String(title || "").trim();
  if (!t) return "Listing";
  return t.length <= max ? t : t.slice(0, max - 1).replace(/\s+\S*$/, "") + "…";
}

function endsSoonLabel(secs) {
  const s = toNum(secs);
  if (s <= 0) return null;
  const m = Math.floor(s / 60);
  if (m < 60) return `${Math.max(m, 1)}m left`;
  return `${Math.floor(m / 60)}h left`;
}

async function fetchCategoryPool(category) {
  const seed = pickSeed(category);
  try {
    const data = await ebayService.searchItems({
      q: seed,
      categoryId: category,
      limit: 10,
      sortOrder: "bestMatch",
    });
    return (data?.items || []).map(readItemCore).filter(Boolean);
  } catch {
    return [];
  }
}

// ----- suggestion builders --------------------------------------------------

function pickTrending(pool, category) {
  if (!pool.length) return null;
  const ranked = [...pool].sort((a, b) => b.dealScore - a.dealScore);
  const top = ranked[0];
  if (!top) return null;
  return {
    id: `sugg-trending-${category}-${top.id}`,
    kind: "trending_in_category",
    tone: "strong",
    title: `Trending in ${labelFor(category)}`,
    reason: `${shortTitle(top.title)} · ${top.priceText}`,
    action: {
      label: "View Deal",
      url: top.url,
      fallback: "/feed",
    },
    meta: { category, itemId: top.id },
  };
}

function pickLowCompetition(pool) {
  if (!pool.length) return null;
  const candidates = pool.filter(
    (p) => p.isAuction && p.bids <= 2 && p.secondsRemaining > 0
  );
  if (!candidates.length) return null;
  const ranked = candidates.sort(
    (a, b) => a.bids - b.bids || a.secondsRemaining - b.secondsRemaining
  );
  const pick = ranked[0];
  const timeLabel = endsSoonLabel(pick.secondsRemaining) || "open bid";
  const bidLabel = pick.bids === 0 ? "no bids yet" : `only ${pick.bids} bid${pick.bids === 1 ? "" : "s"}`;
  return {
    id: `sugg-lowcomp-${pick.id}`,
    kind: "low_competition",
    tone: "move",
    title: `${shortTitle(pick.title)}`,
    reason: `${bidLabel} · ${timeLabel}`,
    action: {
      label: "Snipe It",
      url: pick.url,
      fallback: "/auctions",
    },
    meta: { itemId: pick.id },
  };
}

function pickHighReward(pool) {
  if (!pool.length) return null;
  const ranked = [...pool].sort((a, b) => b.dealScore - a.dealScore);
  const top = ranked[0];
  if (!top || top.dealScore < 78) return null;
  const savings = top.savingsPct >= 15 ? `${Math.round(top.savingsPct)}% off` : `Score ${Math.round(top.dealScore)}`;
  return {
    id: `sugg-reward-${top.id}`,
    kind: "high_reward",
    tone: "great",
    title: `High-reward pick`,
    reason: `${shortTitle(top.title)} · ${savings}`,
    action: {
      label: "View Deal",
      url: top.url,
      fallback: "/feed",
    },
    meta: { itemId: top.id },
  };
}

// ----- public api -----------------------------------------------------------

function fingerprintFor(categories) {
  return categories.map((c) => c.category).join("|");
}

/**
 * Build 2–3 predictive suggestions. Cached for 10 minutes per behavior
 * fingerprint so repeat panel opens don't re-hit the API.
 *
 * @param {{ force?: boolean }} [opts]
 * @returns {Promise<Array<{ id, kind, tone, title, reason, action }>>}
 */
export async function buildPredictiveSuggestions(opts = {}) {
  const topCats = getTopCategories(2);
  const fp = fingerprintFor(topCats);
  const now = Date.now();
  if (
    !opts.force &&
    cache.payload &&
    cache.fingerprint === fp &&
    now - cache.ts < CACHE_TTL_MS
  ) {
    return cache.payload;
  }

  // Cold start: no behavior yet → use "gaming" + "electronics" as sensible seeds.
  const seedCategories = topCats.length
    ? topCats.map((c) => c.category)
    : ["gaming", "electronics"];

  const pools = await Promise.all(seedCategories.slice(0, 2).map(fetchCategoryPool));
  const combined = pools.flat();

  const primaryCategory = seedCategories[0];
  const suggestions = [];

  const trending = pickTrending(pools[0] || [], primaryCategory);
  if (trending) suggestions.push(trending);

  const lowComp = pickLowCompetition(combined);
  if (lowComp && !suggestions.some((s) => s.meta?.itemId === lowComp.meta.itemId)) {
    suggestions.push(lowComp);
  }

  const reward = pickHighReward(combined);
  if (reward && !suggestions.some((s) => s.meta?.itemId === reward.meta.itemId)) {
    suggestions.push(reward);
  }

  // Tie suggestions to recent interactions when possible so the user sees
  // context: "because you viewed PS5…".
  const recent = getRecentItems(5);
  if (recent.length && suggestions.length < 3) {
    const mostRecentCat = recent[0]?.category;
    if (mostRecentCat && !suggestions.some((s) => s.meta?.category === mostRecentCat)) {
      const extra = pickTrending(pools[1] || pools[0] || [], mostRecentCat);
      if (extra) suggestions.push(extra);
    }
  }

  const payload = suggestions.slice(0, 3);
  cache = { ts: now, payload, fingerprint: fp };
  return payload;
}

export function invalidatePredictiveCache() {
  cache = { ts: 0, payload: null, fingerprint: "" };
}

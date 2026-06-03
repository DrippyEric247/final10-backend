import { fetchEbaySearch } from "./ebayClient";
import {
  isLuxuryLowValueTitle,
  isPremiumBrandedTitle,
  LUXURY_LOW_PRICE_ALLOWED_CATEGORIES,
  LUXURY_MIN_PRICE_USD,
  resolveLuxuryLaneAndTerms,
  titleMatchesHeroIntent,
} from "./luxuryHeroSearchMap";
import { evaluateTrustScore, trustScoreInputFromListing } from "./trustScoreEngine";
import { pushScoutDealFound, setScoutVisualState } from "./savvyScoutState";

export const OPTIMIZER_MODE = {
  STANDARD: "standard",
  BUDGET: "budget",
  LUXURY: "luxury",
};

/** @typedef {{ label: string, query: string }} ProductGroup */

const BUNDLE_SCENARIOS = [
  {
    match: /stream|streamer|streaming\s*room|starter\s*stream/i,
    terms: [
      { label: "Webcam", query: "webcam 1080p streaming" },
      { label: "Microphone", query: "usb streaming microphone" },
      { label: "Ring light", query: "ring light streaming" },
      { label: "Capture card", query: "capture card hdmi" },
      { label: "Stream deck", query: "elgato stream deck" },
    ],
    scoutLine: "I found a starter streaming bundle worth checking.",
  },
  {
    match: /gaming|gamer|battle\s*station|ps5|xbox|pc\s*build/i,
    terms: [
      { label: "Gaming headset", query: "gaming headset wireless" },
      { label: "Mechanical keyboard", query: "mechanical gaming keyboard" },
      { label: "Gaming mouse", query: "gaming mouse low latency" },
      { label: "Capture card", query: "capture card 4k" },
      { label: "Gaming monitor", query: "gaming monitor 144hz" },
    ],
    scoutLine: "I found a gaming setup bundle worth checking.",
  },
  {
    match: /cookout|bbq|grill|taco|meal|grocery|pantry/i,
    terms: [
      { label: "Grill tools", query: "bbq grill tool set" },
      { label: "Cooler", query: "portable cooler large" },
      { label: "Serving set", query: "outdoor serving platter set" },
      { label: "Condiment kit", query: "bbq sauce variety pack" },
    ],
    scoutLine: "I found a cookout essentials bundle worth checking.",
  },
  {
    match: /bmw|auto|car\s*detail|automotive/i,
    terms: [
      { label: "Wheel cleaner", query: "bmw wheel cleaner" },
      { label: "Detail kit", query: "ceramic car detail kit" },
      { label: "Interior care", query: "car interior cleaner kit" },
      { label: "Microfiber", query: "microfiber car towel pack" },
    ],
    scoutLine: "I found an automotive care bundle worth checking.",
  },
  {
    match: /apartment|dorm|home\s*essentials|first\s*apartment/i,
    terms: [
      { label: "Bedding", query: "bed sheet set queen" },
      { label: "Kitchen starter", query: "kitchen starter kit cookware" },
      { label: "Storage", query: "closet storage organizer" },
      { label: "Lighting", query: "led desk lamp" },
    ],
    scoutLine: "I found a home essentials bundle worth checking.",
  },
  {
    match: /travel|road\s*trip|vacation/i,
    terms: [
      { label: "Luggage", query: "carry on luggage spinner" },
      { label: "Travel organizer", query: "travel packing cubes" },
      { label: "Power bank", query: "portable charger 20000mah" },
      { label: "Neck pillow", query: "travel neck pillow memory foam" },
    ],
    scoutLine: "I found a travel essentials bundle worth checking.",
  },
];

const CHIP_TERMS = {
  Tech: [
    { label: "USB hub", query: "usb c hub multiport" },
    { label: "Monitor", query: "27 inch monitor" },
    { label: "Keyboard", query: "wireless keyboard" },
    { label: "Webcam", query: "hd webcam" },
  ],
  Gaming: [
    { label: "Headset", query: "gaming headset" },
    { label: "Controller", query: "wireless gaming controller" },
    { label: "Mouse pad", query: "xl gaming mouse pad" },
    { label: "SSD", query: "nvme ssd 1tb" },
  ],
  Fashion: [
    { label: "Sneakers", query: "men sneakers" },
    { label: "Jacket", query: "lightweight jacket" },
    { label: "Backpack", query: "streetwear backpack" },
  ],
  Fitness: [
    { label: "Dumbbells", query: "adjustable dumbbells" },
    { label: "Yoga mat", query: "thick yoga mat" },
    { label: "Resistance bands", query: "resistance band set" },
  ],
  Home: [
    { label: "Vacuum", query: "cordless vacuum" },
    { label: "Air purifier", query: "hepa air purifier" },
    { label: "Smart plug", query: "smart plug 4 pack" },
  ],
};

export const OPTIMIZER_FALLBACK_SUGGESTIONS = [
  { label: "Starter streaming room", query: "starter streaming room" },
  { label: "Cheap gaming setup", query: "cheap gaming setup" },
  { label: "BBQ cookout under $100", query: "bbq cookout essentials" },
  { label: "Apartment essentials", query: "first apartment essentials" },
  { label: "Road trip kit", query: "road trip essentials" },
];

/**
 * @param {string} request
 * @param {string} [chip]
 * @returns {{ terms: ProductGroup[], scoutLine: string }}
 */
export function isLuxuryMode(chip) {
  return String(chip || "").trim().toLowerCase() === "luxury mode";
}

export function isBudgetMode(chip) {
  return String(chip || "").trim().toLowerCase() === "budget mode";
}

export function resolveOptimizerMode(chip) {
  if (isLuxuryMode(chip)) return OPTIMIZER_MODE.LUXURY;
  if (isBudgetMode(chip)) return OPTIMIZER_MODE.BUDGET;
  return OPTIMIZER_MODE.STANDARD;
}

/**
 * Luxury Mode — hero searches only; fewer slots, premium intent.
 * @param {string} request
 * @param {string} [chip]
 */
export function extractLuxuryProductGroups(request, chip = "") {
  const { terms, scoutLine } = resolveLuxuryLaneAndTerms(request, chip);
  return { terms, scoutLine, mode: OPTIMIZER_MODE.LUXURY };
}

/**
 * Budget Mode — favor value-oriented queries from scenarios/chips.
 * @param {string} request
 * @param {string} [chip]
 */
export function extractBudgetProductGroups(request, chip = "") {
  const base = extractProductGroups(request, chip === "Budget Mode" ? "" : chip);
  const text = String(request || "").trim().toLowerCase();
  if (/cheap|budget|under\s*\$|affordable/i.test(text)) {
    return {
      ...base,
      scoutLine: "I found the best value bundle for your budget.",
      mode: OPTIMIZER_MODE.BUDGET,
    };
  }
  const budgetTerms = base.terms.map((t) => ({
    ...t,
    query: `${t.query} best value`.replace(/\s+/g, " ").trim(),
  }));
  return {
    terms: budgetTerms.slice(0, 5),
    scoutLine: "I optimized for the lowest smart-cart total with solid trust.",
    mode: OPTIMIZER_MODE.BUDGET,
  };
}

export function extractProductGroups(request, chip = "") {
  const mode = resolveOptimizerMode(chip);
  if (mode === OPTIMIZER_MODE.LUXURY) {
    return extractLuxuryProductGroups(request);
  }
  if (mode === OPTIMIZER_MODE.BUDGET) {
    return extractBudgetProductGroups(request);
  }

  const text = String(request || "").trim().toLowerCase();
  if (text) {
    for (const scenario of BUNDLE_SCENARIOS) {
      if (scenario.match.test(text)) {
        return { terms: scenario.terms.slice(0, 6), scoutLine: scenario.scoutLine };
      }
    }
  }

  const chipTerms = CHIP_TERMS[String(chip || "").trim()];
  if (chipTerms?.length) {
    return {
      terms: chipTerms.slice(0, 6),
      scoutLine: `I found a ${String(chip).toLowerCase()} bundle worth checking.`,
    };
  }

  if (text) {
    const words = text
      .replace(/[^a-z0-9\s]/gi, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2 && !/^(the|and|for|with|under|best|cheap)$/i.test(w))
      .slice(0, 4);
    const base = words.join(" ") || text;
    return {
      terms: [
        { label: "Top match", query: base },
        { label: "Accessory", query: `${base} accessory` },
        { label: "Bundle add-on", query: `${base} kit` },
      ],
      scoutLine: "I found a custom bundle worth checking.",
    };
  }

  return {
    terms: BUNDLE_SCENARIOS[0].terms,
    scoutLine: BUNDLE_SCENARIOS[0].scoutLine,
  };
}

function normalizeOptimizerItem(raw) {
  const price = Number(raw?.buyNowPrice ?? raw?.price ?? raw?.currentPrice ?? 0);
  const market = Number(raw?.marketValue ?? 0);
  const shipping = Number(raw?.shippingCost ?? 0);
  return {
    itemId: String(raw?.itemId || raw?.id || ""),
    title: String(raw?.title || "Listing"),
    image: raw?.image || raw?.imageUrl || "/fallback.png",
    price: Number.isFinite(price) ? price : 0,
    marketValue: Number.isFinite(market) ? market : 0,
    shippingCost: Number.isFinite(shipping) ? shipping : 0,
    sellerUsername: String(raw?.sellerUsername || raw?.seller || "Seller"),
    sellerFeedbackPercent:
      raw?.sellerFeedbackPercent != null ? Number(raw.sellerFeedbackPercent) : null,
    url: String(raw?.itemWebUrl || raw?.itemUrl || raw?.url || "").trim(),
    category: String(raw?.primaryCategoryName || raw?.category || ""),
    currency: raw?.currency || "USD",
    _raw: raw,
  };
}

function passesLuxuryPriceFloor(item, group) {
  const price = Number(item.price) || 0;
  if (price >= LUXURY_MIN_PRICE_USD) return true;
  const lane = group?.lane || "";
  if (LUXURY_LOW_PRICE_ALLOWED_CATEGORIES.has(lane)) return price > 0;
  return false;
}

function filterLuxuryPool(pool, group) {
  return pool.filter((it) => {
    if (!it.title || !(it.price > 0 || it.url)) return false;
    if (isLuxuryLowValueTitle(it.title)) return false;
    if (!passesLuxuryPriceFloor(it, group)) return false;
    if (group?.query && !titleMatchesHeroIntent(it.title, group.query)) {
      if (!isPremiumBrandedTitle(it.title)) return false;
    }
    return true;
  });
}

function filterBudgetPool(pool) {
  return pool.filter((it) => it.title && (it.price > 0 || it.url));
}

function rankOptimizerItem(item, mode = OPTIMIZER_MODE.STANDARD, group = null) {
  const trust = evaluateTrustScore(trustScoreInputFromListing(item._raw || item));
  const trustScore = Number(trust?.trustScore) || 0;
  const price = Number(item.price) || 0;
  const market = Number(item.marketValue) || 0;
  const savings = market > price ? market - price : 0;
  const savingsPct = market > 0 ? (savings / market) * 100 : 0;
  const fb = Number(item.sellerFeedbackPercent) || 0;
  const shipping = Number(item.shippingCost) || 0;
  const bids = Number(item._raw?.bidCount ?? item.bidCount ?? 0) || 0;
  const popularity = Math.min(25, bids * 2.5);

  let rankScore;

  if (mode === OPTIMIZER_MODE.LUXURY) {
    const premiumBoost = isPremiumBrandedTitle(item.title) ? 22 : 0;
    const heroBoost =
      group?.query && titleMatchesHeroIntent(item.title, group.query) ? 16 : 0;
    const desirability =
      price >= 80 && price <= 1200
        ? 18
        : price >= LUXURY_MIN_PRICE_USD
          ? 8
          : -40;
    const cheapPenalty = price < LUXURY_MIN_PRICE_USD ? -80 : 0;

    rankScore =
      trustScore * 2.6 +
      Math.min(28, savingsPct) * 1.1 +
      Math.min(18, fb * 0.14) +
      popularity +
      premiumBoost +
      heroBoost +
      desirability +
      cheapPenalty -
      Math.min(8, shipping * 0.03);
  } else if (mode === OPTIMIZER_MODE.BUDGET) {
    rankScore =
      trustScore * 1.6 +
      Math.min(30, savingsPct) +
      Math.min(12, fb * 0.1) -
      Math.min(20, price * 0.08) -
      Math.min(10, shipping * 0.05);
  } else {
    rankScore =
      trustScore * 2.2 +
      Math.min(35, savingsPct) +
      Math.min(15, fb * 0.12) -
      Math.min(12, shipping * 0.04) -
      (price > 0 ? Math.min(8, price / 400) : 0);
  }

  return {
    item: { ...item, trustScore, trustLevel: trust?.trustLevel || "medium" },
    rankScore,
    trustScore,
    savings,
    savingsPct,
  };
}

async function searchEbayForGroup(group, mode) {
  const sort =
    mode === OPTIMIZER_MODE.BUDGET
      ? "price"
      : mode === OPTIMIZER_MODE.LUXURY
        ? "bestMatch"
        : "bestMatch";
  const limit = mode === OPTIMIZER_MODE.LUXURY ? 14 : 8;

  const queries =
    mode === OPTIMIZER_MODE.LUXURY
      ? [group.query, ...(group.fallbacks || [])].filter(Boolean)
      : [group.query];

  let bestResult = { group, pick: null, poolSize: 0 };

  for (const q of queries) {
    try {
      const data = await fetchEbaySearch({
        q,
        limit,
        listingMode: "buy_now",
        sort,
      });
      const rawPool = (data?.items || data?.normalizedItems || []).map(normalizeOptimizerItem);
      const pool =
        mode === OPTIMIZER_MODE.LUXURY
          ? filterLuxuryPool(rawPool, { ...group, query: q })
          : filterBudgetPool(rawPool);

      if (!pool.length) continue;

      const ranked = pool
        .map((it) => rankOptimizerItem(it, mode, { ...group, query: q }))
        .sort((a, b) => b.rankScore - a.rankScore);
      const best = ranked[0];
      if (
        !bestResult.pick ||
        best.rankScore > (bestResult.rankMeta?.rankScore ?? -Infinity)
      ) {
        bestResult = {
          group,
          pick: best.item,
          rankMeta: best,
          poolSize: pool.length,
        };
      }
      if (mode === OPTIMIZER_MODE.LUXURY && best.rankScore >= 95) break;
    } catch {
      /* try next query */
    }
  }

  return bestResult;
}

function pickBestFromSearch(data, group, mode = OPTIMIZER_MODE.STANDARD) {
  const rawPool = (data?.items || data?.normalizedItems || [])
    .map(normalizeOptimizerItem)
    .filter((it) => it.title && (it.price > 0 || it.url));

  const pool =
    mode === OPTIMIZER_MODE.LUXURY
      ? filterLuxuryPool(rawPool, group)
      : rawPool;

  if (!pool.length) return { group, pick: null, poolSize: 0 };

  const ranked = pool
    .map((it) => rankOptimizerItem(it, mode, group))
    .sort((a, b) => b.rankScore - a.rankScore);
  const best = ranked[0];
  return {
    group,
    pick: best.item,
    rankMeta: best,
    poolSize: pool.length,
  };
}

function computeBundleSummary(rows) {
  const picks = rows.filter((r) => r.pick);
  let total = 0;
  let marketTotal = 0;
  let savings = 0;
  let trustSum = 0;

  for (const row of picks) {
    const p = Number(row.pick.price) || 0;
    const ship = Number(row.pick.shippingCost) || 0;
    const market = Number(row.pick.marketValue) || 0;
    total += p + ship;
    marketTotal += market > 0 ? market : p;
    savings += Math.max(0, market - p);
    trustSum += Number(row.pick.trustScore) || 0;
  }

  const avgTrust = picks.length ? Math.round(trustSum / picks.length) : 0;
  const savvyPointsEstimate = 120 + picks.length * 48 + Math.round(savings * 0.15);

  return {
    itemCount: picks.length,
    estimatedTotal: total,
    estimatedMarket: marketTotal,
    estimatedSavings: savings,
    avgTrustScore: avgTrust,
    savvyPointsEstimate,
  };
}

/**
 * Search eBay for each product group and build a Smart Cart bundle.
 * @param {string} request
 * @param {{ chip?: string, triggerScout?: boolean }} [options]
 */
export async function buildLifeOptimizerBundle(request, options = {}) {
  const { chip = "", triggerScout = true } = options;
  const mode = resolveOptimizerMode(chip);
  const { terms, scoutLine } = extractProductGroups(request, chip);

  const searchRows = await Promise.all(
    terms.map(async (group) => {
      try {
        if (mode === OPTIMIZER_MODE.LUXURY) {
          return await searchEbayForGroup(group, mode);
        }
        const sort = mode === OPTIMIZER_MODE.BUDGET ? "price" : "bestMatch";
        const data = await fetchEbaySearch({
          q: group.query,
          limit: 8,
          listingMode: "buy_now",
          sort,
        });
        return pickBestFromSearch(data, group, mode);
      } catch {
        return { group, pick: null, poolSize: 0, error: true };
      }
    })
  );

  const bundle = computeBundleSummary(searchRows);
  const hasResults = bundle.itemCount > 0;

  if (triggerScout && hasResults && typeof window !== "undefined") {
    const firstUrl = searchRows.find((r) => r.pick?.url)?.pick?.url || "/business-offers";
    pushScoutDealFound({
      id: `optimizer-bundle-${Date.now()}`,
      title: "Opportunity found.",
      body: scoutLine,
      url: firstUrl,
    });
    setScoutVisualState("dealFound");
    window.setTimeout(() => setScoutVisualState("idle"), 2800);
  }

  return {
    request: String(request || "").trim(),
    scoutLine,
    searchRows,
    bundle,
    hasResults,
    mode,
    fallbackSuggestions: OPTIMIZER_FALLBACK_SUGGESTIONS,
  };
}

export function formatOptimizerMoney(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return "—";
  return `$${Math.round(n).toLocaleString()}`;
}

export function openOptimizerDeal(url) {
  const target = String(url || "").trim();
  if (!target) return;
  if (/^https?:\/\//i.test(target)) {
    window.open(target, "_blank", "noopener,noreferrer");
  }
}

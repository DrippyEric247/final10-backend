/**
 * Luxury Hero Search System — aspirational product queries for Savvy Life Optimizer.
 * Used when "Luxury Mode" is active; avoids $1–$10 filler (cards, cables, junk webcams).
 */

export const LUXURY_MIN_PRICE_USD = 25;

/** Categories where sub-$25 items are still allowed (small consumables). */
export const LUXURY_LOW_PRICE_ALLOWED_CATEGORIES = new Set(["grocery"]);

export const LUXURY_HERO_LANES = {
  gaming: [
    { label: "PlayStation 5", query: "Sony PlayStation 5 console", fallbacks: ["PS5 console bundle"] },
    { label: "PlayStation 5 Pro", query: "PlayStation 5 Pro console", fallbacks: ["PS5 Pro console"] },
    { label: "Nintendo Switch OLED", query: "Nintendo Switch OLED console", fallbacks: ["Switch OLED bundle"] },
    { label: "Steam Deck", query: "Steam Deck OLED", fallbacks: ["Valve Steam Deck"] },
    { label: "Gaming monitor", query: "27 inch 144hz gaming monitor", fallbacks: ["gaming monitor 165hz"] },
    { label: "Gaming chair", query: "premium gaming chair ergonomic", fallbacks: ["Secretlab gaming chair"] },
  ],
  streaming: [
    { label: "Elgato Capture Card", query: "Elgato HD60 capture card", fallbacks: ["Elgato 4K capture card"] },
    { label: "Logitech Brio 4K", query: "Logitech Brio 4K webcam", fallbacks: ["Logitech Brio webcam"] },
    { label: "Stream Deck", query: "Elgato Stream Deck MK.2", fallbacks: ["Elgato stream deck xl"] },
    { label: "Shure Microphone", query: "Shure SM7B microphone", fallbacks: ["Shure dynamic microphone streaming"] },
    { label: "Ring light kit", query: "professional ring light kit streaming", fallbacks: ["LED ring light 18 inch"] },
  ],
  tech: [
    { label: "AirPods Pro", query: "Apple AirPods Pro 2", fallbacks: ["AirPods Pro sealed"] },
    { label: "iPad", query: "Apple iPad Pro", fallbacks: ["Apple iPad Air new"] },
    { label: "MacBook", query: "Apple MacBook Pro", fallbacks: ["MacBook Air M3"] },
    { label: "Gaming laptop", query: "gaming laptop RTX 4060", fallbacks: ["ASUS ROG gaming laptop"] },
  ],
  home: [
    { label: "Standing desk", query: "electric standing desk", fallbacks: ["Uplift standing desk"] },
    { label: "Gaming desk", query: "L shaped gaming desk", fallbacks: ["premium gaming desk"] },
    { label: "Ergonomic chair", query: "Herman Miller ergonomic office chair", fallbacks: ["Steelcase ergonomic chair"] },
    { label: "RGB lighting", query: "Philips Hue RGB lighting kit", fallbacks: ["Govee RGBIC room lighting"] },
  ],
  auto: [
    { label: "Milwaukee tool set", query: "Milwaukee M18 tool combo kit", fallbacks: ["Milwaukee power tool set"] },
    { label: "OBD2 scanner", query: "professional OBD2 scanner diagnostic", fallbacks: ["Autel OBD2 scanner"] },
    { label: "Mechanic tool cart", query: "mechanic tool cart rolling", fallbacks: ["Snap-on style tool cart"] },
    { label: "BMW diagnostic", query: "BMW diagnostic scan tool", fallbacks: ["ISTA BMW coding tool"] },
  ],
};

/** Detect luxury lane from natural-language request. */
export const LUXURY_LANE_MATCHERS = [
  { lane: "streaming", match: /stream|streamer|streaming|elgato|webcam|microphone|ring\s*light|capture\s*card|stream\s*deck/i },
  { lane: "gaming", match: /gaming|gamer|battle\s*station|ps5|playstation|xbox|switch|steam\s*deck|monitor|gaming\s*chair/i },
  { lane: "tech", match: /tech|macbook|airpods|ipad|laptop|iphone|apple/i },
  { lane: "home", match: /home|desk|standing\s*desk|office\s*chair|ergonomic|rgb|apartment|furniture/i },
  { lane: "auto", match: /auto|automotive|bmw|milwaukee|obd|mechanic|tool\s*cart|diagnostic|car\s*detail/i },
];

/** UI category chips → luxury lane. */
export const CHIP_TO_LUXURY_LANE = {
  Gaming: "gaming",
  Tech: "tech",
  Home: "home",
  Automotive: "auto",
  Fashion: "tech",
  Fitness: "home",
  Travel: "tech",
  Family: "tech",
  Grocery: "home",
};

export const PREMIUM_BRAND_PATTERNS = [
  /\bsony\b/i,
  /\bplaystation\b/i,
  /\bnintendo\b/i,
  /\bsteam\s*deck\b/i,
  /\belgato\b/i,
  /\blogitech\b/i,
  /\bshure\b/i,
  /\bapple\b/i,
  /\bairpods\b/i,
  /\bmacbook\b/i,
  /\bipad\b/i,
  /\basus\s*rog\b/i,
  /\bherman\s*miller\b/i,
  /\bsteelcase\b/i,
  /\bsecretlab\b/i,
  /\bphilips\s*hue\b/i,
  /\bgovee\b/i,
  /\bmilwaukee\b/i,
  /\bautel\b/i,
  /\bsnap[-\s]?on\b/i,
  /\bbmw\b/i,
  /\bvalve\b/i,
];

export const LUXURY_LOW_VALUE_PATTERNS = [
  /\btrading\s*card\b/i,
  /\bsingle\s*card\b/i,
  /\bgift\s*card\b/i,
  /\bsticker\b/i,
  /\bdecal\b/i,
  /\bmanual\s*only\b/i,
  /\bempty\s*box\b/i,
  /\breplacement\s+(shell|cover|part)\b/i,
  /\busb\s*cable\s*only\b/i,
  /\badapter\s*only\b/i,
  /\bfor\s*parts\b/i,
  /\bparts\s*only\b/i,
  /\bbroken\b/i,
  /\blot\s+of\s+\d+\s+cards\b/i,
  /\bplaystation\s*plus\s*(code|subscription)\b/i,
  /\bdigital\s*code\b/i,
  /\bcheapest\b/i,
  /\bgeneric\s*webcam\b/i,
  /\b720p\s*webcam\b/i,
  /\bmini\s*webcam\b/i,
];

/**
 * @param {string} request
 * @param {string} [categoryChip] — e.g. "Gaming" when user picked a category chip (not mode chip)
 * @returns {{ lane: string, terms: import('./lifeOptimizerBundle').ProductGroup[] }}
 */
export function resolveLuxuryLaneAndTerms(request, categoryChip = "") {
  const text = String(request || "").trim().toLowerCase();
  let lane = "gaming";

  for (const entry of LUXURY_LANE_MATCHERS) {
    if (entry.match.test(text)) {
      lane = entry.lane;
      break;
    }
  }

  const chipLane = CHIP_TO_LUXURY_LANE[String(categoryChip || "").trim()];
  if (chipLane && (!text || lane === "gaming")) {
    lane = chipLane;
  }

  if (/luxury/i.test(text) && !LUXURY_LANE_MATCHERS.some((e) => e.match.test(text))) {
    lane = chipLane || "gaming";
  }

  const heroes = LUXURY_HERO_LANES[lane] || LUXURY_HERO_LANES.gaming;
  const terms = heroes.slice(0, 4).map((h) => ({
    label: h.label,
    query: h.query,
    fallbacks: h.fallbacks || [],
    lane,
  }));

  const laneLabel = lane.charAt(0).toUpperCase() + lane.slice(1);
  return {
    lane,
    terms,
    scoutLine: `I built a premium ${laneLabel} Smart Cart — high-trust, high-wow picks only.`,
  };
}

export function isPremiumBrandedTitle(title) {
  const t = String(title || "");
  return PREMIUM_BRAND_PATTERNS.some((pat) => pat.test(t));
}

export function isLuxuryLowValueTitle(title) {
  const t = String(title || "").trim();
  if (t.length < 4) return true;
  return LUXURY_LOW_VALUE_PATTERNS.some((pat) => pat.test(t));
}

export function titleMatchesHeroIntent(title, query) {
  const t = String(title || "").toLowerCase();
  const q = String(query || "").toLowerCase();
  const tokens = q.split(/\s+/).filter((w) => w.length > 3);
  if (!tokens.length) return true;
  const hits = tokens.filter((w) => t.includes(w)).length;
  return hits >= Math.min(2, tokens.length);
}

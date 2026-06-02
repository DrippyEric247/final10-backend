import { getDevFeatureTests, isDev } from "./devOverride";
import { getAdvantageTier, getEffectiveSubscriptionTier } from "./tierMultiplier";
import { isBetaTester, getScoutMissionTier } from "./betaTesterAccess";

const SAVVY_AI_RULES_KEY = "f10_savvy_ai_rules_v1";
const SAVVY_AI_PAYMENTS_KEY = "f10_savvy_ai_saved_payments_v1";

function toNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function getSavvyAiCapabilities(tier = getEffectiveSubscriptionTier()) {
  let normalized = getScoutMissionTier(String(tier || "free").toLowerCase());
  if (isBetaTester()) {
    normalized = "elite";
  }
  if (isDev && getDevFeatureTests().premiumAiHints && normalized === "free") {
    normalized = "elite";
  }
  const isCore = normalized === "core" || normalized === "pro" || normalized === "elite";
  const isPro = normalized === "pro" || normalized === "elite";
  const isElite = normalized === "elite";
  const tierInfo = getAdvantageTier(normalized);
  return {
    tier: normalized,
    tierLabel: tierInfo.label,
    hasTextAssistant: true,
    canSuggestAlerts: true,
    canExplainDeals: true,
    hasBasicSmartSuggestions: isCore,
    hasVoiceInput: isElite,
    hasVoiceAutoAlert: isElite,
    hasExecutionAi: isPro,
    hasReadyToBuyFlow: isPro,
    hasAutoConfirmRules: isPro,
  };
}

const PRODUCT_CATEGORY_HINTS = [
  { pat: /\b(ps5|playstation|xbox|switch|nintendo|gaming pc|gaming laptop|rtx|4090|gpu)\b/i, category: "gaming" },
  { pat: /\b(iphone|ipad|airpods|macbook|apple watch|samsung|pixel)\b/i, category: "electronics" },
  { pat: /\b(bmw|mercedes|audi|wheel|wheels|rim|rims|car part|automotive)\b/i, category: "auto" },
  { pat: /\b(sneaker|jordan|yeezy|nike dunk|adidas)\b/i, category: "sneakers" },
  { pat: /\b(pokemon|pok[eé]mon|trading card|mtg|card lot)\b/i, category: "collectibles" },
];

const BRAND_HINTS = [
  "sony",
  "playstation",
  "nintendo",
  "microsoft",
  "xbox",
  "apple",
  "samsung",
  "bmw",
  "nike",
  "adidas",
  "nvidia",
  "amd",
  "intel",
  "rolex",
];

function normalizeWhitespace(s) {
  return String(s || "").replace(/\s+/g, " ").trim();
}

function extractBrands(textLower) {
  return BRAND_HINTS.filter((b) => new RegExp(`\\b${b}\\b`, "i").test(textLower));
}

function extractCategory(text) {
  const hit = PRODUCT_CATEGORY_HINTS.find((x) => x.pat.test(text));
  return hit ? hit.category : null;
}

/**
 * Convert natural language shopping requests into a structured object
 * suitable for marketplace querying and alert creation.
 */
export function extractShoppingIntent(text) {
  const raw = normalizeWhitespace(text);
  if (!raw) return null;
  const lower = raw.toLowerCase();

  const underMatch = lower.match(/(?:under|below|less than|<=?)\s*\$?\s*(\d+(?:\.\d{1,2})?)/i);
  const overMatch = lower.match(/(?:over|above|more than|>=?)\s*\$?\s*(\d+(?:\.\d{1,2})?)/i);
  const aroundMatch = lower.match(/(?:around|about|~)\s*\$?\s*(\d+(?:\.\d{1,2})?)/i);

  const maxPrice = underMatch ? Number(underMatch[1]) : aroundMatch ? Number(aroundMatch[1]) : undefined;
  const minPrice = overMatch ? Number(overMatch[1]) : undefined;

  const monitorRequested =
    /\b(alert|alerts|notify|notification|watch|watchlist|track|tracking|monitor|monitoring|price drop|drops below)\b/i.test(lower);

  const bestMoveRequested =
    /\b(best move|best deal(s)? (today|right now)|biggest savings?|largest savings?|top savings?)\b/i.test(lower);

  const trendingRequested =
    /\b(what('| i)?s hot( today)?|trending|popular right now|what are people buying)\b/i.test(lower);

  const goal = bestMoveRequested ? "best_move" : trendingRequested ? "trending" : monitorRequested ? "monitor" : "search";

  const preferredConditionMatch = lower.match(/\b(new|used|refurbished|open box|excellent|very good|good)\b/i);
  const preferredCondition = preferredConditionMatch ? preferredConditionMatch[1].toLowerCase() : undefined;
  const highTrustOnly = /\bhigh trust|trusted|safe seller|reliable seller\b/i.test(lower);

  const cleanedQuery = raw
    .replace(/^(find|show|search|look for|i('?m| am) looking for|any good)\s+/i, "")
    .replace(/\b(deals?|listings?|products?)\b/gi, "")
    .replace(/\b(today|right now|please)\b/gi, "")
    .replace(/\b(cheap|affordable|budget)\b/gi, "")
    .replace(/\b(alert|alerts|notify me|watch|track|monitor(?:ing)?)\b/gi, "")
    .replace(/\b(under|below|less than|over|above|more than|around|about|~)\s*\$?\s*\d+(?:\.\d{1,2})?/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();

  const query = cleanedQuery || raw;
  const keywords = query.split(/\s+/).filter(Boolean).slice(0, 8);
  const brands = extractBrands(lower);
  const category = extractCategory(lower);

  return {
    raw,
    goal, // search | monitor | best_move | trending
    query,
    item: query, // backward compatibility
    keywords,
    brands,
    category,
    maxPrice: Number.isFinite(maxPrice) ? maxPrice : undefined,
    minPrice: Number.isFinite(minPrice) ? minPrice : undefined,
    preferredCondition,
    highTrustOnly,
    minTrust: highTrustOnly ? 80 : undefined,
    dealType: /\bauction|bid\b/i.test(lower) ? "auction" : /\bbuy now\b/i.test(lower) ? "buy_now" : "any",
    budgetPreference: /\bcheap|affordable|budget\b/i.test(lower) ? "cheap" : "any",
    shoppingGoal:
      goal === "best_move"
        ? "maximize_savings"
        : goal === "trending"
          ? "discover_hot"
          : goal === "monitor"
            ? "price_drop_alert"
            : "find_matches",
  };
}

export function parseVoiceDealIntent(text) {
  return extractShoppingIntent(text);
}

export function buildVoiceAlertPayload(intent) {
  if (!intent?.item && !intent?.query) return null;
  const query = String(intent.item || intent.query || "").trim();
  const keywords = query
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 6);
  return {
    name: `Voice watch • ${query}`,
    keywords,
    ...(Number.isFinite(intent.maxPrice) ? { maxPrice: intent.maxPrice } : {}),
    ...(Number.isFinite(intent.minTrust) ? { minTrust: intent.minTrust } : {}),
    ...(intent.preferredCondition ? { condition: intent.preferredCondition } : {}),
    minConfidence: 72,
    persona: "buyer",
    kind: "voice_watch",
    context: { source: "savvy_voice_ai" },
    status: "active",
  };
}

export function isValidCondition(condition) {
  const c = String(condition || "").toLowerCase();
  if (!c) return false;
  return /(new|used|refurbished|open box|excellent|very good|good)/i.test(c);
}

export function getSavvyAiRules() {
  try {
    const raw = JSON.parse(localStorage.getItem(SAVVY_AI_RULES_KEY) || "{}");
    const enabled = Boolean(raw.enabled);
    const maxPrice = toNum(raw.maxPrice);
    const minTrust = toNum(raw.minTrust);
    return {
      enabled,
      maxPrice: Number.isFinite(maxPrice) ? maxPrice : 400,
      minTrust: Number.isFinite(minTrust) ? minTrust : 80,
    };
  } catch {
    return { enabled: false, maxPrice: 400, minTrust: 80 };
  }
}

export function setSavvyAiRules(nextRules) {
  const next = {
    enabled: Boolean(nextRules?.enabled),
    maxPrice: Number(nextRules?.maxPrice) || 400,
    minTrust: Number(nextRules?.minTrust) || 80,
  };
  try {
    localStorage.setItem(SAVVY_AI_RULES_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  return next;
}

export function getSavedPaymentMethods() {
  try {
    const raw = JSON.parse(localStorage.getItem(SAVVY_AI_PAYMENTS_KEY) || "[]");
    if (Array.isArray(raw) && raw.length > 0) return raw;
  } catch {
    /* ignore */
  }
  const fallback = [{ id: "card_4242", label: "Visa •••• 4242" }];
  try {
    localStorage.setItem(SAVVY_AI_PAYMENTS_KEY, JSON.stringify(fallback));
  } catch {
    /* ignore */
  }
  return fallback;
}

export function shouldTriggerReadyToBuy({ item, trustScore, rules }) {
  const safeRules = rules || getSavvyAiRules();
  const trust = toNum(trustScore);
  const price = toNum(item?.buyNowPrice) ?? toNum(item?.currentBidPrice) ?? toNum(item?.price);
  const validCondition = isValidCondition(item?.condition);
  const priceOk = Number.isFinite(price) && price > 0 && price <= safeRules.maxPrice;
  const trustOk = Number.isFinite(trust) && trust >= safeRules.minTrust;
  return Boolean(priceOk && trustOk && validCondition);
}


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

export function parseVoiceDealIntent(text) {
  const raw = String(text || "").trim();
  if (!raw) return null;
  const lower = raw.toLowerCase();
  const m = lower.match(/(?:under|below|less than)\s*\$?\s*(\d+(?:\.\d{1,2})?)/i);
  const maxPrice = m ? Number(m[1]) : undefined;
  const highTrust = /\bhigh trust\b|\btrusted\b|\btop trust\b/i.test(lower);
  const condMatch = lower.match(/\b(new|used|refurbished|open box|excellent|very good|good)\b/i);
  const preferredCondition = condMatch ? condMatch[1].toLowerCase() : undefined;
  const normalizedQuery = raw
    .replace(/^(find|search|show|look for|watch|track)\s+/i, "")
    .replace(/\s+(deals?|listings?)\b/gi, "")
    .replace(/\s+(with|and)\s+high trust\b/gi, "")
    .replace(/\s+\bhigh trust\b/gi, "")
    .replace(/\s+\b(new|used|refurbished|open box|excellent|very good|good)\b/gi, "")
    .replace(/\s+(under|below|less than)\s*\$?\s*\d+(?:\.\d{1,2})?/i, "")
    .trim();
  const query = normalizedQuery || raw;
  if (!query) return null;
  return {
    query, // Keep backward compatibility for existing call sites.
    item: query,
    maxPrice: Number.isFinite(maxPrice) ? maxPrice : undefined,
    minTrust: highTrust ? 80 : undefined,
    highTrustOnly: highTrust,
    preferredCondition,
  };
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


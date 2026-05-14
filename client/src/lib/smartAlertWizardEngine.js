/**
 * Client-side heuristics for Smart Alert Creation — no network required.
 * Typical discount ranges are illustrative; tune from marketplace data later.
 */

const REALITY_ROWS = [
  { test: (k) => /ps5|playstation\s*5|ps\s*4|xbox|switch\s*2|nintendo/i.test(k), min: 10, max: 22, label: "PS5 / console" },
  { test: (k) => /iphone|ipad|macbook|airpods|apple watch/i.test(k), min: 8, max: 18, label: "Apple devices" },
  { test: (k) => /gpu|graphics card|nvidia|rtx|amd rx/i.test(k), min: 5, max: 15, label: "PC parts" },
  { test: (k) => /sneaker|jordan|nike|yeezy|adidas/i.test(k), min: 12, max: 28, label: "sneakers" },
  { test: (k) => /laptop|chromebook|surface/i.test(k), min: 10, max: 25, label: "laptops" },
  { test: () => true, min: 5, max: 15, label: "similar listings" }, // default bucket
];

const AUTOCOMPLETE_SEEDS = [
  "PS5 disc",
  "PS5 digital",
  "iPhone 15 Pro",
  "Nintendo Switch OLED",
  "RTX 4070",
  "AirPods Pro",
  "Jordan 1",
  "MacBook Air M2",
  "Sony WH-1000XM5",
  "Steam Deck",
  "Dyson V15",
  "Lego sets",
];

export function normalizeKeyword(raw) {
  return String(raw || "")
    .trim()
    .slice(0, 80);
}

export function typicalDealRange(keyword) {
  const k = keyword.toLowerCase();
  for (const row of REALITY_ROWS) {
    if (row.test(k)) return { minPct: row.min, maxPct: row.max, label: row.label };
  }
  return { minPct: 5, maxPct: 15, label: "this category" };
}

/** Target is % off MSRP or “deal depth”; flag if user wants far more than typical. */
export function isTargetUnrealistic(keyword, targetPercentOff) {
  const { maxPct } = typicalDealRange(keyword);
  const t = Number(targetPercentOff);
  if (!Number.isFinite(t) || t <= 0) return false;
  return t > maxPct + 12;
}

export function unrealisticSuggestionCopy(keyword) {
  const { minPct, maxPct, label } = typicalDealRange(keyword);
  return `Most ${label} deals are ${minPct}–${maxPct}% off`;
}

export function suggestAdjustedPercent(keyword) {
  const { minPct, maxPct } = typicalDealRange(keyword);
  return Math.round((minPct + maxPct) / 2);
}

export function filterAutocompleteSuggestions(query, limit = 8) {
  const q = normalizeKeyword(query).toLowerCase();
  if (!q) return AUTOCOMPLETE_SEEDS.slice(0, limit);
  const scored = [...AUTOCOMPLETE_SEEDS]
    .map((s) => {
      const sl = s.toLowerCase();
      let score = 0;
      if (sl.startsWith(q)) score += 40;
      if (sl.includes(q)) score += 20;
      q.split(/\s+/).forEach((tok) => {
        if (tok && sl.includes(tok)) score += 12;
      });
      return { s, score };
    })
    .filter((x) => x.score > 0 || q.length < 2)
    .sort((a, b) => b.score - a.score)
    .map((x) => x.s);
  const uniq = [...new Set([...scored, ...AUTOCOMPLETE_SEEDS])];
  return uniq.slice(0, limit);
}

/** @typedef {'high' | 'balanced' | 'aggressive'} TrustPreset */

export function trustPresetToMinConfidence(preset) {
  if (preset === "high") return 88;
  if (preset === "aggressive") return 62;
  return 76;
}

/**
 * @returns {'high' | 'moderate' | 'rare'}
 */
export function computeSuccessMeter(trustPreset, targetPercentOff, keyword = "") {
  const { maxPct } = typicalDealRange(keyword || "x");
  const t = Number(targetPercentOff) || 0;
  const trustBoost = trustPreset === "high" ? 1.15 : trustPreset === "aggressive" ? 0.92 : 1;
  const adjusted = t * trustBoost;
  const softCap = maxPct + 8;
  if (adjusted <= softCap * 0.75) return "high";
  if (adjusted <= softCap * 1.15) return "moderate";
  return "rare";
}

export function successMeterLabel(tier) {
  if (tier === "high") return "High chance";
  if (tier === "moderate") return "Moderate";
  return "Rare";
}

export function successProbabilityCopy(tier) {
  if (tier === "high") return "Savvy sees strong odds you’ll get pinged with quality hits.";
  if (tier === "moderate") return "Worth watching — you may wait longer for the right listing.";
  return "Ambitious target — fewer matches, but we’ll still scan for you.";
}

export function inferTrustPresetFromAlert(alert) {
  const t = alert?.context?.trustPreset;
  if (t === "high" || t === "balanced" || t === "aggressive") return t;
  const c = Number(alert?.minConfidence);
  if (Number.isFinite(c) && c >= 84) return "high";
  if (Number.isFinite(c) && c <= 64) return "aggressive";
  return "balanced";
}

export function inferTargetFromAlert(alert) {
  if (alert?.maxPrice != null && Number.isFinite(Number(alert.maxPrice))) {
    return { targetMode: "price", maxPrice: String(alert.maxPrice), targetPercent: 50 };
  }
  const p = alert?.context?.targetPercent;
  if (Number.isFinite(Number(p))) {
    return { targetMode: "percent", targetPercent: Math.round(Number(p)), maxPrice: "" };
  }
  return { targetMode: "percent", targetPercent: 50, maxPrice: "" };
}

export function buildSmartAlertPayload({
  keyword,
  targetMode,
  targetPercent,
  maxPrice,
  trustPreset,
}) {
  const kw = normalizeKeyword(keyword);
  const name = `${kw}${maxPrice ? ` · ≤ $${maxPrice}` : targetPercent ? ` · ~${targetPercent}%+ off` : ""}`.slice(0, 120);
  let keywords = kw
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 12);
  if (keywords.length === 0) keywords = [kw];
  const minConfidence = trustPresetToMinConfidence(trustPreset);
  return {
    name,
    keywords,
    maxPrice: maxPrice != null && Number.isFinite(Number(maxPrice)) ? Number(maxPrice) : undefined,
    minConfidence,
    sources: ["ebay"],
    persona: "buyer",
    kind: "smart_wizard",
    context: {
      smartWizard: true,
      trustPreset,
      targetMode,
      targetPercent: targetPercent != null ? Number(targetPercent) : undefined,
      createdWith: "smart_alert_wizard_v1",
    },
  };
}

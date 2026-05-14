function toNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export function calculateSavings(price, marketValue) {
  const p = toNum(price);
  const m = toNum(marketValue);
  if (p <= 0 || m <= 0 || m <= p) {
    return { savings: 0, savingsPct: 0 };
  }
  const savings = Math.round((m - p) * 100) / 100;
  const savingsPct = Math.round(((m - p) / m) * 100);
  return { savings, savingsPct };
}

export function calculateRewardPoints(offer) {
  const trustScore = toNum(offer.trustScore);
  if (trustScore < 60) return 0;
  const savings = toNum(offer.savings);
  const price = toNum(offer.price);
  const base = Math.max(0, Math.round((savings * 0.8) + (price * 0.2)));
  return Math.max(40, base);
}

export function dedupeOffers(offers) {
  const seen = new Set();
  return (offers || []).filter((offer) => {
    const key = String(offer.id || `${offer.sourceType}:${offer.title}:${offer.price}`);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function rankOffers(offers, userRegion = "") {
  const now = Date.now();
  return [...(offers || [])].sort((a, b) => {
    const urgA = Math.max(0, 1 - ((toNum(a.expiresAt) - now) / (48 * 60 * 60 * 1000)));
    const urgB = Math.max(0, 1 - ((toNum(b.expiresAt) - now) / (48 * 60 * 60 * 1000)));
    const demandWeight = { low: 0.35, medium: 0.65, high: 1 };
    const demandA = demandWeight[a.demandLevel] || 0.5;
    const demandB = demandWeight[b.demandLevel] || 0.5;
    const promoWeight = { basic: 0.25, featured: 0.75, boosted: 1 };
    const promoA = promoWeight[a.promotionTier] || 0.25;
    const promoB = promoWeight[b.promotionTier] || 0.25;
    const regionA = String(a.location || "").toLowerCase().includes(String(userRegion).toLowerCase()) ? 1 : a.location === "Online" ? 0.6 : 0.25;
    const regionB = String(b.location || "").toLowerCase().includes(String(userRegion).toLowerCase()) ? 1 : b.location === "Online" ? 0.6 : 0.25;
    const scoreA =
      (toNum(a.savingsPct) * 0.34) +
      (toNum(a.trustScore) * 0.26) +
      (urgA * 25) +
      (demandA * 18) +
      (promoA * 16) +
      (toNum(a.popularity) * 0.06) +
      (regionA * 12);
    const scoreB =
      (toNum(b.savingsPct) * 0.34) +
      (toNum(b.trustScore) * 0.26) +
      (urgB * 25) +
      (demandB * 18) +
      (promoB * 16) +
      (toNum(b.popularity) * 0.06) +
      (regionB * 12);
    return scoreB - scoreA;
  });
}

export function offerReason(offer) {
  const reasons = [];
  if (toNum(offer.savingsPct) >= 20) reasons.push(`Strong ${offer.savingsPct}% savings`);
  if (toNum(offer.trustScore) >= 80) reasons.push("high trust seller");
  if (offer.demandLevel === "high") reasons.push("high demand momentum");
  if (toNum(offer.expiresAt) - Date.now() < 6 * 60 * 60 * 1000) reasons.push("ending soon");
  if (!reasons.length) reasons.push("balanced value and trust");
  return `Why this is a good deal: ${reasons.join(", ")}.`;
}

export function bestMoveTag(offer) {
  if (offer.sourceType === "future_coupon") return "Watch";
  if (toNum(offer.expiresAt) - Date.now() < 2 * 60 * 60 * 1000 && offer.demandLevel === "high") return "Snipe";
  if (toNum(offer.savingsPct) >= 18 && toNum(offer.trustScore) >= 65) return "Buy Now";
  return "Watch";
}


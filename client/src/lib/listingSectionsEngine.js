/**
 * Savvy Trust Engine — feed grouping
 *
 * Groups listings so trust dominates cheap-price churn:
 *   ⭐ Best Move Right Now   — highest-trust picks only (caps risky visibility)
 *   ⚡ Worth Watching         — remaining high-trust + medium-trust opportunities
 *   ⚠️ Risky Deals            — low + unverified sellers, hard-capped share
 *
 * BestMoveScore weights trust highest so “cheapest” cannot outweigh safety.
 */

export const BEST_MOVE_HIGH_TRUST = 80;
export const BEST_MOVE_MEDIUM_TRUST = 55;
export const BEST_MOVE_LOW_TRUST = 36;

export const BEST_MOVE_TOP_LIMIT = 3;
/** Lower cap so low/unverified sellers cannot flood feeds. */
export const BEST_MOVE_LOW_TRUST_SHARE = 0.15;

export const MOVE_TIER_LABEL = Object.freeze({
  high: "🟢 High Trust",
  medium: "🟡 Medium Trust",
  low: "🔴 Low Trust",
  unverified: "⚫ Unverified Seller",
});

export const MOVE_SECTION_META = Object.freeze({
  bestMove: {
    title: "⭐ Best Move Right Now",
    subtitle: "Trust-first picks — price never outweighs safety.",
    tone: "amber",
  },
  worthWatching: {
    title: "⚡ Worth Watching",
    subtitle: "Solid sellers with realistic listings.",
    tone: "cyan",
  },
  risky: {
    title: "⚠️ Risky Deals (Savvy Cooldown)",
    subtitle: "Low or unverified sellers — proceed manually if at all.",
    tone: "rose",
  },
});

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Number(value) || 0));
}

/**
 * `trustLevelHint` should mirror `evaluateTrustScore().trustLevel` when available.
 */
export function getMoveTier(trustScore, trustLevelHint) {
  const hint = String(trustLevelHint || "").toLowerCase();
  if (hint === "high" || hint === "medium" || hint === "low" || hint === "unverified") {
    return hint;
  }
  const t = Number(trustScore);
  if (!Number.isFinite(t)) return "medium";
  if (t >= BEST_MOVE_HIGH_TRUST) return "high";
  if (t >= BEST_MOVE_MEDIUM_TRUST) return "medium";
  if (t >= BEST_MOVE_LOW_TRUST) return "low";
  return "unverified";
}

/**
 * Value score — 0..100. Still capped later by trust tier so savings cannot dominate.
 */
export function valueScoreFor(price, marketValue) {
  const p = Number(price);
  const m = Number(marketValue);
  if (!Number.isFinite(p) || !Number.isFinite(m) || m <= 0 || p <= 0) return 28;
  const pct = Math.max(0, (m - p) / m);
  return Math.round(clamp(pct * 150, 0, 100));
}

/**
 * Time-urgency score — 0..100. Peaks in the snipe window.
 */
export function urgencyScoreFor(secondsRemaining) {
  const s = Number(secondsRemaining);
  if (!Number.isFinite(s) || s <= 0) return 0;
  const hours = s / 3600;
  if (hours > 72) return 10;
  if (hours > 24) return 28;
  if (hours > 6) return 55;
  if (hours > 2) return 80;
  if (hours > 0.25) return 95;
  return 70;
}

const TIER_WEIGHTS = Object.freeze({
  high: [0.58, 0.32, 0.1],
  medium: [0.68, 0.22, 0.1],
  low: [0.76, 0.14, 0.1],
  unverified: [0.86, 0.07, 0.07],
});

export function computeBestMoveScore({ trustScore, valueScore, timeUrgency, tier }) {
  const t = clamp(trustScore, 0, 100);
  const v = clamp(valueScore, 0, 100);
  const u = clamp(timeUrgency, 0, 100);
  const moveTier = tier || getMoveTier(trustScore);
  const [tw, vw, uw] = TIER_WEIGHTS[moveTier] || TIER_WEIGHTS.medium;
  let blended = Math.round(t * tw + v * vw + u * uw);
  if (moveTier === "unverified") blended = Math.min(blended, Math.round(t + 14));
  return blended;
}

/**
 * Attach scoring context to a listing via a caller-supplied extractor.
 * `extract(item)` returns `{ trustScore, price, marketValue, secondsRemaining, trustLevel? }`.
 */
export function scoreListing(item, extract) {
  const ctx = (typeof extract === "function" && extract(item)) || {};
  const trustScore = Number(ctx.trustScore) || 0;
  const tier = getMoveTier(trustScore, ctx.trustLevel);
  const valueScore = valueScoreFor(ctx.price, ctx.marketValue);
  const timeUrgency = urgencyScoreFor(ctx.secondsRemaining);
  const bestMoveScore = computeBestMoveScore({ trustScore, valueScore, timeUrgency, tier });
  return { item, trustScore, valueScore, timeUrgency, bestMoveScore, tier };
}

/**
 * Group listings into { bestMove, worthWatching, risky } sections.
 */
export function groupByBestMove(items, extract, opts = {}) {
  const topLimit = Number.isFinite(opts.topLimit) ? Math.max(1, opts.topLimit) : BEST_MOVE_TOP_LIMIT;
  const lowShareCap = clamp(
    Number.isFinite(opts.lowShareCap) ? opts.lowShareCap : BEST_MOVE_LOW_TRUST_SHARE,
    0,
    0.45
  );

  const scored = (Array.isArray(items) ? items : []).map((i) => scoreListing(i, extract));

  const high = scored
    .filter((s) => s.tier === "high")
    .sort((a, b) => b.bestMoveScore - a.bestMoveScore);
  const medium = scored
    .filter((s) => s.tier === "medium")
    .sort((a, b) => b.bestMoveScore - a.bestMoveScore);
  const low = scored
    .filter((s) => s.tier === "low")
    .sort((a, b) => b.bestMoveScore - a.bestMoveScore);
  const unverified = scored
    .filter((s) => s.tier === "unverified")
    .sort((a, b) => b.bestMoveScore - a.bestMoveScore);

  const bestMove = high.slice(0, topLimit);
  const worthWatching = [...high.slice(topLimit), ...medium];

  const riskyPool = [...low, ...unverified].sort((a, b) => b.bestMoveScore - a.bestMoveScore);
  const totalVisible = bestMove.length + worthWatching.length + riskyPool.length;
  const lowCap = Math.max(riskyPool.length === 0 ? 0 : 1, Math.round(totalVisible * lowShareCap));
  const risky = riskyPool.slice(0, lowCap);

  return {
    bestMove,
    worthWatching,
    risky,
    stats: {
      totalScored: scored.length,
      lowCapped: Math.max(0, riskyPool.length - risky.length),
    },
  };
}

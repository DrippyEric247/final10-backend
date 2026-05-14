/**
 * Trending / Promote lane — Savvy point estimator.
 *
 * The numbers below are a transparent, rule-based projection meant to give
 * users a realistic sense of what browsing + promoting on this tab can pay
 * out. They map cleanly to the reward economy that already ships in the app:
 *
 *   - engagement rewards per click / deep-view on trending cards
 *   - tier multipliers for Featured / Boosted / Basic promotions
 *   - a visibility-boost factor that scales with the user's active promos
 *
 * All functions are pure and side-effect-free so they're safe to call inside
 * `useMemo`.
 */

export const TRENDING_POINT_RULES = Object.freeze({
  baseOrganic: 1,
  basePromoted: 3,
  perClick: 2,
  perDeepView: 5,
  featuredBonus: 8,
  promotionDailyBase: 50, // Savvy per day, per active promotion, at neutral visibility
  tierMultiplier: { organic: 1, basic: 1, boosted: 1.25, featured: 1.5 },
  // Rough conversion rates used to turn impressions/clicks into Savvy.
  savvyPerImpression: 0.03,
  savvyPerClick: 1.2,
  browseSampleSize: 12, // how many visible cards we average over
});

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, Number(v) || 0));
}

function tierFor(item) {
  const t = String(item?.promotionTier || item?.tier || "organic").toLowerCase();
  if (t === "featured") return "featured";
  if (t === "boosted" || t === "promoted") return "boosted";
  if (t === "basic") return "basic";
  return "organic";
}

/**
 * Estimate the Savvy a user could earn by engaging with a single trending card.
 */
export function estimateItemPoints(item) {
  if (!item) return { estimate: 0, perClick: 0, perDeepView: 0, tier: "organic" };
  const tier = tierFor(item);
  const mult = TRENDING_POINT_RULES.tierMultiplier[tier] || 1;
  const base = item.isPromoted ? TRENDING_POINT_RULES.basePromoted : TRENDING_POINT_RULES.baseOrganic;

  // Visibility factor maps visibility score → 1.0–1.8x on top of tier mult.
  const visibility = Number(item.visibilityScore) || 0;
  const visibilityFactor = 1 + clamp(visibility / 500, 0, 0.8);

  const perClick = Math.max(
    1,
    Math.round(TRENDING_POINT_RULES.perClick * mult * visibilityFactor)
  );
  const perDeepView = Math.max(
    2,
    Math.round(TRENDING_POINT_RULES.perDeepView * mult * visibilityFactor)
  );
  const featuredBonus = tier === "featured" ? TRENDING_POINT_RULES.featuredBonus : 0;

  // "Expected" single-interaction reward — opens the card + one click.
  const estimate = Math.round(base + perClick + featuredBonus);

  return { estimate, perClick, perDeepView, featuredBonus, tier };
}

/**
 * Aggregate session-level projection. Combines a browse estimate (what the
 * user can earn by engaging with the current feed) with a promotion estimate
 * (what their currently active promoted listings are projected to earn).
 */
export function estimateSessionEarnings({
  items = [],
  activePromotions = [],
  visibilityBoostPct = 0,
  stats = null,
} = {}) {
  const sample = Array.isArray(items)
    ? items.slice(0, TRENDING_POINT_RULES.browseSampleSize)
    : [];

  // Browse estimate: average per-item × conservative engagement count (~3).
  const avgPerItem =
    sample.length === 0
      ? 0
      : sample.reduce((sum, it) => sum + estimateItemPoints(it).estimate, 0) / sample.length;
  const browseEstimate = Math.round(avgPerItem * 3);

  // Promotion estimate: daily base × active count × visibility scale.
  const visScale = 1 + clamp(Number(visibilityBoostPct) / 100, 0, 2);
  const activeCount = Array.isArray(activePromotions) ? activePromotions.length : 0;
  const promotionEstimate = Math.round(
    activeCount * TRENDING_POINT_RULES.promotionDailyBase * visScale
  );

  // Optional: add an "earned so far" signal from real impressions/clicks if
  // the caller passes aggregate stats.
  const realized = stats
    ? Math.round(
        (Number(stats.totalImpressions) || 0) * TRENDING_POINT_RULES.savvyPerImpression +
          (Number(stats.totalClicks) || 0) * TRENDING_POINT_RULES.savvyPerClick
      )
    : 0;

  const total = browseEstimate + promotionEstimate;

  return {
    browseEstimate,
    promotionEstimate,
    realized,
    total,
    dailyProjection: Math.round(total * 1.1),
    weeklyProjection: Math.round(total * 6.5),
    activeCount,
    visibilityScale: Number(visScale.toFixed(2)),
  };
}

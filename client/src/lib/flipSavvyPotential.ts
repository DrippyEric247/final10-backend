/**
 * Flip Score → Savvy potential (UI ceiling). Mirrors `server/services/flipRewardsService.js`.
 * If server formulas change, update both places.
 */

const LISTING_BASE = 10;
const LISTING_AI_MATCH = 20;
const SALE_COMPLETE = 50;
const SMART_PRICING = 30;
const SPEED_BONUS = 25;

export const SALE_CORE_MAX_FLIP = SALE_COMPLETE + SMART_PRICING + SPEED_BONUS;

function listingBonusPoints(fromAi: boolean): number {
  return LISTING_BASE + (fromAi ? LISTING_AI_MATCH : 0);
}

/** @returns 0 | 1 | 1.2 | 1.5 */
export function flipScoreListingMultiplier(flipScore: number | null | undefined): number {
  if (flipScore == null) return 1;
  const fs = Number(flipScore);
  if (!Number.isFinite(fs)) return 1;
  if (fs < 5) return 0;
  if (fs < 7) return 1;
  if (fs < 8.5) return 1.2;
  return 1.5;
}

/** @returns 0 | 0.2 | 0.5 */
export function flipScoreSaleBoostFraction(flipScore: number | null | undefined): number {
  if (flipScore == null) return 0;
  const fs = Number(flipScore);
  if (!Number.isFinite(fs) || fs < 7) return 0;
  if (fs < 8.5) return 0.2;
  return 0.5;
}

export function computeListingSavvyAfterFlipScore(fromAi: boolean, flipScore: number): number {
  const base = listingBonusPoints(fromAi);
  const m = flipScoreListingMultiplier(flipScore);
  return Math.round(base * m);
}

/**
 * Upper bound Savvy (listing + sale stack at best ROI tier) for copy on deal cards.
 */
export function estimateMaxSavvyPointsForFlip(opts: {
  flipScore?: number | null;
  fromAi?: boolean;
  isPremium?: boolean;
}): number {
  const fs = Number(opts.flipScore);
  const fromAi = Boolean(opts.fromAi);
  const premium = Boolean(opts.isPremium);
  const listing = computeListingSavvyAfterFlipScore(fromAi, Number.isFinite(fs) ? fs : 0);
  const core = SALE_COMPLETE + SMART_PRICING + SPEED_BONUS;
  const frac = flipScoreSaleBoostFraction(fs);
  const boostedCore = Math.round(core * (1 + frac));
  const maxRoi = premium ? 2.15 : 2.0;
  const saleCap = Math.round(boostedCore * maxRoi);
  return listing + saleCap;
}

/**
 * Scout Flight Tournament Mode — configurable rewards, limits, and validation.
 */

const RUN_TIMEOUT_MS = 15 * 60 * 1000;
const MIN_RUN_MS = 3000;
const MAX_SCORE = 10000;
const MAX_SCORE_PER_SECOND = 18;

/** Savvy earned by final tournament score (beta tiers). */
const SCORE_REWARD_TIERS = Object.freeze([
  { minScore: 200, savvy: 300, label: '200+ score = 300 Savvy' },
  { minScore: 100, savvy: 150, label: '100+ score = 150 Savvy' },
  { minScore: 50, savvy: 75, label: '50+ score = 75 Savvy' },
  { minScore: 25, savvy: 25, label: '25+ score = 25 Savvy' },
  { minScore: 0, savvy: 0, label: 'Below 25 = 0 Savvy' },
]);

function resolveSavvyForScore(score) {
  const n = Math.max(0, Math.round(Number(score) || 0));
  for (const tier of SCORE_REWARD_TIERS) {
    if (n >= tier.minScore) return tier.savvy;
  }
  return 0;
}

function getRewardTierPreview() {
  return SCORE_REWARD_TIERS.filter((t) => t.minScore > 0)
    .sort((a, b) => a.minScore - b.minScore)
    .map((t) => ({ ...t }));
}

function getUtcDayKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function getUtcWeekStart(date = new Date()) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay();
  const diff = day === 0 ? 6 : day - 1;
  d.setUTCDate(d.getUTCDate() - diff);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function getUtcMonthStart(date = new Date()) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1, 0, 0, 0, 0));
}

function getPeriodStart(period) {
  const key = String(period || 'daily').toLowerCase();
  if (key === 'alltime' || key === 'all') return null;
  if (key === 'monthly' || key === 'month') return getUtcMonthStart();
  if (key === 'weekly' || key === 'week') return getUtcWeekStart();
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  return today;
}

module.exports = {
  RUN_TIMEOUT_MS,
  MIN_RUN_MS,
  MAX_SCORE,
  MAX_SCORE_PER_SECOND,
  SCORE_REWARD_TIERS,
  resolveSavvyForScore,
  getRewardTierPreview,
  getUtcDayKey,
  getUtcWeekStart,
  getUtcMonthStart,
  getPeriodStart,
};

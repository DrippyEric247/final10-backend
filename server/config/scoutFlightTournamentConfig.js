/**
 * Scout Flight Tournament Mode — configurable rewards, limits, and validation.
 */

/**
 * Runs must be able to outlast the 30-minute Nuke Flight threshold plus a long
 * Nuke survival tail, so the window is far wider than the original 15 minutes.
 */
const RUN_TIMEOUT_MS = Number(process.env.SCOUT_FLIGHT_RUN_TIMEOUT_MS) || 75 * 60 * 1000;
const MIN_RUN_MS = 3000;

/** Floor for the per-run score ceiling — short runs keep the original limit. */
const MAX_SCORE = 10000;

/** Hard ceiling no run may ever exceed, however long it lasted. */
const MAX_SCORE_ABSOLUTE = Number(process.env.SCOUT_FLIGHT_MAX_SCORE_ABSOLUTE) || 400000;

const MAX_SCORE_PER_SECOND = 18;

/**
 * Score ceiling for a run of a given duration.
 *
 * A flat 10,000 cap would reject a legitimate 35-minute flight, so the ceiling
 * scales with duration at the same plausible-rate limit used for cheat detection.
 * @param {number} elapsedMs
 * @returns {number}
 */
function resolveMaxScoreForElapsed(elapsedMs) {
  const seconds = Math.max(0, Number(elapsedMs) || 0) / 1000;
  const byDuration = Math.ceil(seconds * MAX_SCORE_PER_SECOND);
  return Math.min(MAX_SCORE_ABSOLUTE, Math.max(MAX_SCORE, byDuration));
}

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
  MAX_SCORE_ABSOLUTE,
  MAX_SCORE_PER_SECOND,
  resolveMaxScoreForElapsed,
  SCORE_REWARD_TIERS,
  resolveSavvyForScore,
  getRewardTierPreview,
  getUtcDayKey,
  getUtcWeekStart,
  getUtcMonthStart,
  getPeriodStart,
};

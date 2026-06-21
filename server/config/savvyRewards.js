/**
 * Single source of truth for Savvy (wallet) reward amounts on the server.
 * Tier multipliers come from subscriptionPlans `multiplier` — not `dailyLoginBonus`.
 */
const { getTierConfig, normalizeTier } = require('./subscriptionPlans');

const SAVVY_REWARD_TYPES = Object.freeze({
  DAILY_LOGIN: 'daily_login',
  STREAK_BONUS: 'streak_bonus',
  ONBOARDING_FIRST_MOVE: 'onboarding_first_move',
  DAILY_TASK_LEGACY: 'daily_task_legacy',
  SCOUT_MISSION: 'scout_mission',
});

const REWARDS = Object.freeze({
  daily_login: {
    baseSavvy: 20,
    /** Legacy profile "points" field (not wallet Savvy) */
    legacyPoints: 50,
    battlePassXp: 25,
  },
  onboarding_first_move: {
    baseSavvy: 25,
  },
  /** Flat Savvy added when login streak hits these day counts (once per milestone per claim day) */
  streak_milestones: Object.freeze([
    { minDays: 3, bonusSavvy: 5 },
    { minDays: 7, bonusSavvy: 15 },
    { minDays: 14, bonusSavvy: 30 },
    { minDays: 30, bonusSavvy: 75 },
  ]),
});

function utcDayKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function yesterdayKey(dayKey) {
  const d = new Date(`${dayKey}T12:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

function getTierSavvyMultiplier(tier) {
  const cfg = getTierConfig(normalizeTier(tier));
  const mult = Number(cfg.multiplier);
  return Number.isFinite(mult) && mult > 0 ? mult : 1;
}

function computeStreakBonusSavvy(streakDays) {
  const days = Math.max(0, Math.floor(Number(streakDays) || 0));
  let bonus = 0;
  for (const row of REWARDS.streak_milestones) {
    if (days >= row.minDays) bonus = row.bonusSavvy;
  }
  return bonus;
}

/**
 * @param {string} tier
 * @param {number} streakDays
 * @returns {{ baseSavvy: number, tierMultiplier: number, streakBonusSavvy: number, totalSavvy: number }}
 */
function computeDailyLoginSavvy(tier, streakDays = 0) {
  const baseSavvy = REWARDS.daily_login.baseSavvy;
  const tierMultiplier = getTierSavvyMultiplier(tier);
  const streakBonusSavvy = computeStreakBonusSavvy(streakDays);
  const scaledBase = Math.round(baseSavvy * tierMultiplier);
  const totalSavvy = scaledBase + streakBonusSavvy;
  return { baseSavvy, tierMultiplier, streakBonusSavvy, scaledBase, totalSavvy };
}

module.exports = {
  SAVVY_REWARD_TYPES,
  REWARDS,
  utcDayKey,
  yesterdayKey,
  getTierSavvyMultiplier,
  computeStreakBonusSavvy,
  computeDailyLoginSavvy,
};

/**
 * Single source of truth for Savvy Point earnings multiplier.
 *
 * CORE = min(CAP, power + Σ additive bonuses)
 * EFFECTIVE = CORE × specialCombined (Double/Triple Points, Mythic 3×, …)
 * FINAL SAVVY = round(base × EFFECTIVE)
 */

const { normalizeTier } = require('../config/subscriptionPlans');
const { getTierConfigForUser } = require('./betaTesterService');
const { applyTierEventMultiplier } = require('../lib/pointsEventMultipliers');
const {
  isDoublePointsLive,
  isTriplePointsLive,
} = require('./eventActivationService');
const {
  CORE_MULTIPLIER_CAP,
  POWER_EARNINGS_FLOOR,
  MYTHIC_SAVVY_MULTIPLIER,
  MYTHIC_SAVVY_DURATION_MS,
  MYTHIC_EVENT_STACKING_POLICY,
  YEARLY_SUBSCRIPTION_ADDITIVE_BONUS,
  ROUND_SAVVY_REWARD,
  ROUND_MULTIPLIER,
  ecosystemAdditiveBonus,
  dealStreakAdditiveBonus,
} = require('../config/savvyMultiplierConfig');

/** Display cap aligned with power bar. */
const POWER_MULTIPLIER_CAP = 5.5;

function ensureSavvyEarningBoosts(user) {
  if (!user.savvyEarningBoosts || typeof user.savvyEarningBoosts !== 'object') {
    user.savvyEarningBoosts = {};
  }
  return user.savvyEarningBoosts;
}

function ensureDealStreak(user) {
  if (!user.dealStreak || typeof user.dealStreak !== 'object') {
    user.dealStreak = { currentDealStreak: 0 };
  }
  return user.dealStreak;
}

function readPowerMultiplier(user) {
  const base = Math.max(POWER_EARNINGS_FLOOR, Number(user?.powerMultiplier) || 1);
  const bonus = Math.max(0, Number(user?.powerMultiplierBonus) || 0);
  return ROUND_MULTIPLIER(Math.min(POWER_MULTIPLIER_CAP, base + bonus));
}

function readSubscriptionAdditiveBonus(user) {
  const tierCfg = getTierConfigForUser(user);
  const tierMult = Math.max(1, Number(tierCfg?.multiplier) || 1);
  return ROUND_MULTIPLIER(Math.max(0, tierMult - 1));
}

function readEcosystemAdditiveBonus(user) {
  const eco = user?.savvyEcosystem;
  if (!eco || typeof eco !== 'object') return 0;
  const connected = [eco.savvyTrip, eco.ezStay, eco.aiGo].filter(Boolean).length;
  return ROUND_MULTIPLIER(ecosystemAdditiveBonus(connected));
}

function readDealStreakAdditiveBonus(user) {
  const ds = ensureDealStreak(user);
  return dealStreakAdditiveBonus(ds.currentDealStreak);
}

function readYearlySubscriptionBonus(user) {
  const sub = user?.subscription;
  if (!sub || typeof sub !== 'object') return 0;
  if (String(sub.billing || '').toLowerCase() !== 'yearly') return 0;
  return ROUND_MULTIPLIER(YEARLY_SUBSCRIPTION_ADDITIVE_BONUS);
}

function readMythicSavvyBoost(user) {
  const boost = user?.savvyEarningBoosts?.mythic3x;
  if (!boost || !boost.expiresAt) {
    return { active: false, multiplier: 1, expiresAt: null, activatedAt: null };
  }
  const expiresAt = new Date(boost.expiresAt);
  if (expiresAt.getTime() <= Date.now()) {
    return { active: false, multiplier: 1, expiresAt, activatedAt: boost.activatedAt || null };
  }
  return {
    active: true,
    multiplier: Math.max(1, Number(boost.multiplier) || MYTHIC_SAVVY_MULTIPLIER),
    expiresAt,
    activatedAt: boost.activatedAt ? new Date(boost.activatedAt) : null,
  };
}

function readActiveGlobalEvent(user) {
  const tier = normalizeTier(user?.subscription?.tier || user?.membershipTier || 'free');
  if (isTriplePointsLive()) {
    return {
      eventKey: 'triple_points',
      eventLabel: 'Triple Points',
      multiplier: applyTierEventMultiplier(3, tier),
      active: true,
    };
  }
  if (isDoublePointsLive()) {
    return {
      eventKey: 'double_points',
      eventLabel: 'Double Points',
      multiplier: applyTierEventMultiplier(2, tier),
      active: true,
    };
  }
  return {
    eventKey: null,
    eventLabel: null,
    multiplier: 1,
    active: false,
  };
}

function resolveAdditiveBonuses(user) {
  const tier = normalizeTier(user?.subscription?.tier || user?.membershipTier || 'free');
  const subscriptionAmount = readSubscriptionAdditiveBonus(user);
  const ecosystemAmount = readEcosystemAdditiveBonus(user);
  const streakInfo = readDealStreakAdditiveBonus(user);
  const yearlyAmount = readYearlySubscriptionBonus(user);

  const bonuses = [];

  if (subscriptionAmount > 0) {
    bonuses.push({
      type: 'subscription',
      label: `${tier.charAt(0).toUpperCase() + tier.slice(1)} Bonus`,
      amount: subscriptionAmount,
      source: tier,
    });
  }

  if (yearlyAmount > 0) {
    bonuses.push({
      type: 'yearly_subscription',
      label: 'Yearly Plan Bonus',
      amount: yearlyAmount,
      source: 'yearly_billing',
    });
  }

  if (ecosystemAmount > 0) {
    bonuses.push({
      type: 'ecosystem',
      label: 'Savvy Ecosystem',
      amount: ecosystemAmount,
      source: 'connected_apps',
    });
  }

  if (streakInfo.amount > 0) {
    bonuses.push({
      type: 'deal_streak',
      label: streakInfo.label,
      amount: streakInfo.amount,
      source: `streak_${streakInfo.minStreak}+`,
    });
  }

  return bonuses;
}

function resolveSpecialMultipliers(user) {
  const list = [];
  const event = readActiveGlobalEvent(user);
  if (event.active) {
    list.push({
      type: 'global_event',
      label: event.eventLabel,
      multiplier: event.multiplier,
      expiresAt: null,
      source: event.eventKey,
    });
  }

  const mythic = readMythicSavvyBoost(user);
  if (mythic.active) {
    list.push({
      type: 'mythic_3x',
      label: 'Mythic 3× Earnings',
      multiplier: mythic.multiplier,
      expiresAt: mythic.expiresAt,
      source: 'mythic_egg',
    });
  }

  if (list.length === 0) {
    return { combined: 1, list: [] };
  }

  if (list.length === 1) {
    return { combined: ROUND_MULTIPLIER(list[0].multiplier), list };
  }

  if (MYTHIC_EVENT_STACKING_POLICY === 'multiply_all') {
    const combined = ROUND_MULTIPLIER(list.reduce((acc, item) => acc * item.multiplier, 1));
    return { combined, list };
  }

  // Default: max_multiplier — prevents Mythic 3× × Triple Points blow-up
  const combined = ROUND_MULTIPLIER(Math.max(...list.map((item) => item.multiplier)));
  return { combined, list, stackingPolicy: MYTHIC_EVENT_STACKING_POLICY };
}

function resolveCoreMultiplier(user) {
  const powerMultiplier = readPowerMultiplier(user);
  const additiveBonuses = resolveAdditiveBonuses(user);
  const additiveSum = ROUND_MULTIPLIER(
    additiveBonuses.reduce((sum, b) => sum + b.amount, 0)
  );
  const uncapped = ROUND_MULTIPLIER(powerMultiplier + additiveSum);
  const coreMultiplier = ROUND_MULTIPLIER(Math.min(CORE_MULTIPLIER_CAP, uncapped));
  const capApplied = uncapped > CORE_MULTIPLIER_CAP + 1e-9;

  return {
    powerMultiplier,
    additiveBonuses,
    additiveSum,
    uncappedCore: uncapped,
    coreMultiplier,
    capApplied,
  };
}

/**
 * @returns Full authoritative multiplier state for API + payouts.
 */
function resolveSavvyMultiplierState(user) {
  const core = resolveCoreMultiplier(user);
  const special = resolveSpecialMultipliers(user);
  const effectiveMultiplier = ROUND_MULTIPLIER(core.coreMultiplier * special.combined);

  return {
    powerMultiplier: core.powerMultiplier,
    additiveBonuses: core.additiveBonuses,
    coreMultiplier: core.coreMultiplier,
    uncappedCore: core.uncappedCore,
    capApplied: core.capApplied,
    coreMultiplierCap: CORE_MULTIPLIER_CAP,
    specialMultipliers: special.list,
    specialCombined: special.combined,
    specialStackingPolicy: special.stackingPolicy || null,
    effectiveMultiplier,
    // Back-compat fields consumed by existing client hooks
    dealEffectiveMultiplier: effectiveMultiplier,
    subscriptionTierMultiplier: ROUND_MULTIPLIER(1 + readSubscriptionAdditiveBonus(user)),
    eventActive: special.list.some((s) => s.type === 'global_event'),
    eventKey: special.list.find((s) => s.type === 'global_event')?.source || null,
    eventLabel: special.list.find((s) => s.type === 'global_event')?.label || null,
    eventMultiplier: special.list.find((s) => s.type === 'global_event')?.multiplier || 1,
    stackingFormula:
      'effective = min(CORE_CAP, power + Σ additives) × specialCombined; specialCombined uses max(mythic, event) by default',
  };
}

/**
 * Apply authoritative multiplier to a trust-adjusted base Savvy amount.
 */
function applySavvyMultiplier(baseSavvy, user) {
  const base = Math.max(0, Number(baseSavvy) || 0);
  const state = resolveSavvyMultiplierState(user);
  const coreSavvy = ROUND_SAVVY_REWARD(base * state.coreMultiplier);
  const totalSavvy = ROUND_SAVVY_REWARD(base * state.effectiveMultiplier);
  const specialBonusSavvy = Math.max(0, totalSavvy - coreSavvy);

  return {
    baseSavvy: base,
    coreSavvy,
    specialBonusSavvy,
    totalSavvy,
    coreMultiplier: state.coreMultiplier,
    effectiveMultiplier: state.effectiveMultiplier,
    specialCombined: state.specialCombined,
    capApplied: state.capApplied,
    state,
    // Back-compat for dealRewardService audit fields
    preEventTotal: coreSavvy,
    eventBonus: specialBonusSavvy,
    tierMultiplier: state.subscriptionTierMultiplier,
    eventMultiplier: state.specialCombined,
    eventKey: state.eventKey,
    eventLabel: state.eventLabel,
  };
}

/** @deprecated use applySavvyMultiplier */
function applyDealMultiplier(baseSavvy, user) {
  return applySavvyMultiplier(baseSavvy, user);
}

function activateMythicSavvyMultiplier(user, options = {}) {
  const durationMs = Number(options.durationMs) || MYTHIC_SAVVY_DURATION_MS;
  const multiplier = Math.max(1, Number(options.multiplier) || MYTHIC_SAVVY_MULTIPLIER);
  const boosts = ensureSavvyEarningBoosts(user);
  const now = new Date();
  boosts.mythic3x = {
    multiplier,
    activatedAt: now,
    expiresAt: new Date(now.getTime() + durationMs),
  };
  if (typeof user.markModified === 'function') {
    user.markModified('savvyEarningBoosts');
  }
  return boosts.mythic3x;
}

function clearExpiredSavvyBoosts(user) {
  const mythic = readMythicSavvyBoost(user);
  if (!mythic.active && user?.savvyEarningBoosts?.mythic3x?.expiresAt) {
    if (new Date(user.savvyEarningBoosts.mythic3x.expiresAt).getTime() <= Date.now()) {
      delete user.savvyEarningBoosts.mythic3x;
      if (typeof user.markModified === 'function') {
        user.markModified('savvyEarningBoosts');
      }
      return true;
    }
  }
  return false;
}

/** @deprecated */
function readSubscriptionTierMultiplier(user) {
  return ROUND_MULTIPLIER(1 + readSubscriptionAdditiveBonus(user));
}

/** @deprecated */
function resolveDealEffectiveMultiplier(user) {
  const state = resolveSavvyMultiplierState(user);
  return {
    tierMult: state.subscriptionTierMultiplier,
    event: {
      eventKey: state.eventKey,
      eventLabel: state.eventLabel,
      multiplier: state.specialCombined,
      active: state.eventActive,
    },
    effectiveMultiplier: state.effectiveMultiplier,
  };
}

/** @deprecated */
function readActiveEvent(user) {
  return readActiveGlobalEvent(user);
}

module.exports = {
  POWER_MULTIPLIER_CAP,
  readPowerMultiplier,
  readSubscriptionTierMultiplier,
  readActiveEvent,
  resolveDealEffectiveMultiplier,
  resolveSavvyMultiplierState,
  resolveCoreMultiplier,
  resolveAdditiveBonuses,
  resolveSpecialMultipliers,
  applySavvyMultiplier,
  applyDealMultiplier,
  activateMythicSavvyMultiplier,
  clearExpiredSavvyBoosts,
  readMythicSavvyBoost,
};

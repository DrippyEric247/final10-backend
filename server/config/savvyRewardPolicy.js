/**
 * Authoritative Savvy reward eligibility registry.
 *
 * PROGRESSION / SUBSCRIPTION / STREAK / EGG / EVENT → builds effectiveMultiplier
 * QUALIFYING EARNING ACTION → applies effectiveMultiplier
 * FIXED REWARD → pays advertised baseAmount exactly (appliedMultiplier = 1)
 */

const REWARD_CLASS = Object.freeze({
  FIXED: 'fixed',
  EARNING: 'earning',
});

/** Sources that pay the advertised amount — never global earning multiplier. */
const FIXED_SOURCES = new Set([
  // Perk Machine
  'perk_machine',
  'perk_machine_calling_card_duplicate',
  'perk_machine_hatch',
  'perk_machine_refund',
  'admin_perk_machine_grant',
  // Feature voting / community
  'feature_vote_reward',
  'home_feature_voting',
  'beta_community_review',
  'beta_feedback',
  // Login streak / daily
  'daily_login',
  'daily_streak',
  'streak_bonus',
  'streak_comeback',
  'streak_hidden',
  'streak_milestone',
  'daily_streak_admin',
  // Battle Pass
  'battle_pass',
  'battle_pass_mission',
  // Founding / promos / referrals
  'founding_tester_grand',
  'founding_tester_mission',
  'trailer_promo',
  'easter_egg',
  'referral_referrer',
  'referral_referee',
  'referral_manual_grant',
  // Fixed bonuses / admin
  'fixed_admin_grant',
  'fixed_bonus',
  'admin',
  'admin_simulate',
  'community_goal',
  'community_mission',
  'supply_drop',
  'scout_mission',
  'event_reward',
  'egg_exchange',
  'egg_hatch_token',
  'mythic_bp_skip_conversion',
  'easter_challenge',
  // Business offers (flat offer math, not deal multiplier pipeline)
  'offer_claim_reward',
  'private_offer_claim',
  'private_offer_conversion',
  'flip_listing_bonus',
  'flip_sale_stack',
  // Scout Flight nuke bonus (fixed advertised amount — do not alter nuke logic)
  'scout_flight_nuke',
  // Savvy Watch live stream participation
  'savvy_watch',
  'savvy_watch_join',
  'savvy_watch_checkpoint',
  'savvy_watch_live_code',
  'savvy_watch_competition',
  'savvy_watch_host_award',
  // Legacy profile points — not wallet savvy
  'savvy_credit_convert',
  'savvy_store_redeem',
]);

/** Qualifying economic/gameplay activity — uses authoritative effectiveMultiplier. */
const EARNING_SOURCES = new Set([
  'deal_purchase',
  'deal_completion',
  'deal_reward',
  'auction_win',
  'auction_reward',
  'alert_trigger',
  'watch_listing',
  'flip_reward',
  'ebay',
  'scout_flight_tournament',
  'scout_flight_championship',
  'scout_flight_reward',
  'promotions_deal',
]);

const SOURCE_ALIASES = Object.freeze({
  deal_purchase_confirm: 'deal_purchase',
  contract_completed: 'contract_reward',
});

function normalizeSource(source, rewardType) {
  const raw = String(rewardType || source || 'unknown')
    .trim()
    .toLowerCase();
  return SOURCE_ALIASES[raw] || raw;
}

/**
 * Resolve reward policy for a production source identifier.
 * @param {string} sourceOrRewardType
 * @param {{ rewardType?: string, rewardClass?: string, multiplierEligible?: boolean, meta?: object }} [options]
 */
function getRewardPolicy(sourceOrRewardType, options = {}) {
  const source = normalizeSource(sourceOrRewardType, options.rewardType);

  if (options.rewardClass === REWARD_CLASS.EARNING || options.multiplierEligible === true) {
    return {
      source,
      rewardClass: REWARD_CLASS.EARNING,
      multiplierEligible: true,
      reason: 'explicit_earning_config',
    };
  }

  if (
    options.rewardClass === REWARD_CLASS.FIXED ||
    options.multiplierEligible === false
  ) {
    return {
      source,
      rewardClass: REWARD_CLASS.FIXED,
      multiplierEligible: false,
      reason: 'explicit_fixed_config',
    };
  }

  if (EARNING_SOURCES.has(source)) {
    return {
      source,
      rewardClass: REWARD_CLASS.EARNING,
      multiplierEligible: true,
      reason: 'registry_earning',
    };
  }

  if (FIXED_SOURCES.has(source)) {
    return {
      source,
      rewardClass: REWARD_CLASS.FIXED,
      multiplierEligible: false,
      reason: 'registry_fixed',
    };
  }

  // contract_reward defaults fixed unless contract config marks earning-eligible
  if (source === 'contract_reward') {
    return {
      source,
      rewardClass: REWARD_CLASS.FIXED,
      multiplierEligible: false,
      reason: 'contract_default_fixed',
    };
  }

  // Safe default — never accidentally inflate unknown sources
  return {
    source,
    rewardClass: REWARD_CLASS.FIXED,
    multiplierEligible: false,
    reason: 'default_fixed',
  };
}

function isMultiplierEligible(sourceOrRewardType, options = {}) {
  return getRewardPolicy(sourceOrRewardType, options).multiplierEligible;
}

module.exports = {
  REWARD_CLASS,
  FIXED_SOURCES,
  EARNING_SOURCES,
  normalizeSource,
  getRewardPolicy,
  isMultiplierEligible,
};

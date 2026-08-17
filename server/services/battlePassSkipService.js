/**
 * Battle Pass tier skip — bulk skip + completed-pass Savvy conversion.
 * Follows existing skip semantics: unlock tiers via XP; rewards remain manually claimable.
 */
const { grantSavvyReward } = require('./savvyRewardService');
const { REWARD_CLASS } = require('../config/savvyRewardPolicy');

const COMPLETED_PASS_CONVERSION_SAVVY = 2000;

/**
 * @param {import('../models/User')} user
 * @param {number} tiers
 * @param {{ idempotencyKey: string, source?: string }} options
 */
async function applyBattlePassTierSkip(user, tiers, options = {}) {
  const skipTiers = Math.max(1, Math.round(Number(tiers) || 1));
  const idempotencyKey = String(options.idempotencyKey || '').trim();
  if (!idempotencyKey) {
    throw new Error('applyBattlePassTierSkip requires idempotencyKey');
  }

  const { ensureProgressDocuments } = require('./battlePassPersistenceService');
  const { adminGrantXp } = require('./battlePassClaimService');
  const {
    BATTLE_PASS_CUMULATIVE_XP,
    BATTLE_PASS_TIERS,
    computeTierFromXp,
    getBattlePassMaxXp,
  } = require('../lib/battlePassConfig');

  const { bp } = await ensureProgressDocuments(user._id);
  const currentXp = Number(bp.xp) || 0;
  const maxTier = BATTLE_PASS_TIERS.length;
  const currentTier = computeTierFromXp(currentXp);

  if (currentTier >= maxTier) {
    const conversion = await grantSavvyReward(user, {
      rewardType: 'mythic_bp_skip_conversion',
      amount: COMPLETED_PASS_CONVERSION_SAVVY,
      baseAmount: COMPLETED_PASS_CONVERSION_SAVVY,
      idempotencyKey: `${idempotencyKey}:conversion`,
      note: 'Mythic Battle Pass skip converted — pass already complete',
      meta: {
        source: options.source || 'mythic_bp_skip',
        rewardClass: REWARD_CLASS.FIXED,
        baseAmount: COMPLETED_PASS_CONVERSION_SAVVY,
        finalAmount: COMPLETED_PASS_CONVERSION_SAVVY,
        policySource: 'mythic_bp_skip_conversion',
        multiplierEligible: false,
      },
    });

    return {
      skipped: false,
      converted: true,
      duplicate: Boolean(conversion.duplicate),
      fromTier: currentTier,
      toTier: currentTier,
      savvyGranted: conversion.amount || 0,
      conversionSavvy: COMPLETED_PASS_CONVERSION_SAVVY,
    };
  }

  const targetTier = Math.min(currentTier + skipTiers, maxTier);
  let targetXp;
  if (targetTier >= maxTier) {
    targetXp = getBattlePassMaxXp();
  } else {
    targetXp = Number(BATTLE_PASS_CUMULATIVE_XP[targetTier - 1]) || currentXp;
  }

  const delta = Math.max(1, targetXp - currentXp);
  await adminGrantXp(String(user._id), delta);

  return {
    skipped: true,
    converted: false,
    fromTier: currentTier,
    toTier: targetTier,
    tiersApplied: targetTier - currentTier,
    xpGranted: delta,
  };
}

module.exports = {
  COMPLETED_PASS_CONVERSION_SAVVY,
  applyBattlePassTierSkip,
};

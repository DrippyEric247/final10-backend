const { SAVVY_REWARD_TYPES, REWARDS } = require('../config/savvyRewards');
const { grantSavvyReward } = require('./savvyRewardService');

/**
 * Grant Savvy for completing onboarding Best Move. Idempotent per user.
 */
async function claimOnboardingFirstMoveReward(user) {
  const rewardAmount = Math.max(
    1,
    Math.round(Number(REWARDS.onboarding_first_move.baseSavvy) || 0)
  );
  const idempotencyKey = `onboarding_first_move:${user._id}`;
  const oldBalance = Math.max(0, Math.round(Number(user.savvyPoints) || 0));

  const grant = await grantSavvyReward(user, {
    rewardType: SAVVY_REWARD_TYPES.ONBOARDING_FIRST_MOVE,
    amount: rewardAmount,
    idempotencyKey,
    note: 'Onboarding first Best Move bonus',
    meta: { source: 'onboarding_best_move' },
  });

  if (grant.duplicate) {
    return {
      ok: false,
      granted: false,
      alreadyClaimed: true,
      duplicate: true,
      added: 0,
      rewardSavvy: 0,
      newBalance: grant.newBalance,
      message: 'Onboarding reward already claimed.',
    };
  }

  if (grant.granted) {
    await user.save();
    console.log('[onboardingReward] first move granted', {
      userId: String(user._id),
      rewardAmount: grant.amount,
      oldBalance,
      newBalance: grant.newBalance,
    });
  }

  return {
    ok: grant.granted,
    granted: grant.granted,
    alreadyClaimed: false,
    duplicate: false,
    added: grant.amount,
    rewardSavvy: grant.amount,
    newBalance: grant.newBalance,
    message: grant.granted
      ? `+${grant.amount} Savvy added to your wallet`
      : 'No reward granted.',
  };
}

module.exports = { claimOnboardingFirstMoveReward };

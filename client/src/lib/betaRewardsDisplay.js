/**
 * Beta-mode reward display — suppress "Rewards locked" and show positive beta copy.
 */

import { isBetaModeActive } from './betaModeAccess';
import { isBetaTester } from './betaTesterAccess';
import { getDevFeatureTests, isDev } from './devOverride';
import { computeSavvyReward } from '../components/rewards/SavvyRewardBadge';

/** Trust score used when beta unlocks low/unverified listings for display. */
export const BETA_REWARD_DISPLAY_TRUST_SCORE = 60;

export function isRewardsLockedTier(tier) {
  return tier === 'low' || tier === 'unverified';
}

/** True when beta mode should hide lock messaging (unless dev override is on). */
export function shouldSuppressRewardsLocked() {
  if (!isBetaModeActive()) return false;
  if (isDev && getDevFeatureTests().showRewardsLocked) return false;
  return true;
}

export function shouldShowRewardsLocked(tier) {
  if (!isRewardsLockedTier(tier)) return false;
  if (shouldSuppressRewardsLocked()) return false;
  return true;
}

export function getBetaRewardsActiveLabel(user = null, entitlement = null) {
  if (isBetaTester(user, entitlement)) return 'Founding Tester Rewards Active';
  if (isBetaModeActive()) return 'Beta Mode — All Rewards Enabled';
  return 'Beta Rewards Active';
}

export function getBetaRewardsCompactLabel(user = null, entitlement = null) {
  if (isBetaTester(user, entitlement)) return 'Founding Tester Rewards Active';
  return 'Beta Rewards Active';
}

/**
 * During beta, low/unverified tiers render as medium-trust estimates with positive copy.
 * Amounts are resolved server-side by SavvyRewardBadge — this only adjusts lock state.
 */
export function applyBetaRewardUnlock({
  reward,
  baseSavvy,
  trustScore,
  price,
  savings,
}) {
  const wouldLock = isRewardsLockedTier(reward.tier);
  if (!wouldLock) {
    return { reward, rewardsLocked: false, betaUnlocked: false, betaLabel: null };
  }
  if (shouldShowRewardsLocked(reward.tier)) {
    return { reward, rewardsLocked: true, betaUnlocked: false, betaLabel: null };
  }
  const unlocked = computeSavvyReward({
    baseSavvy,
    trustScore: BETA_REWARD_DISPLAY_TRUST_SCORE,
    price,
    savings,
  });
  return {
    reward: { ...reward, ...unlocked, tier: 'medium' },
    rewardsLocked: false,
    betaUnlocked: true,
    betaLabel: getBetaRewardsActiveLabel(),
  };
}

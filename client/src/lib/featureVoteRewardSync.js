/**
 * Apply authoritative Feature Vote reward from POST /beta-community/vote response.
 */
import { applyServerSavvyBalance } from './applyServerSavvyBalance';
import { WALLET_AWARD_EVENT } from '@savvy/core/events/universeEvents';
import { FEATURE_VOTE_REWARD_TYPE } from '@savvy/core/config/featureVoting';

export function syncFeatureVoteRewardFromResponse(patchUser, response, currentBalance) {
  if (typeof patchUser !== 'function' || !response) return false;

  const reward = response.reward;
  const newBalance =
    reward?.newBalance != null
      ? Math.round(Number(reward.newBalance))
      : response.savvyBalance != null
        ? Math.round(Number(response.savvyBalance))
        : null;

  if (newBalance == null || !Number.isFinite(newBalance)) return false;

  const amountAdded =
    reward?.amount != null ? Math.round(Number(reward.amount) || 0) : undefined;

  applyServerSavvyBalance(patchUser, newBalance, {
    source: FEATURE_VOTE_REWARD_TYPE,
    oldValue: currentBalance,
    amountAdded,
  });

  if (amountAdded > 0 && typeof window !== 'undefined') {
    try {
      window.dispatchEvent(
        new CustomEvent(WALLET_AWARD_EVENT, {
          detail: {
            amount: amountAdded,
            type: FEATURE_VOTE_REWARD_TYPE,
            mirrorOnly: false,
          },
        })
      );
    } catch {
      /* ignore */
    }
  }

  return true;
}

import { syncFeatureVoteRewardFromResponse } from '../featureVoteRewardSync';
import { FEATURE_VOTE_REWARD_TYPE } from '@savvy/core/config/featureVoting';

describe('syncFeatureVoteRewardFromResponse', () => {
  it('patches AuthContext balance from vote API response', () => {
    const patches = [];
    const patchUser = (partial) => patches.push(partial);

    const synced = syncFeatureVoteRewardFromResponse(
      patchUser,
      { reward: { amount: 15, newBalance: 215 } },
      200
    );

    expect(synced).toBe(true);
    expect(patches).toHaveLength(1);
    expect(patches[0].savvyPointsServerBase).toBe(215);
    expect(patches[0].savvyPoints).toBe(215);
  });

  it('returns false when response has no balance', () => {
    const patchUser = jest.fn();
    expect(syncFeatureVoteRewardFromResponse(patchUser, {}, 100)).toBe(false);
    expect(patchUser).not.toHaveBeenCalled();
  });

  it('dispatches wallet award event when amount is granted', () => {
    const events = [];
    const listener = (e) => events.push(e.detail);
    window.addEventListener('f10:savvy-wallet-award', listener);

    syncFeatureVoteRewardFromResponse(
      () => {},
      { reward: { amount: 15, newBalance: 115 } },
      100
    );

    window.removeEventListener('f10:savvy-wallet-award', listener);
    expect(events[0]).toMatchObject({ amount: 15, type: FEATURE_VOTE_REWARD_TYPE });
  });
});

const { verifySavvyWatchHandlers } = require('../services/savvyWatchHandlerCheck');
const { requireGrantSavvyReward } = require('../services/savvyWatchRewardService');
const { SAVVY_WATCH_REWARD_SOURCES } = require('../config/savvyWatchConfig');
const { getRewardPolicy, REWARD_CLASS } = require('../config/savvyRewardPolicy');

describe('savvyWatch handler wiring', () => {
  test('typeof grantSavvyReward === "function" via lazy resolver', () => {
    expect(typeof requireGrantSavvyReward()).toBe('function');
  });

  test('all Savvy Watch reward sources use FIXED policy', () => {
    for (const source of SAVVY_WATCH_REWARD_SOURCES) {
      const policy = getRewardPolicy(source);
      expect(policy).toBeTruthy();
      expect(policy.rewardClass).toBe(REWARD_CLASS.FIXED);
    }
  });

  test('startup handler check passes', () => {
    const result = verifySavvyWatchHandlers({ failOnError: false });
    expect(result.allValid).toBe(true);
    expect(result.grantSavvyReward).toBe('function');
    expect(result.savvyWatchSources).toBe(SAVVY_WATCH_REWARD_SOURCES.length);
  });
});

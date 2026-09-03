const { verifySavvyPredictionsHandlers } = require('../services/savvyPredictionsHandlerCheck');
const { requireGrantSavvyReward } = require('../services/savvyPredictionsRewardService');
const { SAVVY_PREDICTIONS_REWARD_SOURCES } = require('../config/savvyPredictionsConfig');
const { getRewardPolicy, REWARD_CLASS } = require('../config/savvyRewardPolicy');
const { findBracketOption, isLocked } = require('../services/savvyPredictionsService');

describe('savvyPredictions handler wiring', () => {
  test('typeof grantSavvyReward === "function" via lazy resolver', () => {
    expect(typeof requireGrantSavvyReward()).toBe('function');
  });

  test('all prediction reward sources use FIXED policy', () => {
    for (const source of SAVVY_PREDICTIONS_REWARD_SOURCES) {
      const policy = getRewardPolicy(source);
      expect(policy).toBeTruthy();
      expect(policy.rewardClass).toBe(REWARD_CLASS.FIXED);
    }
  });

  test('startup handler check passes', () => {
    const result = verifySavvyPredictionsHandlers({ failOnError: false });
    expect(result.allValid).toBe(true);
    expect(result.grantSavvyReward).toBe('function');
  });
});

describe('savvyPredictions bracket resolution', () => {
  const options = [
    { optionId: 'a', label: 'Under 9.00', min: null, max: 8.999 },
    { optionId: 'b', label: '9.00–9.49', min: 9.0, max: 9.49 },
    { optionId: 'c', label: '9.50+', min: 9.5, max: null },
  ];

  test('findBracketOption matches numeric value', () => {
    expect(findBracketOption(options, 9.21)).toBe('b');
    expect(findBracketOption(options, 9.55)).toBe('c');
  });

  test('isLocked respects server locksAt', () => {
    const prediction = { status: 'open', locksAt: new Date(Date.now() - 1000) };
    expect(isLocked(prediction)).toBe(true);
  });
});

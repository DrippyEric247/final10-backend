/**
 * Final10 → Savvy Core thin adapter (V1 compatibility layer).
 * Wraps proven Final10 reward paths without importing deal/auction models here.
 */
const { SAVVY_APP_IDS } = require('../../config/savvyCoreConfig');
const { grantReward } = require('./savvyCoreRewardService');
const { progressAppContracts } = require('./savvyCoreContractService');

const FINAL10_APP = SAVVY_APP_IDS.FINAL10;

async function final10GrantSavvyReward(userId, { amount, reason, idempotencyKey, metadata = {} } = {}) {
  return grantReward({
    userId,
    appId: FINAL10_APP,
    rewardType: 'SAVVY',
    amount,
    source: reason || 'final10_reward',
    idempotencyKey,
    metadata,
  });
}

async function final10GrantAccountXp(userId, { amount, activityType, idempotencyKey, metadata = {} } = {}) {
  return grantReward({
    userId,
    appId: FINAL10_APP,
    rewardType: 'ACCOUNT_XP',
    amount,
    source: activityType || 'final10_activity',
    idempotencyKey,
    metadata,
  });
}

async function final10ProgressContract(userId, { trigger, increment = 1, metadata = {} } = {}) {
  return progressAppContracts({
    userId,
    sourceApp: FINAL10_APP,
    trigger,
    increment,
    metadata,
  });
}

module.exports = {
  FINAL10_APP,
  final10GrantSavvyReward,
  final10GrantAccountXp,
  final10ProgressContract,
};

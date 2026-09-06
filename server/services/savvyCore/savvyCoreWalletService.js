/**
 * Savvy Core V1 — canonical wallet interface (wraps proven production wallet path).
 */
const User = require('../../models/User');
const { resolveSavvyBalance } = require('../../lib/dataAuthority/savvyBalance');
const {
  assertAppPermission,
  buildCoreMeta,
  buildIdempotencyKey,
  SAVVY_PERMISSIONS,
  validateAppId,
} = require('../../config/savvyCoreConfig');

function requireGrantSavvyReward() {
  const { grantSavvyReward } = require('../savvyRewardService');
  if (typeof grantSavvyReward !== 'function') {
    throw new TypeError('grantSavvyReward is not a function');
  }
  return grantSavvyReward;
}

function requireSpendSavvyReward() {
  const { spendSavvyReward } = require('../savvyRewardService');
  if (typeof spendSavvyReward !== 'function') {
    throw new TypeError('spendSavvyReward is not a function');
  }
  return spendSavvyReward;
}

class SavvyCoreWalletError extends Error {
  constructor(status, code, message, details = {}) {
    super(message);
    this.name = 'SavvyCoreWalletError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

async function getSavvyBalance({ userId }) {
  const user = await User.findById(userId).lean();
  if (!user) throw new SavvyCoreWalletError(404, 'USER_NOT_FOUND', 'User not found.');
  return {
    userId: String(userId),
    balance: resolveSavvyBalance(user),
    lifetimeEarned: Math.round(Number(user.lifetimePointsEarned) || 0),
  };
}

async function earnSavvy({
  userId,
  amount,
  sourceApp,
  reason = 'earn',
  metadata = {},
  idempotencyKey,
  originApp = null,
  activityType = null,
}) {
  const appId = validateAppId(sourceApp);
  assertAppPermission(appId, SAVVY_PERMISSIONS.WALLET_EARN);

  const savvyAmount = Math.round(Number(amount) || 0);
  if (savvyAmount <= 0) {
    throw new SavvyCoreWalletError(400, 'INVALID_AMOUNT', 'Earn amount must be positive.');
  }
  if (savvyAmount > 100000) {
    throw new SavvyCoreWalletError(400, 'AMOUNT_CAP', 'Earn amount exceeds safety cap.');
  }

  const user = await User.findById(userId);
  if (!user) throw new SavvyCoreWalletError(404, 'USER_NOT_FOUND', 'User not found.');

  const key = idempotencyKey || buildIdempotencyKey(appId, 'wallet', userId, 'earn', reason);
  const meta = buildCoreMeta({
    sourceApp: appId,
    originApp: originApp || appId,
    activityType,
    rewardSource: reason,
    extra: metadata,
  });

  const result = await requireGrantSavvyReward()(user, {
    rewardType: 'savvy_core_earn',
    amount: savvyAmount,
    idempotencyKey: key,
    note: `Savvy Core earn — ${appId}:${reason}`,
    meta,
    applyRewardPolicy: true,
  });

  // eslint-disable-next-line no-console
  console.log('[CORE_WALLET_EARN]', JSON.stringify({
    appId,
    userId: String(userId),
    idempotencyKey: key,
    amount: result.granted ? savvyAmount : 0,
    duplicate: Boolean(result.duplicate),
    result: result.granted || result.duplicate ? 'ok' : 'rejected',
  }));

  return {
    granted: Boolean(result.granted),
    duplicate: Boolean(result.duplicate),
    savvyAmount: result.granted ? savvyAmount : 0,
    newBalance: result.newBalance,
    idempotencyKey: key,
    transactionId: result.transactionId || null,
  };
}

async function spendSavvy({
  userId,
  amount,
  sourceApp,
  reason = 'spend',
  metadata = {},
  idempotencyKey,
  originApp = null,
}) {
  const appId = validateAppId(sourceApp);
  assertAppPermission(appId, SAVVY_PERMISSIONS.WALLET_SPEND);

  const savvyAmount = Math.round(Number(amount) || 0);
  if (savvyAmount <= 0) {
    throw new SavvyCoreWalletError(400, 'INVALID_AMOUNT', 'Spend amount must be positive.');
  }

  const user = await User.findById(userId);
  if (!user) throw new SavvyCoreWalletError(404, 'USER_NOT_FOUND', 'User not found.');

  const key = idempotencyKey || buildIdempotencyKey(appId, 'wallet', userId, 'spend', reason);
  const meta = buildCoreMeta({
    sourceApp: appId,
    originApp: originApp || appId,
    rewardSource: reason,
    extra: metadata,
  });

  const result = await requireSpendSavvyReward()(user, {
    amount: savvyAmount,
    source: 'savvy_core_spend',
    idempotencyKey: key,
    note: `Savvy Core spend — ${appId}:${reason}`,
    meta,
  });

  // eslint-disable-next-line no-console
  console.log('[CORE_WALLET_SPEND]', JSON.stringify({
    appId,
    userId: String(userId),
    idempotencyKey: key,
    amount: result.spent ? savvyAmount : 0,
    duplicate: Boolean(result.duplicate),
    result: result.spent || result.duplicate ? 'ok' : 'rejected',
  }));

  return {
    spent: Boolean(result.spent),
    duplicate: Boolean(result.duplicate),
    savvyAmount: result.spent ? savvyAmount : 0,
    newBalance: result.newBalance,
    idempotencyKey: key,
    transactionId: result.transactionId || null,
  };
}

module.exports = {
  SavvyCoreWalletError,
  requireGrantSavvyReward,
  requireSpendSavvyReward,
  getSavvyBalance,
  earnSavvy,
  spendSavvy,
};

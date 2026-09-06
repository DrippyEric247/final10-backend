/**
 * Savvy Core V1 — account XP / level / prestige interface.
 */
const User = require('../../models/User');
const {
  assertAppPermission,
  buildCoreMeta,
  buildIdempotencyKey,
  SAVVY_PERMISSIONS,
  validateAppId,
} = require('../../config/savvyCoreConfig');
const { grantProfileXp, getProfileProgress } = require('../profileXpService');

class SavvyCoreProgressionError extends Error {
  constructor(status, code, message, details = {}) {
    super(message);
    this.name = 'SavvyCoreProgressionError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

async function getAccountProgression({ userId }) {
  const user = await User.findById(userId).lean();
  if (!user) throw new SavvyCoreProgressionError(404, 'USER_NOT_FOUND', 'User not found.');
  const progress = await getProfileProgress(userId);
  return {
    userId: String(userId),
    accountLevel: progress.profileLevel,
    prestige: progress.prestige,
    currentXP: progress.profileXp,
    xpToNext: progress.xpToNext,
    xpProgress: progress.xpProgress,
    rankName: progress.rankName,
    rankColor: progress.rankColor,
    accountProgression: progress.accountProgression,
  };
}

async function awardAccountXP({
  userId,
  amount,
  sourceApp,
  activityType = 'activity',
  metadata = {},
  idempotencyKey,
}) {
  const appId = validateAppId(sourceApp);
  assertAppPermission(appId, SAVVY_PERMISSIONS.XP_AWARD);

  const xpAmount = Math.round(Number(amount) || 0);
  if (xpAmount <= 0) {
    throw new SavvyCoreProgressionError(400, 'INVALID_AMOUNT', 'XP amount must be positive.');
  }
  if (xpAmount > 10000) {
    throw new SavvyCoreProgressionError(400, 'AMOUNT_CAP', 'XP amount exceeds safety cap.');
  }

  const user = await User.findById(userId);
  if (!user) throw new SavvyCoreProgressionError(404, 'USER_NOT_FOUND', 'User not found.');

  const source = `savvy_core:${appId}:${activityType}`;
  const key = idempotencyKey || buildIdempotencyKey(appId, 'xp', userId, activityType, metadata.refId || 'default');

  const result = await grantProfileXp(user, {
    amount: xpAmount,
    source,
    metadata: buildCoreMeta({
      sourceApp: appId,
      activityType,
      extra: metadata,
    }),
    idempotencyKey: key,
  });

  // eslint-disable-next-line no-console
  console.log('[CORE_XP_AWARD]', JSON.stringify({
    appId,
    userId: String(userId),
    idempotencyKey: key,
    amount: result.duplicate ? 0 : xpAmount,
    duplicate: Boolean(result.duplicate),
    result: 'ok',
  }));

  return {
    granted: !result.duplicate,
    duplicate: Boolean(result.duplicate),
    xpAmount: result.duplicate ? 0 : xpAmount,
    progression: result.progress || null,
    idempotencyKey: key,
  };
}

module.exports = {
  SavvyCoreProgressionError,
  getAccountProgression,
  awardAccountXP,
};

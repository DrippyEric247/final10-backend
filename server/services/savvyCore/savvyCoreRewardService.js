/**
 * Savvy Core V1 — unified reward grant dispatcher.
 */
const crypto = require('crypto');
const {
  assertAppPermission,
  validateAppId,
  SAVVY_PERMISSIONS,
  buildIdempotencyKey,
} = require('../../config/savvyCoreConfig');
const { isMultiplierEligible } = require('../../config/savvyRewardPolicy');
const { earnSavvy } = require('./savvyCoreWalletService');
const { awardAccountXP } = require('./savvyCoreProgressionService');
const { unlockCosmetic } = require('./savvyCoreCosmeticService');
const SavvyCoreAudit = require('../../models/SavvyCoreAudit');

const REWARD_FAMILIES = Object.freeze([
  'SAVVY',
  'ACCOUNT_XP',
  'CALLING_CARD',
  'EMBLEM',
  'CAMO',
  'TICKET',
  'PERK',
  'APP_UNLOCK',
]);

class SavvyCoreRewardError extends Error {
  constructor(status, code, message, details = {}) {
    super(message);
    this.name = 'SavvyCoreRewardError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

async function grantReward({
  userId,
  appId,
  rewardType,
  amount = 0,
  rewardId = null,
  metadata = {},
  source = 'grant',
  idempotencyKey,
}) {
  const sourceApp = validateAppId(appId);
  assertAppPermission(sourceApp, SAVVY_PERMISSIONS.REWARDS_GRANT);

  const family = String(rewardType || '').trim().toUpperCase();
  if (!REWARD_FAMILIES.includes(family)) {
    throw new SavvyCoreRewardError(400, 'INVALID_REWARD_TYPE', `Unsupported reward type: ${rewardType}`);
  }

  const key = idempotencyKey || buildIdempotencyKey(
    sourceApp,
    'reward',
    userId,
    family.toLowerCase(),
    rewardId || source
  );

  const multiplierEligible = isMultiplierEligible(`savvy_core_${family.toLowerCase()}`, { rewardType: `savvy_core_${family.toLowerCase()}` });

  let result;
  switch (family) {
    case 'SAVVY':
      result = await earnSavvy({
        userId,
        amount,
        sourceApp,
        reason: source,
        metadata: { ...metadata, rewardId, multiplierEligible },
        idempotencyKey: key,
      });
      break;
    case 'ACCOUNT_XP':
      result = await awardAccountXP({
        userId,
        amount,
        sourceApp,
        activityType: source,
        metadata: { ...metadata, rewardId },
        idempotencyKey: key,
      });
      break;
    case 'CALLING_CARD':
    case 'EMBLEM':
    case 'CAMO':
      result = await unlockCosmetic({
        userId,
        cosmeticId: rewardId || metadata.cosmeticId,
        sourceApp,
        sourceType: source,
        metadata,
        idempotencyKey: key,
        scopeType: metadata.scopeType || 'app',
        scopeId: metadata.scopeId || sourceApp,
        globalEquipEligible: Boolean(metadata.globalEquipEligible),
      });
      break;
    case 'TICKET':
    case 'PERK':
    case 'APP_UNLOCK':
      throw new SavvyCoreRewardError(501, 'NOT_IMPLEMENTED_V1', `${family} grants deferred to app-specific handlers in V1.`);
    default:
      throw new SavvyCoreRewardError(400, 'INVALID_REWARD_TYPE', `Unsupported reward type: ${rewardType}`);
  }

  await SavvyCoreAudit.create({
    auditId: `sca_${crypto.randomBytes(8).toString('hex')}`,
    userId,
    appId: sourceApp,
    action: 'reward_grant',
    resource: family,
    amount: Math.round(Number(amount) || 0) || null,
    source,
    idempotencyKey: key,
    status: result.duplicate ? 'duplicate' : 'completed',
    meta: { rewardType: family, rewardId, multiplierEligible, ...metadata },
  }).catch(() => {});

  // eslint-disable-next-line no-console
  console.log('[CORE_REWARD_GRANT]', JSON.stringify({
    appId: sourceApp,
    userId: String(userId),
    rewardType: family,
    idempotencyKey: key,
    duplicate: Boolean(result.duplicate),
    result: 'ok',
  }));

  return { rewardType: family, idempotencyKey: key, multiplierEligible, ...result };
}

module.exports = {
  SavvyCoreRewardError,
  REWARD_FAMILIES,
  grantReward,
};

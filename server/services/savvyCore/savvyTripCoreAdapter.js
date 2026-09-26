/**
 * SavvyTrip → Savvy Core adapter.
 * Always stamps sourceApp: savvytrip. Never trusts client app identity or balances.
 */
const { SAVVY_APP_IDS, validateAppId } = require('../../config/savvyCoreConfig');
const { getSavvyCoreMe } = require('./savvyCoreProfileService');
const { getSavvyBalance, earnSavvy } = require('./savvyCoreWalletService');
const { getAccountProgression, awardAccountXP } = require('./savvyCoreProgressionService');
const { progressAppContracts } = require('./savvyCoreContractService');
const { unlockCosmetic } = require('./savvyCoreCosmeticService');

const SOURCE_APP = SAVVY_APP_IDS.SAVVY_TRIP;

class SavvyTripCoreAdapterError extends Error {
  constructor(status, code, message, details = {}) {
    super(message);
    this.name = 'SavvyTripCoreAdapterError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

function stampCoreMeta({ sourceFeature, reason, referenceId, extra = {} } = {}) {
  return {
    sourceFeature: sourceFeature ? String(sourceFeature).slice(0, 128) : undefined,
    reason: reason ? String(reason).slice(0, 256) : undefined,
    referenceId: referenceId ? String(referenceId).slice(0, 128) : undefined,
    timestamp: new Date().toISOString(),
    ...extra,
  };
}

function assertCanonicalSourceApp(claimedSourceApp) {
  if (claimedSourceApp == null || claimedSourceApp === '') return SOURCE_APP;
  const claimed = String(claimedSourceApp).trim().toLowerCase();
  if (claimed !== SOURCE_APP) {
    throw new SavvyTripCoreAdapterError(
      403,
      'SOURCE_APP_IMPERSONATION_REJECTED',
      'SavvyTrip cannot impersonate another sourceApp. Server derives sourceApp=savvytrip.'
    );
  }
  return SOURCE_APP;
}

async function readSavvyTripCoreAccount(user) {
  if (!user) {
    throw new SavvyTripCoreAdapterError(401, 'MISSING_AUTH', 'Authentication required.');
  }
  const [me, wallet, progression] = await Promise.all([
    getSavvyCoreMe(user),
    getSavvyBalance({ userId: user._id }),
    getAccountProgression({ userId: user._id }),
  ]);
  return {
    sourceApp: SOURCE_APP,
    canonicalUserId: String(user._id),
    me,
    wallet,
    progression,
    syncedAt: new Date().toISOString(),
  };
}

async function awardSavvyFromSavvyTrip({
  userId,
  amount,
  sourceFeature,
  reason,
  referenceId,
  idempotencyKey,
  claimedSourceApp,
  claimedUserId,
  claimedBalance,
  claimedPrestige,
} = {}) {
  if (claimedUserId && String(claimedUserId) !== String(userId)) {
    throw new SavvyTripCoreAdapterError(403, 'FORGED_USER_ID', 'Client userId does not match authenticated Core user.');
  }
  if (claimedBalance != null) {
    throw new SavvyTripCoreAdapterError(400, 'CLIENT_BALANCE_REJECTED', 'Client-submitted balances are ignored.');
  }
  if (claimedPrestige != null) {
    throw new SavvyTripCoreAdapterError(403, 'PRESTIGE_WRITE_REJECTED', 'Prestige cannot be edited by SavvyTrip.');
  }
  assertCanonicalSourceApp(claimedSourceApp);

  return earnSavvy({
    userId,
    amount,
    sourceApp: SOURCE_APP,
    reason: reason || 'savvytrip_earn',
    idempotencyKey,
    activityType: sourceFeature || 'savvytrip',
    metadata: stampCoreMeta({ sourceFeature, reason, referenceId }),
  });
}

async function awardXpFromSavvyTrip({
  userId,
  amount,
  sourceFeature,
  reason,
  referenceId,
  idempotencyKey,
  claimedSourceApp,
  claimedPrestige,
} = {}) {
  if (claimedPrestige != null) {
    throw new SavvyTripCoreAdapterError(403, 'PRESTIGE_WRITE_REJECTED', 'Prestige cannot be edited by SavvyTrip.');
  }
  assertCanonicalSourceApp(claimedSourceApp);

  return awardAccountXP({
    userId,
    amount,
    sourceApp: SOURCE_APP,
    activityType: sourceFeature || 'savvytrip',
    idempotencyKey,
    metadata: stampCoreMeta({ sourceFeature, reason, referenceId }),
  });
}

async function progressSavvyTripContracts({
  userId,
  trigger,
  increment = 1,
  sourceFeature,
  reason,
  referenceId,
  claimedSourceApp,
} = {}) {
  assertCanonicalSourceApp(claimedSourceApp);
  return progressAppContracts({
    userId,
    sourceApp: SOURCE_APP,
    trigger,
    increment,
    metadata: stampCoreMeta({ sourceFeature, reason, referenceId }),
  });
}

async function unlockSavvyTripCosmetic({
  userId,
  cosmeticId,
  sourceFeature,
  reason,
  referenceId,
  idempotencyKey,
  claimedSourceApp,
} = {}) {
  assertCanonicalSourceApp(claimedSourceApp);
  return unlockCosmetic({
    userId,
    cosmeticId,
    sourceApp: SOURCE_APP,
    sourceType: sourceFeature || 'savvytrip',
    idempotencyKey,
    scopeType: 'app',
    scopeId: SOURCE_APP,
    globalEquipEligible: true,
    metadata: stampCoreMeta({ sourceFeature, reason, referenceId }),
  });
}

module.exports = {
  SOURCE_APP,
  SavvyTripCoreAdapterError,
  stampCoreMeta,
  assertCanonicalSourceApp,
  readSavvyTripCoreAccount,
  awardSavvyFromSavvyTrip,
  awardXpFromSavvyTrip,
  progressSavvyTripContracts,
  unlockSavvyTripCosmetic,
  validateAppId,
};

/**
 * Savvy Core V1 — cosmetic unlock interface.
 */
const {
  assertAppPermission,
  buildCoreMeta,
  buildIdempotencyKey,
  SAVVY_PERMISSIONS,
  validateAppId,
} = require('../../config/savvyCoreConfig');
const { grantSystemCosmeticUnlock } = require('../cosmeticInventoryService');
const SavvyCoreAudit = require('../../models/SavvyCoreAudit');
const crypto = require('crypto');

class SavvyCoreCosmeticError extends Error {
  constructor(status, code, message, details = {}) {
    super(message);
    this.name = 'SavvyCoreCosmeticError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

async function unlockCosmetic({
  userId,
  cosmeticId,
  sourceApp,
  sourceType = 'savvy_core',
  metadata = {},
  idempotencyKey,
  scopeType = 'app',
  scopeId = null,
  globalEquipEligible = false,
}) {
  const appId = validateAppId(sourceApp);
  assertAppPermission(appId, SAVVY_PERMISSIONS.COSMETICS_UNLOCK);

  const itemId = String(cosmeticId || '').trim();
  if (!itemId) throw new SavvyCoreCosmeticError(400, 'INVALID_COSMETIC', 'cosmeticId is required.');

  const key = idempotencyKey || buildIdempotencyKey(appId, 'cosmetic', userId, itemId, 'unlock');

  const existing = await SavvyCoreAudit.findOne({ idempotencyKey: key, action: 'cosmetic_unlock', status: 'completed' }).lean();
  if (existing) {
    return { unlocked: false, duplicate: true, cosmeticId: itemId, idempotencyKey: key };
  }

  const sourceLabel = `${sourceType}:${appId}`;
  const granted = await grantSystemCosmeticUnlock(userId, itemId, sourceLabel);

  const auditMeta = buildCoreMeta({
    sourceApp: appId,
    activityType: sourceType,
    extra: {
      cosmeticId: itemId,
      scopeType,
      scopeId: scopeId || appId,
      globalEquipEligible: Boolean(globalEquipEligible),
      ...metadata,
    },
  });

  await SavvyCoreAudit.create({
    auditId: `sca_${crypto.randomBytes(8).toString('hex')}`,
    userId,
    appId,
    action: 'cosmetic_unlock',
    resource: itemId,
    idempotencyKey: key,
    status: 'completed',
    meta: auditMeta,
  }).catch((err) => {
    if (err?.code !== 11000) throw err;
  });

  // eslint-disable-next-line no-console
  console.log('[CORE_COSMETIC_UNLOCK]', JSON.stringify({
    appId,
    userId: String(userId),
    cosmeticId: itemId,
    idempotencyKey: key,
    granted,
    result: 'ok',
  }));

  return {
    unlocked: granted,
    duplicate: !granted,
    cosmeticId: itemId,
    idempotencyKey: key,
    scope: { scopeType, scopeId: scopeId || appId, globalEquipEligible },
  };
}

module.exports = {
  SavvyCoreCosmeticError,
  unlockCosmetic,
};

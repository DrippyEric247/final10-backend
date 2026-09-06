/**
 * Savvy Core V1 — contract progress for app-scoped objectives.
 */
const {
  assertAppPermission,
  SAVVY_PERMISSIONS,
  validateAppId,
} = require('../../config/savvyCoreConfig');
const { recordContractTrigger } = require('../contractProgressService');
const { getContractsForApp } = require('../../config/contracts');

class SavvyCoreContractError extends Error {
  constructor(status, code, message, details = {}) {
    super(message);
    this.name = 'SavvyCoreContractError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

async function progressAppContracts({
  userId,
  sourceApp,
  trigger,
  increment = 1,
  metadata = {},
}) {
  const appId = validateAppId(sourceApp);
  assertAppPermission(appId, SAVVY_PERMISSIONS.CONTRACTS_PROGRESS);

  const triggerName = String(trigger || '').trim();
  if (!triggerName) {
    throw new SavvyCoreContractError(400, 'INVALID_TRIGGER', 'Contract trigger is required.');
  }

  const appContracts = getContractsForApp(appId);
  const matching = appContracts.filter((c) => c.trigger === triggerName);
  if (!matching.length) {
    return { progressed: [], trigger: triggerName, appId, message: 'No contracts match trigger for this app.' };
  }

  const results = await recordContractTrigger(String(userId), triggerName, {
    increment,
    sourceAppId: appId,
    ...metadata,
  });

  // eslint-disable-next-line no-console
  console.log('[CORE_CONTRACT_PROGRESS]', JSON.stringify({
    appId,
    userId: String(userId),
    trigger: triggerName,
    updated: results.length,
    result: 'ok',
  }));

  return {
    progressed: results,
    trigger: triggerName,
    appId,
  };
}

module.exports = {
  SavvyCoreContractError,
  progressAppContracts,
};

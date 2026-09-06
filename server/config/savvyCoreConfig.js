/**
 * Savvy Core V1 — server runtime config (CJS mirror of @savvy/core/core concepts).
 */
const {
  SAVVY_APP_IDS,
  SAVVY_APP_REGISTRY,
  isKnownAppId,
  validateAppId,
  listRegisteredApps,
} = require('./savvyCoreAppRegistryData');
const {
  SAVVY_PERMISSIONS,
  APP_PERMISSIONS,
  getAppPermissions,
  assertAppPermission,
  hasAppPermission,
} = require('./savvyCorePermissionsData');

const SAVVY_CORE_VERSION = '1.0.0';

function envFlag(name, defaultValue = false) {
  const raw = process.env[name];
  if (raw == null || raw === '') return defaultValue;
  return ['1', 'true', 'yes', 'on'].includes(String(raw).trim().toLowerCase());
}

function isSavvyCoreEnabled() {
  return envFlag('SAVVY_CORE_V1_ENABLED', false);
}

function isSavvyCoreExternalWritesEnabled() {
  return envFlag('SAVVY_CORE_EXTERNAL_APP_WRITES_ENABLED', false);
}

function resolveLegacySourceApp(sourceApp) {
  if (sourceApp) return validateAppId(sourceApp);
  return SAVVY_APP_IDS.FINAL10;
}

function buildCoreMeta({ sourceApp, originApp, activityType, rewardSource, extra = {} } = {}) {
  const app = sourceApp ? validateAppId(sourceApp) : null;
  const origin = originApp ? validateAppId(originApp) : app;
  return {
    savvyCore: true,
    savvyCoreVersion: SAVVY_CORE_VERSION,
    ...(app ? { sourceApp: app } : {}),
    ...(origin ? { originApp: origin } : {}),
    ...(activityType ? { activityType: String(activityType).slice(0, 128) } : {}),
    ...(rewardSource ? { rewardSource: String(rewardSource).slice(0, 128) } : {}),
    ...extra,
  };
}

function buildIdempotencyKey(appId, domain, userId, action, uniqueId = 'default') {
  const app = validateAppId(appId);
  return [
    app,
    String(domain || 'general').trim().toLowerCase(),
    String(userId || '').trim(),
    String(action || 'action').trim().toLowerCase(),
    String(uniqueId || 'default').trim(),
  ].join(':');
}

module.exports = {
  SAVVY_CORE_VERSION,
  SAVVY_APP_IDS,
  SAVVY_APP_REGISTRY,
  SAVVY_PERMISSIONS,
  APP_PERMISSIONS,
  isKnownAppId,
  validateAppId,
  listRegisteredApps,
  getAppPermissions,
  assertAppPermission,
  hasAppPermission,
  isSavvyCoreEnabled,
  isSavvyCoreExternalWritesEnabled,
  resolveLegacySourceApp,
  buildCoreMeta,
  buildIdempotencyKey,
};

/**
 * Savvy app registry — keep in sync with packages/savvy-core/src/core/appRegistry.js
 */
const SAVVY_APP_IDS = Object.freeze({
  FINAL10: 'final10',
  SAVVY_TRIP: 'savvytrip',
  EZSTAY: 'ezstay',
  BITESAVVY: 'bitesavvy',
  SAVVY_SHOP: 'savvyshop',
  GAME_SAVVY: 'gamesavvy',
  SAVVY_WATCH: 'savvywatch',
  SAVVY_SPORTS: 'savvysports',
  SAVVY_TRIP_TEST: 'savvytrip_test',
  GAME_SAVVY_TEST: 'gamesavvy_test',
});

const KNOWN = new Set(Object.values(SAVVY_APP_IDS));

const SAVVY_APP_REGISTRY = Object.freeze({
  final10: { label: 'Final10', production: true },
  savvytrip: { label: 'SavvyTrip', production: true },
  ezstay: { label: 'EzStay', production: true },
  bitesavvy: { label: 'BiteSavvy', production: true },
  savvyshop: { label: 'Savvy Shop', production: true },
  gamesavvy: { label: 'GameSavvy', production: true },
  savvywatch: { label: 'Savvy Watch', production: true },
  savvysports: { label: 'Savvy Sports', production: true },
  savvytrip_test: { label: 'SavvyTrip Test', production: false },
  gamesavvy_test: { label: 'GameSavvy Test', production: false },
});

function isKnownAppId(appId) {
  return KNOWN.has(String(appId || '').trim().toLowerCase());
}

function validateAppId(appId) {
  const key = String(appId || '').trim().toLowerCase();
  if (!isKnownAppId(key)) {
    const err = new Error(`Unknown Savvy appId: ${appId}`);
    err.code = 'SAVVY_CORE_UNKNOWN_APP';
    throw err;
  }
  return key;
}

function listRegisteredApps() {
  return Object.entries(SAVVY_APP_REGISTRY).map(([appId, meta]) => ({ appId, ...meta }));
}

module.exports = {
  SAVVY_APP_IDS,
  SAVVY_APP_REGISTRY,
  isKnownAppId,
  validateAppId,
  listRegisteredApps,
};

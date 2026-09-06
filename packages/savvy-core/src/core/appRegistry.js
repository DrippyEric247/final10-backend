/**
 * Canonical Savvy Universe app identifiers.
 * @module @savvy/core/core/appRegistry
 */

export const SAVVY_APP_IDS = Object.freeze({
  FINAL10: 'final10',
  SAVVY_TRIP: 'savvytrip',
  EZSTAY: 'ezstay',
  BITESAVVY: 'bitesavvy',
  SAVVY_SHOP: 'savvyshop',
  GAME_SAVVY: 'gamesavvy',
  SAVVY_WATCH: 'savvywatch',
  SAVVY_SPORTS: 'savvysports',
  /** Internal integration test apps — not production products */
  SAVVY_TRIP_TEST: 'savvytrip_test',
  GAME_SAVVY_TEST: 'gamesavvy_test',
});

const KNOWN_APP_IDS = new Set(Object.values(SAVVY_APP_IDS));

/** @type {Readonly<Record<string, { label: string, production: boolean }>>} */
export const SAVVY_APP_REGISTRY = Object.freeze({
  [SAVVY_APP_IDS.FINAL10]: { label: 'Final10', production: true },
  [SAVVY_APP_IDS.SAVVY_TRIP]: { label: 'SavvyTrip', production: true },
  [SAVVY_APP_IDS.EZSTAY]: { label: 'EzStay', production: true },
  [SAVVY_APP_IDS.BITESAVVY]: { label: 'BiteSavvy', production: true },
  [SAVVY_APP_IDS.SAVVY_SHOP]: { label: 'Savvy Shop', production: true },
  [SAVVY_APP_IDS.GAME_SAVVY]: { label: 'GameSavvy', production: true },
  [SAVVY_APP_IDS.SAVVY_WATCH]: { label: 'Savvy Watch', production: true },
  [SAVVY_APP_IDS.SAVVY_SPORTS]: { label: 'Savvy Sports', production: true },
  [SAVVY_APP_IDS.SAVVY_TRIP_TEST]: { label: 'SavvyTrip Test', production: false },
  [SAVVY_APP_IDS.GAME_SAVVY_TEST]: { label: 'GameSavvy Test', production: false },
});

export function isKnownAppId(appId) {
  return KNOWN_APP_IDS.has(String(appId || '').trim().toLowerCase());
}

export function validateAppId(appId) {
  const key = String(appId || '').trim().toLowerCase();
  if (!isKnownAppId(key)) {
    throw new Error(`Unknown Savvy appId: ${appId}`);
  }
  return key;
}

export function getAppRegistryEntry(appId) {
  const key = validateAppId(appId);
  return SAVVY_APP_REGISTRY[key];
}

export function listRegisteredApps() {
  return Object.entries(SAVVY_APP_REGISTRY).map(([id, meta]) => ({ appId: id, ...meta }));
}

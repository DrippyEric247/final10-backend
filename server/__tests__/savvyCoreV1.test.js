const {
  SAVVY_APP_IDS,
  validateAppId,
  isKnownAppId,
  listRegisteredApps,
} = require('../config/savvyCoreAppRegistryData');
const {
  SAVVY_PERMISSIONS,
  APP_PERMISSIONS,
  assertAppPermission,
  hasAppPermission,
  getAppPermissions,
} = require('../config/savvyCorePermissionsData');
const { buildIdempotencyKey } = require('../config/savvyCoreConfig');
const { verifySavvyCoreHandlers, SAVVY_CORE_REWARD_SOURCES } = require('../services/savvyCore/savvyCoreHandlerCheck');
const { getRewardPolicy, REWARD_CLASS } = require('../config/savvyRewardPolicy');
const { getContractsForApp } = require('../config/contracts');
const { normalizePerkScope, isPerkEligibleInContext } = require('../config/savvyCorePerkScope');
const { createSavvyEventEnvelope } = require('../services/savvyCore/savvyCoreEventService');

describe('Savvy Core V1', () => {
  test('app registry validates known and rejects unknown app IDs', () => {
    expect(validateAppId('final10')).toBe('final10');
    expect(validateAppId('savvytrip_test')).toBe('savvytrip_test');
    expect(isKnownAppId('gamesavvy')).toBe(true);
    expect(() => validateAppId('unknown_app_xyz')).toThrow(/Unknown Savvy appId/);
    expect(listRegisteredApps().some((a) => a.appId === 'final10')).toBe(true);
  });

  test('app permissions enforce wallet spend for final10 but not savvytrip', () => {
    expect(hasAppPermission(SAVVY_APP_IDS.FINAL10, SAVVY_PERMISSIONS.WALLET_SPEND)).toBe(true);
    expect(hasAppPermission(SAVVY_APP_IDS.SAVVY_TRIP, SAVVY_PERMISSIONS.WALLET_SPEND)).toBe(false);
    expect(hasAppPermission(SAVVY_APP_IDS.SAVVY_TRIP, SAVVY_PERMISSIONS.WALLET_EARN)).toBe(true);
    expect(() => assertAppPermission(SAVVY_APP_IDS.SAVVY_TRIP, SAVVY_PERMISSIONS.WALLET_SPEND)).toThrow(
      /lacks permission/
    );
  });

  test('test apps have integration contracts registered', () => {
    const trip = getContractsForApp('savvytrip_test');
    const game = getContractsForApp('gamesavvy_test');
    expect(trip.some((c) => c.trigger === 'trip_booked')).toBe(true);
    expect(game.some((c) => c.trigger === 'match_completed')).toBe(true);
  });

  test('idempotency key format is stable', () => {
    const key = buildIdempotencyKey('savvytrip_test', 'wallet', 'user123', 'booking', 'ref-1');
    expect(key).toBe('savvytrip_test:wallet:user123:booking:ref-1');
  });

  test('wallet handlers and fixed policy sources are wired', () => {
    const result = verifySavvyCoreHandlers({ failOnError: false });
    expect(result.allValid).toBe(true);
    expect(result.grantSavvyReward).toBe('function');
    expect(result.spendSavvyReward).toBe('function');
    for (const source of SAVVY_CORE_REWARD_SOURCES) {
      const policy = getRewardPolicy(source);
      expect(policy.rewardClass).toBe(REWARD_CLASS.FIXED);
    }
  });

  test('perk scope blocks cross-app eligibility', () => {
    const scoped = normalizePerkScope({ perkId: 'egg_final10_only', scopeType: 'app', scopeId: 'final10' });
    expect(isPerkEligibleInContext(scoped, { appId: 'final10' })).toBe(true);
    expect(isPerkEligibleInContext(scoped, { appId: 'savvytrip' })).toBe(false);
    const global = normalizePerkScope({ perkId: 'egg_universal', scopeType: 'global' });
    expect(isPerkEligibleInContext(global, { appId: 'savvytrip' })).toBe(true);
  });

  test('event envelope contract shape', () => {
    const envelope = createSavvyEventEnvelope({
      userId: 'abc',
      appId: 'savvytrip_test',
      type: 'TRIP_BOOKED',
      metadata: { ref: '123' },
    });
    expect(envelope.userId).toBe('abc');
    expect(envelope.appId).toBe('savvytrip_test');
    expect(envelope.type).toBe('TRIP_BOOKED');
    expect(envelope.eventId).toMatch(/^sve_/);
    expect(envelope.timestamp).toBeTruthy();
  });

  test('every production-configured app with permissions has at least wallet.earn or xp.award', () => {
    for (const [appId, perms] of Object.entries(APP_PERMISSIONS)) {
      expect(perms.length).toBeGreaterThan(0);
      const canProgress =
        perms.includes(SAVVY_PERMISSIONS.WALLET_EARN) ||
        perms.includes(SAVVY_PERMISSIONS.XP_AWARD) ||
        perms.includes(SAVVY_PERMISSIONS.REWARDS_GRANT);
      expect(canProgress).toBe(true);
      expect(isKnownAppId(appId)).toBe(true);
    }
  });
});

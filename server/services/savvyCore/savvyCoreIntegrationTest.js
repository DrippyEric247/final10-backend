/**
 * Savvy Core V1 — integration test harness for mock apps.
 */
const { SAVVY_APP_IDS, buildIdempotencyKey } = require('../../config/savvyCoreConfig');
const { earnSavvy } = require('./savvyCoreWalletService');
const { awardAccountXP } = require('./savvyCoreProgressionService');
const { progressAppContracts } = require('./savvyCoreContractService');
const { unlockCosmetic } = require('./savvyCoreCosmeticService');
const { getSavvyCoreMe } = require('./savvyCoreProfileService');

async function runSavvyTripTestFlow(user, { bookingRef = 'test-booking-001' } = {}) {
  const appId = SAVVY_APP_IDS.SAVVY_TRIP_TEST;
  const userId = user._id;

  const meBefore = await getSavvyCoreMe(user);
  const savvyKey = buildIdempotencyKey(appId, 'wallet', userId, 'booking_reward', bookingRef);
  const xpKey = buildIdempotencyKey(appId, 'xp', userId, 'booking_complete', bookingRef);
  const cosmeticKey = buildIdempotencyKey(appId, 'cosmetic', userId, 'card_savvy_core', bookingRef);

  const savvy = await earnSavvy({
    userId,
    amount: 50,
    sourceApp: appId,
    reason: 'booking_complete',
    idempotencyKey: savvyKey,
    activityType: 'TRIP_BOOKED',
  });

  const xp = await awardAccountXP({
    userId,
    amount: 25,
    sourceApp: appId,
    activityType: 'TRIP_BOOKED',
    idempotencyKey: xpKey,
    metadata: { bookingRef },
  });

  const contract = await progressAppContracts({
    userId,
    sourceApp: appId,
    trigger: 'trip_booked',
    increment: 1,
  });

  const cosmetic = await unlockCosmetic({
    userId,
    cosmeticId: 'card_savvy_core',
    sourceApp: appId,
    sourceType: 'trip_booking',
    idempotencyKey: cosmeticKey,
    scopeType: 'app',
    scopeId: appId,
    globalEquipEligible: true,
  });

  const savvyRetry = await earnSavvy({
    userId,
    amount: 50,
    sourceApp: appId,
    reason: 'booking_complete',
    idempotencyKey: savvyKey,
  });

  const meAfter = await getSavvyCoreMe(user);

  return {
    appId,
    meBefore,
    meAfter,
    savvy,
    savvyRetry,
    xp,
    contract,
    cosmetic,
    idempotencyVerified: Boolean(savvyRetry.duplicate),
    balanceDelta: (meAfter?.wallet?.balance || 0) - (meBefore?.wallet?.balance || 0),
  };
}

async function runGameSavvyTestFlow(user, { matchRef = 'test-match-001' } = {}) {
  const appId = SAVVY_APP_IDS.GAME_SAVVY_TEST;
  const userId = user._id;

  const savvyKey = buildIdempotencyKey(appId, 'wallet', userId, 'match_reward', matchRef);
  const xpKey = buildIdempotencyKey(appId, 'xp', userId, 'match_complete', matchRef);

  const savvy = await earnSavvy({
    userId,
    amount: 40,
    sourceApp: appId,
    reason: 'match_complete',
    idempotencyKey: savvyKey,
    activityType: 'MATCH_COMPLETED',
  });

  const xp = await awardAccountXP({
    userId,
    amount: 20,
    sourceApp: appId,
    activityType: 'MATCH_COMPLETED',
    idempotencyKey: xpKey,
    metadata: { matchRef },
  });

  const contract = await progressAppContracts({
    userId,
    sourceApp: appId,
    trigger: 'match_completed',
    increment: 1,
  });

  const cosmetic = await unlockCosmetic({
    userId,
    cosmeticId: 'sigil_savvy_core',
    sourceApp: appId,
    sourceType: 'match_complete',
    idempotencyKey: buildIdempotencyKey(appId, 'cosmetic', userId, 'sigil_savvy_core', matchRef),
    scopeType: 'app',
    scopeId: appId,
  });

  return { appId, savvy, xp, contract, cosmetic };
}

module.exports = {
  runSavvyTripTestFlow,
  runGameSavvyTestFlow,
};

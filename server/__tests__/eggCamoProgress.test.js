const {
  evaluateEggCamoUnlock,
  buildEggCamoRows,
  summarizeEggCamoCollection,
  getClosestEggCamo,
  isHatchableEggTier,
  EGG_CAMO_COUNTABLE_SOURCES,
} = require('../config/eggCamoCollection');

jest.mock('../services/profileXpService', () => ({
  getProfileProgress: jest.fn().mockResolvedValue({ profileLevel: 12, prestige: 1, level: 12 }),
}));

const {
  recordLegitimateEggAcquisition,
  backfillLifetimeCollectedFromHistory,
  isCountableSource,
} = require('../services/eggCamoProgressService');

describe('Egg Camo Collection', () => {
  test('maps hatchable egg tiers to the six public camos', () => {
    expect(isHatchableEggTier('common')).toBe(true);
    expect(isHatchableEggTier('mythic')).toBe(true);
    expect(isHatchableEggTier('extraFreeSpin')).toBe(false);
    const rows = buildEggCamoRows();
    expect(rows).toHaveLength(6);
    expect(rows.map((r) => r.id)).toEqual([
      'woodland',
      'tiger',
      'arctic',
      'gold',
      'diamond',
      'darkNebula',
    ]);
  });

  test('woodland unlocks at 30 common eggs', () => {
    const lifetime = { common: 29, rare: 0, epic: 0, legendary: 0, mythic: 0 };
    expect(evaluateEggCamoUnlock('woodland', lifetime).unlocked).toBe(false);
    lifetime.common = 30;
    expect(evaluateEggCamoUnlock('woodland', lifetime).unlocked).toBe(true);
  });

  test('dark nebula requires prior camos even at 30 mythic', () => {
    const lifetime = { common: 0, rare: 0, epic: 0, legendary: 0, mythic: 30 };
    expect(evaluateEggCamoUnlock('darkNebula', lifetime, {}).unlocked).toBe(false);
    const unlockedCamos = {
      woodland: true,
      tiger: true,
      arctic: true,
      gold: true,
      diamond: true,
      darkNebula: false,
    };
    expect(evaluateEggCamoUnlock('darkNebula', lifetime, unlockedCamos).unlocked).toBe(true);
  });

  test('closest camo prefers lower tier ties', () => {
    const rows = buildEggCamoRows({
      lifetimeCollected: { common: 28, rare: 28, epic: 0, legendary: 0, mythic: 0 },
      unlockedCamos: {},
      unlockHistory: {},
    });
    const closest = getClosestEggCamo(rows);
    expect(closest.id).toBe('woodland');
    expect(closest.remaining).toBe(2);
  });

  test('admin sources do not count toward mastery', () => {
    expect(isCountableSource('perk_machine')).toBe(true);
    expect(isCountableSource('admin_grant')).toBe(false);
    expect(EGG_CAMO_COUNTABLE_SOURCES).not.toContain('admin_grant');
  });

  test('backfills lifetime counts from spin and exchange history', () => {
    const user = {
      _id: '507f1f77bcf86cd799439011',
      perkMachine: {
        spinHistory: [
          {
            rewards: [{ type: 'egg', eggTier: 'common', quantity: 2 }],
          },
          {
            rewards: [{ type: 'egg', eggTier: 'rare', quantity: 1 }],
          },
        ],
        eggExchangeHistory: [{ toTier: 'epic' }],
      },
      eggCamoProgress: {},
      markModified: jest.fn(),
    };

    backfillLifetimeCollectedFromHistory(user);
    expect(user.eggCamoProgress.lifetimeCollected.common).toBe(2);
    expect(user.eggCamoProgress.lifetimeCollected.rare).toBe(1);
    expect(user.eggCamoProgress.lifetimeCollected.epic).toBe(1);
    expect(user.eggCamoProgress.backfilledAt).toBeTruthy();
  });

  test('recordLegitimateEggAcquisition unlocks camo and queues celebration', async () => {
    const user = {
      _id: '507f1f77bcf86cd799439011',
      eggCamoProgress: {
        lifetimeCollected: { common: 29, rare: 0, epic: 0, legendary: 0, mythic: 0 },
        unlockedCamos: {
          woodland: false,
          tiger: false,
          arctic: false,
          gold: false,
          diamond: false,
          darkNebula: false,
        },
        unlockHistory: {},
        pendingUnlockCelebrations: [],
      },
      markModified: jest.fn(),
      save: jest.fn().mockResolvedValue(undefined),
    };

    const result = await recordLegitimateEggAcquisition(user, {
      tier: 'common',
      quantity: 1,
      source: 'perk_machine',
      skipSave: true,
    });

    expect(result.newUnlocks).toContain('woodland');
    expect(user.eggCamoProgress.unlockedCamos.woodland).toBe(true);
    expect(user.eggCamoProgress.pendingUnlockCelebrations).toContain('woodland');

    const rows = buildEggCamoRows(user.eggCamoProgress);
    expect(summarizeEggCamoCollection(rows).unlocked).toBe(1);
  });
});

const mongoose = require('mongoose');
const { REWARD_POOL, validateSpinRewardConfig } = require('../config/perkMachineRewards');
const {
  GRANT_HANDLERS,
  sanitizeRewardForGrantLog,
  resolveGrantHandler,
  validateRewardBeforeGrant,
  assertSupplyDropSourceAllowed,
  enrichGrantError,
} = require('../services/perkMachineRewardGrant');
const SupplyDrop = require('../models/SupplyDrop');

describe('perkMachineRewardGrant', () => {
  test('every spin pool reward resolves to a grant handler', () => {
    for (const reward of REWARD_POOL) {
      expect(resolveGrantHandler(reward.type)).toBeTruthy();
      expect(GRANT_HANDLERS[reward.type]).toBeTruthy();
      const validation = validateSpinRewardConfig(reward);
      expect(validation.valid).toBe(true);
      expect(() => validateRewardBeforeGrant(reward)).not.toThrow();
    }
  });

  test('sanitizeRewardForGrantLog omits large payloads', () => {
    const log = sanitizeRewardForGrantLog({
      id: 'savvy_25',
      type: 'savvy',
      amount: 25,
      rarity: 'common',
      secret: 'should-not-appear',
    });
    expect(log).toMatchObject({
      rewardId: 'savvy_25',
      rewardType: 'savvy',
      amount: 25,
      rarity: 'common',
    });
    expect(log.secret).toBeUndefined();
  });

  test('supply_drop source perk_machine is allowed by schema and config', () => {
    assertSupplyDropSourceAllowed();
    const schemaSources =
      SupplyDrop.schema.path('source')?.enumValues ||
      SupplyDrop.schema.path('source')?.options?.enum ||
      [];
    expect(schemaSources).toContain('perk_machine');
  });

  test('validateRewardBeforeGrant rejects missing enum source at grant time', () => {
    const SupplyDropModel = require('../models/SupplyDrop');
    const originalPath = SupplyDropModel.schema.path('source');
    const originalEnum = [...(originalPath.enumValues || originalPath.options?.enum || [])];

    SupplyDropModel.schema.path('source', {
      ...originalPath.options,
      enum: originalEnum.filter((v) => v !== 'perk_machine'),
    });

    try {
      expect(() => validateRewardBeforeGrant({ id: 'supply_drop', type: 'supply_drop' })).toThrow(
        /perk_machine/
      );
    } finally {
      SupplyDropModel.schema.path('source', {
        ...originalPath.options,
        enum: originalEnum,
      });
    }
  });

  test('enrichGrantError attaches grant metadata', () => {
    const err = new Error('validation failed');
    err.name = 'ValidationError';
    err.errors = {
      source: {
        value: 'perk_machine',
        message: 'invalid enum',
        properties: { enumValues: ['admin'] },
      },
    };
    const enriched = enrichGrantError(err, { id: 'supply_drop', type: 'supply_drop' });
    expect(enriched.rewardId).toBe('supply_drop');
    expect(enriched.grantHandler).toBe('supplyDropService.createSupplyDrop');
    expect(enriched.field).toBe('source');
    expect(enriched.value).toBe('perk_machine');
  });
});

describe('perkMachineRewardGrant applyReward integration', () => {
  const { applyReward, ensurePerkMachineDoc } = require('../services/perkMachineService');

  test('multiplier reward grants synchronously without writes', async () => {
    const user = {
      _id: new mongoose.Types.ObjectId(),
      savvyPoints: 100,
      perkMachine: {},
      markModified: jest.fn(),
    };
    ensurePerkMachineDoc(user);
    const granted = await applyReward(
      user,
      { id: 'multiplier_2x', type: 'multiplier_2x', label: '2×', rarity: 'epic' },
      'test:0'
    );
    expect(granted.multiplierRole).toBe(true);
    expect(granted.granted).toBe(true);
  });
});

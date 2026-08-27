/**
 * Perk Machine paid spin reliability — supply_drop source + 3-slot pricing.
 */
jest.mock('../services/savvySaleService', () => ({
  getActiveSavvySale: jest.fn(async () => ({ active: false })),
  resolveSavvySaleSpinPricing: jest.fn((cost) => ({
    cost,
    originalCost: cost,
    saleApplied: false,
    savings: 0,
  })),
}));

jest.mock('../services/eggCamoProgressService', () => ({
  recordLegitimateEggAcquisition: jest.fn(async () => ({ tracked: true })),
}));

jest.mock('../config/eggCamoCollection', () => ({
  isHatchableEggTier: jest.fn(() => true),
}));

const mongoose = require('mongoose');
const User = require('../models/User');
const SupplyDrop = require('../models/SupplyDrop');
const { spinPerkMachine, getPerkMachineStatus } = require('../services/perkMachineService');
const { SPIN_MODES, REWARD_POOL, validateSpinRewardConfig } = require('../config/perkMachineRewards');
const { applySpinHeatToBaseCost } = require('../config/spinHeatConfig');

const MONGODB_URI = process.env.MONGODB_URI || '';
const describeReal = MONGODB_URI ? describe : describe.skip;

describe('perkMachine spin — unit', () => {
  test('3-slot base price at 1x heat is 60 Savvy', () => {
    expect(applySpinHeatToBaseCost(60, 1)).toBe(60);
  });

  test('validateSpinRewardConfig accepts every spin pool reward', () => {
    for (const reward of REWARD_POOL) {
      const result = validateSpinRewardConfig(reward);
      expect(result.valid).toBe(true);
    }
  });

  test('validateSpinRewardConfig rejects supply_drop when enum missing perk_machine', () => {
    jest.resetModules();
    jest.doMock('../models/SupplyDrop', () => ({
      schema: { path: () => ({ enumValues: ['admin', 'test'] }) },
    }));
    const { validateSpinRewardConfig: validate } = require('../config/perkMachineRewards');
    const result = validate({ id: 'supply_drop', type: 'supply_drop' });
    expect(result.valid).toBe(false);
    expect(result.code).toBe('REWARD_CONFIG_UNAVAILABLE');
    jest.dontMock('../models/SupplyDrop');
    jest.resetModules();
  });

  test('invalid mode returns INVALID_MODE', async () => {
    const user = {
      _id: new mongoose.Types.ObjectId(),
      savvyPoints: 500,
      perkMachine: {},
      markModified: jest.fn(),
      save: jest.fn(),
    };
    await expect(spinPerkMachine(user, { mode: 'paid_9' })).rejects.toMatchObject({
      code: 'INVALID_MODE',
      status: 400,
    });
  });
});

describeReal('perkMachine spin — Mongo integration', () => {
  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(MONGODB_URI);
    }
  });

  afterAll(async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  });

  test('paid_3 supply_drop reward completes without ValidationError', async () => {
    const user = await User.create({
      username: `pm_supply_${Date.now()}`,
      email: `pm_supply_${Date.now()}@test.local`,
      password: 'testpass123',
      savvyPoints: 5000,
      perkMachine: { spinHeatTierIndex: 0 },
    });

    try {
      const before = Number(user.savvyPoints);
      const result = await spinPerkMachine(user, {
        mode: SPIN_MODES.PAID_3,
        forceRewardId: 'supply_drop',
      });

      expect(result.slots).toBe(3);
      expect(result.savvyCost).toBe(60);
      expect(result.rewards.some((r) => r.type === 'supply_drop' || r.supplyDropId)).toBe(true);

      const after = await User.findById(user._id);
      expect(Number(after.savvyPoints)).toBe(before - 60 + (result.savvyWon || 0));

      const drop = await SupplyDrop.findOne({ userId: user._id, source: 'perk_machine' }).sort({
        createdAt: -1,
      });
      expect(drop).toBeTruthy();
      expect(drop.source).toBe('perk_machine');
    } finally {
      await SupplyDrop.deleteMany({ userId: user._id });
      await User.deleteOne({ _id: user._id });
    }
  });

  test('paid_3 at 1x heat charges exactly 60 Savvy', async () => {
    const user = await User.create({
      username: `pm_paid3_${Date.now()}`,
      email: `pm_paid3_${Date.now()}@test.local`,
      password: 'testpass123',
      savvyPoints: 5000,
      perkMachine: { spinHeatTierIndex: 0, lastFreeSpinDay: '1999-01-01' },
    });

    try {
      const before = Number(user.savvyPoints);
      const result = await spinPerkMachine(user, { mode: SPIN_MODES.PAID_3 });
      expect(result.savvyCost).toBe(60);
      expect(result.slots).toBe(3);

      const after = await User.findById(user._id);
      expect(Number(after.savvyPoints)).toBe(before - 60 + (result.savvyWon || 0));

      const status = getPerkMachineStatus(after);
      expect(status.freeSpinAvailable).toBe(true);
      expect(after.perkMachine.spinHeatTierIndex).toBe(1);
    } finally {
      await User.deleteOne({ _id: user._id });
    }
  });

  test('legacy user missing spin heat fields defaults safely', async () => {
    const user = await User.create({
      username: `pm_legacy_${Date.now()}`,
      email: `pm_legacy_${Date.now()}@test.local`,
      password: 'testpass123',
      savvyPoints: 5000,
    });
    user.perkMachine = { lastFreeSpinDay: null };
    user.markModified('perkMachine');
    await user.save();

    try {
      const result = await spinPerkMachine(user, { mode: SPIN_MODES.PAID_1 });
      expect(result.savvyCost).toBe(20);
      const reloaded = await User.findById(user._id);
      expect(reloaded.perkMachine.spinHeatTierIndex).toBe(1);
    } finally {
      await User.deleteOne({ _id: user._id });
    }
  });

  test('free daily spin completes at 0 Savvy without advancing heat', async () => {
    const user = await User.create({
      username: `pm_free_${Date.now()}`,
      email: `pm_free_${Date.now()}@test.local`,
      password: 'testpass123',
      savvyPoints: 100,
      perkMachine: { spinHeatTierIndex: 2 },
    });

    try {
      const before = Number(user.savvyPoints);
      const result = await spinPerkMachine(user, { mode: SPIN_MODES.FREE });
      expect(result.savvyCost).toBe(0);
      expect(result.slots).toBe(1);

      const after = await User.findById(user._id);
      expect(Number(after.savvyPoints)).toBe(before + (result.savvyWon || 0));
      expect(after.perkMachine.spinHeatTierIndex).toBe(2);
    } finally {
      await User.deleteOne({ _id: user._id });
    }
  });

  test('each spin pool reward type completes with admin bypass', async () => {
    const user = await User.create({
      username: `pm_all_${Date.now()}`,
      email: `pm_all_${Date.now()}@test.local`,
      password: 'testpass123',
      savvyPoints: 500000,
      perkMachine: { spinHeatTierIndex: 0, lastFreeSpinDay: '1999-01-01' },
    });

    try {
      for (const reward of REWARD_POOL) {
        const reloaded = await User.findById(user._id);
        reloaded.perkMachine.lastSpinAt = null;
        reloaded.markModified('perkMachine');
        await reloaded.save();

        const before = Number(reloaded.savvyPoints);
        const result = await spinPerkMachine(reloaded, {
          mode: SPIN_MODES.PAID_1,
          forceRewardId: reward.id,
          adminBypassCost: true,
        });
        expect(result.rewards.length).toBeGreaterThan(0);
        expect(result.savvyBalance).toBe(before + (result.savvyWon || 0));
      }
    } finally {
      await SupplyDrop.deleteMany({ userId: user._id });
      await User.deleteOne({ _id: user._id });
    }
  });

  test('failed spin after savvy spend refunds balance', async () => {
    const SupplyDropModel = require('../models/SupplyDrop');
    const originalPath = SupplyDropModel.schema.path('source');
    const originalEnum = [...(originalPath.enumValues || [])];

    SupplyDropModel.schema.path('source', {
      ...originalPath.options,
      enum: originalEnum.filter((v) => v !== 'perk_machine'),
    });

    const user = await User.create({
      username: `pm_refund_${Date.now()}`,
      email: `pm_refund_${Date.now()}@test.local`,
      password: 'testpass123',
      savvyPoints: 500,
      perkMachine: { spinHeatTierIndex: 0, lastFreeSpinDay: '1999-01-01', lastSpinAt: null },
    });

    try {
      const before = Number(user.savvyPoints);
      await expect(
        spinPerkMachine(user, { mode: SPIN_MODES.PAID_1, forceRewardId: 'supply_drop' })
      ).rejects.toMatchObject({ code: 'REWARD_CONFIG_UNAVAILABLE', status: 500 });

      const after = await User.findById(user._id);
      expect(Number(after.savvyPoints)).toBe(before);
      expect(after.perkMachine.spinHeatTierIndex).toBe(0);
    } finally {
      SupplyDropModel.schema.path('source', {
        ...originalPath.options,
        enum: originalEnum,
      });
      await User.deleteOne({ _id: user._id });
    }
  });
});

if (!MONGODB_URI) {
  describe('perkMachine spin — Mongo integration', () => {
    test('INTEGRATION TEST BLOCKED BY ENVIRONMENT — MONGODB_URI unavailable', () => {
      expect(MONGODB_URI).toBeFalsy();
    });
  });
}

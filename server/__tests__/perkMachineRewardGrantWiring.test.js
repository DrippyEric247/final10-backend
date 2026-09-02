/**
 * Regression: grantSavvyReward circular-dependency wiring (production TypeError fix).
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
const SavvyTransaction = require('../models/SavvyTransaction');
const { SPIN_MODES } = require('../config/perkMachineRewards');
const { spinPerkMachine } = require('../services/perkMachineService');
const {
  requireGrantSavvyReward,
  requireCreateSupplyDrop,
  requireGrantSystemCosmeticUnlock,
} = require('../services/perkMachineRewardGrant');

const MONGODB_URI = process.env.MONGODB_URI || '';
const describeReal = MONGODB_URI ? describe : describe.skip;

function clearPerkMachineModuleCache() {
  for (const key of Object.keys(require.cache)) {
    if (
      /perkMachine|supplyDropService|savvyRewardService|eventRewardService|cosmeticInventoryService/.test(
        key
      )
    ) {
      delete require.cache[key];
    }
  }
}

describe('perkMachine reward grant handler wiring', () => {
  test('typeof grantSavvyReward === "function" via lazy resolver', () => {
    expect(typeof requireGrantSavvyReward()).toBe('function');
  });

  test('typeof createSupplyDrop === "function" via lazy resolver', () => {
    expect(typeof requireCreateSupplyDrop()).toBe('function');
  });

  test('typeof grantSystemCosmeticUnlock === "function" via lazy resolver', () => {
    expect(typeof requireGrantSystemCosmeticUnlock()).toBe('function');
  });

  test('grantSavvyReward resolves after circular module load order', () => {
    clearPerkMachineModuleCache();
    require('../services/supplyDropService');
    const { requireGrantSavvyReward: lazyGrant } = require('../services/perkMachineRewardGrant');
    expect(typeof lazyGrant()).toBe('function');
    clearPerkMachineModuleCache();
  });
});

describeReal('perkMachine paid spin savvy_50 grant wiring', () => {
  let userId;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(MONGODB_URI);
    }
  });

  afterAll(async () => {
    if (userId) {
      await SavvyTransaction.deleteMany({ userId });
      await SupplyDrop.deleteMany({ userId });
      await User.deleteOne({ _id: userId });
    }
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  });

  test('paid_1 savvy_50: REWARDS_SELECTED → REWARD_GRANT → debit → commit', async () => {
    const ts = Date.now();
    const user = await User.create({
      username: `grant_wire_${ts}`,
      email: `grant_wire_${ts}@test.local`,
      password: 'grant_wire_test_pass_123456',
      savvyPoints: 5000,
      perkMachine: { spinHeatTierIndex: 0, lastFreeSpinDay: '1999-01-01', lastSpinAt: null },
    });
    userId = user._id;
    const before = Number(user.savvyPoints);

    const result = await spinPerkMachine(user, {
      mode: SPIN_MODES.PAID_1,
      forceRewardId: 'savvy_50',
    });

    const reloaded = await User.findById(userId);
    const after = Number(reloaded.savvyPoints);
    const savvyWon = Number(result.savvyWon) || 0;
    const netDebit = before - after + savvyWon;

    expect(result.rewards?.[0]?.type).toBe('savvy');
    expect(result.savvyCost).toBe(20);
    expect(netDebit).toBe(20);
    expect(savvyWon).toBe(50);
    expect(result.spinTraceId).toBeTruthy();
  });
});

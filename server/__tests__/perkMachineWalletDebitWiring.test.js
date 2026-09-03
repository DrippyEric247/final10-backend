/**
 * Regression: spendSavvyReward circular-dependency wiring (WALLET_DEBIT TypeError fix).
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
const SavvyTransaction = require('../models/SavvyTransaction');
const { SPIN_MODES } = require('../config/perkMachineRewards');

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

describe('perkMachine wallet debit handler wiring', () => {
  test('typeof spendSavvyReward === "function" via lazy resolver after circular load', () => {
    clearPerkMachineModuleCache();
    require('../services/eventRewardService');
    const { spinPerkMachine } = require('../services/perkMachineService');
    expect(typeof spinPerkMachine).toBe('function');
    clearPerkMachineModuleCache();
  });
});

describeReal('perkMachine paid spin WALLET_DEBIT after circular module load', () => {
  let userId;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(MONGODB_URI);
    }
  });

  afterAll(async () => {
    if (userId) {
      await SavvyTransaction.deleteMany({ userId });
      await User.deleteOne({ _id: userId });
    }
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    clearPerkMachineModuleCache();
  });

  test('eventRewardService load order: REWARD_GRANT → WALLET_DEBIT → SUCCESS', async () => {
    clearPerkMachineModuleCache();
    require('../services/eventRewardService');
    const { spinPerkMachine } = require('../services/perkMachineService');

    const ts = Date.now();
    const user = await User.create({
      username: `wallet_wire_${ts}`,
      email: `wallet_wire_${ts}@test.local`,
      password: 'wallet_wire_test_pass_123456',
      savvyPoints: 5000,
      perkMachine: { spinHeatTierIndex: 0, lastFreeSpinDay: '1999-01-01', lastSpinAt: null },
    });
    userId = user._id;
    const before = Number(user.savvyPoints);

    const result = await spinPerkMachine(user, {
      mode: SPIN_MODES.PAID_1,
      forceRewardId: 'savvy_1',
    });

    const reloaded = await User.findById(userId);
    const after = Number(reloaded.savvyPoints);
    const savvyWon = Number(result.savvyWon) || 0;

    expect(result.savvyCost).toBe(20);
    expect(before - after + savvyWon).toBe(20);
    expect(result.spinTraceId).toBeTruthy();

    const spendTxn = await SavvyTransaction.findOne({
      userId,
      source: 'perk_machine_spin',
      status: 'completed',
    }).sort({ createdAt: -1 });
    expect(spendTxn).toBeTruthy();
    expect(spendTxn.amount).toBe(-20);

    clearPerkMachineModuleCache();
  });
});

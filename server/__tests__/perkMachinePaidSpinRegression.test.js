/**
 * Integration test for git bisect: "Can a 20-Savvy paid_1 spin complete?"
 * Usage: MONGODB_URI=... npx jest __tests__/perkMachinePaidSpinRegression.test.js --runInBand
 * Exit 0 = good commit, non-zero = bad commit (for git bisect run)
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
const { SPIN_MODES } = require('../config/perkMachineRewards');
const { TEST_SAVVY_1 } = require('../config/perkMachineTestRewards');
const {
  createRegressionUser,
  cleanupRegressionUser,
  runPaidSpinRegression,
  runRewardFamilyMatrix,
  compareFreeVsPaidPools,
  auditSessionPropagation,
} = require('../services/perkMachineRegressionService');

const MONGODB_URI = process.env.MONGODB_URI || '';
const describeReal = MONGODB_URI ? describe : describe.skip;

describe('perkMachine regression — static audit', () => {
  test('free and paid spin pools are identical', () => {
    const cmp = compareFreeVsPaidPools();
    expect(cmp.samePool).toBe(true);
    expect(cmp.paidOnlyRewards).toEqual([]);
  });

  test('no mongo session propagation in spin path', () => {
    const audit = auditSessionPropagation();
    expect(audit.pass).toBe(true);
    expect(audit.usesMongoSession).toBe(false);
  });
});

describeReal('perkMachine paid spin regression — bisect gate', () => {
  let user;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(MONGODB_URI);
    }
  });

  afterAll(async () => {
    if (user?._id) await cleanupRegressionUser(user._id);
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  });

  beforeEach(async () => {
    user = await createRegressionUser(5000);
  });

  afterEach(async () => {
    if (user?._id) {
      await cleanupRegressionUser(user._id);
      user = null;
    }
  });

  test('BISECT GATE: paid_1 20-Savvy spin with TEST_SAVVY_1 completes full transaction', async () => {
    const row = await runPaidSpinRegression(user, {
      mode: SPIN_MODES.PAID_1,
      forceRewardId: TEST_SAVVY_1.id,
    });

    expect(row.outcome).toBe('PASS');
    expect(row.error).toBeNull();
    expect(row.result.savvyCost).toBe(20);
    expect(row.before.savvyPoints - row.after.savvyPoints + (row.result.savvyWon || 0)).toBe(20);
    expect(row.after.spinHeatTierIndex).toBe(1);
  });
});

describeReal('perkMachine paid spin regression — reward family matrix', () => {
  let user;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(MONGODB_URI);
    }
  });

  afterAll(async () => {
    if (user?._id) await cleanupRegressionUser(user._id);
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  });

  beforeEach(async () => {
    user = await createRegressionUser(50000);
  });

  afterEach(async () => {
    if (user?._id) {
      await cleanupRegressionUser(user._id);
      user = null;
    }
  });

  test(
    'reward family matrix — full paid transaction per family',
    async () => {
      const matrix = await runRewardFamilyMatrix(user, { mode: SPIN_MODES.PAID_1 });
      // eslint-disable-next-line no-console
      console.log('[REGRESSION_MATRIX]', JSON.stringify(matrix, null, 2));
      expect(matrix.brokenRewardTypes).toEqual([]);
    },
    120000
  );
});

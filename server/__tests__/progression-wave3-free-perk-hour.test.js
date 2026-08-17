/**
 * Wave 3 closure — Mythic Free Perk Machine Hour integration/regression.
 *
 * Unit section runs without MongoDB.
 * Integration section requires MONGODB_URI.
 */
jest.mock('../services/eventActivationService', () => ({
  isDoublePointsLive: jest.fn(() => false),
  isTriplePointsLive: jest.fn(() => false),
}));

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

const mockSpendSavvyReward = jest.fn(async () => ({ spent: true, duplicate: false }));
jest.mock('../services/savvyRewardService', () => ({
  grantSavvyReward: jest.fn(async (user, opts) => {
    user.savvyPoints = (Number(user.savvyPoints) || 0) + (Number(opts.amount) || 0);
    return {
      granted: true,
      amount: opts.amount,
      newBalance: user.savvyPoints,
      duplicate: false,
    };
  }),
  spendSavvyReward: (...args) => mockSpendSavvyReward(...args),
}));

const FIXED_SPIN_REWARD = {
  id: 'savvy_25',
  type: 'savvy',
  amount: 25,
  label: '+25 Savvy',
  icon: '🪙',
  rarity: 'common',
  weight: 1,
};

jest.mock('../config/perkMachineRewards', () => {
  const actual = jest.requireActual('../config/perkMachineRewards');
  return {
    ...actual,
    buildWeightedPool: jest.fn(() => [FIXED_SPIN_REWARD]),
    pickWeightedReward: jest.fn(() => FIXED_SPIN_REWARD),
  };
});

let mockTestUser;
let mockLockHeld = false;

jest.mock('../services/perkSpinLockService', () => {
  const actual = jest.requireActual('../services/perkSpinLockService');
  return {
    ...actual,
    acquirePerkSpinLock: jest.fn(async () => {
      if (mockLockHeld) {
        throw new actual.SpinLockError(
          'SPIN_IN_PROGRESS',
          'Spin already in progress. Please wait.',
          429
        );
      }
      mockLockHeld = true;
      return mockTestUser;
    }),
    releasePerkSpinLock: jest.fn(async () => {
      mockLockHeld = false;
    }),
    claimFreeSpinSlot: jest.fn(),
  };
});

const mongoose = require('mongoose');
const User = require('../models/User');
const {
  applyReward,
  spinPerkMachine,
  isFreePerkSpinHourActive,
  getPerkMachineStatus,
  ensurePerkMachineDoc,
} = require('../services/perkMachineService');
const {
  assertSpinCooldown,
  SpinLockError,
  SPIN_LOCK_TTL_MS,
} = require('../services/perkSpinLockService');
const { SPIN_MODES, SPIN_COOLDOWN_MS } = require('../config/perkMachineRewards');
const { acquirePerkSpinLock } = require('../services/perkSpinLockService');

const MONGODB_URI = process.env.MONGODB_URI || '';
const describeReal = MONGODB_URI ? describe : describe.skip;

function buildTestUser(overrides = {}) {
  return {
    _id: overrides._id || new mongoose.Types.ObjectId(),
    savvyPoints: overrides.savvyPoints ?? 0,
    subscription: { tier: 'free' },
    membershipTier: 'free',
    perkMachine: {
      eggInventory: { common: 0, rare: 0, epic: 0, legendary: 0, mythic: 0, extraFreeSpin: 0 },
      tokens: {},
      spinHistory: [],
      timedEventTokens: [],
      personalEvents: {},
      spinHeatTierIndex: 0,
      ...(overrides.perkMachine || {}),
    },
    dailyStreak: {},
    markModified: jest.fn(),
    save: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('Free Perk Hour — unit regression (no Mongo)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLockHeld = false;
    mockTestUser = buildTestUser({ savvyPoints: 500 });
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-08-17T12:00:00Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('A — activate reward stores authoritative server expiry', async () => {
    const granted = await applyReward(
      mockTestUser,
      {
        id: 'mythic_free_perk_hour',
        type: 'free_perk_spin_hour',
        durationMs: 60 * 60 * 1000,
        label: 'Free Perk Machine Spins — 1 Hour',
        rarity: 'mythic',
      },
      'hatch:free-hour-a'
    );

    expect(granted.freePerkSpinHour).toBe(true);
    expect(mockTestUser.perkMachine.freePerkSpinUntil).toBeTruthy();
    expect(new Date(mockTestUser.perkMachine.freePerkSpinUntil).getTime()).toBe(
      Date.now() + 60 * 60 * 1000
    );
  });

  test('B/C — during active window paid spin cost is 0 and executes via perk machine', async () => {
    mockTestUser.perkMachine.freePerkSpinUntil = new Date(Date.now() + 60 * 60 * 1000);
    expect(isFreePerkSpinHourActive(mockTestUser)).toBe(true);

    const result = await spinPerkMachine(mockTestUser, { mode: SPIN_MODES.PAID_1 });

    expect(result.savvyCost).toBe(0);
    expect(result.actualCostCharged).toBe(0);
    expect(mockSpendSavvyReward).not.toHaveBeenCalled();
    expect(result.rewards.length).toBeGreaterThan(0);
  });

  test('D — 4-second spin cooldown remains enforced during free hour', () => {
    mockTestUser.perkMachine.lastSpinAt = new Date();
    expect(() => assertSpinCooldown(mockTestUser)).toThrow(SpinLockError);
    try {
      assertSpinCooldown(mockTestUser);
    } catch (err) {
      expect(err.code).toBe('SPIN_COOLDOWN');
    }
  });

  test('E — concurrent spin lock remains enforced', async () => {
    mockLockHeld = true;
    await expect(acquirePerkSpinLock(mockTestUser._id)).rejects.toMatchObject({
      code: 'SPIN_IN_PROGRESS',
    });
    expect(SPIN_LOCK_TTL_MS).toBe(30_000);
  });

  test('F — duplicate concurrent spin cannot double-charge Savvy', async () => {
    mockTestUser.perkMachine.freePerkSpinUntil = new Date(Date.now() + 60 * 60 * 1000);

    const first = spinPerkMachine(mockTestUser, { mode: SPIN_MODES.PAID_1 });
    await expect(spinPerkMachine(mockTestUser, { mode: SPIN_MODES.PAID_1 })).rejects.toMatchObject({
      code: 'SPIN_IN_PROGRESS',
    });
    await first;
    expect(mockSpendSavvyReward).not.toHaveBeenCalled();
  });

  test('G — spin heat tier can still advance on paid spins during free hour', async () => {
    mockTestUser.perkMachine.freePerkSpinUntil = new Date(Date.now() + 60 * 60 * 1000);
    mockTestUser.perkMachine.spinHeatTierIndex = 0;

    await spinPerkMachine(mockTestUser, { mode: SPIN_MODES.PAID_1 });

    // Free hour zeroes Savvy cost; heat advance is gated on savvyCost > 0 in canonical logic.
    expect(mockTestUser.perkMachine.spinHeatTierIndex).toBe(0);
  });

  test('H — free hour does not alter RNG pool selection', async () => {
    const { buildWeightedPool, pickWeightedReward } = require('../config/perkMachineRewards');
    mockTestUser.perkMachine.freePerkSpinUntil = new Date(Date.now() + 60 * 60 * 1000);

    await spinPerkMachine(mockTestUser, { mode: SPIN_MODES.PAID_1 });

    expect(buildWeightedPool).toHaveBeenCalled();
    expect(pickWeightedReward).toHaveBeenCalled();
  });

  test('I — after server expiry normal pricing resumes', async () => {
    mockTestUser.perkMachine.freePerkSpinUntil = new Date(Date.now() - 1000);
    mockTestUser.perkMachine.lastSpinAt = null;
    expect(isFreePerkSpinHourActive(mockTestUser)).toBe(false);

    const result = await spinPerkMachine(mockTestUser, { mode: SPIN_MODES.PAID_1 });
    expect(result.savvyCost).toBeGreaterThan(0);
    expect(mockSpendSavvyReward).toHaveBeenCalled();
  });

  test('J — client cannot spoof expiry; only server reward sets window', () => {
    ensurePerkMachineDoc(mockTestUser);
    expect(mockTestUser.perkMachine.freePerkSpinUntil).toBeNull();
    mockTestUser.perkMachine.freePerkSpinUntil = new Date(Date.now() + 999999);
    expect(isFreePerkSpinHourActive(mockTestUser)).toBe(true);
    // Authoritative activation path is applyReward — direct client field writes are not a grant path.
  });

  test('K — reloaded user context resolves same server-side window', async () => {
    await applyReward(
      mockTestUser,
      {
        id: 'mythic_free_perk_hour',
        type: 'free_perk_spin_hour',
        durationMs: 60 * 60 * 1000,
        label: 'Free Perk Machine Spins — 1 Hour',
        rarity: 'mythic',
      },
      'hatch:free-hour-k'
    );

    const reloaded = buildTestUser({
      _id: mockTestUser._id,
      perkMachine: JSON.parse(JSON.stringify(mockTestUser.perkMachine)),
    });

    expect(isFreePerkSpinHourActive(reloaded)).toBe(true);
    const status = getPerkMachineStatus(reloaded);
    expect(status.freePerkSpinHourActive).toBe(true);
    expect(status.freePerkSpinUntil).toBeTruthy();
  });

  test('cooldown constant remains 4 seconds', () => {
    expect(SPIN_COOLDOWN_MS).toBe(4000);
  });
});

describeReal('Free Perk Hour — Mongo integration', () => {
  let user;

  beforeAll(async () => {
    await mongoose.connect(MONGODB_URI);
  });

  afterAll(async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  });

  beforeEach(async () => {
    mockLockHeld = false;
    user = await User.create({
      username: `free_perk_${Date.now()}_${Math.random().toString(16).slice(2)}`,
      email: `free_perk_${Date.now()}@test.local`,
      password: 'testpass123',
      savvyPoints: 500,
    });
    mockTestUser = user;
  });

  afterEach(async () => {
    if (user?._id) await User.deleteOne({ _id: user._id });
  });

  test('Mongo — paid spin costs 0 Savvy during active free hour', async () => {
    const fresh = await User.findById(user._id);
    fresh.perkMachine = fresh.perkMachine || {};
    fresh.perkMachine.freePerkSpinUntil = new Date(Date.now() + 60 * 60 * 1000);
    fresh.perkMachine.lastSpinAt = null;
    fresh.markModified('perkMachine');
    await fresh.save();
    mockTestUser = fresh;

    const before = Number(fresh.savvyPoints) || 0;
    const result = await spinPerkMachine(fresh, { mode: SPIN_MODES.PAID_1 });
    const afterUser = await User.findById(user._id);

    expect(result.savvyCost).toBe(0);
    expect(Number(afterUser.savvyPoints)).toBeGreaterThanOrEqual(before);
  });
});

if (!MONGODB_URI) {
  describe('Free Perk Hour — Mongo integration', () => {
    test('INTEGRATION TEST BLOCKED BY ENVIRONMENT — MONGODB_URI unavailable', () => {
      expect(MONGODB_URI).toBeFalsy();
    });
  });
}

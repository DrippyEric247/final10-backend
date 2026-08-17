/**
 * Wave 3 — progression / spec drift closure tests.
 */
jest.mock('../services/eventActivationService', () => ({
  isDoublePointsLive: jest.fn(() => false),
  isTriplePointsLive: jest.fn(() => false),
}));

jest.mock('../services/battlePassPersistenceService', () => ({
  ensureProgressDocuments: jest.fn(async () => ({
    bp: { xp: 0, premiumUnlocked: false },
  })),
}));

jest.mock('../services/battlePassClaimService', () => ({
  adminGrantXp: jest.fn(async () => ({ xpGranted: 100 })),
}));

jest.mock('../services/eggCamoProgressService', () => ({
  recordLegitimateEggAcquisition: jest.fn(async () => ({ tracked: true })),
}));

jest.mock('../config/eggCamoCollection', () => ({
  isHatchableEggTier: jest.fn(() => true),
}));

jest.mock('../services/savvyBalanceService', () => ({
  creditSavvy: jest.fn(async (user, opts) => {
    user.savvyPoints = (Number(user.savvyPoints) || 0) + (opts.amount || 0);
    return { credited: true, amount: opts.amount, duplicate: false, newBalance: user.savvyPoints };
  }),
  debitSavvy: jest.fn(),
}));

const { buildEggHatchPool, EGG_HATCH_POOLS } = require('../config/eggHatchRewards');
const { DEAL_STREAK_EGG_MILESTONES } = require('../config/dealStreakMilestones');
const {
  grantDealStreakEggMilestone,
  evaluateDealStreakEggMilestones,
} = require('../services/dealStreakEggMilestoneService');
const { ensureDealStreakDoc } = require('../services/dealStreakService');
const {
  advanceLoginStreakProgress,
  ensureDailyStreakDoc,
} = require('../services/dailyStreakService');
const { applyBattlePassTierSkip, COMPLETED_PASS_CONVERSION_SAVVY } = require('../services/battlePassSkipService');
const { grantEggHaul } = require('../services/eggHaulService');
const { activateEasterChallenge } = require('../services/easterChallengeService');
const { ensurePerkMachineDoc, applyReward } = require('../services/perkMachineService');
const { MYTHIC_SAVVY_DURATION_MS } = require('../config/savvyMultiplierConfig');
const { activateMythicSavvyMultiplier, readMythicSavvyBoost } = require('../services/savvyMultiplierService');
const { resolveAuthoritativeSavvyPayout } = require('../services/savvyMultiplierService');
const { REWARD_CLASS } = require('../config/savvyRewardPolicy');
const { EGG_HAUL_BUNDLE_SIZE, EGG_HAUL_DISTRIBUTION } = require('../config/eggHaulConfig');

function mockUser(overrides = {}) {
  return {
    _id: 'user-wave3',
    savvyPoints: 0,
    loginStreakDays: 0,
    longestStreak: 0,
    dailyStreak: {},
    dealStreak: {},
    perkMachine: {},
    markModified: jest.fn(),
    save: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('Wave 3 — Mythic dedicated pool', () => {
  test('mythic pool is separate from legendary', () => {
    const mythic = buildEggHatchPool('mythic');
    const legendary = buildEggHatchPool('legendary');
    expect(mythic.some((r) => r.id === 'mythic_3x_5h')).toBe(true);
    expect(mythic.some((r) => r.id === 'mythic_free_perk_hour')).toBe(true);
    expect(mythic.some((r) => r.id === 'mythic_bp_skip_20')).toBe(true);
    expect(mythic.some((r) => r.id === 'mythic_egg_haul')).toBe(true);
    expect(legendary.some((r) => r.id === 'mythic_3x_5h')).toBe(false);
    expect(EGG_HATCH_POOLS.mythic).toBeTruthy();
  });

  test('rare and legendary login skip rewards exist', () => {
    const rare = buildEggHatchPool('rare');
    const legendary = buildEggHatchPool('legendary');
    expect(rare.find((r) => r.id === 'hatch_login_skip_1')?.days).toBe(1);
    expect(legendary.find((r) => r.id === 'hatch_login_skip_5')?.days).toBe(5);
  });
});

describe('Wave 3 — Mythic 3× / 5h', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-08-10T12:00:00Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('lasts exactly 5 hours through Wave 1 authority', () => {
    const u = mockUser();
    activateMythicSavvyMultiplier(u);
    expect(readMythicSavvyBoost(u).active).toBe(true);
    expect(MYTHIC_SAVVY_DURATION_MS).toBe(5 * 60 * 60 * 1000);

    jest.setSystemTime(new Date('2026-08-10T16:59:00Z'));
    expect(readMythicSavvyBoost(u).active).toBe(true);

    jest.setSystemTime(new Date('2026-08-10T17:01:00Z'));
    expect(readMythicSavvyBoost(u).active).toBe(false);
  });

  test('FIXED rewards ignore mythic multiplier', () => {
    const u = mockUser({
      savvyEarningBoosts: {
        mythic3x: {
          multiplier: 3,
          activatedAt: new Date(),
          expiresAt: new Date(Date.now() + MYTHIC_SAVVY_DURATION_MS),
        },
      },
    });
    const fixed = resolveAuthoritativeSavvyPayout(u, 2000, 'mythic_bp_skip_conversion', {
      rewardClass: REWARD_CLASS.FIXED,
      multiplierEligible: false,
    });
    expect(fixed.finalAmount).toBe(2000);
    expect(fixed.appliedMultiplier).toBe(1);
  });
});

describe('Wave 3 — Deal Streak egg ladder', () => {
  test('milestone config matches 3/6/8 Epic/Legendary/Mythic', () => {
    expect(DEAL_STREAK_EGG_MILESTONES.map((m) => m.streak)).toEqual([3, 6, 8]);
    expect(DEAL_STREAK_EGG_MILESTONES.map((m) => m.eggTier)).toEqual([
      'epic',
      'legendary',
      'mythic',
    ]);
  });

  test('grants exactly one egg per milestone', async () => {
    const user = mockUser();
    const ds = ensureDealStreakDoc(user);
    ds.currentDealStreak = 3;

    const first = await grantDealStreakEggMilestone(user, 3);
    expect(first.granted).toBe(true);
    expect(first.eggTier).toBe('epic');
    expect(user.perkMachine.eggInventory.epic).toBe(1);

    const second = await grantDealStreakEggMilestone(user, 3);
    expect(second.duplicate).toBe(true);
    expect(user.perkMachine.eggInventory.epic).toBe(1);
  });

  test('6 → legendary, 8 → mythic', async () => {
    const user = mockUser();
    ensureDealStreakDoc(user);

    const leg = await evaluateDealStreakEggMilestones(user, 6);
    expect(leg.eggTier).toBe('legendary');
    expect(user.perkMachine.eggInventory.legendary).toBe(1);

    const myth = await evaluateDealStreakEggMilestones(user, 8);
    expect(myth.eggTier).toBe('mythic');
    expect(user.perkMachine.eggInventory.mythic).toBe(1);
  });
});

describe('Wave 3 — Login streak skips', () => {
  test('Rare +1 reaches day 7 milestone once', async () => {
    const user = mockUser({ loginStreakDays: 6 });
    ensureDailyStreakDoc(user);

    const result = await advanceLoginStreakProgress(user, 1, {
      idempotencyKey: 'skip-rare-1',
      source: 'hatch_login_skip_1',
    });

    expect(result.advanced).toBe(true);
    expect(result.fromStreak).toBe(6);
    expect(result.toStreak).toBe(7);
    expect(result.milestonesGranted.some((m) => m.day === 7)).toBe(true);
    expect(user.dailyStreak.claimedMilestoneDays).toContain(7);
  });

  test('Legendary +5 from day 12 grants day 14 milestone once', async () => {
    const user = mockUser({ loginStreakDays: 12 });
    ensureDailyStreakDoc(user);

    const result = await advanceLoginStreakProgress(user, 5, {
      idempotencyKey: 'skip-leg-1',
      source: 'hatch_login_skip_5',
    });

    expect(result.toStreak).toBe(17);
    expect(result.milestonesGranted.some((m) => m.day === 14)).toBe(true);
    expect(user.dailyStreak.claimedMilestoneDays).toContain(14);
    expect(user.dailyStreak.claimedMilestoneDays).not.toContain(7);
  });

  test('duplicate skip request is idempotent', async () => {
    const user = mockUser({ loginStreakDays: 6 });
    ensureDailyStreakDoc(user);

    await advanceLoginStreakProgress(user, 1, {
      idempotencyKey: 'dup-skip',
      source: 'test',
    });
    const dup = await advanceLoginStreakProgress(user, 1, {
      idempotencyKey: 'dup-skip',
      source: 'test',
    });

    expect(dup.duplicate).toBe(true);
    expect(user.loginStreakDays).toBe(7);
  });
});

describe('Wave 3 — Battle Pass 20-tier skip', () => {
  const battlePassClaimService = require('../services/battlePassClaimService');
  const battlePassPersistenceService = require('../services/battlePassPersistenceService');
  const battlePassConfig = require('../lib/battlePassConfig');

  beforeEach(() => {
    battlePassClaimService.adminGrantXp.mockClear();
    battlePassPersistenceService.ensureProgressDocuments.mockResolvedValue({
      bp: { xp: 0, premiumUnlocked: false },
    });
  });

  test('applies +20 tier XP unlock', async () => {
    jest.spyOn(battlePassConfig, 'computeTierFromXp').mockReturnValue(5);

    const user = mockUser();
    const result = await applyBattlePassTierSkip(user, 20, {
      idempotencyKey: 'bp-skip-20',
    });

    expect(result.skipped).toBe(true);
    expect(result.fromTier).toBe(5);
    expect(result.toTier).toBe(25);
    expect(battlePassClaimService.adminGrantXp).toHaveBeenCalled();
  });

  test('completed pass converts to exactly 2000 Savvy', async () => {
    jest.spyOn(battlePassConfig, 'computeTierFromXp').mockReturnValue(60);

    const user = mockUser({ savvyPoints: 100 });
    const result = await applyBattlePassTierSkip(user, 20, {
      idempotencyKey: 'bp-complete',
    });

    expect(result.converted).toBe(true);
    expect(result.conversionSavvy).toBe(2000);
    expect(COMPLETED_PASS_CONVERSION_SAVVY).toBe(2000);
    expect(user.savvyPoints).toBe(2100);
  });

  test('near-complete pass reaches max tier without conversion', async () => {
    jest.spyOn(battlePassConfig, 'computeTierFromXp').mockReturnValue(55);
    battlePassPersistenceService.ensureProgressDocuments.mockResolvedValue({
      bp: { xp: 50000, premiumUnlocked: false },
    });

    const user = mockUser();
    const result = await applyBattlePassTierSkip(user, 20, {
      idempotencyKey: 'bp-near-complete',
    });

    expect(result.skipped).toBe(true);
    expect(result.converted).toBe(false);
    expect(result.toTier).toBe(60);
  });
});

describe('Wave 3 — Egg Haul', () => {
  test('distribution totals bundle size', () => {
    const total = EGG_HAUL_DISTRIBUTION.reduce((s, r) => s + r.quantity, 0);
    expect(total).toBe(EGG_HAUL_BUNDLE_SIZE);
    expect(EGG_HAUL_BUNDLE_SIZE).toBe(20);
  });

  test('grants configured eggs idempotently', async () => {
    const user = mockUser();
    ensurePerkMachineDoc(user);

    const first = await grantEggHaul(user, 'haul-key-1');
    expect(first.granted).toBe(true);
    expect(first.totalEggs).toBe(20);
    expect(user.perkMachine.eggInventory.common).toBe(4);
    expect(user.perkMachine.eggInventory.mythic).toBe(4);

    const dup = await grantEggHaul(user, 'haul-key-1');
    expect(dup.duplicate).toBe(true);
    expect(user.perkMachine.eggInventory.mythic).toBe(4);
  });
});

describe('Wave 3 — Easter challenge', () => {
  test('admin placeholder activates idempotently', async () => {
    const user = mockUser();

    const first = await activateEasterChallenge(user, 'wave3_placeholder', {
      idempotencyKey: 'easter-1',
      adminBypass: true,
    });
    expect(first.activated).toBe(true);

    const dup = await activateEasterChallenge(user, 'wave3_placeholder', {
      idempotencyKey: 'easter-1',
      adminBypass: true,
    });
    expect(dup.duplicate).toBe(true);
  });
});

describe('Wave 3 — Mythic handler audit', () => {
  test('mythic pool does not alias legendary', () => {
    const mythicIds = buildEggHatchPool('mythic').map((r) => r.id);
    const legendaryIds = buildEggHatchPool('legendary').map((r) => r.id);
    expect(mythicIds).not.toEqual(legendaryIds);
    expect(buildEggHatchPool('mythic').length).toBeGreaterThan(0);
  });

  test('each mythic reward type has executable handler path', () => {
    const types = buildEggHatchPool('mythic').map((r) => r.type);
    const expected = [
      'timed_savvy_multiplier',
      'free_perk_spin_hour',
      'bp_tier_skip_bulk',
      'easter_challenge_activator',
      'egg_haul',
    ];
    for (const t of expected) {
      expect(types).toContain(t);
    }
  });
});

describe('Wave 3 — applyReward handlers', () => {
  test('free perk hour extends window', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-08-10T12:00:00Z'));

    const user = mockUser();
    ensurePerkMachineDoc(user);

    const granted = await applyReward(
      user,
      {
        id: 'mythic_free_perk_hour',
        type: 'free_perk_spin_hour',
        durationMs: 60 * 60 * 1000,
        label: 'Free Perk Machine Spins — 1 Hour',
        rarity: 'mythic',
      },
      'hatch:test-free-hour'
    );

    expect(granted.freePerkSpinHour).toBe(true);
    expect(user.perkMachine.freePerkSpinUntil).toBeTruthy();
    expect(new Date(user.perkMachine.freePerkSpinUntil).getTime()).toBe(
      Date.now() + 60 * 60 * 1000
    );

    jest.useRealTimers();
  });
});

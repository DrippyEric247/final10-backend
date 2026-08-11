const {
  DEAL_STREAK_MIN_QUALIFY_INTERVAL_MS,
  DEAL_STREAK_CONTRACT_MILESTONE,
  NUKE_CATEGORY_CONSECUTIVE_TARGET,
} = require('../config/dealStreak');
const {
  NUKE_CATEGORY_CHALLENGES,
  getNukeCategoryChallengeByCategory,
} = require('../config/nukeCategoryChallenges');
const { resolveDealCategory } = require('../lib/dealCategoryUtils');
const {
  ensureDealStreakDoc,
  updateNukeCategoryStreak,
  buildDealStreakStatus,
} = require('../services/dealStreakService');

describe('Deal Streak config', () => {
  test('central cooldown interval is configured', () => {
    expect(DEAL_STREAK_MIN_QUALIFY_INTERVAL_MS).toBeGreaterThan(0);
    expect(DEAL_STREAK_CONTRACT_MILESTONE).toBe(5);
    expect(NUKE_CATEGORY_CONSECUTIVE_TARGET).toBe(30);
  });

  test('nuke challenges are built from camo catalog', () => {
    expect(NUKE_CATEGORY_CHALLENGES.length).toBeGreaterThanOrEqual(4);
    const automotive = getNukeCategoryChallengeByCategory('automotive');
    expect(automotive).toBeTruthy();
    expect(automotive.camoItemId).toBe('camo_automotive_nuke-streak_gloves');
    expect(automotive.requiredConsecutiveDeals).toBe(30);

    const retail = getNukeCategoryChallengeByCategory('retail');
    expect(retail).toBeTruthy();
    expect(retail.camoItemId).toBe('camo_retail_nuke-streak_hoodie');
    expect(retail.camoName).toBe('NUKE HOODIE');
  });
});

describe('dealCategoryUtils', () => {
  test('maps listing aliases to camo categories', () => {
    expect(resolveDealCategory('automotive')).toBe('automotive');
    expect(resolveDealCategory('auto')).toBe('automotive');
    expect(resolveDealCategory('electronics')).toBe('electronics');
    expect(resolveDealCategory('gaming')).toBe('retail');
  });
});

describe('Nuke category streak logic', () => {
  function mockUser() {
    return {
      dealStreak: {},
      markModified: jest.fn(),
    };
  }

  test('different categories still increase normal streak via service state', () => {
    const user = mockUser();
    const ds = ensureDealStreakDoc(user);
    ds.currentDealStreak = 0;

    updateNukeCategoryStreak(ds, 'automotive', new Date());
    ds.currentDealStreak += 1;
    updateNukeCategoryStreak(ds, 'electronics', new Date());
    ds.currentDealStreak += 1;

    expect(ds.currentDealStreak).toBe(2);
    expect(ds.nuke.activeCategory).toBe('electronics');
    expect(ds.nuke.activeStreak).toBe(1);
  });

  test('same category increments nuke consecutive streak', () => {
    const user = mockUser();
    const ds = ensureDealStreakDoc(user);

    updateNukeCategoryStreak(ds, 'automotive', new Date());
    updateNukeCategoryStreak(ds, 'automotive', new Date());
    updateNukeCategoryStreak(ds, 'automotive', new Date());

    expect(ds.nuke.activeCategory).toBe('automotive');
    expect(ds.nuke.activeStreak).toBe(3);
  });

  test('29 automotive + 1 gaming resets automotive nuke display progress', () => {
    const user = mockUser();
    const ds = ensureDealStreakDoc(user);

    for (let i = 0; i < 29; i += 1) {
      updateNukeCategoryStreak(ds, 'automotive', new Date());
      ds.currentDealStreak += 1;
    }
    updateNukeCategoryStreak(ds, 'retail', new Date());
    ds.currentDealStreak += 1;

    expect(ds.currentDealStreak).toBe(30);
    expect(ds.nuke.activeCategory).toBe('retail');
    expect(ds.nuke.activeStreak).toBe(1);

    const status = buildDealStreakStatus(user);
    const automotive = status.nuke.challenges.find((c) => c.category === 'automotive');
    expect(automotive.progress).toBe(0);
    expect(automotive.isComplete).toBe(false);
  });

  test('30 consecutive automotive completes challenge state', () => {
    const user = mockUser();
    const ds = ensureDealStreakDoc(user);

    for (let i = 0; i < 30; i += 1) {
      updateNukeCategoryStreak(ds, 'automotive', new Date());
    }

    expect(ds.nuke.activeStreak).toBe(30);
    const status = buildDealStreakStatus(user);
    const automotive = status.nuke.challenges.find((c) => c.category === 'automotive');
    expect(automotive.progress).toBe(30);
  });

  test('category switch starts new category at 1', () => {
    const user = mockUser();
    const ds = ensureDealStreakDoc(user);

    updateNukeCategoryStreak(ds, 'automotive', new Date());
    updateNukeCategoryStreak(ds, 'automotive', new Date());
    updateNukeCategoryStreak(ds, 'fitness', new Date());

    expect(ds.nuke.activeCategory).toBe('fitness');
    expect(ds.nuke.activeStreak).toBe(1);
  });
});

const mongoose = require('mongoose');
const User = require('../models/User');
const QualifiedDealRecord = require('../models/QualifiedDealRecord');
const ContractProgress = require('../models/ContractProgress');
const { recordQualifyingDeal } = require('../services/dealStreakService');
const { getContractById, periodKeyForContract } = require('../config/contracts');

const MONGODB_URI = process.env.MONGODB_URI || '';
const describeReal = MONGODB_URI ? describe : describe.skip;

describeReal('Deal Streak integration', () => {
  let user;

  beforeAll(async () => {
    await mongoose.connect(MONGODB_URI);
  });

  afterAll(async () => {
    if (!MONGODB_URI) return;
    await mongoose.disconnect();
  });

  beforeEach(async () => {
    user = await User.create({
      username: `deal_streak_${Date.now()}`,
      email: `deal_streak_${Date.now()}@example.com`,
      password: 'testpass123',
    });
  });

  afterEach(async () => {
    if (!user) return;
    await QualifiedDealRecord.deleteMany({ userId: user._id });
    await ContractProgress.deleteMany({ userId: user._id });
    await User.deleteOne({ _id: user._id });
  });

  test('duplicate transaction cannot increment streak twice', async () => {
    const first = await recordQualifyingDeal(user._id, {
      sourceType: 'auction_won',
      sourceId: 'listing-123',
      categoryRaw: 'automotive',
    });
    expect(first.counted).toBe(true);
    expect(first.status.currentDealStreak).toBe(1);

    const second = await recordQualifyingDeal(user._id, {
      sourceType: 'auction_won',
      sourceId: 'listing-123',
      categoryRaw: 'automotive',
    });
    expect(second.duplicate).toBe(true);

    const fresh = await User.findById(user._id);
    expect(fresh.dealStreak.currentDealStreak).toBe(1);
  });

  test('rapid deals respect cooldown without penalizing purchase record', async () => {
    await recordQualifyingDeal(user._id, {
      sourceType: 'auction_won',
      sourceId: 'deal-a',
      categoryRaw: 'automotive',
    });

    const rapid = await recordQualifyingDeal(user._id, {
      sourceType: 'auction_won',
      sourceId: 'deal-b',
      categoryRaw: 'automotive',
    });

    expect(rapid.duplicate).toBe(false);
    expect(rapid.counted).toBe(false);
    expect(rapid.skipReason).toBe('cooldown');

    const fresh = await User.findById(user._id);
    expect(fresh.dealStreak.currentDealStreak).toBe(1);

    const records = await QualifiedDealRecord.find({ userId: user._id }).lean();
    expect(records.length).toBe(2);
  });

  test('contract progress updates at authoritative streak milestone', async () => {
    for (let i = 0; i < 5; i += 1) {
      const u = await User.findById(user._id);
      u.dealStreak.lastQualifiedDealAt = new Date(Date.now() - DEAL_STREAK_MIN_QUALIFY_INTERVAL_MS - 1000);
      u.markModified('dealStreak');
      await u.save();

      await recordQualifyingDeal(user._id, {
        sourceType: 'auction_won',
        sourceId: `deal-${i}`,
        categoryRaw: 'automotive',
      });
    }

    const contract = getContractById('final10_savvy_streak');
    const row = await ContractProgress.findOne({
      userId: user._id,
      contractId: contract.id,
      periodKey: periodKeyForContract(contract),
    }).lean();

    expect(row?.progress).toBeGreaterThanOrEqual(1);
  });
});

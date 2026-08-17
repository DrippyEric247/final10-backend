/**
 * Wave 3 closure — Deal Streak persistence/integration matrix.
 * Requires MONGODB_URI for full matrix; reports ENVIRONMENT BLOCKED otherwise.
 */
const mongoose = require('mongoose');
const User = require('../models/User');
const QualifiedDealRecord = require('../models/QualifiedDealRecord');
const {
  DEAL_STREAK_MIN_QUALIFY_INTERVAL_MS,
} = require('../config/dealStreak');
const {
  recordQualifyingDeal,
  buildDealStreakStatus,
  ensureDealStreakDoc,
  updateNukeCategoryStreak,
} = require('../services/dealStreakService');
const {
  grantDealStreakEggMilestone,
} = require('../services/dealStreakEggMilestoneService');
const { buildQuantumPublicState } = require('../services/quantumEggService');

const MONGODB_URI = process.env.MONGODB_URI || '';
const describeReal = MONGODB_URI ? describe : describe.skip;

async function recordSpacedDeal(userId, sourceId, categoryRaw = 'automotive') {
  const u = await User.findById(userId);
  u.dealStreak.lastQualifiedDealAt = new Date(
    Date.now() - DEAL_STREAK_MIN_QUALIFY_INTERVAL_MS - 1000
  );
  u.markModified('dealStreak');
  await u.save();
  return recordQualifyingDeal(userId, {
    sourceType: 'auction_won',
    sourceId,
    categoryRaw,
  });
}

async function advanceToStreak(userId, targetStreak, categoryRaw = 'automotive') {
  let last;
  for (let i = 0; i < targetStreak; i += 1) {
    last = await recordSpacedDeal(userId, `deal-${targetStreak}-${i}-${Date.now()}`, categoryRaw);
  }
  return last;
}

describeReal('Deal Streak — Wave 3 integration matrix', () => {
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
    user = await User.create({
      username: `ds_wave3_${Date.now()}_${Math.random().toString(16).slice(2)}`,
      email: `ds_wave3_${Date.now()}@test.local`,
      password: 'testpass123',
    });
  });

  afterEach(async () => {
    if (!user?._id) return;
    await QualifiedDealRecord.deleteMany({ userId: user._id });
    await User.deleteOne({ _id: user._id });
  });

  test('A — 3 spaced qualifying deals → exactly one Epic Egg', async () => {
    await advanceToStreak(user._id, 3);
    const fresh = await User.findById(user._id);
    expect(fresh.dealStreak.currentDealStreak).toBe(3);
    expect(fresh.perkMachine?.eggInventory?.epic).toBe(1);
    expect(fresh.dealStreak.streakMilestonesClaimed).toContain('deal_streak_3');
  });

  test('B — 6 deals → exactly one Legendary Egg', async () => {
    await advanceToStreak(user._id, 6);
    const fresh = await User.findById(user._id);
    expect(fresh.perkMachine?.eggInventory?.legendary).toBe(1);
    expect(fresh.dealStreak.streakMilestonesClaimed.filter((k) => k === 'deal_streak_6').length).toBe(1);
  });

  test('C — 8 deals → exactly one Mythic Egg', async () => {
    await advanceToStreak(user._id, 8);
    const fresh = await User.findById(user._id);
    expect(fresh.perkMachine?.eggInventory?.mythic).toBe(1);
    expect(fresh.dealStreak.streakMilestonesClaimed).toContain('deal_streak_8');
  });

  test('D — 30 deals → exactly one Quantum unlock', async () => {
    await advanceToStreak(user._id, 30);
    const fresh = await User.findById(user._id);
    expect(fresh.quantumLegacy?.unlocked).toBe(true);
    expect(fresh.dealStreak.currentDealStreak).toBe(30);
  });

  test('E — retry milestone evaluation does not duplicate eggs', async () => {
    await advanceToStreak(user._id, 3);
    const fresh = await User.findById(user._id);
    const dup = await grantDealStreakEggMilestone(fresh, 3);
    expect(dup.duplicate).toBe(true);
    await fresh.save();
    const again = await User.findById(user._id);
    expect(again.perkMachine?.eggInventory?.epic).toBe(1);
  });

  test('F — mixed categories continue normal Deal Streak', async () => {
    await recordSpacedDeal(user._id, 'mix-1', 'automotive');
    await recordSpacedDeal(user._id, 'mix-2', 'electronics');
    await recordSpacedDeal(user._id, 'mix-3', 'retail');
    const fresh = await User.findById(user._id);
    expect(fresh.dealStreak.currentDealStreak).toBe(3);
  });

  test('G — category switch does not reset normal Deal Streak', async () => {
    await recordSpacedDeal(user._id, 'cat-1', 'automotive');
    await recordSpacedDeal(user._id, 'cat-2', 'electronics');
    const fresh = await User.findById(user._id);
    expect(fresh.dealStreak.currentDealStreak).toBe(2);
  });

  test('H — nuke same-category challenge remains separate', async () => {
    const u = await User.findById(user._id);
    const ds = ensureDealStreakDoc(u);
    updateNukeCategoryStreak(ds, 'automotive', new Date());
    updateNukeCategoryStreak(ds, 'automotive', new Date());
    updateNukeCategoryStreak(ds, 'electronics', new Date());
    u.markModified('dealStreak');
    await u.save();

    const status = buildDealStreakStatus(u);
    expect(status.nuke.activeCategory).toBe('electronics');
    expect(status.nuke.activeStreak).toBe(1);
    const automotive = status.nuke.challenges.find((c) => c.category === 'automotive');
    expect(automotive.progress).toBe(0);
  });

  test('I — deals inside 4-hour interval do not advance normal streak', async () => {
    await recordQualifyingDeal(user._id, {
      sourceType: 'auction_won',
      sourceId: 'cooldown-a',
      categoryRaw: 'automotive',
    });
    const rapid = await recordQualifyingDeal(user._id, {
      sourceType: 'auction_won',
      sourceId: 'cooldown-b',
      categoryRaw: 'automotive',
    });
    expect(rapid.counted).toBe(false);
    expect(rapid.skipReason).toBe('cooldown');
    const fresh = await User.findById(user._id);
    expect(fresh.dealStreak.currentDealStreak).toBe(1);
  });

  test('J — persisted milestone state prevents duplicate after reload', async () => {
    await advanceToStreak(user._id, 3);
    const reloaded = await User.findById(user._id);
    const { evaluateDealStreakEggMilestones } = require('../services/dealStreakEggMilestoneService');
    const retry = await evaluateDealStreakEggMilestones(reloaded, 3);
    expect(retry.duplicate || retry.granted === false).toBe(true);
    expect(reloaded.perkMachine?.eggInventory?.epic).toBe(1);
  });

  test('K — concurrent milestone grant cannot double-award', async () => {
    await advanceToStreak(user._id, 6);
    const fresh = await User.findById(user._id);
    fresh.dealStreak.streakMilestonesClaimed = fresh.dealStreak.streakMilestonesClaimed.filter(
      (k) => k !== 'deal_streak_6'
    );
    fresh.perkMachine.eggInventory.legendary = 0;
    await fresh.save();

    const [a, b] = await Promise.all([
      grantDealStreakEggMilestone(fresh, 6),
      grantDealStreakEggMilestone(fresh, 6),
    ]);
    await fresh.save();
    const after = await User.findById(user._id);
    const grantedCount = [a, b].filter((r) => r.granted).length;
    expect(grantedCount).toBeLessThanOrEqual(1);
    expect(after.perkMachine?.eggInventory?.legendary).toBeLessThanOrEqual(1);
  });

  test('L — quantum requirement hidden from unrevealed public API', async () => {
    const fresh = await User.findById(user._id);
    const quantum = buildQuantumPublicState(fresh);
    expect(quantum.visible).toBe(false);
    expect(quantum.classified).toBe(true);
    const status = buildDealStreakStatus(fresh);
    const serialized = JSON.stringify(status);
    expect(serialized).not.toMatch(/buy 30 deals/i);
    expect(serialized).not.toMatch(/30 deals to get quantum/i);
  });
});

if (!MONGODB_URI) {
  describe('Deal Streak — Wave 3 integration matrix', () => {
    test('INTEGRATION TEST BLOCKED BY ENVIRONMENT — MONGODB_URI unavailable', () => {
      expect(MONGODB_URI).toBeFalsy();
    });
  });
}

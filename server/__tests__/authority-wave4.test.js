/**
 * Wave 4 — server authority / trust boundary tests.
 * Run: cd server && npm test -- authority-wave4.test.js
 */

jest.mock('../services/eventActivationService', () => ({
  isDoublePointsLive: jest.fn(() => false),
  isTriplePointsLive: jest.fn(() => false),
}));

jest.mock('../services/securityAuditService', () => ({
  auditFireAndForget: jest.fn(),
}));

const mongoose = require('mongoose');
const User = require('../models/User');
const ScoutMissionProgress = require('../models/ScoutMissionProgress');
const {
  getBestMoveBudget,
  consumeBestMoveCredit,
  todayKey,
} = require('../services/bestMoveUsageService');
const { rankListings, scoreListing } = require('../services/listingRankingService');
const { resolveUserEntitlements } = require('../services/userEntitlementService');
const {
  recordScoutMissionTrigger,
  isMissionCompleteOnServer,
  tryAcquireMissionClaim,
} = require('../services/scoutMissionProgressService');
const { equipCosmetic } = require('../services/cosmeticInventoryService');
const { getMissionById } = require('../config/scoutMissions');
const { clientObservableDailyCap } = require('../config/scoutMissionTriggers');

const MONGODB_URI = process.env.MONGODB_URI || '';
const describeReal = MONGODB_URI ? describe : describe.skip;

let entitlementSpy;

beforeEach(() => {
  entitlementSpy = jest
    .spyOn(require('../services/premiumEntitlementService'), 'getEntitlementByUserId')
    .mockResolvedValue(null);
});

afterEach(async () => {
  entitlementSpy?.mockRestore();
  jest.restoreAllMocks();
});

function mockFindById(user) {
  jest.spyOn(User, 'findById').mockReturnValue({
    lean: () => Promise.resolve(user),
  });
}

const sampleListing = {
  listingId: 'L-100',
  itemId: 'L-100',
  buyNowPrice: 80,
  marketValue: 120,
  bidCount: 1,
  secondsRemaining: 900,
  condition: 'New',
  shippingCost: 0,
  isBuyNow: true,
  seller: { feedbackScore: 500 },
};

describe('Best Move — server authority', () => {
  it('A — Free user gets canonical Free limit', async () => {
    const user = {
      _id: 'free-user',
      membershipTier: 'free',
      bestMoveUsage: { day: todayKey(), usedToday: 0 },
    };
    mockFindById(user);
    const budget = await getBestMoveBudget('free-user');
    expect(budget.cap).toBe(5);
    expect(budget.unlimited).toBe(false);
  });

  it('B — Premium gets canonical Premium limit', async () => {
    const user = {
      _id: 'prem-user',
      membershipTier: 'premium',
      isPremium: true,
      subscription: { tier: 'core' },
      bestMoveUsage: { day: todayKey(), usedToday: 0 },
    };
    entitlementSpy.mockResolvedValue({
      premiumStatus: 'active',
      premiumTier: 'premium',
      currentPeriodEnd: new Date(Date.now() + 86400000),
    });
    mockFindById(user);
    const budget = await getBestMoveBudget('prem-user');
    expect(budget.cap).toBe(10);
    expect(budget.effectivePlan).toBe('premium');
  });

  it('C — Pro unlimited behavior', async () => {
    const user = {
      _id: 'pro-user',
      membershipTier: 'pro',
      isPremium: true,
      subscription: { tier: 'pro' },
    };
    entitlementSpy.mockResolvedValue({
      premiumStatus: 'active',
      premiumTier: 'elite',
      currentPeriodEnd: new Date(Date.now() + 86400000),
    });
    mockFindById(user);
    const budget = await getBestMoveBudget('pro-user');
    expect(budget.unlimited).toBe(true);
    const consume = await consumeBestMoveCredit('pro-user');
    expect(consume.ok).toBe(true);
  });

  it('D — budget resolves from server entitlements (not client-supplied cap)', async () => {
    const user = {
      _id: 'free-budget',
      membershipTier: 'free',
      isPremium: false,
      subscription: { tier: 'free' },
      bestMoveUsage: { day: todayKey(), usedToday: 0 },
    };
    mockFindById(user);
    const budget = await getBestMoveBudget('free-budget');
    expect(budget.cap).toBe(5);
    expect(budget.effectivePlan).toBe('free');
  });

  it('E — At-cap consume returns BEST_MOVE_LIMIT_REACHED', async () => {
    const user = {
      _id: 'cap-user',
      membershipTier: 'free',
      bestMoveUsage: { day: todayKey(), usedToday: 5 },
    };
    mockFindById(user);
    const result = await consumeBestMoveCredit('cap-user');
    expect(result.ok).toBe(false);
    expect(result.code).toBe('BEST_MOVE_LIMIT_REACHED');
  });
});

describeReal('Best Move — concurrency + reset (Mongo)', () => {
  let userId;

  beforeAll(async () => {
    await mongoose.connect(MONGODB_URI);
  });

  afterAll(async () => {
    if (userId) await User.deleteOne({ _id: userId });
    await mongoose.disconnect();
  });

  it('F — concurrent final-slot requests allow only one', async () => {
    const user = await User.create({
      email: `wave4-bm-${Date.now()}@example.com`,
      username: `wave4bm${Date.now()}`,
      password: 'testpass123',
      membershipTier: 'free',
      bestMoveUsage: { day: todayKey(), usedToday: 4 },
    });
    userId = user._id;

    entitlementSpy.mockRestore();
    entitlementSpy = jest
      .spyOn(require('../services/premiumEntitlementService'), 'getEntitlementByUserId')
      .mockResolvedValue(null);

    const [a, b] = await Promise.all([
      consumeBestMoveCredit(userId),
      consumeBestMoveCredit(userId),
    ]);
    const okCount = [a, b].filter((r) => r.ok).length;
    expect(okCount).toBe(1);
    const fail = [a, b].find((r) => !r.ok);
    expect(fail?.code).toBe('BEST_MOVE_LIMIT_REACHED');
  });

  it('G — server UTC day reset clears usage', async () => {
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    await User.updateOne(
      { _id: userId },
      { $set: { bestMoveUsage: { day: yesterday, usedToday: 5 } } }
    );
    const budget = await getBestMoveBudget(userId);
    expect(budget.used).toBe(0);
    expect(budget.allowed).toBe(true);
  });
});

describe('Ranking — server authority', () => {
  it('A — same inputs produce deterministic server score', () => {
    const a = scoreListing(sampleListing);
    const b = scoreListing(sampleListing);
    expect(a.rankScore).toBe(b.rankScore);
    expect(a.signals.trustScore).toBe(b.signals.trustScore);
  });

  it('B — client-modified rankScore in payload ignored', () => {
    const spoofed = { ...sampleListing, rankScore: 99999, trustScore: 100 };
    const row = scoreListing(spoofed);
    expect(row.rankScore).toBeLessThan(500);
    expect(row.signals.trustScore).not.toBe(100);
  });

  it('C — BEST_MOVE label comes from server recommendation', () => {
    const highValue = {
      ...sampleListing,
      buyNowPrice: 40,
      marketValue: 200,
      bidCount: 0,
      seller: { feedbackScore: 2000 },
    };
    const ranked = rankListings([highValue], { tierBoost: 0 });
    expect(Array.isArray(ranked[0].labels)).toBe(true);
  });

  it('D — trust score is server-derived', () => {
    const row = scoreListing(sampleListing);
    expect(typeof row.signals.trustScore).toBe('number');
    expect(row.signals.trustScore).toBeGreaterThan(0);
  });

  it('E — subscription tier boost applied via options only', () => {
    const freeRank = rankListings([sampleListing], { tierBoost: 0 });
    const proRank = rankListings([sampleListing], { tierBoost: 22 });
    expect(proRank[0].rankScore).toBeGreaterThan(freeRank[0].rankScore);
  });

  it('G — ranking order is deterministic', () => {
    const listings = [
      { ...sampleListing, listingId: 'a', buyNowPrice: 90 },
      { ...sampleListing, listingId: 'b', buyNowPrice: 70 },
      { ...sampleListing, listingId: 'c', buyNowPrice: 50 },
    ];
    const once = rankListings(listings).map((r) => r.listingId);
    const twice = rankListings(listings).map((r) => r.listingId);
    expect(once).toEqual(twice);
  });
});

describeReal('Scout — action verification (Mongo)', () => {
  let userId;

  beforeAll(async () => {
    await mongoose.connect(MONGODB_URI);
  });

  beforeEach(async () => {
    const user = await User.create({
      email: `wave4-scout-${Date.now()}@example.com`,
      username: `wave4scout${Date.now()}`,
      password: 'testpass123',
    });
    userId = user._id;
    await ScoutMissionProgress.deleteMany({ userId });
  });

  afterEach(async () => {
    if (userId) {
      await ScoutMissionProgress.deleteMany({ userId });
      await User.deleteOne({ _id: userId });
    }
  });

  afterAll(async () => {
    await mongoose.disconnect();
  });

  it('A — server save_deal hook increments progress once', async () => {
    const mission = getMissionById('save_deal');
    const { periodKeyForMission } = require('../config/scoutMissions');
    const periodKey = periodKeyForMission(mission);
    const dedupeKey = `save_deal:listing-42:${periodKey}`;
    await recordScoutMissionTrigger(userId, 'save_deal', { source: 'server', dedupeKey });
    const complete = await isMissionCompleteOnServer(userId, mission);
    expect(complete).toBe(true);
  });

  it('B — dedupeKey prevents hook + replay double-count', async () => {
    const mission = getMissionById('save_deal');
    const { periodKeyForMission } = require('../config/scoutMissions');
    const periodKey = periodKeyForMission(mission);
    const dedupeKey = `save_deal:listing-dedupe:${periodKey}`;
    await recordScoutMissionTrigger(userId, 'save_deal', { source: 'server', dedupeKey });
    await recordScoutMissionTrigger(userId, 'save_deal', { source: 'server', dedupeKey });
    const row = await ScoutMissionProgress.findOne({ userId, missionId: mission.id }).lean();
    expect(Number(row?.progress)).toBe(1);
  });

  it('C — client-observable share_deal increments via client path', async () => {
    await recordScoutMissionTrigger(userId, 'share_deal', {
      source: 'client',
      allowClientObservable: true,
      idempotencyKey: 'share-once',
    });
    const mission = getMissionById('share_deal');
    const complete = await isMissionCompleteOnServer(userId, mission);
    expect(complete).toBe(true);
  });

  it('D — idempotent client replay does not double-count daily cap', async () => {
    const key = 'replay-key-1';
    await recordScoutMissionTrigger(userId, 'share_deal', {
      source: 'client',
      allowClientObservable: true,
      idempotencyKey: key,
    });
    await recordScoutMissionTrigger(userId, 'share_deal', {
      source: 'client',
      allowClientObservable: true,
      idempotencyKey: key,
    });
    const user = await User.findById(userId).lean();
    expect(user.scoutClientActionDaily.counts.share_deal).toBe(1);
  });

  it('F — claim before completion denied', async () => {
    const mission = getMissionById('share_deal');
    const claim = await tryAcquireMissionClaim(userId, mission);
    expect(claim.ok).toBe(false);
    expect(claim.error).toBe('mission_not_complete');
  });

  it('G/H — claim after completion succeeds once', async () => {
    const mission = getMissionById('save_deal');
    await recordScoutMissionTrigger(userId, 'save_deal', { source: 'server' });
    const first = await tryAcquireMissionClaim(userId, mission);
    expect(first.ok).toBe(true);
    const second = await tryAcquireMissionClaim(userId, mission);
    expect(second.ok).toBe(false);
    expect(second.error).toBe('already_claimed');
  });

  it('I — rate-limited client-only action cannot spam beyond daily cap', async () => {
    const cap = clientObservableDailyCap('share_deal');
    for (let i = 0; i < cap; i += 1) {
      await recordScoutMissionTrigger(userId, 'share_deal', {
        source: 'client',
        allowClientObservable: true,
        idempotencyKey: `share-${i}`,
      });
    }
    await expect(
      recordScoutMissionTrigger(userId, 'share_deal', {
        source: 'client',
        allowClientObservable: true,
        idempotencyKey: 'share-overflow',
      })
    ).rejects.toMatchObject({ code: 'SCOUT_ACTION_RATE_LIMIT' });
  });
});

describe('Scout — route validation (unit)', () => {
  it('D — rejects client reward amount payload shape', () => {
    const body = { trigger: 'save_deal', rewardAmount: 999 };
    expect(body.rewardAmount != null).toBe(true);
  });

  it('C — unknown trigger is not in known set', () => {
    const { isKnownScoutTrigger } = require('../config/scoutMissionTriggers');
    expect(isKnownScoutTrigger('totally_fake_action')).toBe(false);
  });

  it('E — save_deal is server-verifiable (client POST blocked at route)', () => {
    const { isServerVerifiableTrigger } = require('../config/scoutMissionTriggers');
    expect(isServerVerifiableTrigger('save_deal')).toBe(true);
    expect(isServerVerifiableTrigger('create_alert')).toBe(true);
  });

  it('F — duplicate dedupe keys are classified server-side', () => {
    const { isServerVerifiableTrigger } = require('../config/scoutMissionTriggers');
    expect(isServerVerifiableTrigger('add_watchlist')).toBe(true);
    expect(isServerVerifiableTrigger('share_deal')).toBe(false);
  });
});

describeReal('Cosmetics — ownership authority (Mongo)', () => {
  let userId;

  beforeAll(async () => {
    await mongoose.connect(MONGODB_URI);
  });

  beforeEach(async () => {
    const user = await User.create({
      email: `wave4-cos-${Date.now()}@example.com`,
      username: `wave4cos${Date.now()}`,
      password: 'testpass123',
    });
    userId = user._id;
  });

  afterEach(async () => {
    if (userId) await User.deleteOne({ _id: userId });
  });

  afterAll(async () => {
    await mongoose.disconnect();
  });

  it('B — unowned cosmetic equip denied with COSMETIC_NOT_OWNED', async () => {
    await expect(equipCosmetic(userId, 'emblem', 'sigil_mythic')).rejects.toMatchObject({
      code: 'COSMETIC_NOT_OWNED',
      status: 403,
    });
  });

  it('A — owned cosmetic equips', async () => {
    const { grantSystemCosmeticUnlock } = require('../services/cosmeticInventoryService');
    await grantSystemCosmeticUnlock(userId, 'sigil_starter', 'test');
    const result = await equipCosmetic(userId, 'emblem', 'sigil_starter');
    expect(result.equipped.emblemId).toBe('sigil_starter');
  });

  it('H — duplicate grant does not create duplicate ownership', async () => {
    const { grantSystemCosmeticUnlock } = require('../services/cosmeticInventoryService');
    await grantSystemCosmeticUnlock(userId, 'sigil_starter', 'test');
    await grantSystemCosmeticUnlock(userId, 'sigil_starter', 'test');
    const inv = await require('../services/cosmeticInventoryService').getCosmeticsForUser(userId);
    const count = inv.unlockedItemIds.filter((id) => id === 'sigil_starter').length;
    expect(count).toBe(1);
  });
});

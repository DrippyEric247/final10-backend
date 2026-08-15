/**
 * Wave 2 closure tests — Best Move authority, payment delegation, regression.
 * Run: cd server && npm test -- entitlement-wave2-closure.test.js
 */

jest.mock('../services/eventActivationService', () => ({
  isDoublePointsLive: jest.fn(() => false),
  isTriplePointsLive: jest.fn(() => false),
}));

const mongoose = require('mongoose');
const User = require('../models/User');
const PremiumEntitlement = require('../models/PremiumEntitlement');
const {
  getBestMoveBudget,
  consumeBestMoveCredit,
} = require('../services/bestMoveUsageService');
const {
  applyVerifiedPaidSubscription,
  revokePaidSubscription,
} = require('../services/subscriptionWriteService');
const { resolveUserEntitlements } = require('../services/userEntitlementService');
const { calculateSavvyReward } = require('../services/savvyMultiplierService');
const { getRewardPolicy, REWARD_CLASS } = require('../config/savvyRewardPolicy');

const MONGODB_URI = process.env.MONGODB_URI || '';
const describeReal = MONGODB_URI ? describe : describe.skip;

const prevBeta = process.env.BETA_MODE;
let entitlementSpy;

beforeEach(() => {
  entitlementSpy = jest
    .spyOn(require('../services/premiumEntitlementService'), 'getEntitlementByUserId')
    .mockResolvedValue(null);
});

afterEach(async () => {
  entitlementSpy?.mockRestore();
  jest.restoreAllMocks();
  if (prevBeta === undefined) delete process.env.BETA_MODE;
  else process.env.BETA_MODE = prevBeta;
});

function mockFindById(user) {
  jest.spyOn(User, 'findById').mockReturnValue({
    lean: () => Promise.resolve(user),
  });
}

describe('A — Free user cannot exceed server Best Move limit', () => {
  it('blocks consume after cap reached', async () => {
    delete process.env.BETA_MODE;
    const userId = 'free-cap-user';
    const user = {
      _id: userId,
      membershipTier: 'free',
      isPremium: false,
      subscription: { tier: 'free' },
      bestMoveUsage: { day: new Date().toISOString().split('T')[0], usedToday: 5 },
    };

    mockFindById(user);

    const budget = await getBestMoveBudget(userId);
    expect(budget.cap).toBe(5);
    expect(budget.allowed).toBe(false);

    const result = await consumeBestMoveCredit(userId);
    expect(result.ok).toBe(false);
    expect(result.code).toBe('BEST_MOVE_LIMIT_REACHED');
  });
});

describe('B — Premium user receives Premium Best Move limit', () => {
  it('cap is 10 for premium effective plan', async () => {
    delete process.env.BETA_MODE;
    const user = {
      _id: 'prem-user',
      membershipTier: 'premium',
      isPremium: true,
      subscription: { tier: 'core' },
      bestMoveUsage: { day: new Date().toISOString().split('T')[0], usedToday: 0 },
    };
    const ent = {
      premiumStatus: 'active',
      premiumTier: 'premium',
      currentPeriodEnd: new Date(Date.now() + 30 * 86400000),
    };
    entitlementSpy.mockResolvedValue(ent);
    mockFindById(user);

    const budget = await getBestMoveBudget('prem-user');
    expect(budget.cap).toBe(10);
    expect(budget.effectivePlan).toBe('premium');

  });
});

describe('C — Pro unlimited behavior', () => {
  it('returns unlimited for pro plan', async () => {
    delete process.env.BETA_MODE;
    const user = {
      _id: 'pro-user',
      membershipTier: 'pro',
      isPremium: true,
      subscription: { tier: 'pro' },
    };
    const ent = {
      premiumStatus: 'active',
      premiumTier: 'elite',
      currentPeriodEnd: new Date(Date.now() + 30 * 86400000),
    };
    entitlementSpy.mockResolvedValue(ent);
    mockFindById(user);

    const budget = await getBestMoveBudget('pro-user');
    expect(budget.unlimited).toBe(true);

    const consume = await consumeBestMoveCredit('pro-user');
    expect(consume.ok).toBe(true);
    expect(consume.unlimited).toBe(true);

  });
});

describe('D — Client claiming pro cannot bypass Free Best Move limit', () => {
  it('server enforces free cap — client state is irrelevant', async () => {
    delete process.env.BETA_MODE;
    const userId = 'free-spoof-user';
    const day = new Date().toISOString().split('T')[0];
    const user = {
      _id: userId,
      membershipTier: 'free',
      isPremium: false,
      subscription: { tier: 'free' },
      bestMoveUsage: { day, usedToday: 5 },
    };
    mockFindById(user);

    const budget = await getBestMoveBudget(userId);
    expect(budget.effectivePlan).toBe('free');
    expect(budget.cap).toBe(5);
    expect(budget.allowed).toBe(false);
  });
});

describe('E — Concurrent Best Move requests', () => {
  it('only one consume succeeds at cap boundary', async () => {
    delete process.env.BETA_MODE;
    const userId = 'concurrent-free-user';
    const day = new Date().toISOString().split('T')[0];
    let used = 4;

    const baseUser = {
      _id: userId,
      membershipTier: 'free',
      isPremium: false,
      subscription: { tier: 'free' },
      bestMoveUsage: { day, usedToday: used },
    };

    jest.spyOn(User, 'findById').mockImplementation(() => ({
      lean: async () => ({
        ...baseUser,
        bestMoveUsage: { day, usedToday: used },
      }),
    }));

    jest.spyOn(User, 'findOneAndUpdate').mockImplementation(async () => {
      if (used >= 5) return null;
      used += 1;
      return {
        ...baseUser,
        bestMoveUsage: { day, usedToday: used, lastUsedAt: new Date() },
      };
    });

    const first = await consumeBestMoveCredit(userId);
    expect(first.ok).toBe(true);
    const second = await consumeBestMoveCredit(userId);
    expect(second.ok).toBe(false);
    expect(second.code).toBe('BEST_MOVE_LIMIT_REACHED');
  });
});

describe('F — Legacy payment route delegates to canonical authority', () => {
  describeReal('with mongo', () => {
    beforeAll(async () => {
      if (mongoose.connection.readyState === 0) {
        await mongoose.connect(MONGODB_URI);
      }
    });

    it('applyVerifiedPaidSubscription writes PremiumEntitlement + User compat', async () => {
      const user = await User.create({
        username: 'closure_pay',
        email: 'closure_pay@closure-test.local',
        password: 'hashed',
        membershipTier: 'free',
      });
      const exp = new Date(Date.now() + 30 * 86400000);
      await applyVerifiedPaidSubscription(user._id, {
        plan: 'premium',
        expiresAt: exp,
        provider: 'legacy_payment_intent',
      });

      const ent = await PremiumEntitlement.findOne({ userId: user._id }).lean();
      const fresh = await User.findById(user._id).lean();
      const resolved = resolveUserEntitlements(fresh, ent);

      expect(ent.premiumStatus).toBe('active');
      expect(ent.premiumTier).toBe('premium');
      expect(resolved.effectivePlan).toBe('premium');
      expect(resolved.basePlan).toBe('premium');
      expect(fresh.membershipTier).toBe('premium');
      expect(fresh.isPremium).toBe(true);
    });
  });
});

describe('G — New paid subscription does not create contradictory tier states', () => {
  describeReal('with mongo pro', () => {
    beforeAll(async () => {
      if (mongoose.connection.readyState === 0) {
        await mongoose.connect(MONGODB_URI);
      }
    });

    it('pro plan is consistent across entitlement and user', async () => {
      const user = await User.create({
        username: 'closure_pro',
        email: 'closure_pro@closure-test.local',
        password: 'hashed',
        membershipTier: 'free',
      });
      const exp = new Date(Date.now() + 30 * 86400000);
      await applyVerifiedPaidSubscription(user._id, {
        plan: 'pro',
        expiresAt: exp,
        provider: 'dev_subscribe',
        subscriptionObject: { tier: 'pro', billing: 'monthly', multiplier: 1.35 },
      });
      const ent = await PremiumEntitlement.findOne({ userId: user._id }).lean();
      const fresh = await User.findById(user._id).lean();
      const resolved = resolveUserEntitlements(fresh, ent);
      expect(ent.premiumTier).toBe('elite');
      expect(resolved.effectivePlan).toBe('pro');
      expect(fresh.membershipTier).toBe('pro');
      expect(fresh.subscription.tier).toBe('pro');
    });
  });
});

describe('H — Existing legacy user still resolves correctly', () => {
  it('legacy subscription.tier core resolves premium', () => {
    delete process.env.BETA_MODE;
    const user = {
      membershipTier: 'free',
      isPremium: false,
      subscription: { tier: 'core' },
    };
    const r = resolveUserEntitlements(user, null);
    expect(r.effectivePlan).toBe('premium');
  });
});

describe('I — Temporary grant still resolves correctly', () => {
  it('founding tester grand reward resolves pro with free base', () => {
    delete process.env.BETA_MODE;
    const user = {
      membershipTier: 'pro',
      isPremium: true,
      foundingTesterProgramCompleted: true,
      subscriptionExpires: new Date(Date.now() + 10 * 86400000),
    };
    const r = resolveUserEntitlements(user, null);
    expect(r.effectivePlan).toBe('pro');
    expect(r.basePlan).toBe('free');
    expect(r.entitlementSource).toBe('founding_tester');
  });
});

describe('J — localStorage spoof still fails at server', () => {
  it('server budget ignores client-only state', async () => {
    delete process.env.BETA_MODE;
    const user = {
      _id: 'server-free',
      membershipTier: 'free',
      isPremium: false,
      subscription: { tier: 'free' },
      bestMoveUsage: { day: new Date().toISOString().split('T')[0], usedToday: 0 },
    };
    mockFindById(user);
    const budget = await getBestMoveBudget('server-free');
    expect(budget.effectivePlan).toBe('free');
    expect(budget.cap).toBe(5);
    User.findById.mockRestore();
  });
});

describe('K — Wave 1 multiplier integration still passes', () => {
  it('premium subscription bonus applies on earning source', () => {
    delete process.env.BETA_MODE;
    const u = {
      membershipTier: 'premium',
      isPremium: true,
      subscription: { tier: 'core' },
      powerMultiplier: 1,
      powerMultiplierBonus: 0,
      dealStreak: { currentDealStreak: 0 },
      savvyEcosystem: {},
    };
    const r = calculateSavvyReward(u, 100, { source: 'deal_purchase' });
    expect(r.finalAmount).toBeGreaterThan(100);
  });
});

describe('L — Fixed rewards remain fixed', () => {
  it('perk machine stays flat for pro user', () => {
    delete process.env.BETA_MODE;
    const u = {
      membershipTier: 'pro',
      isPremium: true,
      subscription: { tier: 'pro' },
      powerMultiplier: 1,
      powerMultiplierBonus: 0,
      dealStreak: { currentDealStreak: 0 },
      savvyEcosystem: {},
    };
    const policy = getRewardPolicy('perk_machine');
    expect(policy.rewardClass).toBe(REWARD_CLASS.FIXED);
    const r = calculateSavvyReward(u, 50, { source: 'perk_machine' });
    expect(r.finalAmount).toBe(50);
  });
});

describe('revokePaidSubscription clears canonical state', () => {
  describeReal('mongo revoke', () => {
    beforeAll(async () => {
      if (mongoose.connection.readyState === 0) {
        await mongoose.connect(MONGODB_URI);
      }
    });

    it('clears paid access', async () => {
      const user = await User.create({
        username: 'closure_revoke',
        email: 'closure_revoke@closure-test.local',
        password: 'hashed',
        membershipTier: 'free',
      });
      const exp = new Date(Date.now() + 30 * 86400000);
      await applyVerifiedPaidSubscription(user._id, { plan: 'premium', expiresAt: exp, provider: 'test' });
      await revokePaidSubscription(user._id);
      const ent = await PremiumEntitlement.findOne({ userId: user._id }).lean();
      const fresh = await User.findById(user._id).lean();
      const resolved = resolveUserEntitlements(fresh, ent);
      expect(resolved.effectivePlan).toBe('free');
      expect(ent.premiumStatus).toBe('inactive');
    });
  });
});

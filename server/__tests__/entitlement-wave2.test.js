/**
 * Wave 2 — Entitlement / Subscription Truth tests (A–M).
 * Run: cd server && npm test -- entitlement-wave2.test.js
 */

jest.mock('../services/eventActivationService', () => ({
  isDoublePointsLive: jest.fn(() => false),
  isTriplePointsLive: jest.fn(() => false),
}));

const {
  resolveUserEntitlements,
  isFoundingTesterGrandRewardMembership,
} = require('../services/userEntitlementService');
const { normalizeCanonicalPlan, PLAN } = require('../config/canonicalPlans');
const { calculateSavvyReward } = require('../services/savvyMultiplierService');
const { getRewardPolicy, REWARD_CLASS } = require('../config/savvyRewardPolicy');

const prevBeta = process.env.BETA_MODE;

afterEach(() => {
  if (prevBeta === undefined) delete process.env.BETA_MODE;
  else process.env.BETA_MODE = prevBeta;
});

function mockUser(overrides = {}) {
  return {
    _id: 'ent-user-1',
    membershipTier: 'free',
    isPremium: false,
    subscription: { tier: 'free' },
    ...overrides,
  };
}

function stripeEntitlement(tier, status = 'active') {
  return {
    premiumStatus: status,
    premiumTier: tier === 'pro' ? 'elite' : tier === 'premium' ? 'premium' : 'free',
    currentPeriodEnd: new Date(Date.now() + 30 * 86400000),
    provider: 'stripe',
  };
}

describe('A — Free user', () => {
  it('basePlan and effectivePlan are free with Free limits', () => {
    delete process.env.BETA_MODE;
    const u = mockUser();
    const r = resolveUserEntitlements(u, null);
    expect(r.basePlan).toBe('free');
    expect(r.effectivePlan).toBe('free');
    expect(r.features.bestMovesPerDay).toBe(5);
    expect(r.features.alertLimit).toBe(5);
    expect(r.features.alertSpeedTier).toBe('standard');
  });
});

describe('B — Paid Premium', () => {
  it('effectivePlan premium with Premium limits, Pro denied', () => {
    delete process.env.BETA_MODE;
    const u = mockUser();
    const ent = stripeEntitlement('premium');
    const r = resolveUserEntitlements(u, ent);
    expect(r.effectivePlan).toBe('premium');
    expect(r.features.bestMovesPerDay).toBe(10);
    expect(r.features.alertLimit).toBe(15);
    expect(r.features.advancedBestMove).toBe(false);
    expect(r.features.sellerInsights).toBe(false);
  });
});

describe('C — Paid Pro', () => {
  it('effectivePlan pro with Pro tier features', () => {
    delete process.env.BETA_MODE;
    const u = mockUser();
    const ent = stripeEntitlement('pro');
    const r = resolveUserEntitlements(u, ent);
    expect(r.effectivePlan).toBe('pro');
    expect(r.features.bestMovesPerDay).toBe(Number.POSITIVE_INFINITY);
    expect(r.features.advancedBestMove).toBe(true);
    expect(r.features.sellerInsights).toBe(true);
    expect(r.features.alertSpeedTier).toBe('fastest');
  });
});

describe('D — Beta override', () => {
  it('basePlan stays free while effectivePlan is pro under BETA_MODE', () => {
    process.env.BETA_MODE = 'true';
    const u = mockUser({ membershipTier: 'free' });
    const r = resolveUserEntitlements(u, null);
    expect(r.basePlan).toBe('free');
    expect(r.effectivePlan).toBe('pro');
    expect(r.entitlementSource).toBe('beta');
  });
});

describe('E — Founding Tester 30d Pro grant', () => {
  it('free user with grand reward gets pro until expiration', () => {
    delete process.env.BETA_MODE;
    const exp = new Date(Date.now() + 20 * 86400000);
    const u = mockUser({
      membershipTier: 'pro',
      isPremium: true,
      foundingTesterProgramCompleted: true,
      subscriptionExpires: exp,
    });
    expect(isFoundingTesterGrandRewardMembership(u)).toBe(true);
    const r = resolveUserEntitlements(u, null);
    expect(r.basePlan).toBe('free');
    expect(r.effectivePlan).toBe('pro');
    expect(r.entitlementSource).toBe('founding_tester');
  });

  it('returns to free after grant expires', () => {
    delete process.env.BETA_MODE;
    const u = mockUser({
      membershipTier: 'pro',
      isPremium: true,
      foundingTesterProgramCompleted: true,
      subscriptionExpires: new Date(Date.now() - 86400000),
    });
    const r = resolveUserEntitlements(u, null);
    expect(r.effectivePlan).toBe('free');
  });
});

describe('F — Paid Premium + temporary Pro', () => {
  it('effective pro during founding grant, base stays premium', () => {
    delete process.env.BETA_MODE;
    const exp = new Date(Date.now() + 10 * 86400000);
    const u = mockUser({
      membershipTier: 'pro',
      isPremium: true,
      foundingTesterProgramCompleted: true,
      subscriptionExpires: exp,
    });
    const ent = stripeEntitlement('premium');
    const r = resolveUserEntitlements(u, ent);
    expect(r.basePlan).toBe('premium');
    expect(r.effectivePlan).toBe('pro');
  });

  it('returns to premium after temporary pro expires', () => {
    delete process.env.BETA_MODE;
    const u = mockUser({
      membershipTier: 'pro',
      isPremium: true,
      foundingTesterProgramCompleted: true,
      subscriptionExpires: new Date(Date.now() - 1000),
    });
    const ent = stripeEntitlement('premium');
    const r = resolveUserEntitlements(u, ent);
    expect(r.basePlan).toBe('premium');
    expect(r.effectivePlan).toBe('premium');
  });
});

describe('G — Paid Pro + temporary Pro must not shorten', () => {
  it('paid pro with longer stripe period wins over shorter grant storage', () => {
    delete process.env.BETA_MODE;
    const shortGrant = new Date(Date.now() + 5 * 86400000);
    const u = mockUser({
      membershipTier: 'pro',
      isPremium: true,
      foundingTesterProgramCompleted: true,
      subscriptionExpires: shortGrant,
    });
    const ent = {
      premiumStatus: 'active',
      premiumTier: 'elite',
      currentPeriodEnd: new Date(Date.now() + 60 * 86400000),
    };
    const r = resolveUserEntitlements(u, ent);
    expect(r.basePlan).toBe('pro');
    expect(r.effectivePlan).toBe('pro');
    expect(r.expiresAt).toEqual(ent.currentPeriodEnd);
  });
});

describe('H — Expired grant', () => {
  it('does not provide pro access after expiry', () => {
    delete process.env.BETA_MODE;
    const u = mockUser({
      membershipTier: 'pro',
      isPremium: true,
      foundingTesterProgramCompleted: true,
      subscriptionExpires: new Date(Date.now() - 3600000),
    });
    const r = resolveUserEntitlements(u, null);
    expect(r.effectivePlan).toBe('free');
    expect(r.isPro).toBe(false);
  });
});

describe('I — Client spoof attempt (server wins)', () => {
  it('resolver ignores client-only state — free user stays free', () => {
    delete process.env.BETA_MODE;
    const u = mockUser({ membershipTier: 'free', isPremium: false });
    const r = resolveUserEntitlements(u, null);
    expect(r.effectivePlan).toBe('free');
  });
});

describe('J — Invalid legacy tier', () => {
  it('unknown tier fails safe to free', () => {
    expect(normalizeCanonicalPlan('mystery_tier_xyz')).toBe(PLAN.FREE);
    const u = mockUser({ membershipTier: 'mystery_tier_xyz', isPremium: true });
    const r = resolveUserEntitlements(u, null);
    expect(r.effectivePlan).toBe('free');
  });

  it('core maps to premium, elite maps to pro', () => {
    expect(normalizeCanonicalPlan('core')).toBe('premium');
    expect(normalizeCanonicalPlan('elite')).toBe('pro');
  });
});

describe('K — Subscription bonus feeds Wave 1 multiplier', () => {
  it('premium tier adds subscription bonus on earning rewards', () => {
    delete process.env.BETA_MODE;
    const u = mockUser({ membershipTier: 'premium', isPremium: true, subscription: { tier: 'core' } });
    const ent = stripeEntitlement('premium');
    Object.assign(u, { subscriptionExpires: ent.currentPeriodEnd });
    const r = calculateSavvyReward(u, 100, { source: 'deal_purchase' });
    expect(r.finalAmount).toBeGreaterThan(100);
  });
});

describe('L — Fixed reward unaffected by subscription tier', () => {
  it('perk machine payout stays exact for pro user', () => {
    delete process.env.BETA_MODE;
    process.env.BETA_MODE = 'false';
    const u = mockUser({ membershipTier: 'pro', isPremium: true, subscription: { tier: 'pro' } });
    const ent = stripeEntitlement('pro');
    const resolved = resolveUserEntitlements(u, ent);
    expect(resolved.effectivePlan).toBe('pro');
    const policy = getRewardPolicy('perk_machine');
    expect(policy.rewardClass).toBe(REWARD_CLASS.FIXED);
    const r = calculateSavvyReward(u, 50, { source: 'perk_machine' });
    expect(r.finalAmount).toBe(50);
    expect(r.appliedMultiplier).toBe(1);
  });
});

describe('M — Feature limits by plan', () => {
  it('Free/Premium/Pro limits resolve correctly', () => {
    delete process.env.BETA_MODE;
    const free = resolveUserEntitlements(mockUser(), null);
    const premium = resolveUserEntitlements(mockUser(), stripeEntitlement('premium'));
    const pro = resolveUserEntitlements(mockUser(), stripeEntitlement('pro'));

    expect(free.features.bestMovesPerDay).toBe(5);
    expect(premium.features.bestMovesPerDay).toBe(10);
    expect(pro.features.bestMovesPerDay).toBe(Number.POSITIVE_INFINITY);

    expect(free.features.alertLimit).toBe(5);
    expect(premium.features.alertLimit).toBe(15);
    expect(pro.features.alertLimit).toBe(Number.POSITIVE_INFINITY);
  });
});

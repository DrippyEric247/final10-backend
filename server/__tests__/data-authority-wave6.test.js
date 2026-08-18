/**
 * Wave 6 — data authority / legacy consolidation tests.
 */

const {
  resolveSavvyBalance,
  detectSavvyBalanceConflict,
  resolveSavvyBalanceMigrationTarget,
  resolveLoginStreak,
  buildNormalizationPatch,
  isUserNormalized,
} = require('../lib/dataAuthority');

describe('Wave 6 — Savvy balance authority', () => {
  it('A — canonical savvyPoints wins over mirror', () => {
    expect(resolveSavvyBalance({ savvyPoints: 120, pointsBalance: 999 })).toBe(120);
  });

  it('B — legacy pointsBalance cannot override when savvyPoints missing', () => {
    expect(resolveSavvyBalance({ pointsBalance: 80 })).toBe(80);
    expect(resolveSavvyBalance({ points: 500, savvyPoints: 40 })).toBe(40);
  });

  it('F — ambiguous migration flagged when mirror exceeds canonical', async () => {
    const target = await resolveSavvyBalanceMigrationTarget({ savvyPoints: 100, pointsBalance: 150 });
    expect(target.ambiguous).toBe(true);
    expect(target.source).toBe('savvyPoints');
  });

  it('conflict detector identifies mirror drift', () => {
    const out = detectSavvyBalanceConflict({ savvyPoints: 50, pointsBalance: 75 });
    expect(out.conflict).toBe(true);
    expect(out.delta).toBe(25);
  });
});

describe('Wave 6 — login streak authority', () => {
  it('C — loginStreakDays is canonical over currentStreak mirror', () => {
    expect(resolveLoginStreak({ loginStreakDays: 9, currentStreak: 3 })).toBe(9);
  });

  it('falls back to currentStreak when canonical missing', () => {
    expect(resolveLoginStreak({ currentStreak: 4 })).toBe(4);
  });
});

describe('Wave 6 — entitlement legacy cannot self-authorize', () => {
  it('A — isPremium alone does not imply paid plan in resolver', () => {
    const { resolveUserEntitlements } = require('../services/userEntitlementService');
    const user = {
      membershipTier: 'free',
      isPremium: true,
      premium: true,
      subscriptionExpires: null,
    };
    const resolved = resolveUserEntitlements(user, null);
    expect(resolved.effectivePlan).toBe('free');
  });
});

describe('Wave 6 — migration markers', () => {
  it('normalization patch stamps version', () => {
    const patch = buildNormalizationPatch('test');
    expect(patch['dataNormalization.version']).toBeGreaterThan(0);
    expect(isUserNormalized({ dataNormalization: { version: patch['dataNormalization.version'] } })).toBe(true);
  });
});

describe('Wave 6 — subscription write service exports', () => {
  it('syncLegacyUserFieldsFromEntitlement is available', () => {
    const svc = require('../services/subscriptionWriteService');
    expect(typeof svc.syncLegacyUserFieldsFromEntitlement).toBe('function');
    expect(typeof svc.applyLifetimeMembershipGrant).toBe('function');
    expect(typeof svc.extendMembershipMonths).toBe('function');
  });
});

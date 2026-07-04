/**
 * Scout Flight World Championship config + season helpers.
 */

const {
  getSeasonId,
  getUtcMonthStart,
  getUtcMonthEnd,
  formatSeasonName,
  resolveRewardTierForRank,
  getRewardTiers,
  getPrizePoolSavvy,
  BETA_REWARD_TIERS,
  PERMANENT_REWARD_TIERS,
  SEASON_STATUSES,
} = require('../config/scoutFlightChampionshipConfig');

describe('scoutFlightChampionshipConfig', () => {
  test('getSeasonId returns YYYY-MM', () => {
    const id = getSeasonId(new Date('2026-07-15T12:00:00Z'));
    expect(id).toBe('2026-07');
  });

  test('beta rewards are higher than permanent for top 3', () => {
    const beta1 = resolveRewardTierForRank(1, true);
    const perm1 = resolveRewardTierForRank(1, false);
    expect(beta1.savvy).toBeGreaterThan(perm1.savvy);

    const beta2 = resolveRewardTierForRank(2, true);
    const perm2 = resolveRewardTierForRank(2, false);
    expect(beta2.savvy).toBeGreaterThan(perm2.savvy);
  });

  test('prize pool sums tier savvy', () => {
    expect(getPrizePoolSavvy(true)).toBe(
      BETA_REWARD_TIERS.reduce((s, t) => s + (t.savvy || 0), 0)
    );
    expect(getPrizePoolSavvy(false)).toBe(
      PERMANENT_REWARD_TIERS.reduce((s, t) => s + (t.savvy || 0), 0)
    );
  });

  test('formatSeasonName includes Beta label when beta season', () => {
    const name = formatSeasonName('2026-07', { isBetaSeason: true });
    expect(name).toContain('Beta');
    expect(name).toContain('2026');
  });

  test('month boundaries align to UTC month', () => {
    const start = getUtcMonthStart(new Date('2026-07-15T12:00:00Z'));
    const end = getUtcMonthEnd(new Date('2026-07-15T12:00:00Z'));
    expect(start.toISOString()).toBe('2026-07-01T00:00:00.000Z');
    expect(end.toISOString()).toBe('2026-08-01T00:00:00.000Z');
  });

  test('reward tiers cover ranks 1-100', () => {
    for (const beta of [true, false]) {
      const tiers = getRewardTiers(beta);
      expect(tiers.length).toBeGreaterThan(0);
      expect(resolveRewardTierForRank(1, beta)).toBeTruthy();
      expect(resolveRewardTierForRank(50, beta)).toBeTruthy();
      expect(resolveRewardTierForRank(100, beta)).toBeTruthy();
      expect(resolveRewardTierForRank(101, beta)).toBeNull();
    }
  });

  test('SEASON_STATUSES includes finalized', () => {
    expect(SEASON_STATUSES.FINALIZED).toBe('finalized');
  });
});

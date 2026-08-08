const {
  ACCOUNT_MAX_LEVEL,
  ACCOUNT_MAX_PRESTIGE,
  deriveAccountProgression,
  xpPerPrestigeCycle,
  getAccountRank,
} = require('../config/accountProgression');

describe('account progression', () => {
  test('caps visible level at 55 within a prestige cycle', () => {
    const cycle = xpPerPrestigeCycle();
    const mid = deriveAccountProgression(Math.floor(cycle * 0.4));
    expect(mid.level).toBeGreaterThanOrEqual(1);
    expect(mid.level).toBeLessThanOrEqual(ACCOUNT_MAX_LEVEL);
    expect(mid.prestige).toBe(0);
  });

  test('prestiges after completing a full cycle of XP', () => {
    const cycle = xpPerPrestigeCycle();
    const afterOne = deriveAccountProgression(cycle);
    expect(afterOne.prestige).toBe(1);
    expect(afterOne.level).toBe(1);
  });

  test('preserves lifetime XP and never exceeds max prestige', () => {
    const cycle = xpPerPrestigeCycle();
    const max = deriveAccountProgression(cycle * (ACCOUNT_MAX_PRESTIGE + 2));
    expect(max.prestige).toBe(ACCOUNT_MAX_PRESTIGE);
    expect(max.lifetimeProfileXp).toBe(cycle * (ACCOUNT_MAX_PRESTIGE + 2));
  });

  test('maps rank titles from visible level only', () => {
    expect(getAccountRank(1).name).toBe('Bronze');
    expect(getAccountRank(10).name).toBe('Silver');
    expect(getAccountRank(20).name).toBe('Gold');
    expect(getAccountRank(30).name).toBe('Platinum');
    expect(getAccountRank(40).name).toBe('Diamond');
    expect(getAccountRank(50).name).toBe('Legend');
    expect(getAccountRank(55).name).toBe('Legend');
  });

  test('migrates legacy high levels via lifetime XP without losing XP', () => {
    const legacyXp = 1000 + (80 - 6) * 500;
    const derived = deriveAccountProgression(legacyXp);
    expect(derived.lifetimeProfileXp).toBe(legacyXp);
    expect(derived.level).toBeLessThanOrEqual(ACCOUNT_MAX_LEVEL);
    expect(derived.prestige).toBeGreaterThan(0);
  });
});

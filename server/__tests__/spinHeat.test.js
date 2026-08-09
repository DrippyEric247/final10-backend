const {
  SPIN_HEAT_MULTIPLIERS,
  SPIN_HEAT_MAX,
  SPIN_HEAT_COOLDOWN_MS,
  SPIN_HEAT_BASE_COSTS,
  applySpinHeatToBaseCost,
  getHeatAdjustedSpinCosts,
} = require('../config/spinHeatConfig');
const {
  maybeResetSpinHeat,
  getSpinHeatState,
  advanceSpinHeat,
  formatHeatCountdown,
} = require('../services/spinHeatService');

function mockUser(tierIndex = 0, cooldownUntil = null) {
  return {
    perkMachine: {
      spinHeatTierIndex: tierIndex,
      spinHeatCooldownUntil: cooldownUntil,
    },
    markModified: jest.fn(),
  };
}

describe('spinHeatConfig', () => {
  test('defines multiplier ladder through 10x max', () => {
    expect(SPIN_HEAT_MULTIPLIERS).toEqual([1, 2, 4, 6, 8, 10]);
    expect(SPIN_HEAT_MAX).toBe(10);
  });

  test('calculates slot prices at every tier', () => {
    for (const mult of SPIN_HEAT_MULTIPLIERS) {
      expect(getHeatAdjustedSpinCosts(mult)).toEqual({
        paid_1: SPIN_HEAT_BASE_COSTS.paid_1 * mult,
        paid_2: SPIN_HEAT_BASE_COSTS.paid_2 * mult,
        paid_3: SPIN_HEAT_BASE_COSTS.paid_3 * mult,
      });
    }
  });

  test('10x max pricing matches spec', () => {
    const costs = getHeatAdjustedSpinCosts(10);
    expect(costs.paid_1).toBe(200);
    expect(costs.paid_2).toBe(400);
    expect(costs.paid_3).toBe(600);
  });
});

describe('spinHeatService', () => {
  test('first paid spin uses 1x pricing tier', () => {
    const user = mockUser(0);
    const state = getSpinHeatState(user);
    expect(state.multiplier).toBe(1);
    expect(applySpinHeatToBaseCost(20, state.multiplier)).toBe(20);
  });

  test('progression advances through every multiplier', () => {
    const user = mockUser(0);
    const seen = [];

    for (let i = 0; i < SPIN_HEAT_MULTIPLIERS.length; i += 1) {
      const before = getSpinHeatState(user);
      seen.push(before.multiplier);
      advanceSpinHeat(user);
    }

    expect(seen).toEqual([1, 2, 4, 6, 8, 10]);
    expect(getSpinHeatState(user).multiplier).toBe(10);
  });

  test('reaching 10x starts cooldown without blocking further 10x pricing', () => {
    const user = mockUser(SPIN_HEAT_MULTIPLIERS.length - 1);
    const result = advanceSpinHeat(user);
    expect(result.currentMultiplier).toBe(10);
    expect(user.perkMachine.spinHeatCooldownUntil).toBeTruthy();

    const after = getSpinHeatState(user);
    expect(after.multiplier).toBe(10);
    expect(after.cooldownActive).toBe(true);
  });

  test('expired cooldown resets to 1x', () => {
    const past = new Date(Date.now() - 1000);
    const user = mockUser(SPIN_HEAT_MULTIPLIERS.length - 1, past);
    const reset = maybeResetSpinHeat(user);
    expect(reset).toBe(true);
    expect(user.perkMachine.spinHeatTierIndex).toBe(0);
    expect(user.perkMachine.spinHeatCooldownUntil).toBeNull();
    expect(getSpinHeatState(user).multiplier).toBe(1);
  });

  test('active cooldown keeps 10x until expiry', () => {
    const future = new Date(Date.now() + SPIN_HEAT_COOLDOWN_MS);
    const user = mockUser(SPIN_HEAT_MULTIPLIERS.length - 1, future);
    const state = getSpinHeatState(user);
    expect(state.multiplier).toBe(10);
    expect(state.cooldownActive).toBe(true);
    expect(state.msUntilReset).toBeGreaterThan(0);
  });

  test('formatHeatCountdown renders mm:ss', () => {
    expect(formatHeatCountdown(47 * 60 * 1000 + 32 * 1000)).toBe('47:32');
  });
});

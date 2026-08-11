const {
  SPIN_HEAT_MULTIPLIERS,
  SPIN_HEAT_MAX,
  SPIN_HEAT_COOLDOWN_MS,
  PERK_SPIN_HEAT_RESET_MINUTES,
  PERK_SPIN_HEAT_RESET_MS,
  SPIN_HEAT_BASE_COSTS,
  applySpinHeatToBaseCost,
  getHeatAdjustedSpinCosts,
} = require('../config/spinHeatConfig');
const {
  maybeResetSpinHeat,
  maybeResetSpinHeatFromInactivity,
  maybeResetSpinHeatFromCapCooldown,
  getSpinHeatState,
  advanceSpinHeat,
  formatHeatCountdown,
  formatSpinHeatForClient,
  resolveHeatAdjustedSavvyCost,
} = require('../services/spinHeatService');

function mockUser(tierIndex = 0, cooldownUntil = null, lastSpinAt = null) {
  return {
    perkMachine: {
      spinHeatTierIndex: tierIndex,
      spinHeatCooldownUntil: cooldownUntil,
      lastSpinAt,
    },
    markModified: jest.fn(),
  };
}

function minutesAgo(minutes) {
  return new Date(Date.now() - minutes * 60 * 1000);
}

describe('spinHeatConfig', () => {
  test('defines multiplier ladder through 10x max', () => {
    expect(SPIN_HEAT_MULTIPLIERS).toEqual([1, 2, 4, 6, 8, 10]);
    expect(SPIN_HEAT_MAX).toBe(10);
  });

  test('centralizes inactivity reset duration', () => {
    expect(PERK_SPIN_HEAT_RESET_MINUTES).toBe(60);
    expect(PERK_SPIN_HEAT_RESET_MS).toBe(60 * 60 * 1000);
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

  test('expired cap cooldown resets to 1x', () => {
    const past = new Date(Date.now() - 1000);
    const recentSpin = minutesAgo(5);
    const user = mockUser(SPIN_HEAT_MULTIPLIERS.length - 1, past, recentSpin);
    const reset = maybeResetSpinHeatFromCapCooldown(user);
    expect(reset).toBe(true);
    expect(user.perkMachine.spinHeatTierIndex).toBe(0);
    expect(user.perkMachine.spinHeatCooldownUntil).toBeNull();
    expect(getSpinHeatState(user).multiplier).toBe(1);
  });

  test('active cap cooldown keeps 10x until expiry', () => {
    const future = new Date(Date.now() + SPIN_HEAT_COOLDOWN_MS);
    const recentSpin = minutesAgo(5);
    const user = mockUser(SPIN_HEAT_MULTIPLIERS.length - 1, future, recentSpin);
    const state = getSpinHeatState(user);
    expect(state.multiplier).toBe(10);
    expect(state.cooldownActive).toBe(true);
    expect(state.msUntilReset).toBeGreaterThan(0);
  });

  test('formatHeatCountdown renders mm:ss', () => {
    expect(formatHeatCountdown(47 * 60 * 1000 + 32 * 1000)).toBe('47:32');
  });

  describe('inactivity reset (lastPerkSpinAt / lastSpinAt)', () => {
    test('2x inactive 59 minutes stays 2x', () => {
      const user = mockUser(1, null, minutesAgo(59));
      expect(getSpinHeatState(user).multiplier).toBe(2);
      expect(maybeResetSpinHeatFromInactivity(user)).toBe(false);
    });

    test('2x inactive 60 minutes resets to 1x', () => {
      const user = mockUser(1, null, minutesAgo(60));
      expect(maybeResetSpinHeatFromInactivity(user)).toBe(true);
      expect(getSpinHeatState(user).multiplier).toBe(1);
    });

    test.each([
      ['4x', 2],
      ['8x', 4],
      ['10x', 5],
    ])('%s inactive 60+ minutes resets to 1x', (_label, tierIndex) => {
      const user = mockUser(tierIndex, null, minutesAgo(61));
      expect(getSpinHeatState(user).multiplier).toBe(1);
      expect(user.perkMachine.spinHeatTierIndex).toBe(0);
    });

    test('10x with active cap cooldown inactive 60+ minutes resets to 1x', () => {
      const futureCooldown = new Date(Date.now() + 30 * 60 * 1000);
      const user = mockUser(5, futureCooldown, minutesAgo(61));
      const state = getSpinHeatState(user);
      expect(state.multiplier).toBe(1);
      expect(state.cooldownActive).toBe(false);
      expect(user.perkMachine.spinHeatCooldownUntil).toBeNull();
    });

    test('recent spin at minute 50 keeps elevated heat', () => {
      const user = mockUser(2, null, minutesAgo(50));
      expect(getSpinHeatState(user).multiplier).toBe(4);
    });

    test('no lastSpinAt does not inactivity-reset stale heat', () => {
      const user = mockUser(2, null, null);
      expect(maybeResetSpinHeatFromInactivity(user)).toBe(false);
      expect(getSpinHeatState(user).multiplier).toBe(4);
    });

    test('resolveHeatAdjustedSavvyCost charges 1x after inactivity elapsed', () => {
      const user = mockUser(2, null, minutesAgo(60));
      const pricing = resolveHeatAdjustedSavvyCost(20, user);
      expect(pricing.cost).toBe(20);
      expect(pricing.spinHeat.multiplier).toBe(1);
    });

    test('formatSpinHeatForClient exposes passive inactivity hint', () => {
      const user = mockUser(1, null, minutesAgo(10));
      const formatted = formatSpinHeatForClient(getSpinHeatState(user));
      expect(formatted.inactivityHint).toBe(
        'Spin Heat cools back to normal after 1 hour without spinning.'
      );
      expect(formatted.lastPerkSpinAt).toBeTruthy();
      expect(formatted.inactivityResetMinutes).toBe(PERK_SPIN_HEAT_RESET_MINUTES);
    });
  });

  describe('cap cooldown vs inactivity interaction', () => {
    test('active 10x cap cooldown with recent spins is not cleared by inactivity', () => {
      const futureCooldown = new Date(Date.now() + 45 * 60 * 1000);
      const user = mockUser(5, futureCooldown, minutesAgo(10));
      const state = getSpinHeatState(user);
      expect(state.multiplier).toBe(10);
      expect(state.cooldownActive).toBe(true);
    });

    test('expired cap cooldown resets even when user spun recently', () => {
      const expiredCooldown = new Date(Date.now() - 1000);
      const user = mockUser(5, expiredCooldown, minutesAgo(10));
      expect(maybeResetSpinHeat(user)).toBe(true);
      expect(getSpinHeatState(user).multiplier).toBe(1);
    });

    test('maybeResetSpinHeat applies inactivity before cap cooldown', () => {
      const futureCooldown = new Date(Date.now() + 45 * 60 * 1000);
      const user = mockUser(5, futureCooldown, minutesAgo(61));
      expect(maybeResetSpinHeat(user)).toBe(true);
      expect(user.perkMachine.spinHeatTierIndex).toBe(0);
      expect(user.perkMachine.spinHeatCooldownUntil).toBeNull();
    });
  });
});

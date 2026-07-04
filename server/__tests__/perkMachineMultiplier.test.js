const {
  computeSpinMultiplier,
  countMultiplierTiles,
  scaleRewardForMultiplier,
  buildMultiplierBreakdown,
} = require('../services/perkMachineMultiplier');

describe('perkMachineMultiplier', () => {
  const savvy250 = { id: 'savvy_250', type: 'savvy', amount: 250, label: '+250 Savvy' };
  const eggRare = { id: 'egg_rare', type: 'egg', eggTier: 'rare', label: 'Rare Egg' };
  const mult2x = { id: 'multiplier_2x', type: 'multiplier_2x', label: '2× Multiplier' };

  it('returns factor 1 with no multiplier tiles', () => {
    expect(computeSpinMultiplier(0)).toEqual({ factor: 1, count: 0, isJackpot: false });
  });

  it('doubles with one 2× tile', () => {
    expect(computeSpinMultiplier(1)).toEqual({ factor: 2, count: 1, isJackpot: false });
  });

  it('quadruples with two 2× tiles', () => {
    expect(computeSpinMultiplier(2)).toEqual({ factor: 4, count: 2, isJackpot: false });
  });

  it('applies 8× jackpot with three 2× tiles', () => {
    expect(computeSpinMultiplier(3)).toEqual({ factor: 8, count: 3, isJackpot: true });
    expect(computeSpinMultiplier(5)).toEqual({ factor: 8, count: 3, isJackpot: true });
  });

  it('counts multiplier tiles in picks', () => {
    expect(countMultiplierTiles([mult2x, savvy250, mult2x])).toBe(2);
  });

  it('scales savvy rewards', () => {
    const scaled = scaleRewardForMultiplier(savvy250, 2);
    expect(scaled.amount).toBe(500);
    expect(scaled.label).toBe('+500 Savvy');
    expect(scaled.baseAmount).toBe(250);
  });

  it('scales egg quantity', () => {
    const scaled = scaleRewardForMultiplier(eggRare, 2);
    expect(scaled.quantity).toBe(2);
    expect(scaled.label).toBe('Rare Egg ×2');
  });

  it('does not scale multiplier tiles', () => {
    const scaled = scaleRewardForMultiplier(mult2x, 4);
    expect(scaled.type).toBe('multiplier_2x');
    expect(scaled.quantity).toBeUndefined();
  });

  it('builds breakdown expression for one multiplier', () => {
    const breakdown = buildMultiplierBreakdown([mult2x, savvy250, eggRare], 2);
    expect(breakdown.factor).toBe(2);
    expect(breakdown.expression).toContain('2×');
    expect(breakdown.expression).toContain('250 Savvy');
    expect(breakdown.expression).toContain('Rare Egg');
    expect(breakdown.expression).toContain('= +500 Savvy + Rare Egg ×2');
  });

  it('builds breakdown for stacked multipliers', () => {
    const breakdown = buildMultiplierBreakdown([mult2x, mult2x, savvy250], 4);
    expect(breakdown.factor).toBe(4);
    expect(breakdown.expression).toContain('2× + 2× + 250 Savvy = +1000 Savvy');
  });
});

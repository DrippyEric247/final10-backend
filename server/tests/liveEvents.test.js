/**
 * Smoke tests for live beta events services (no DB required for config exports).
 */

const { pickSupplyDropReward, SUPPLY_DROP_POOL } = require('../config/supplyDropRewards');
const { applySavvySaleToSpinCost, SAVVY_SALE_SPIN_COST } = require('../services/savvySaleService');
const { SCOUT_SUPPORT_MILESTONES, nextMilestoneAfter } = require('../config/scoutSupportConfig');

describe('supplyDropRewards', () => {
  test('pool has entries', () => {
    expect(SUPPLY_DROP_POOL.length).toBeGreaterThan(5);
  });

  test('pickSupplyDropReward returns valid reward', () => {
    const reward = pickSupplyDropReward();
    expect(reward).toHaveProperty('id');
    expect(reward).toHaveProperty('type');
    expect(reward).toHaveProperty('label');
  });
});

describe('savvySaleService pricing', () => {
  test('applies 10 Savvy during sale', () => {
    const result = applySavvySaleToSpinCost(60, true);
    expect(result.cost).toBe(SAVVY_SALE_SPIN_COST);
    expect(result.originalCost).toBe(60);
    expect(result.saleApplied).toBe(true);
    expect(result.savings).toBe(50);
  });

  test('leaves cost unchanged when sale inactive', () => {
    const result = applySavvySaleToSpinCost(40, false);
    expect(result.cost).toBe(40);
    expect(result.saleApplied).toBe(false);
  });
});

describe('scoutSupportConfig', () => {
  test('milestones include supply drop at 5 and sale at 8', () => {
    const m5 = SCOUT_SUPPORT_MILESTONES.find((m) => m.milestone === 5);
    const m8 = SCOUT_SUPPORT_MILESTONES.find((m) => m.milestone === 8);
    expect(m5.rewardType).toBe('supply_drop');
    expect(m8.rewardType).toBe('savvy_sale');
  });

  test('nextMilestoneAfter returns 8 after 5', () => {
    const next = nextMilestoneAfter(5);
    expect(next.milestone).toBe(8);
  });
});

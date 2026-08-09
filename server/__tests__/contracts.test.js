const {
  getContractById,
  getContractsForApp,
  getUniverseContracts,
  getContractsForTrigger,
  periodKeyForContract,
  FINAL10_CONTRACTS,
  UNIVERSE_CONTRACTS,
} = require('../config/contracts');
const { mergeContractWithProgress, formatRewardLabel } = require('../services/contractService');

describe('Savvy Contracts', () => {
  test('registers Final10 app contracts', () => {
    const app = getContractsForApp('final10');
    expect(app.length).toBe(8);
    expect(app.map((c) => c.id)).toContain('final10_deal_hunter');
    expect(app.map((c) => c.id)).toContain('final10_perk_user');
    expect(app.map((c) => c.id)).toContain('final10_weekend_rush');
    expect(app.map((c) => c.id)).toContain('final10_hidden_signal');
  });

  test('registers universe cross-app contracts separately', () => {
    const universe = getUniverseContracts();
    expect(universe.length).toBe(2);
    expect(universe.every((c) => c.scope === 'universe')).toBe(true);
    expect(universe.find((c) => c.id === 'universe_multi_app_contracts')?.minDistinctApps).toBe(2);
  });

  test('maps triggers to contract definitions', () => {
    const dealContracts = getContractsForTrigger('deal_found');
    expect(dealContracts.some((c) => c.id === 'final10_deal_hunter')).toBe(true);

    const deepDiscount = getContractsForTrigger('deep_discount_deal');
    expect(deepDiscount.some((c) => c.id === 'final10_hidden_signal')).toBe(true);
  });

  test('period keys are server-authoritative by contract type', () => {
    const daily = getContractById('final10_deal_hunter');
    const weekly = getContractById('final10_savvy_streak');
    const event = getContractById('final10_weekend_rush');
    expect(periodKeyForContract(daily)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(periodKeyForContract(weekly)).toMatch(/^\d{4}-W\d+$/);
    expect(periodKeyForContract(event)).toBe('final10-weekend-rush');
  });

  test('app and universe catalogs stay roughly 80/20 weighted', () => {
    const appCount = FINAL10_CONTRACTS.length;
    const universeCount = UNIVERSE_CONTRACTS.length;
    expect(appCount).toBeGreaterThanOrEqual(universeCount * 3);
  });

  test('mergeContractWithProgress blocks claim when expired', () => {
    const contract = getContractById('final10_weekend_rush');
    const expiredDate = new Date('2099-01-01T12:00:00.000Z');
    const row = {
      periodKey: periodKeyForContract(contract, expiredDate),
      progress: 1,
      target: 1,
      completedAt: expiredDate,
    };
    const merged = mergeContractWithProgress(contract, row, new Date('2099-01-10T12:00:00.000Z'));
    expect(merged.isExpired).toBe(true);
    expect(merged.canClaim).toBe(false);
    expect(merged.expiresLabel).toBeTruthy();
  });

  test('formatRewardLabel covers schema reward types', () => {
    expect(formatRewardLabel({ type: 'savvy', amount: 100 })).toContain('Savvy');
    expect(formatRewardLabel({ type: 'perk_spin', amount: 1 })).toContain('Perk Spin');
    expect(formatRewardLabel({ type: 'egg', amount: 1 })).toContain('Egg');
    expect(formatRewardLabel({ type: 'scout_flight_ticket', amount: 1 })).toContain('Ticket');
    expect(formatRewardLabel({ type: 'cosmetic' })).toContain('Cosmetic');
    expect(formatRewardLabel({ type: 'hidden', label: 'Classified Reward' })).toContain('Classified');
  });
});

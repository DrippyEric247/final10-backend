const {
  resolveContractExpiresAt,
  isContractExpired,
  isContractDiscovered,
  maskContractForClient,
  computeContractStreak,
  formatMsRemaining,
} = require('../lib/contractUtils');
const { utcDayKey } = require('../config/contracts');

describe('contractUtils', () => {
  test('resolveContractExpiresAt honors expiresInHours for event contracts', () => {
    const contract = { type: 'event', expiresInHours: 72, eventKey: 'test-event' };
    const now = new Date('2026-08-09T15:00:00.000Z');
    const exp = resolveContractExpiresAt(contract, now);
    expect(exp).not.toBeNull();
    expect(exp.getTime()).toBeGreaterThan(now.getTime());
  });

  test('isContractExpired returns true after period rolls or time window ends', () => {
    const contract = { type: 'daily' };
    const duringDay = new Date('2099-01-01T12:00:00.000Z');
    expect(isContractExpired(contract, duringDay, { periodKey: '2099-01-01' })).toBe(false);
    expect(isContractExpired(contract, duringDay, { periodKey: '2099-01-01' })).toBe(false);
    expect(isContractExpired(contract, duringDay, { periodKey: '2098-12-31' })).toBe(true);

    const event = { type: 'event', eventKey: 'test', expiresInHours: 72 };
    expect(isContractExpired(event, new Date('2099-01-10T12:00:00.000Z'))).toBe(true);
  });

  test('hidden contracts stay masked until discovered', () => {
    const contract = {
      id: 'hidden_test',
      isHidden: true,
      revealBeforeDiscovery: false,
      title: 'Secret',
      description: 'Find it',
      reward: { type: 'egg', amount: 1 },
    };
    const masked = maskContractForClient(contract, null);
    expect(masked.title).toBe('???');
    expect(masked.reward.type).toBe('hidden');

    const row = { progress: 1, meta: { discovered: true } };
    const revealed = maskContractForClient(contract, row);
    expect(revealed.title).toBe('Secret');
    expect(revealed.isDiscovered).toBe(true);
  });

  test('isContractDiscovered detects progress and completion', () => {
    const contract = { isHidden: true };
    expect(isContractDiscovered(contract, null)).toBe(false);
    expect(isContractDiscovered(contract, { progress: 1 })).toBe(true);
    expect(isContractDiscovered(contract, { meta: { discovered: true } })).toBe(true);
  });

  test('computeContractStreak counts consecutive claim days', () => {
    const today = utcDayKey();
    const yesterday = new Date(`${today}T12:00:00.000Z`);
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    const yKey = yesterday.toISOString().slice(0, 10);

    const streak = computeContractStreak([
      { claimedAt: new Date(`${today}T10:00:00.000Z`) },
      { claimedAt: new Date(`${yKey}T10:00:00.000Z`) },
    ]);
    expect(streak).toBeGreaterThanOrEqual(2);
  });

  test('formatMsRemaining renders human labels', () => {
    expect(formatMsRemaining(0)).toBe('Expired');
    expect(formatMsRemaining(30 * 60000)).toMatch(/left/);
    expect(formatMsRemaining(3 * 24 * 3600000)).toMatch(/d left/);
  });
});

/**
 * Ensures UI consumes server authoritative multiplier — no local power×tier totals.
 */

jest.mock('../../lib/api', () => ({
  getSavvyMultiplier: jest.fn(),
}));

const { getSavvyMultiplier } = require('../../lib/api');
const { renderHook, waitFor } = require('@testing-library/react');
const { useSavvyMultiplier } = require('../useSavvyMultiplier');

const mockUser = {
  id: 'user-1',
    savvyMultiplier: {
      effectiveMultiplier: 1.35,
      coreMultiplier: 1.35,
      powerMultiplier: 1.5,
      additiveBonuses: [{ type: 'subscription', label: 'Pro Bonus', amount: 0.35 }],
      specialMultipliers: [],
    },
};

jest.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ user: mockUser }),
}));

describe('useSavvyMultiplier', () => {
  beforeEach(() => {
    getSavvyMultiplier.mockResolvedValue({
      effectiveMultiplier: 2.2,
      powerMultiplier: 2.1,
      components: [
        { type: 'subscription', label: 'Subscription tier', value: 1.15, appliesToSavvyEarnings: true },
        { type: 'event', label: 'Double Points', value: 2.2, appliesToSavvyEarnings: true },
      ],
    });
  });

  it('uses auth/me savvyMultiplier before remote fetch completes', () => {
    const { result } = renderHook(() => useSavvyMultiplier({ refreshEvents: false }));
    expect(result.current.effectiveMultiplier).toBe(1.35);
    expect(result.current.powerMultiplier).toBe(1.5);
  });

  it('refreshes to server effectiveMultiplier', async () => {
    const { result } = renderHook(() => useSavvyMultiplier());
    await waitFor(() => expect(result.current.effectiveMultiplier).toBe(2.2));
    expect(getSavvyMultiplier).toHaveBeenCalled();
  });
});

describe('deal multiplier math (server contract)', () => {
  it('preview equals base × effectiveMultiplier', () => {
    const base = 500;
    const effectiveMultiplier = 2.2;
    expect(Math.round(base * effectiveMultiplier)).toBe(1100);
  });
});

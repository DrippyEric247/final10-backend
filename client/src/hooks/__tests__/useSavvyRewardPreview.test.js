jest.mock('../../lib/api', () => ({
  calculateSavvyRewardPreview: jest.fn(),
}));

jest.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'user-1' } }),
}));

const { calculateSavvyRewardPreview } = require('../../lib/api');
const { renderHook, waitFor } = require('@testing-library/react');
const { useSavvyRewardPreview } = require('../useSavvyRewardPreview');

describe('useSavvyRewardPreview', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    calculateSavvyRewardPreview.mockResolvedValue({
      baseAmount: 120,
      finalAmount: 240,
      appliedMultiplier: 2,
      multiplierEligible: true,
      rewardClass: 'earning',
    });
  });

  it('does not throw when preview options are null (auction deal-estimate path)', () => {
    expect(() => renderHook(() => useSavvyRewardPreview(null))).not.toThrow();
    const { result } = renderHook(() => useSavvyRewardPreview(null));
    expect(result.current.preview).toBeNull();
    expect(result.current.loading).toBe(false);
    expect(calculateSavvyRewardPreview).not.toHaveBeenCalled();
  });

  it('does not throw when preview options are undefined', () => {
    const { result } = renderHook(() => useSavvyRewardPreview(undefined));
    expect(result.current.preview).toBeNull();
    expect(result.current.loading).toBe(false);
  });

  it('fetches preview when baseAmount and source are provided', async () => {
    const { result } = renderHook(() =>
      useSavvyRewardPreview({ baseAmount: 100, source: 'deal_purchase' })
    );
    await waitFor(() => expect(result.current.preview?.finalAmount).toBe(240));
    expect(calculateSavvyRewardPreview).toHaveBeenCalledWith({
      baseAmount: 100,
      source: 'deal_purchase',
    });
  });

  it('survives null API response without throwing', async () => {
    calculateSavvyRewardPreview.mockResolvedValueOnce(null);
    const { result } = renderHook(() =>
      useSavvyRewardPreview({ baseAmount: 50, source: 'deal_purchase', listingId: 'auction-9' })
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.preview).toBeNull();
  });
});

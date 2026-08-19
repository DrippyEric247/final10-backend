import '@testing-library/jest-dom';
import React from 'react';
import { render, screen } from '@testing-library/react';
import SavvyRewardBadge from '../SavvyRewardBadge';

jest.mock('../../../hooks/useDealRewardEstimate', () => ({
  useDealRewardEstimate: jest.fn(() => ({ estimate: null, loading: false })),
}));

jest.mock('../../../hooks/useSavvyRewardPreview', () => ({
  useSavvyRewardPreview: jest.fn(() => ({ preview: null, loading: false })),
}));

const { useDealRewardEstimate } = require('../../../hooks/useDealRewardEstimate');
const { useSavvyRewardPreview } = require('../../../hooks/useSavvyRewardPreview');

describe('SavvyRewardBadge', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useDealRewardEstimate.mockReturnValue({ estimate: null, loading: false });
    useSavvyRewardPreview.mockReturnValue({ preview: null, loading: false });
  });

  it('renders fallback when deal estimate and pricing inputs are missing (auction card path)', () => {
    render(
      <SavvyRewardBadge
        listingId="ebay-auction-123"
        trustScore={72}
        price={null}
        savings={0}
        compact
      />
    );

    expect(screen.getByText('Price data unavailable')).toBeInTheDocument();
    expect(useSavvyRewardPreview).toHaveBeenCalledWith(null);
  });

  it('still renders reward estimate when server deal estimate is available', () => {
    useDealRewardEstimate.mockReturnValue({
      estimate: {
        eligible: true,
        baseSavvy: 80,
        totalSavvy: 160,
        appliedMultiplier: 2,
        multiplierEligible: true,
        rewardClass: 'earning',
      },
      loading: false,
    });

    render(
      <SavvyRewardBadge
        listingId="ebay-auction-456"
        trustScore={85}
        price={null}
        savings={0}
        compact
      />
    );

    expect(screen.queryByText('Price data unavailable')).not.toBeInTheDocument();
    expect(screen.getByText(/Est\. earn \+80 Savvy/)).toBeInTheDocument();
  });

  it('does not crash when savvy preview hook receives null options', () => {
    expect(() =>
      render(
        <SavvyRewardBadge
          listingId="ebay-auction-789"
          trustScore={90}
          price={120}
          savings={25}
          compact
        />
      )
    ).not.toThrow();
  });
});

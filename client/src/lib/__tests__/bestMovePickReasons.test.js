import { buildBestMovePickReasons } from '../bestMovePickReasons';

const baseDecision = {
  confidence: 'high',
  confidenceScore: 88,
  estimatedSavings: 120,
  bestMove: 'bid',
};

const baseTrust = {
  trustScore: 82,
  sellerTrustScore: 84,
  safeToRecommend: true,
  sellerTrustBand: 'high',
};

describe('buildBestMovePickReasons', () => {
  it('prioritizes urgency and low bids for closing auctions', () => {
    const reasons = buildBestMovePickReasons({
      item: {
        isAuction: true,
        secondsRemaining: 15,
        bidCount: 2,
        currentBidPrice: 80,
        marketValue: 120,
      },
      decision: baseDecision,
      trustResult: baseTrust,
      effectiveSavings: 40,
    });

    expect(reasons[0]).toMatch(/15 second/);
    expect(reasons.some((r) => r.includes('Only 2 bids'))).toBe(true);
    expect(reasons.some((r) => r.includes('% below market'))).toBe(true);
  });

  it('surfaces trust and savings when timing is relaxed', () => {
    const reasons = buildBestMovePickReasons({
      item: {
        isAuction: false,
        buyNowPrice: 200,
        marketValue: 280,
        savvyVerifiedSeller: true,
      },
      decision: { ...baseDecision, bestMove: 'buy_now' },
      trustResult: { ...baseTrust, sellerTrustScore: 90, sellerTrustBand: 'elite' },
      effectiveSavings: 80,
    });

    expect(reasons.some((r) => r.includes('Savvy verified seller'))).toBe(true);
    expect(reasons.some((r) => r.includes('% below market'))).toBe(true);
  });

  it('limits output to max reasons', () => {
    const reasons = buildBestMovePickReasons(
      {
        item: {
          isAuction: true,
          secondsRemaining: 45,
          bidCount: 1,
          currentBidPrice: 50,
          marketValue: 100,
          savvyVerifiedSeller: true,
        },
        decision: baseDecision,
        trustResult: baseTrust,
        effectiveSavings: 50,
      },
      3
    );

    expect(reasons).toHaveLength(3);
  });
});

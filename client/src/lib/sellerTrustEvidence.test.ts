import { buildSellerTrustEvidence } from './sellerTrustEvidence';
import { evaluateTrustScore } from './trustScoreEngine';

describe('sellerTrustEvidence', () => {
  test('A — 100% positive, 5000 feedback → strong evidence, no mystery score in payload', () => {
    const listing = {
      seller: 'power_seller',
      sellerFeedbackPercent: 100,
      sellerFeedbackCount: 5000,
      sellerAccountAgeDays: 2000,
    };
    const trust = evaluateTrustScore(listing);
    const evidence = buildSellerTrustEvidence(listing, trust);

    expect(evidence.positiveFeedbackPercent).toBe(100);
    expect(evidence.feedbackCount).toBe(5000);
    expect(evidence.evidenceState).toBe('GOOD');
    expect(evidence.final10Note).toMatch(/No major seller concerns/i);
    expect(evidence.internalTrustScore).toBeGreaterThan(36);
  });

  test('B — 100% positive, 3 feedback → limited history explained', () => {
    const listing = {
      seller: 'new_seller',
      sellerFeedbackPercent: 100,
      sellerFeedbackCount: 3,
      sellerAccountAgeDays: 30,
    };
    const trust = evaluateTrustScore(listing);
    const evidence = buildSellerTrustEvidence(listing, trust);

    expect(evidence.positiveFeedbackPercent).toBe(100);
    expect(evidence.feedbackCount).toBe(3);
    expect(evidence.evidenceState).toBe('LIMITED_HISTORY');
    expect(evidence.final10Note).toMatch(/limited/i);
  });

  test('C — 97% positive, large volume → actual percent + concern note', () => {
    const listing = {
      seller: 'big_seller',
      sellerFeedbackPercent: 97,
      sellerFeedbackCount: 10000,
    };
    const evidence = buildSellerTrustEvidence(listing, evaluateTrustScore(listing));

    expect(evidence.positiveFeedbackPercent).toBe(97);
    expect(evidence.evidenceState).toBe('CHECK_DETAILS');
    expect(evidence.sellerConcerns.some((c) => /negative feedback/i.test(c))).toBe(true);
  });

  test('D — missing feedback → unavailable, no fabricated score shown to UI layer', () => {
    const evidence = buildSellerTrustEvidence({ seller: 'unknown' });

    expect(evidence.positiveFeedbackPercent).toBeNull();
    expect(evidence.evidenceState).toBe('SELLER_DATA_UNAVAILABLE');
    expect(evidence.final10Note).toMatch(/don't have enough seller information/i);
  });

  test('E — excellent seller + suspicious listing → separate listing concern', () => {
    const listing = {
      seller: 'top_seller',
      sellerFeedbackPercent: 100,
      sellerFeedbackCount: 2100,
      marketValue: 500,
      price: 50,
      title: 'Test item',
    };
    const trust = evaluateTrustScore(listing);
    const evidence = buildSellerTrustEvidence(listing, trust);

    expect(evidence.positiveFeedbackPercent).toBe(100);
    expect(evidence.listingConcerns.length).toBeGreaterThan(0);
    expect(evidence.evidenceState).toBe('GOOD');
  });

  test('F — weak seller evidence + normal listing → seller concern, no invented listing concern', () => {
    const listing = {
      seller: 'risky_seller',
      sellerFeedbackPercent: 88,
      sellerFeedbackCount: 12,
      marketValue: 200,
      price: 200,
      buyNowPrice: 200,
      title: 'Normal listing with full details',
      imageUrl: 'https://example.com/item.jpg',
      condition: 'Used',
    };
    const trust = evaluateTrustScore(listing);
    const evidence = buildSellerTrustEvidence(listing, trust);

    expect(evidence.positiveFeedbackPercent).toBe(88);
    expect(evidence.sellerConcerns.length).toBeGreaterThan(0);
    expect(evidence.listingConcerns.length).toBe(0);
    expect(evidence.evidenceState).toBe('CONCERN_DETECTED');
  });

  test('G — contradictory case: internal score ~36 while eBay shows 100%', () => {
    const listing = {
      seller: 'named_seller',
      sellerFeedbackPercent: 100,
      sellerFeedbackCount: 5,
      sellerAccountAgeDays: 14,
    };
    const trust = evaluateTrustScore(listing);
    const evidence = buildSellerTrustEvidence(listing, trust);

    expect(trust.sellerTrustScore).toBeGreaterThanOrEqual(36);
    expect(trust.sellerTrustScore).toBeLessThanOrEqual(40);
    expect(evidence.positiveFeedbackPercent).toBe(100);
    expect(evidence.feedbackCount).toBe(5);
    expect(evidence.evidenceState).toBe('LIMITED_HISTORY');
    expect(evidence.final10Note).toMatch(/limited/i);
  });
});

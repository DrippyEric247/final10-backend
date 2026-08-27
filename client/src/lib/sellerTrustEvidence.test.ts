import {
  buildSellerTrustEvidence,
  formatMarketplaceRatingDisplay,
  sellerTrustEvidenceSummary,
} from './sellerTrustEvidence';
import { evaluateTrustScore } from './trustScoreEngine';

describe('sellerTrustEvidence — marketplace-grounded trust', () => {
  test('A — 100% positive, 3 ratings → NEW SELLER + LIMITED EVIDENCE', () => {
    const listing = {
      seller: 'new_shop',
      sellerFeedbackPercent: 100,
      sellerFeedbackCount: 3,
    };
    const evidence = buildSellerTrustEvidence(listing, evaluateTrustScore(listing));

    expect(evidence.marketplaceRating.display).toBe('100% Positive Feedback');
    expect(evidence.feedbackCount).toBe(3);
    expect(evidence.final10Remarks.some((r) => r.code === 'NEW_SELLER')).toBe(true);
    expect(evidence.riskLevel).toBe('limited_evidence');
    expect(evidence.positiveFeedbackPercent).toBe(100);
    expect(formatMarketplaceRatingDisplay(100)).toBe('100% Positive Feedback');
  });

  test('B — 100% positive, 250 ratings → strong evidence, not auto-risky', () => {
    const listing = {
      seller: 'solid_seller',
      sellerFeedbackPercent: 100,
      sellerFeedbackCount: 250,
    };
    const evidence = buildSellerTrustEvidence(listing, evaluateTrustScore(listing));

    expect(evidence.marketplaceRating.display).toBe('100% Positive Feedback');
    expect(evidence.riskLevel).not.toBe('high_risk');
    expect(evidence.final10Remarks.some((r) => r.code === 'NEW_SELLER')).toBe(false);
  });

  test('C — 99.9% positive, 15000 ratings, Top Rated → ESTABLISHED + TOP RATED', () => {
    const listing = {
      seller: 'power_seller',
      sellerFeedbackPercent: 99.9,
      sellerFeedbackCount: 15000,
      sellerTopRated: true,
    };
    const evidence = buildSellerTrustEvidence(listing, evaluateTrustScore(listing));

    expect(evidence.marketplaceRating.display).toBe('99.9% Positive Feedback');
    expect(evidence.final10Remarks.some((r) => r.code === 'ESTABLISHED_SELLER')).toBe(true);
    expect(evidence.final10Remarks.some((r) => r.code === 'TOP_RATED_SELLER')).toBe(true);
    expect(evidence.riskLevel).toBe('low_risk');
  });

  test('D — 94% positive, 2000 ratings → caution without invented reasons', () => {
    const listing = {
      seller: 'mid_seller',
      sellerFeedbackPercent: 94,
      sellerFeedbackCount: 2000,
    };
    const evidence = buildSellerTrustEvidence(listing, evaluateTrustScore(listing));

    expect(evidence.marketplaceRating.display).toBe('94% Positive Feedback');
    expect(evidence.riskLevel).toBe('moderate_risk');
    expect(evidence.final10Remarks.some((r) => r.code === 'RECENT_NEGATIVE_FEEDBACK')).toBe(true);
    expect(evidence.sellerConcerns.some((c) => /shipping delays|item condition/i.test(c))).toBe(false);
  });

  test('E — no marketplace reputation → unavailable, no fake 0%', () => {
    const evidence = buildSellerTrustEvidence({ seller: 'unknown' });

    expect(evidence.positiveFeedbackPercent).toBeNull();
    expect(evidence.marketplaceRating.display).toBeNull();
    expect(evidence.evidenceState).toBe('SELLER_DATA_UNAVAILABLE');
    expect(sellerTrustEvidenceSummary(evidence)).toBe('Seller reputation unavailable');
    expect(sellerTrustEvidenceSummary(evidence)).not.toMatch(/0%/);
  });

  test('F — 100% positive, 5 ratings, no returns → NEW SELLER + NO RETURNS', () => {
    const listing = {
      seller: 'fresh_seller',
      sellerFeedbackPercent: 100,
      sellerFeedbackCount: 5,
      sellerReturnsAccepted: false,
    };
    const evidence = buildSellerTrustEvidence(listing, evaluateTrustScore(listing));

    expect(evidence.marketplaceRating.display).toBe('100% Positive Feedback');
    expect(evidence.final10Remarks.some((r) => r.code === 'NEW_SELLER')).toBe(true);
    expect(evidence.final10Remarks.some((r) => r.code === 'NO_RETURNS')).toBe(true);
    expect(evidence.returnsAccepted).toBe(false);
  });

  test('G — internal score ~36 while eBay shows 100% — UI uses marketplace only', () => {
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
    expect(evidence.marketplaceRating.display).toBe('100% Positive Feedback');
    expect(sellerTrustEvidenceSummary(evidence)).toContain('100% Positive Feedback');
    expect(sellerTrustEvidenceSummary(evidence)).not.toMatch(/Trust Score|36%/);
  });

  test('98.7% displays exactly as marketplace value', () => {
    expect(formatMarketplaceRatingDisplay(98.7)).toBe('98.7% Positive Feedback');
  });
});

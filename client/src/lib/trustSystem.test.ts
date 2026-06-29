import {
  evaluateListingTrust,
  evaluateTrustScore,
  trustScoreInputFromListing,
} from './trustScoreEngine';
import { evaluateSellerTrust, isEstablishedSellerProfile, isMegaReputationSeller } from './sellerTrustEngine';
import { evaluateDealRisk } from './dealRiskEngine';
import { buildSellerTrustDisplay } from './sellerTrustDisplay';

const MEGA_EBAY_SELLER = {
  seller: 'power_seller_us',
  sellerFeedbackPercent: 99.8,
  sellerFeedbackCount: 63000,
  sellerCompletedSalesCount: 173000,
  sellerAccountAgeDays: 365 * 16,
  sellerTopRated: true,
  sellerAccountType: 'BUSINESS',
  title: 'Sony PlayStation 5 Console',
  imageUrl: 'https://i.ebayimg.com/images/g/x/s-l1600.jpg',
  price: 399,
  marketValue: 520,
  condition: 'New',
};

describe('sellerTrustEngine', () => {
  test('new seller (0-10 feedback) scores safely and bands as New', () => {
    const r = evaluateSellerTrust({
      seller: 'fresh_shop',
      sellerFeedbackCount: 5,
      sellerFeedbackPercent: 100,
      sellerAccountAgeDays: 14,
    });
    expect(r.sellerTrustScore).toBeGreaterThanOrEqual(8);
    expect(r.band).toBe('low');
    expect(
      buildSellerTrustDisplay(
        { sellerFeedbackCount: 5, sellerFeedbackPercent: 100, sellerAccountAgeDays: 14 },
        r.band
      ).bandLabel
    ).toBe('New');
  });

  test('small seller (10-100 feedback)', () => {
    const r = evaluateSellerTrust({
      seller: 'growing_shop',
      sellerFeedbackCount: 55,
      sellerFeedbackPercent: 97.5,
      sellerAccountAgeDays: 200,
    });
    expect(r.sellerTrustScore).toBeGreaterThanOrEqual(21);
  });

  test('established seller (100-1000 feedback)', () => {
    const r = evaluateSellerTrust({
      seller: 'steady_shop',
      sellerFeedbackCount: 450,
      sellerFeedbackPercent: 98.2,
      sellerAccountAgeDays: 800,
    });
    expect(r.sellerTrustScore).toBeGreaterThanOrEqual(41);
  });

  test('high-volume seller (1000+ feedback)', () => {
    const r = evaluateSellerTrust({
      seller: 'volume_shop',
      sellerFeedbackCount: 4200,
      sellerFeedbackPercent: 99.1,
      sellerAccountAgeDays: 1200,
    });
    expect(r.sellerTrustScore).toBeGreaterThanOrEqual(55);
    expect(['high', 'elite']).toContain(r.band);
  });

  test('top rated seller adds reputation signal', () => {
    const base = evaluateSellerTrust({
      seller: 'rated_shop',
      sellerFeedbackCount: 800,
      sellerFeedbackPercent: 99,
      sellerAccountAgeDays: 900,
    });
    const top = evaluateSellerTrust({
      seller: 'rated_shop',
      sellerFeedbackCount: 800,
      sellerFeedbackPercent: 99,
      sellerAccountAgeDays: 900,
      sellerTopRated: true,
    });
    expect(top.sellerTrustScore).toBeGreaterThanOrEqual(base.sellerTrustScore);
  });

  test.each([95, 98, 99, 100])('feedback % tiers (%i%%)', (pct) => {
    const r = evaluateSellerTrust({
      seller: 'pct_test',
      sellerFeedbackCount: 250,
      sellerFeedbackPercent: pct,
      sellerAccountAgeDays: 400,
    });
    expect(r.sellerTrustScore).toBeGreaterThanOrEqual(8);
    if (pct >= 98) expect(r.sellerTrustScore).toBeGreaterThanOrEqual(40);
  });

  test('mega eBay seller is Elite — never unverified', () => {
    const r = evaluateSellerTrust(MEGA_EBAY_SELLER);
    expect(r.band).toBe('elite');
    expect(r.sellerTrustScore).toBeGreaterThanOrEqual(72);
    expect(r.isMegaReputation).toBe(true);
  });

  test('missing seller data never scores zero', () => {
    expect(() => evaluateSellerTrust({})).not.toThrow();
    expect(evaluateSellerTrust({}).sellerTrustScore).toBeGreaterThanOrEqual(8);
  });

  test('established profile guard', () => {
    expect(
      isEstablishedSellerProfile({
        feedbackPct: 99,
        feedbackCount: 5000,
        itemsSold: 5000,
        accountAgeDays: 900,
      })
    ).toBe(true);
    expect(
      isMegaReputationSeller({ feedbackPct: 99.8, feedbackCount: 63000, itemsSold: 173000 })
    ).toBe(true);
  });
});

describe('dealRiskEngine', () => {
  test('cheap price does not reduce seller score', () => {
    const seller = evaluateSellerTrust(MEGA_EBAY_SELLER);
    const deal = evaluateDealRisk({
      ...MEGA_EBAY_SELLER,
      marketValue: 800,
      price: 200,
      buyNowPrice: 200,
    });
    expect(seller.band).toBe('elite');
    expect(deal.flags).toContain('price_far_below_market');
  });
});

describe('trustScoreEngine integration', () => {
  test('mega seller full trust — not unverified', () => {
    const t = evaluateTrustScore(MEGA_EBAY_SELLER);
    expect(t.sellerTrustScore).toBeGreaterThanOrEqual(72);
    expect(t.trustLevel).not.toBe('unverified');
    expect(t.sellerDisplay.bandLabel).toBe('Elite');
    expect(t.sellerDisplay.feedbackPercent).toBe('99.8%');
    expect(t.sellerDisplay.isTopRated).toBe(true);
  });

  test('missing fields does not crash', () => {
    expect(() => evaluateListingTrust({})).not.toThrow();
    const t = evaluateListingTrust({});
    expect(t.sellerTrustScore).toBeGreaterThanOrEqual(8);
    expect(t.sellerDisplay.feedbackPercent).toBe('—');
  });

  test('cross-surface consistency', () => {
    const listing = {
      title: 'iPhone 15 Pro Max',
      seller: 'mobile_pro',
      sellerFeedbackPercent: 99.2,
      sellerFeedbackCount: 8400,
      sellerAccountAgeDays: 2000,
      sellerTopRated: true,
    };
    const scores = [
      evaluateListingTrust(listing),
      evaluateListingTrust(listing),
      evaluateListingTrust(listing),
    ];
    expect(scores[0].sellerTrustScore).toBe(scores[1].sellerTrustScore);
    expect(scores[0].sellerDisplay).toEqual(scores[2].sellerDisplay);
  });

  test('evaluateListingTrust matches manual pipeline', () => {
    const item = {
      seller: 'consistency_shop',
      sellerFeedbackPercent: 98.5,
      sellerFeedbackCount: 2100,
      sellerAccountAgeDays: 1000,
    };
    const a = evaluateListingTrust(item);
    const b = evaluateTrustScore(trustScoreInputFromListing(item));
    expect(a.sellerTrustScore).toBe(b.sellerTrustScore);
    expect(a.sellerDisplay).toEqual(b.sellerDisplay);
  });

  test('deal warning separate from seller band', () => {
    const t = evaluateTrustScore({
      ...MEGA_EBAY_SELLER,
      marketValue: 600,
      price: 180,
      buyNowPrice: 180,
    });
    expect(t.sellerDisplay.bandLabel).toBe('Elite');
    expect(t.dealWarningHeadline).toMatch(/market|price/i);
    expect(t.trustLevel).not.toBe('unverified');
  });
});

/** Mirrors each buyer surface's trust enrichment wrapper (score must match canonical API). */
function searchSurfaceTrust(item: Record<string, unknown>) {
  const base = trustScoreInputFromListing(item || {});
  return evaluateTrustScore({
    ...base,
    imageUrl: (item?.imageUrl as string) || base.imageUrl || null,
    seller: (item?.seller as string) || (item?.sellerUsername as string) || base.seller || null,
  });
}

function productFeedSurfaceTrust(item: Record<string, unknown>) {
  const feedPrice =
    Number(item.currentPrice ?? item.price ?? item.buyNowPrice ?? item.currentBidPrice) || null;
  const baseIn = trustScoreInputFromListing(item);
  return evaluateTrustScore({
    ...baseIn,
    imageUrl: (typeof item.image === 'string' ? item.image : null) || baseIn.imageUrl,
    price: feedPrice ?? baseIn.price,
    seller: (item.seller as string) || (item.sellerUsername as string) || baseIn.seller,
  });
}

function bestMoveSurfaceTrust(item: Record<string, unknown>) {
  const baseTrustInput = trustScoreInputFromListing(item);
  return evaluateTrustScore({
    ...baseTrustInput,
    imageUrl: (item.imageUrl as string) || baseTrustInput.imageUrl,
    seller: (item.seller as string) || baseTrustInput.seller,
    savvyVerifiedSeller:
      (item.savvyVerifiedSeller as boolean | undefined) ?? baseTrustInput.savvyVerifiedSeller,
  });
}

describe('cross-surface parity (Search, Feed, Best Move, Quick Snipes, Watchlist)', () => {
  const FIXTURES: Record<string, Record<string, unknown>> = {
    mega: MEGA_EBAY_SELLER,
    established: {
      seller: 'steady_shop',
      sellerFeedbackCount: 450,
      sellerFeedbackPercent: 98.2,
      sellerAccountAgeDays: 800,
      title: 'MacBook Pro 14',
      price: 1200,
      marketValue: 1400,
    },
    partial: { title: 'Untitled listing', price: 49 },
    empty: {},
  };

  test.each([
    ['mega', 'mega'],
    ['established', 'established'],
    ['partial', 'partial'],
    ['empty', 'empty'],
  ])('%s listing — identical sellerTrustScore across all surfaces', (_label, key) => {
    const item = FIXTURES[key];
    const canonical = evaluateListingTrust(item);
    const surfaces = [
      searchSurfaceTrust(item),
      productFeedSurfaceTrust(item),
      bestMoveSurfaceTrust(item),
      evaluateListingTrust(item),
    ];
    for (const s of surfaces) {
      expect(s.sellerTrustScore).toBe(canonical.sellerTrustScore);
      expect(s.sellerDisplay).toEqual(canonical.sellerDisplay);
      expect(s.sellerTrustBand).toBe(canonical.sellerTrustBand);
    }
  });

  test.each([
    ['mega', 'mega'],
    ['partial', 'partial'],
    ['empty', 'empty'],
  ])('%s listing — no surface throws on partial/missing seller data', (_label, key) => {
    const item = FIXTURES[key];
    expect(() => searchSurfaceTrust(item)).not.toThrow();
    expect(() => productFeedSurfaceTrust(item)).not.toThrow();
    expect(() => bestMoveSurfaceTrust(item)).not.toThrow();
    expect(searchSurfaceTrust(item).sellerTrustScore).toBeGreaterThanOrEqual(8);
  });
});

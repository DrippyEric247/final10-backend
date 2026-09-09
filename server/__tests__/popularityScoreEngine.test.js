const {
  computePopularityScore,
  computePopularityBoost,
  applyDiversityRanking,
  isLowInterestTitle,
  POPULARITY_RANK_WEIGHTS,
} = require('../lib/listingRanking/popularityScoreEngine');
const { listBestMoveInterestCategories } = require('../lib/listingRanking/categoryInterestProfiles');

describe('popularityScoreEngine', () => {
  test('profiles exist for all Best Move interest categories', () => {
    const categories = listBestMoveInterestCategories();
    expect(categories).toEqual(
      expect.arrayContaining(['gaming', 'electronics', 'sneakers', 'fashion', 'collectibles', 'home', 'auto', 'luxury'])
    );
    categories.forEach((cat) => {
      const score = computePopularityScore({ title: 'test listing', bidCount: 0 }, cat);
      expect(score.score).toBeGreaterThanOrEqual(0);
      expect(score.signals.profileMatch.source).toBe('inferred');
      expect(score.signals.marketplaceActivity.source).toBe('observed');
    });
  });

  test('recognizable gaming products score higher than generic accessories', () => {
    const ps5 = computePopularityScore(
      { title: 'Sony PlayStation 5 Console Disc Edition', bidCount: 4 },
      'gaming'
    );
    const cable = computePopularityScore(
      { title: 'USB cable only for controller', bidCount: 4 },
      'gaming'
    );
    expect(ps5.score).toBeGreaterThan(cable.score);
    expect(ps5.signals.profileMatch.matchedBrand).toBeTruthy();
    expect(cable.signals.profileMatch.lowInterest).toBe(true);
  });

  test('popular product with weak deal gets capped popularity boost', () => {
    const popular = computePopularityScore({ title: 'Apple iPhone 15 Pro Max', bidCount: 6 }, 'electronics');
    const strongDealBoost = computePopularityBoost(popular.score, { dealScore: 78, savingsPct: 18 });
    const weakDealBoost = computePopularityBoost(popular.score, { dealScore: 32, savingsPct: 2 });
    expect(strongDealBoost).toBeGreaterThan(weakDealBoost);
    expect(weakDealBoost).toBeLessThanOrEqual(POPULARITY_RANK_WEIGHTS.maxBoostWhenWeakDeal);
  });

  test('excellent lesser-known deal can still receive moderate boost', () => {
    const niche = computePopularityScore({ title: 'Refurbished office monitor 27 inch', bidCount: 2 }, 'electronics');
    const boost = computePopularityBoost(niche.score, { dealScore: 82, savingsPct: 22 });
    expect(boost).toBeGreaterThan(0);
  });

  test('diversity reduces duplicate product families in top results', () => {
    const rows = [
      { title: 'PS5 Console Bundle A', rankScore: 100, category: 'gaming', listing: { title: 'PS5 Console Bundle A' } },
      { title: 'PS5 Console Bundle B', rankScore: 98, category: 'gaming', listing: { title: 'PS5 Console Bundle B' } },
      { title: 'PS5 Console Bundle C', rankScore: 96, category: 'gaming', listing: { title: 'PS5 Console Bundle C' } },
      { title: 'Xbox Series X Console', rankScore: 94, category: 'gaming', listing: { title: 'Xbox Series X Console' } },
      { title: 'Nintendo Switch OLED', rankScore: 92, category: 'gaming', listing: { title: 'Nintendo Switch OLED' } },
    ];
    const ranked = applyDiversityRanking(rows, { scoreKey: 'rankScore', categoryKey: 'category', limit: 5 });
    const top3Titles = ranked.slice(0, 3).map((r) => r.title);
    const uniqueFamilies = new Set(top3Titles.filter((t) => !t.includes('PS5')));
    expect(uniqueFamilies.size).toBeGreaterThanOrEqual(1);
    expect(ranked[0].title).toContain('PS5');
  });

  test('isLowInterestTitle flags accessory-only listings', () => {
    expect(isLowInterestTitle('USB cable only')).toBe(true);
    expect(isLowInterestTitle('Sony PlayStation 5 Console')).toBe(false);
  });
});

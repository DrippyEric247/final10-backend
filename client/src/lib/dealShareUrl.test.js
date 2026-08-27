import {
  buildCanonicalDealId,
  getDealShareUrl,
  resolveDealIdFromListing,
  sanitizeDealShareSource,
} from '../lib/dealShareUrl';

describe('dealShareUrl', () => {
  test('builds stable deal ID from listing', () => {
    const listing = { itemId: 'v1|999|0', source: 'ebay' };
    const dealId = resolveDealIdFromListing(listing);
    expect(dealId).toBeTruthy();
    expect(buildCanonicalDealId('ebay', 'v1|999|0')).toBe(dealId);
  });

  test('getDealShareUrl uses Final10 deal route', () => {
    const url = getDealShareUrl({ itemId: 'v1|42|0' }, 'daily-deal-reveal');
    expect(url).toMatch(/\/deal\//);
    expect(url).toContain('src=daily-deal-reveal');
  });

  test('sanitizeDealShareSource normalizes unknown values', () => {
    expect(sanitizeDealShareSource('TIKTOK')).toBe('tiktok');
    expect(sanitizeDealShareSource('weird')).toBe('share');
  });
});

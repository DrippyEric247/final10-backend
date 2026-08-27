const {
  buildCanonicalDealId,
  parseCanonicalDealId,
  resolveListingIdentity,
} = require('../lib/canonicalDealId');

const VALID_SHARE_SOURCES = new Set([
  'daily-deal-reveal',
  'tiktok',
  'instagram',
  'referral',
  'share',
  'discord',
  'copy',
  'web-share',
]);

function sanitizeShareSource(raw) {
  const src = String(raw || 'share').trim().toLowerCase().slice(0, 64);
  if (!src) return 'share';
  return VALID_SHARE_SOURCES.has(src) ? src : 'share';
}

const ALLOWED_MARKETPLACE_HOSTS = new Set(['ebay.com', 'www.ebay.com', 'm.ebay.com']);

function isAllowedMarketplaceUrl(url) {
  if (!url || typeof url !== 'string') return false;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') return false;
    return ALLOWED_MARKETPLACE_HOSTS.has(parsed.hostname.toLowerCase());
  } catch {
    return false;
  }
}

function buildPublicDealShareUrl(dealId, shareSource) {
  const base = 'https://www.final10.app';
  const src = sanitizeShareSource(shareSource);
  const q = src && src !== 'share' ? `?src=${encodeURIComponent(src)}` : '';
  return `${base}/deal/${encodeURIComponent(dealId)}${q}`;
}

describe('canonicalDealId', () => {
  test('round-trips ebay listing IDs with pipes', () => {
    const listingId = 'v1|123456789012|0';
    const dealId = buildCanonicalDealId('ebay', listingId);
    const parsed = parseCanonicalDealId(dealId);
    expect(parsed.marketplace).toBe('ebay');
    expect(parsed.listingId).toBe(listingId);
  });

  test('rejects malformed deal IDs', () => {
    expect(parseCanonicalDealId('')).toBeNull();
    expect(parseCanonicalDealId('not-valid-base64!!!')).toBeNull();
  });

  test('resolveListingIdentity prefers listingId/itemId', () => {
    expect(resolveListingIdentity({ itemId: 'abc', id: 'xyz' })).toEqual({
      marketplace: 'ebay',
      listingId: 'abc',
    });
  });
});

describe('canonicalDealService helpers', () => {
  test('sanitizeShareSource allows daily-deal-reveal', () => {
    expect(sanitizeShareSource('daily-deal-reveal')).toBe('daily-deal-reveal');
    expect(sanitizeShareSource('unknown-source')).toBe('share');
  });

  test('isAllowedMarketplaceUrl rejects open redirects', () => {
    expect(isAllowedMarketplaceUrl('https://www.ebay.com/itm/123')).toBe(true);
    expect(isAllowedMarketplaceUrl('https://evil.example/phish')).toBe(false);
    expect(isAllowedMarketplaceUrl('http://www.ebay.com/itm/123')).toBe(false);
  });

  test('buildPublicDealShareUrl includes src param', () => {
    const dealId = buildCanonicalDealId('ebay', 'v1|1|0');
    const url = buildPublicDealShareUrl(dealId, 'tiktok');
    expect(url).toContain('/deal/');
    expect(url).toContain('src=tiktok');
  });
});

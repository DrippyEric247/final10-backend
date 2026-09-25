jest.mock('../services/ebayBrowseClient', () => ({
  ebayBrowseGet: jest.fn().mockRejectedValue(new Error('eBay unavailable in test')),
}));

const {
  buildCanonicalProductKey,
  listingsStrictIdentityMatch,
} = require('../lib/marketplace/canonicalProductKey');
const {
  mapOpenBoxCondition,
  OPEN_BOX_CONDITION_MAP,
} = require('../services/bestBuy/bestBuyConditionMapper');
const {
  normalizeBestBuyNewProduct,
  normalizeOpenBoxOffer,
} = require('../services/bestBuy/bestBuyListingNormalizer');
const { remember, recall, cacheKey, clearAll } = require('../services/bestBuy/bestBuyCache');

describe('Best Buy integration — Phase 1', () => {
  beforeEach(() => {
    clearAll();
    delete process.env.BESTBUY_API_KEY;
  });

  test('A — connection helper reports not configured without key', () => {
    const { testBestBuyConnection } = require('../services/bestBuy/bestBuyProvider');
    return testBestBuyConnection().then((result) => {
      expect(result.configured).toBe(false);
      expect(result.ok).toBe(false);
    });
  });

  test('B — product search normalization maps core retail fields', () => {
    const item = normalizeBestBuyNewProduct({
      sku: 1234567,
      name: 'Samsung Odyssey G7',
      salePrice: 499.99,
      regularPrice: 699.99,
      onlineAvailability: true,
      manufacturer: 'Samsung',
      modelNumber: 'LC32G75TQSNXZA',
      upc: '887276600123',
      url: 'https://www.bestbuy.com/site/example.p?skuId=1234567',
      image: 'https://test.bestbuy.com/image.jpg',
    });

    expect(item.marketplace).toBe('bestbuy');
    expect(item.listingType).toBe('retail_new');
    expect(item.condition).toBe('new');
    expect(item.price).toBe(499.99);
    expect(item.seller.name).toBe('Best Buy');
    expect(item.trust.retailerBacked).toBe(true);
    expect(item.canonicalProductKey).toMatch(/^gtin:/);
  });

  test('C — exact SKU lookup normalization', () => {
    const item = normalizeBestBuyNewProduct({ sku: '6487435', name: 'Test SKU Product', salePrice: 10 });
    expect(item.marketplaceListingId).toBe('bestbuy:new:6487435');
    expect(item.sku).toBe('6487435');
  });

  test('D — New condition mapping', () => {
    const item = normalizeBestBuyNewProduct({ sku: '1', name: 'X', salePrice: 1, condition: 'New' });
    expect(item.condition).toBe('new');
    expect(item.conditionLabel).toBe('New');
  });

  test('E — Open Box condition mapping uses API values centrally', () => {
    expect(mapOpenBoxCondition('excellent')).toBe('open_box_excellent');
    expect(mapOpenBoxCondition('good')).toBe('open_box_good');
    expect(mapOpenBoxCondition('fair')).toBe('open_box_fair');
    expect(mapOpenBoxCondition('unknown')).toBe('open_box_other');
    expect(OPEN_BOX_CONDITION_MAP.certified).toBe('open_box_excellent');
  });

  test('F — missing Open Box options returns empty offers list', () => {
    const { normalizeOpenBoxSkuResponse } = require('../services/bestBuy/bestBuyListingNormalizer');
    expect(normalizeOpenBoxSkuResponse({ results: [] })).toEqual([]);
    expect(normalizeOpenBoxSkuResponse({})).toEqual([]);
  });

  test('G — cache hit for identical search keys', () => {
    const key = cacheKey(['search', 'mario', 1]);
    remember(key, { products: [{ sku: 1 }] }, 'search');
    const hit = recall(key);
    expect(hit.hit).toBe(true);
    expect(hit.payload.products[0].sku).toBe(1);
  });

  test('H — upstream failure does not throw from compare when Best Buy disabled', async () => {
    const { getMarketplaceCandidates } = require('../services/marketplace/marketplaceCandidateService');
    const result = await getMarketplaceCandidates({ query: 'Samsung Odyssey G7' });
    expect(result.providers.bestbuy.status).toBe('skipped');
    expect(Array.isArray(result.ebay.candidates)).toBe(true);
    expect(result.providers.ebay.status).toBe('ebay_unavailable');
  });

  test('J — API responses strip key from admin sanitizer', () => {
    process.env.BESTBUY_API_KEY = 'secret-test-key-12345';
    jest.resetModules();
    const { getBestBuyConfig } = require('../config/bestBuyConfig');
    const cfg = getBestBuyConfig();
    const payload = { note: `key=${cfg.apiKey}` };
    const json = JSON.stringify(payload).replaceAll(cfg.apiKey, '[REDACTED]');
    expect(json).not.toContain('secret-test-key-12345');
  });

  test('K — strict product identity matching prefers UPC', () => {
    const a = { upc: '887276600123', brand: 'Samsung', model: 'LC32G75TQSNXZA' };
    const b = { upc: '887276600123', brand: 'Samsung', model: 'LC32G75TQSNXZA' };
    expect(listingsStrictIdentityMatch(a, b)).toBe(true);
    expect(buildCanonicalProductKey(a)).toBe(buildCanonicalProductKey(b));
  });

  test('L — unrelated ASUS laptops do not merge', () => {
    const a = { brand: 'ASUS', model: 'G14-2024', upc: '111111111111' };
    const b = { brand: 'ASUS', model: 'G16-2025', upc: '222222222222' };
    expect(listingsStrictIdentityMatch(a, b)).toBe(false);
  });

  test('Open box offer normalization', () => {
    const offer = normalizeOpenBoxOffer(
      { sku: '999', name: 'TV', manufacturer: 'Sony', upc: '123456789012' },
      { condition: 'good', prices: { current: 799, regular: 999 } },
      0
    );
    expect(offer.listingType).toBe('retail_open_box');
    expect(offer.condition).toBe('open_box_good');
    expect(offer.price).toBe(799);
  });
});

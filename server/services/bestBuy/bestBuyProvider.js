const { getBestBuyConfig, isBestBuyIntegrationEnabled } = require('../../config/bestBuyConfig');
const { bestBuyGet } = require('./bestBuyHttpClient');
const {
  PRODUCT_SHOW_FIELDS,
  normalizeBestBuyNewProduct,
  normalizeBestBuySearchResponse,
  normalizeOpenBoxSkuResponse,
} = require('./bestBuyListingNormalizer');
const { buildCanonicalProductKey } = require('../../lib/marketplace/canonicalProductKey');

function sanitizeQuery(q) {
  return String(q || '')
    .trim()
    .replace(/[^\w\s\-./#+&]/g, ' ')
    .slice(0, 120);
}

function encodeSearchTerm(term) {
  return encodeURIComponent(term);
}

async function testBestBuyConnection() {
  const { getBestBuyStartupDiagnostics } = require('../../config/bestBuyConfig');
  const diag = getBestBuyStartupDiagnostics();
  if (!isBestBuyIntegrationEnabled()) {
    return {
      ok: false,
      configured: diag.apiKeyConfigured,
      statusLabel: 'Best Buy API: FAILED',
      reason: diag.apiKeyConfigured
        ? 'Best Buy integration is disabled (BESTBUY_INTEGRATION_ENABLED=false).'
        : `Best Buy API key not detected. Set BESTBUY_API_KEY on the server (also accepts BBY_API_KEY, BEST_BUY_API_KEY).`,
      message: diag.apiKeyConfigured
        ? 'Best Buy integration is disabled.'
        : 'BESTBUY_API_KEY is not configured.',
      diagnostics: diag,
    };
  }
  try {
    const { data, cache } = await bestBuyGet(
      `/v1/products/6487435.json?show=sku,name&format=json`,
      {
        cacheKind: 'product',
        cacheKeyParts: ['connection', 'ping'],
        skipCache: true,
        context: { sku: '6487435' },
      }
    );
    const sampleSku = data?.sku || null;
    return {
      ok: true,
      configured: true,
      statusLabel: 'Best Buy API: CONNECTED',
      reason: sampleSku ? `Verified SKU ${sampleSku} via Products API.` : 'Products API responded successfully.',
      message: 'Best Buy API connection successful.',
      sampleSku,
      cache,
      diagnostics: diag,
    };
  } catch (err) {
    return {
      ok: false,
      configured: true,
      statusLabel: 'Best Buy API: FAILED',
      reason: err.userMessage || err.message,
      message: err.message,
      code: err.code || 'BESTBUY_CONNECTION_FAILED',
      upstreamStatus: err.upstreamStatus,
      diagnostics: diag,
    };
  }
}

async function searchBestBuyProducts({ query, categoryId, page = 1, pageSize } = {}) {
  const cfg = getBestBuyConfig();
  const q = sanitizeQuery(query);
  if (!q) {
    const err = new Error('Search query is required.');
    err.status = 400;
    throw err;
  }
  const limit = Math.min(25, pageSize || cfg.defaultPageSize);
  const pageNum = Math.max(1, Number(page) || 1);

  const term = encodeSearchTerm(q);
  let searchExpr = `(search=${term})`;
  if (categoryId) {
    searchExpr = `(search=${term}&categoryPath.id=${encodeURIComponent(String(categoryId))})`;
  }

  const path = `/v1/products${searchExpr}?format=json&show=${PRODUCT_SHOW_FIELDS}&page=${pageNum}&pageSize=${limit}`;
  const { data, cache } = await bestBuyGet(path, {
    cacheKind: 'search',
    cacheKeyParts: ['search', q, categoryId || '', pageNum, limit],
    context: { searchQuery: q },
  });

  const items = normalizeBestBuySearchResponse(data);
  return {
    items,
    total: Number(data?.total) || items.length,
    page: pageNum,
    pageSize: limit,
    cache,
    providerStatus: 'ok',
  };
}

async function getBestBuyProductBySku(sku) {
  const id = String(sku || '').trim();
  if (!id) {
    const err = new Error('SKU is required.');
    err.status = 400;
    throw err;
  }
  const path = `/v1/products/${encodeURIComponent(id)}.json?show=${PRODUCT_SHOW_FIELDS}`;
  const { data, cache } = await bestBuyGet(path, {
    cacheKind: 'product',
    cacheKeyParts: ['sku', id],
    context: { sku: id },
  });
  return { item: normalizeBestBuyNewProduct(data), cache, providerStatus: 'ok' };
}

async function getBestBuyProductByUpc(upc) {
  const digits = String(upc || '').replace(/\D/g, '');
  if (!digits) {
    const err = new Error('UPC is required.');
    err.status = 400;
    throw err;
  }
  const path = `/v1/products(upc=${encodeURIComponent(digits)})?show=${PRODUCT_SHOW_FIELDS}&format=json&pageSize=1`;
  const { data, cache } = await bestBuyGet(path, {
    cacheKind: 'product',
    cacheKeyParts: ['upc', digits],
  });
  const product = Array.isArray(data?.products) ? data.products[0] : null;
  return {
    item: product ? normalizeBestBuyNewProduct(product) : null,
    cache,
    providerStatus: 'ok',
  };
}

async function getBestBuyOpenBoxForSkus(skus) {
  const list = [...new Set((skus || []).map((s) => String(s).trim()).filter(Boolean))].slice(0, 100);
  if (!list.length) return { offers: [], cache: { hit: false }, providerStatus: 'ok' };

  if (list.length === 1) {
    const sku = list[0];
    const path = `/beta/products/${encodeURIComponent(sku)}/openBox?format=json`;
    const { data, cache } = await bestBuyGet(path, {
      cacheKind: 'openbox',
      cacheKeyParts: ['openbox', sku],
      context: { sku },
    });
    const offers = normalizeOpenBoxSkuResponse(data);
    return { offers, cache, providerStatus: 'ok' };
  }

  const skuFilter = list.join(',');
  const path = `/beta/products/openBox(sku%20in(${skuFilter}))?format=json`;
  const { data, cache } = await bestBuyGet(path, {
    cacheKind: 'openbox',
    cacheKeyParts: ['openbox-batch', skuFilter],
  });
  const offers = normalizeOpenBoxSkuResponse(data);
  return { offers, cache, providerStatus: 'ok' };
}

async function searchBestBuyWithOpenBox(options) {
  const search = await searchBestBuyProducts(options);
  const skus = search.items.map((i) => i.sku).filter(Boolean);
  let openBox = { offers: [], cache: { hit: false } };
  try {
    openBox = await getBestBuyOpenBoxForSkus(skus);
  } catch {
    openBox = { offers: [], cache: { hit: false }, providerStatus: 'openbox_unavailable' };
  }

  const offersBySku = new Map();
  for (const offer of openBox.offers || []) {
    if (!offersBySku.has(offer.sku)) offersBySku.set(offer.sku, []);
    offersBySku.get(offer.sku).push(offer);
  }

  const enriched = search.items.map((item) => ({
    ...item,
    openBoxOffers: offersBySku.get(item.sku) || [],
  }));

  return {
    ...search,
    items: enriched,
    openBoxOffers: openBox.offers || [],
    openBoxCache: openBox.cache,
  };
}

function buildIdentityFromListing(listing) {
  return buildCanonicalProductKey({
    upc: listing?.upc,
    manufacturer: listing?.brand || listing?.manufacturer,
    brand: listing?.brand,
    modelNumber: listing?.model || listing?.modelNumber,
    sku: listing?.sku,
    marketplace: listing?.marketplace || listing?.source || 'bestbuy',
  });
}

module.exports = {
  testBestBuyConnection,
  searchBestBuyProducts,
  searchBestBuyWithOpenBox,
  getBestBuyProductBySku,
  getBestBuyProductByUpc,
  getBestBuyOpenBoxForSkus,
  buildIdentityFromListing,
  isBestBuyIntegrationEnabled,
};

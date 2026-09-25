/**
 * Best Move V2 prep — gather normalized marketplace candidates without ranking.
 */
const { listingsStrictIdentityMatch, buildCanonicalProductKey } = require('../../lib/marketplace/canonicalProductKey');
const {
  searchBestBuyWithOpenBox,
  getBestBuyProductBySku,
  getBestBuyProductByUpc,
  getBestBuyOpenBoxForSkus,
  isBestBuyIntegrationEnabled,
} = require('../bestBuy/bestBuyProvider');
const { normalizeEbayItemSummary } = require('../ebayListingNormalizer');
const { ebayBrowseGet } = require('../ebayBrowseClient');
const { warn } = require('../structuredLog');

function mapEbayToCandidate(item, listingType) {
  const normalized = normalizeEbayItemSummary(item);
  const canonicalProductKey = buildCanonicalProductKey({
    upc: item.upc || item.gtin || normalized.upc,
    brand: item.brand || normalized.brand,
    manufacturer: item.brand || normalized.manufacturer,
    modelNumber: item.mpn || item.modelNumber || normalized.modelNumber,
    sku: normalized.itemId,
    marketplace: 'ebay',
  });

  const price =
    listingType === 'ebay_buy_it_now'
      ? normalized.buyNowPrice ?? normalized.price
      : normalized.currentBidPrice ?? normalized.price;

  return {
    marketplace: 'ebay',
    marketplaceListingId: String(normalized.itemId),
    listingType,
    canonicalProductKey,
    title: normalized.title,
    brand: item.brand || null,
    model: item.mpn || item.modelNumber || null,
    sku: null,
    upc: item.upc || item.gtin || null,
    condition: normalized.condition || 'unknown',
    price,
    shippingPrice: null,
    totalPrice: price,
    imageUrl: normalized.imageUrl,
    productUrl: normalized.itemWebUrl,
    availability: normalized.isAuction ? 'auction_live' : 'buy_it_now',
    seller: {
      name: normalized.seller || 'eBay seller',
      type: 'marketplace_seller',
    },
    trust: {
      marketplace: 'eBay',
      retailerBacked: false,
      evidenceType: 'marketplace_seller',
    },
    rawSourceId: String(normalized.itemId),
    retrievedAt: new Date().toISOString(),
    sourceListing: normalized,
  };
}

async function searchEbayCandidates(query, { limit = 8 } = {}) {
  try {
    const data = await ebayBrowseGet('item_summary/search', {
      q: query,
      limit: Math.min(20, limit),
      fieldgroups: 'MATCHING_ITEMS',
    });
    const items = Array.isArray(data?.itemSummaries) ? data.itemSummaries : [];
    const candidates = [];
    for (const item of items) {
      const buying = (item.buyingOptions || []).map((x) => String(x).toUpperCase());
      if (buying.includes('AUCTION')) {
        candidates.push(mapEbayToCandidate(item, 'ebay_auction'));
      }
      if (buying.includes('FIXED_PRICE')) {
        candidates.push(mapEbayToCandidate(item, 'ebay_buy_it_now'));
      }
      if (!buying.length) {
        candidates.push(mapEbayToCandidate(item, 'ebay_buy_it_now'));
      }
    }
    return { candidates, providerStatus: 'ok' };
  } catch (err) {
    warn('EBAY_CANDIDATE_SEARCH_FAILED', { message: err.message });
    return { candidates: [], providerStatus: 'ebay_unavailable', error: err.message };
  }
}

function attachIdentityMatchFlags(anchor, candidates) {
  return candidates.map((c) => ({
    ...c,
    identityMatch: listingsStrictIdentityMatch(anchor, c),
  }));
}

/**
 * @param {object} params
 * @param {string} [params.query]
 * @param {string} [params.sku]
 * @param {string} [params.upc]
 * @param {string} [params.modelNumber]
 * @param {string} [params.manufacturer]
 */
async function getMarketplaceCandidates(params = {}) {
  const query = String(params.query || '').trim();
  const sku = String(params.sku || '').trim();
  const upc = String(params.upc || '').trim();

  const result = {
    anchor: null,
    bestBuy: { new: [], openBox: [], status: 'skipped' },
    ebay: { candidates: [], status: 'skipped' },
    all: [],
    providers: {
      bestbuy: { available: isBestBuyIntegrationEnabled(), status: 'skipped' },
      ebay: { status: 'pending' },
    },
  };

  // Resolve Best Buy anchor product
  if (isBestBuyIntegrationEnabled()) {
    try {
      let anchor = null;
      let openBoxOffers = [];

      if (sku) {
        const bySku = await getBestBuyProductBySku(sku);
        anchor = bySku.item;
        const ob = await getBestBuyOpenBoxForSkus([sku]);
        openBoxOffers = ob.offers || [];
      } else if (upc) {
        const byUpc = await getBestBuyProductByUpc(upc);
        anchor = byUpc.item;
        if (anchor?.sku) {
          const ob = await getBestBuyOpenBoxForSkus([anchor.sku]);
          openBoxOffers = ob.offers || [];
        }
      } else if (query) {
        const search = await searchBestBuyWithOpenBox({ query, pageSize: 5 });
        anchor = search.items[0] || null;
        openBoxOffers = search.openBoxOffers || [];
      }

      if (anchor) {
        result.anchor = anchor;
        result.bestBuy.new = [anchor];
        result.bestBuy.openBox = openBoxOffers;
        result.bestBuy.status = 'ok';
        result.providers.bestbuy.status = 'ok';
      } else {
        result.bestBuy.status = 'no_match';
        result.providers.bestbuy.status = 'no_match';
      }
    } catch (err) {
      result.bestBuy.status = 'error';
      result.providers.bestbuy.status = 'error';
      result.providers.bestbuy.message = err.message;
    }
  }

  const ebayQuery =
    query ||
    result.anchor?.title ||
    [params.manufacturer, params.modelNumber].filter(Boolean).join(' ');
  if (ebayQuery) {
    const ebay = await searchEbayCandidates(ebayQuery, { limit: 10 });
    result.ebay.candidates = ebay.candidates;
    result.ebay.status = ebay.providerStatus;
    result.providers.ebay.status = ebay.providerStatus;
    if (ebay.error) result.providers.ebay.message = ebay.error;
  }

  const anchor = result.anchor || result.bestBuy.new[0] || null;
  if (anchor) {
    result.ebay.candidates = attachIdentityMatchFlags(anchor, result.ebay.candidates);
  }

  result.all = [
    ...result.bestBuy.new.map((c) => ({ ...c, listingType: c.listingType || 'retail_new' })),
    ...result.bestBuy.openBox.map((c) => ({ ...c, listingType: c.listingType || 'retail_open_box' })),
    ...result.ebay.candidates,
  ];

  return result;
}

module.exports = {
  getMarketplaceCandidates,
  searchEbayCandidates,
};

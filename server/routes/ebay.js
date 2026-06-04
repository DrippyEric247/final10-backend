const express = require('express');
const {
  normalizeEbayItemSummary,
  toLegacyAuctionShape,
  ENDING_SOON_SECONDS,
} = require('../services/ebayListingNormalizer');
const { placeProxyBidForUser } = require('../services/ebayOfferService');
const auth = require('../middleware/auth');
const optionalUserAuth = require('../middleware/optionalUserAuth');
const { validateRequest } = require('../middleware/validateRequest');
const { ebaySearchLimiter, ebayBidLimiter, ebaySellerTrendsLimiter } = require('../middleware/rateLimits');
const ebaySchemas = require('../validation/schemas');
const { isProduction } = require('../config/envValidation');
const { refreshScanDeck, issueBidFlowTokens } = require('../services/progressionTrustService');
const { logEbayProviderError } = require('../services/structuredLog');
const { isEbayVerboseLogEnabled } = require('../lib/backgroundJobFlags');
const { safeBuildEbaySellerTrendsPayload } = require('../services/ebaySellerTrendsService');
const { ebayBrowseGet } = require('../services/ebayBrowseClient');
const { getEbayAuthStatus, getEbayAppToken } = require('../services/ebayAuthService');
const {
  buildMockBrowseResponse,
  MOCK_FALLBACK_WARNING,
} = require('../services/ebayMockBrowseService');
const ebaySearchMemoryCache = require('../services/ebaySearchMemoryCache');
const {
  enrichItemsWithMarketValue,
  getMarketValue,
  attachMarketValue,
} = require('../services/marketValueService');

const router = express.Router();

function collectListingIdsFromNormalized(items) {
  return (items || [])
    .map((it) => String(it.itemId || it.id || '').trim())
    .filter(Boolean);
}

/** Slug from UI → keyword for Browse search when not using numeric category_ids */
const EBAY_CATEGORY_SLUG_KEYWORDS = {
  electronics: 'electronics',
  furniture: 'furniture used',
  vehicles: 'automotive',
  fashion: 'fashion',
  tools: 'tools',
  toys: 'toys',
  books: 'books',
  collectibles: 'collectibles',
  home: 'home garden',
  sports: 'sports outdoors',
  automotive: 'automotive',
};

// Public browse routes attach req.user when a JWT is sent; bidding stays auth-gated below.
router.use(optionalUserAuth);

// CORS is handled globally in index.js

// Old search endpoint removed - using the improved one below

function pickFinal10Items(items) {
  return items.filter(
    (item) =>
      item.secondsRemaining > 0 &&
      item.secondsRemaining < 600 &&
      item.isAuction &&
      item.bidCount <= 3
  );
}

async function loadEbayBrowseSearch(req, {
  searchQuery,
  limit,
  offset,
  sortOrder,
  listingMode,
  categoryId,
  minPrice,
  maxPrice,
  conditionIds,
  endingSoonOnly,
}) {
  const params = {
    q: searchQuery,
    limit: Math.min(limit, 200),
    sort: sortOrder,
    offset: Math.max(0, Number(offset) || 0)
  };

  const cat = String(categoryId || '').trim();
  if (cat && /^\d+$/.test(cat)) {
    params.category_ids = cat;
  }
  const filterParts = [];
  if (listingMode === 'auction') filterParts.push('buyingOptions:{AUCTION}');
  if (listingMode === 'buy_now') filterParts.push('buyingOptions:{FIXED_PRICE}');
  if (minPrice) filterParts.push(`price:[${minPrice}..]`);
  if (maxPrice) filterParts.push(`price:[..${maxPrice}]`);
  const conditionList = String(conditionIds || '')
    .split(',')
    .map((x) => x.trim())
    .filter((x) => /^\d+$/.test(x));
  if (conditionList.length) filterParts.push(`conditionIds:{${conditionList.join('|')}}`);
  if (filterParts.length) params.filter = filterParts.join(',');

  let data;
  try {
    data = await ebayBrowseGet('item_summary/search', params);
    if (isEbayVerboseLogEnabled()) {
      console.log('eBay browse search ok', data?.itemSummaries?.length || 0, 'items');
    }
  } catch (apiError) {
    logEbayProviderError('/ebay/browse/search', apiError.status, apiError.code || apiError.message);
    const useMock =
      apiError.code === 'EBAY_TOKEN_UNAVAILABLE' ||
      apiError.status === 401 ||
      apiError.status === 403;
    if (useMock && isEbayVerboseLogEnabled()) {
      console.warn('eBay Browse: mock fallback for query:', searchQuery);
      return buildMockBrowseResponse({
        searchQuery,
        limit,
        listingMode,
      });
    }
    throw apiError;
  }

  if (endingSoonOnly) {
    const list = Array.isArray(data?.itemSummaries) ? data.itemSummaries : [];
    data.itemSummaries = list.filter((it) => {
      const end = it.itemEndDate ? new Date(it.itemEndDate) : null;
      if (!end || Number.isNaN(end.getTime())) return false;
      const secs = Math.floor((end.getTime() - Date.now()) / 1000);
      return secs > 0 && secs <= ENDING_SOON_SECONDS;
    });
    data.total = data.itemSummaries.length;
  }

  return data;
}

// GET /api/ebay/search?q=...
router.get('/search', ebaySearchLimiter, validateRequest(ebaySchemas.ebaySearchQuery, 'query'), async (req, res) => {
  let cacheRowKey = '';
  try {
    const {
      q = '',
      keywords = '',
      limit: limitRaw = 20,
      offset: offsetRaw = 0,
      page: pageRaw = 1,
      categoryId = '',
      sortOrder = '',
      sort = '',
      minPrice = '',
      maxPrice = '',
      conditionIds = '',
      listingMode: listingModeRaw = 'mixed',
      endingSoonOnly: endingSoonOnlyRaw = 'false',
    } = req.query;

    const rawQ = String(q || keywords || '').trim();
    const catRaw = String(categoryId || '').trim();
    let searchQuery = rawQ || 'electronics';
    if (catRaw && !/^\d+$/.test(catRaw)) {
      const mapped = EBAY_CATEGORY_SLUG_KEYWORDS[catRaw.toLowerCase()];
      if (mapped) searchQuery = mapped;
      else if (!rawQ) searchQuery = catRaw.replace(/[-_]/g, ' ');
    }
    const limit = Math.min(Math.max(parseInt(limitRaw, 10) || 20, 1), 200);
    const page = Math.max(parseInt(pageRaw, 10) || 1, 1);
    const offset =
      offsetRaw !== undefined && offsetRaw !== null && String(offsetRaw) !== ''
        ? Math.max(0, parseInt(offsetRaw, 10) || 0)
        : (page - 1) * limit;
    const listingMode = ['auction', 'buy_now', 'mixed'].includes(String(listingModeRaw))
      ? String(listingModeRaw)
      : 'mixed';
    const finalSort = String(sort || sortOrder || '').trim() || (listingMode === 'auction' ? 'EndTimeSoonest' : 'bestMatch');
    const endingSoonOnly = String(endingSoonOnlyRaw).toLowerCase() === 'true';

    cacheRowKey = ebaySearchMemoryCache.searchKey([
      searchQuery,
      limit,
      offset,
      finalSort,
      listingMode,
      catRaw,
      String(minPrice || ''),
      String(maxPrice || ''),
      String(conditionIds || ''),
      endingSoonOnly ? '1' : '0',
    ]);

    const data = await loadEbayBrowseSearch(req, {
      searchQuery,
      limit,
      offset,
      sortOrder: finalSort,
      listingMode,
      categoryId: catRaw,
      minPrice,
      maxPrice,
      conditionIds,
      endingSoonOnly,
    });

    let items = (data.itemSummaries || []).map(normalizeEbayItemSummary);

    if (listingMode === 'auction') {
      items = items.filter((it) => it.isAuction);
    } else if (listingMode === 'buy_now') {
      items = items.filter((it) => it.isBuyNow);
    }

    try {
      await enrichItemsWithMarketValue(items, { fallbackQuery: searchQuery });
    } catch (e) {
      console.warn('marketValue enrichment failed', e.message || e);
    }

    const final10 = pickFinal10Items(items).map(toLegacyAuctionShape);
    const legacyItems = items.map(toLegacyAuctionShape);

    const totalItems = data.total || items.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / limit));
    const hasNextPage = offset + limit < totalItems;

    if (req.user) {
      try {
        await refreshScanDeck(req.user._id, collectListingIdsFromNormalized(items));
      } catch (e) {
        console.warn('refreshScanDeck failed', e.message || e);
      }
    }

    const body = {
      success: true,
      stale: false,
      mock: Boolean(data.mock),
      warning: data.mock ? MOCK_FALLBACK_WARNING : undefined,
      items: legacyItems,
      normalizedItems: items,
      final10,
      listingMode,
      pagination: {
        current: page,
        pages: totalPages,
        total: totalItems,
        limit,
        offset,
        hasNextPage
      }
    };
    if (cacheRowKey) {
      ebaySearchMemoryCache.remember(cacheRowKey, {
        items: legacyItems,
        normalizedItems: items,
        final10,
        listingMode,
        pagination: body.pagination,
      });
    }
    res.json(body);
  } catch (err) {
    console.error('eBay search route error', err.status || '', err.message);
    const stale = cacheRowKey ? ebaySearchMemoryCache.recall(cacheRowKey) : null;
    if (stale && Array.isArray(stale.items) && stale.items.length) {
      return res.status(200).json({
        success: true,
        stale: true,
        warning:
          err.message ||
          'Showing saved marketplace results from your last successful search.',
        code: err.code || 'EBAY_STALE_CACHE',
        items: stale.items,
        normalizedItems: stale.normalizedItems || stale.items,
        final10: Array.isArray(stale.final10) ? stale.final10 : [],
        listingMode: stale.listingMode || 'mixed',
        pagination: stale.pagination || null,
      });
    }
    try {
      const mockData = buildMockBrowseResponse({
        searchQuery: String(req.query?.q || req.query?.keywords || 'electronics').trim() || 'electronics',
        limit: Math.min(Math.max(parseInt(req.query?.limit, 10) || 20, 1), 200),
        listingMode: String(req.query?.listingMode || 'mixed'),
      });
      let items = (mockData.itemSummaries || []).map(normalizeEbayItemSummary);
      const legacyItems = items.map(toLegacyAuctionShape);
      return res.status(200).json({
        success: true,
        mock: true,
        warning: MOCK_FALLBACK_WARNING,
        code: err.code || 'EBAY_SEARCH_MOCK_FALLBACK',
        items: legacyItems,
        normalizedItems: items,
        final10: pickFinal10Items(items).map(toLegacyAuctionShape),
        listingMode: String(req.query?.listingMode || 'mixed'),
        pagination: {
          current: 1,
          pages: 1,
          total: items.length,
          limit: items.length,
          offset: 0,
          hasNextPage: false,
        },
      });
    } catch (mockErr) {
      console.error('eBay mock fallback failed', mockErr.message);
    }

    const status = err.status === 429 ? 429 : 503;
    return res.status(status).json({
      success: false,
      code: err.code || 'EBAY_SEARCH_UNAVAILABLE',
      message:
        err.message ||
        'Market results could not be loaded. Try again in a moment.',
      items: [],
      final10: [],
      pagination: null,
    });
  }
});

// GET /api/ebay/final10?q=... — ending within 10 minutes, ≤3 bids (sniper picks)
router.get('/final10', ebaySearchLimiter, validateRequest(ebaySchemas.ebayFinal10Query, 'query'), async (req, res) => {
  let cacheRowKey = '';
  try {
    const {
      q = '',
      keywords = '',
      limit: limitRaw = 20,
      offset: offsetRaw = 0,
      categoryId = '',
      minPrice = '',
      maxPrice = ''
    } = req.query;

    const rawQ = String(q || keywords || '').trim();
    const catRaw = String(categoryId || '').trim();
    let searchQuery = rawQ || 'electronics';
    if (catRaw && !/^\d+$/.test(catRaw)) {
      const mapped = EBAY_CATEGORY_SLUG_KEYWORDS[catRaw.toLowerCase()];
      if (mapped) searchQuery = mapped;
      else if (!rawQ) searchQuery = catRaw.replace(/[-_]/g, ' ');
    }
    const outLimit = Math.min(Math.max(parseInt(limitRaw, 10) || 20, 1), 50);
    const offset = Math.max(0, parseInt(offsetRaw, 10) || 0);
    const poolLimit = Math.min(200, Math.max(outLimit * 5, 50));

    cacheRowKey = ebaySearchMemoryCache.final10Key([
      searchQuery,
      outLimit,
      offset,
      catRaw,
      String(minPrice || ''),
      String(maxPrice || ''),
    ]);

    const data = await loadEbayBrowseSearch(req, {
      searchQuery,
      limit: poolLimit,
      offset,
      sortOrder: 'EndTimeSoonest',
      listingMode: 'auction',
      categoryId: catRaw,
      minPrice,
      maxPrice,
      conditionIds: '',
      endingSoonOnly: false,
    });

    let items = (data.itemSummaries || []).map(normalizeEbayItemSummary);
    let final10Items = pickFinal10Items(items).slice(0, outLimit);

    try {
      await enrichItemsWithMarketValue(final10Items, { fallbackQuery: searchQuery });
    } catch (e) {
      console.warn('marketValue enrichment (final10) failed', e.message || e);
    }

    if (req.user) {
      try {
        await refreshScanDeck(req.user._id, collectListingIdsFromNormalized(final10Items));
      } catch (e) {
        console.warn('refreshScanDeck final10 failed', e.message || e);
      }
    }

    const shaped = final10Items.map(toLegacyAuctionShape);
    const body = {
      success: true,
      stale: false,
      mock: Boolean(data.mock),
      warning: data.mock ? MOCK_FALLBACK_WARNING : undefined,
      items: shaped,
      normalizedItems: final10Items,
      query: searchQuery,
    };
    if (cacheRowKey) {
      ebaySearchMemoryCache.remember(cacheRowKey, {
        items: shaped,
        normalizedItems: final10Items,
        query: searchQuery,
      });
    }
    res.json(body);
  } catch (err) {
    console.error('eBay final10 route error', err.status || '', err.message);
    const stale = cacheRowKey ? ebaySearchMemoryCache.recall(cacheRowKey) : null;
    if (stale && Array.isArray(stale.items) && stale.items.length) {
      return res.status(200).json({
        success: true,
        stale: true,
        warning:
          err.message ||
          'Showing saved sniper picks from your last successful search.',
        code: err.code || 'EBAY_STALE_CACHE',
        items: stale.items,
        normalizedItems: stale.normalizedItems || stale.items,
        query: stale.query || '',
      });
    }
    const status = err.status === 429 ? 429 : 503;
    return res.status(status).json({
      success: false,
      code: err.code || 'EBAY_FINAL10_UNAVAILABLE',
      message:
        err.message ||
        'Sniper picks could not be refreshed right now. Try again shortly.',
      items: [],
    });
  }
});

// GET /api/ebay/item/:id
router.get('/item/:id', async (req, res) => {
  try {
    try {
      const itemIdEnc = encodeURIComponent(req.params.id);
      const it = await ebayBrowseGet(`item/${itemIdEnc}`);

      const priceNum = Number(it.price?.value);
      const item = {
        id: it.itemId,
        itemId: it.itemId,
        title: it.title,
        image: it.image?.imageUrl,
        currentBid: it.price?.value,
        currentBidPrice: it.price?.value,
        buyNowPrice: it.price?.value,
        price: it.price?.value,
        startingPrice: Number.isFinite(priceNum) ? (priceNum * 0.5).toFixed(2) : it.price?.value,
        currency: it.price?.currency,
        itemUrl: it.itemWebUrl,
        seller: {
          username: it.seller?.username || 'eBay Seller',
          profileImage: 'https://picsum.photos/100/100?random=888'
        },
        description: it.shortDescription || it.description || 'No description available.',
        bidCount: it.bidCount || 0,
        timeRemaining: Math.floor((new Date(it.itemEndDate) - new Date()) / 1000),
        secondsRemaining: Math.max(
          0,
          Math.floor((new Date(it.itemEndDate) - new Date()) / 1000)
        ),
        isAuction: Array.isArray(it.buyingOptions) && it.buyingOptions.includes('AUCTION'),
        isBuyNow: Array.isArray(it.buyingOptions) && it.buyingOptions.includes('FIXED_PRICE'),
        dealPotential: Math.floor(Math.random() * 40) + 60, // Random 60-100%
        competitionLevel: it.bidCount > 10 ? 'High' : it.bidCount > 5 ? 'Medium' : 'Low',
        trendingScore: Math.floor(Math.random() * 30) + 70, // Random 70-100%
        bids: [] // Real eBay API doesn't provide bid history in item details
      };

      try {
        const stats = await getMarketValue({
          q: String(it.title || '').split(/\s+/).slice(0, 6).join(' '),
        });
        attachMarketValue(item, stats);
      } catch (e) {
        console.warn('marketValue lookup (item) failed', e.message || e);
      }

      res.json({ item });
    } catch (apiError) {
      logEbayProviderError('/ebay/item', apiError.status, apiError.code || apiError.message);
      throw apiError;
    }
  } catch (err) {
    console.error('eBay item error', err.status || '', err.message);
    const status = err.status === 429 ? 429 : err.status === 404 ? 404 : 503;
    res.status(status).json({
      code: err.code || 'ebay_item_failed',
      message:
        err.message ||
        'This listing could not be loaded from the marketplace. Try opening it on eBay.',
      item: null,
    });
  }
});

// GET /api/ebay/auth-status — credential + token health (no secrets)
router.get('/auth-status', async (req, res) => {
  try {
    const status = getEbayAuthStatus();
    let tokenOk = false;
    let tokenError = null;
    if (status.credentialsConfigured) {
      try {
        const token = await getEbayAppToken();
        tokenOk = Boolean(token);
        if (!token) tokenError = status.lastFailureReason || 'token_request_failed';
      } catch (e) {
        tokenError = e.message;
      }
    } else {
      tokenError = 'missing_ebay_credentials';
    }
    res.json({
      ...status,
      tokenOk,
      tokenError,
    });
  } catch (err) {
    res.status(500).json({
      tokenOk: false,
      tokenError: err.message,
    });
  }
});

// GET /api/ebay/trending
router.get('/trending', async (req, res) => {
  let trendingItems = [];
  let categories = [];
  try {
    const { category = 'all', limit = 20 } = req.query;

    trendingItems = [];
    categories = [];

    // Use real eBay API with app token only
    const cat = String(category || 'all').toLowerCase();
    const baseTrending = [
      'iPhone', 'laptop', 'watch', 'headphones', 'camera',
      'gaming', 'fitness', 'home', 'fashion', 'collectibles',
    ];
    const byCategory = {
      electronics: ['laptop', 'iPhone', 'headphones', 'camera', 'tablet'],
      fashion: ['sneakers', 'jacket', 'watch', 'handbag', 'sunglasses'],
      home: ['furniture', 'kitchen', 'decor', 'tools home', 'lighting'],
      sports: ['bicycle', 'golf', 'fitness', 'camping', 'running shoes'],
      vehicles: ['automotive parts', 'car accessories', 'motorcycle parts', 'tires', 'tools automotive'],
      toys: ['lego', 'action figures', 'board games', 'dolls', 'rc car'],
      books: ['textbooks', 'fiction books', 'comics', 'magazines', 'audiobook'],
      tools: ['drill', 'wrench set', 'power tools', 'saw', 'tool box'],
      collectibles: ['trading cards', 'coins', 'vintage toys', 'memorabilia', 'figurines'],
      furniture: ['sofa', 'dining table', 'office chair', 'dresser', 'bookshelf'],
    };
    const trendingQueries =
      cat === 'all' || !byCategory[cat]
        ? baseTrending
        : byCategory[cat];

    for (const query of trendingQueries.slice(0, Math.ceil(limit / 2))) {
      try {
        const data = await ebayBrowseGet('item_summary/search', {
          q: query,
          limit: 2,
          sort: 'EndTimeSoonest',
        });
        const items = (data.itemSummaries || []).map(it => ({
        id: it.itemId,
        title: it.title,
        image: it.image?.imageUrl,
        currentBid: it.price?.value,
        currency: it.price?.currency,
        endTime: it.itemEndDate,
        bidCount: it.bidCount,
        itemUrl: it.itemWebUrl,
        platform: 'eBay',
        timeRemaining: Math.floor((new Date(it.itemEndDate) - new Date()) / 1000),
        aiScore: {
          dealPotential: Math.floor(Math.random() * 30) + 70,
          trendingScore: Math.floor(Math.random() * 40) + 60,
          competitionLevel: ['low', 'medium', 'high'][Math.floor(Math.random() * 3)]
        }
      }));
        trendingItems.push(...items);
      } catch (err) {
        console.error(`Error fetching trending for ${query}:`, err.message);
      }
    }

    categories = trendingQueries.map((bucket) => ({ _id: bucket, count: Math.floor(Math.random() * 100) + 50 }));

    if (!trendingItems.length) {
      const mock = buildMockBrowseResponse({
        searchQuery: trendingQueries[0] || 'electronics',
        limit: Math.min(Math.max(parseInt(limit, 10) || 20, 1), 50),
        listingMode: 'mixed',
      });
      trendingItems = (mock.itemSummaries || []).map((it) => ({
        id: it.itemId,
        title: it.title,
        image: it.image?.imageUrl,
        currentBid: it.price?.value,
        currency: it.price?.currency,
        endTime: it.itemEndDate,
        bidCount: it.bidCount,
        itemUrl: it.itemWebUrl,
        platform: 'eBay',
        timeRemaining: Math.floor((new Date(it.itemEndDate) - new Date()) / 1000),
        aiScore: {
          dealPotential: 72,
          trendingScore: 68,
          competitionLevel: 'low',
        },
      }));
    }

    res.json({
      items: trendingItems.slice(0, limit),
      categories,
      mock: trendingItems.some((it) => String(it.id || '').includes('f10-mock')),
      warning: trendingItems.some((it) => String(it.id || '').includes('f10-mock'))
        ? MOCK_FALLBACK_WARNING
        : undefined,
    });
  } catch (err) {
    console.error('eBay trending error', err.status || '', err.message);
    const lim = Math.min(Math.max(parseInt(req.query?.limit, 10) || 20, 1), 50);
    const mock = buildMockBrowseResponse({ searchQuery: 'electronics', limit: lim });
    const mockItems = (mock.itemSummaries || []).map((it) => ({
      id: it.itemId,
      title: it.title,
      image: it.image?.imageUrl,
      currentBid: it.price?.value,
      currency: it.price?.currency,
      endTime: it.itemEndDate,
      bidCount: it.bidCount,
      itemUrl: it.itemWebUrl,
      platform: 'eBay',
      timeRemaining: Math.floor((new Date(it.itemEndDate) - new Date()) / 1000),
      aiScore: { dealPotential: 70, trendingScore: 65, competitionLevel: 'low' },
    }));
    res.status(200).json({
      code: 'ebay_trending_partial',
      mock: true,
      warning: MOCK_FALLBACK_WARNING,
      message:
        err.message ||
        'Some trending picks could not be refreshed. Try another category.',
      items: mockItems.length ? mockItems : (Array.isArray(trendingItems) ? trendingItems.slice(0, lim) : []),
      categories: Array.isArray(categories) && categories.length
        ? categories
        : ['electronics', 'fashion', 'home', 'sports', 'collectibles'].map((bucket) => ({
            _id: bucket,
            count: 0,
          })),
    });
  }
});

// GET /api/ebay/seller-trends — Browse active listings only (not sold/completed)
router.get(
  '/seller-trends',
  ebaySellerTrendsLimiter,
  validateRequest(ebaySchemas.ebaySellerTrendsQuery, 'query'),
  async (req, res) => {
    try {
      const tz = String(req.query.tz || '').trim() || undefined;
      const payload = await safeBuildEbaySellerTrendsPayload({ timeZone: tz });
      res.json(payload);
    } catch (err) {
      console.error('eBay seller-trends route error', err?.message || err);
      const payload = await safeBuildEbaySellerTrendsPayload();
      res.json(payload);
    }
  }
);

// GET /api/ebay/categories
router.get('/categories', async (req, res) => {
  try {
    // Return a list of popular eBay categories
    const categories = [
      { _id: 'electronics', name: 'Electronics', count: 1250 },
      { _id: 'fashion', name: 'Fashion', count: 980 },
      { _id: 'home', name: 'Home & Garden', count: 750 },
      { _id: 'sports', name: 'Sports & Outdoors', count: 650 },
      { _id: 'collectibles', name: 'Collectibles', count: 580 },
      { _id: 'automotive', name: 'Automotive', count: 420 },
      { _id: 'toys', name: 'Toys & Games', count: 380 },
      { _id: 'books', name: 'Books', count: 320 }
    ];

    res.json({ categories });
  } catch (err) {
    console.error('eBay categories error', err.message);
    res.status(500).json({ error: 'ebay_categories_failed' });
  }
});

// POST /api/ebay/bids/place — requires login
router.post('/bids/place', auth, ebayBidLimiter, validateRequest(ebaySchemas.ebayBidPlaceBody), async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'not_authenticated',
        message: 'Please log in to place bids.',
      });
    }

    const { itemId, maxAmount, currency } = req.body || {};
    if (!itemId || maxAmount == null || !currency) {
      return res.status(400).json({
        success: false,
        error: 'invalid_request',
        message: 'itemId, maxAmount and currency are required.',
      });
    }

    const result = await placeProxyBidForUser(req.user, { itemId, maxAmount, currency });
    if (result.mode === 'redirect_required') {
      return res.status(200).json(result);
    }
    if (result.success) {
      try {
        const lid = String(result.itemId || itemId || '').trim();
        const progression = await issueBidFlowTokens(req.user._id, lid, {
          isWinning: result.isWinning,
        });
        return res.status(200).json({ ...result, progression });
      } catch (e) {
        console.warn('issueBidFlowTokens failed', e.message || e);
      }
    }
    return res.status(200).json(result);
  } catch (err) {
    const msg = String(err.message || 'Bid placement failed');
    const lc = msg.toLowerCase();
    let error = 'ebay_bid_failed';
    if (lc.includes('refresh token') || lc.includes('connected')) error = 'ebay_not_connected';
    if (lc.includes('invalid bid amount')) error = 'invalid_bid_amount';

    return res.status(err.statusCode || 500).json({
      success: false,
      error,
      message:
        error === 'ebay_not_connected'
          ? 'Connect your eBay account before placing bids.'
          : error === 'invalid_bid_amount'
          ? 'Enter a valid max bid amount.'
          : 'Unable to place bid right now.',
      details: !isProduction() ? msg : undefined,
      source: 'ebay',
    });
  }
});

module.exports = router;




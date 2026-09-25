const express = require('express');
const auth = require('../middleware/auth');
const { requireAdminAccess } = require('../middleware/requireRole');
const { isBestBuyIntegrationEnabled, getBestBuyConfig } = require('../config/bestBuyConfig');
const {
  testBestBuyConnection,
  searchBestBuyWithOpenBox,
  getBestBuyProductBySku,
  getBestBuyProductByUpc,
} = require('../services/bestBuy/bestBuyProvider');
const { getMarketplaceCandidates } = require('../services/marketplace/marketplaceCandidateService');
const { warn } = require('../services/structuredLog');

const router = express.Router();

router.use(auth, requireAdminAccess());

function publicConfig() {
  const cfg = getBestBuyConfig();
  return {
    enabled: cfg.enabled,
    configured: Boolean(cfg.apiKey),
    cacheTtls: {
      searchMs: cfg.searchCacheTtlMs,
      productMs: cfg.productCacheTtlMs,
      openBoxMs: cfg.openBoxCacheTtlMs,
    },
    maxRequestsPerMinute: cfg.maxRequestsPerMinute,
  };
}

function stripSecrets(payload) {
  const json = JSON.stringify(payload);
  const key = getBestBuyConfig().apiKey;
  if (key && json.includes(key)) {
    return JSON.parse(json.replaceAll(key, '[REDACTED]'));
  }
  return payload;
}

router.get('/status', (_req, res) => {
  res.json({
    provider: 'bestbuy',
    ...publicConfig(),
  });
});

router.post('/test-connection', async (_req, res) => {
  try {
    const result = await testBestBuyConnection();
    res.json(stripSecrets(result));
  } catch (err) {
    warn('BESTBUY_TEST_CONNECTION_FAILED', { message: err.message });
    res.status(err.status || 503).json({
      ok: false,
      code: err.code || 'BESTBUY_TEST_FAILED',
      message: err.message,
    });
  }
});

router.get('/search', async (req, res) => {
  if (!isBestBuyIntegrationEnabled()) {
    return res.status(503).json({
      code: 'BESTBUY_NOT_CONFIGURED',
      message: 'Best Buy integration is not configured.',
      items: [],
    });
  }
  try {
    const query = String(req.query.q || req.query.query || '').trim();
    const page = Number(req.query.page) || 1;
    const pageSize = Number(req.query.pageSize) || undefined;
    const data = await searchBestBuyWithOpenBox({ query, page, pageSize });
    res.json(stripSecrets(data));
  } catch (err) {
    warn('BESTBUY_SEARCH_FAILED', { message: err.message });
    res.status(err.status || 503).json({
      code: err.code || 'BESTBUY_SEARCH_FAILED',
      message: err.message,
      items: [],
      providerStatus: 'error',
    });
  }
});

router.get('/product/sku/:sku', async (req, res) => {
  if (!isBestBuyIntegrationEnabled()) {
    return res.status(503).json({ code: 'BESTBUY_NOT_CONFIGURED', message: 'Not configured.' });
  }
  try {
    const data = await getBestBuyProductBySku(req.params.sku);
    res.json(stripSecrets(data));
  } catch (err) {
    res.status(err.status || 503).json({ code: err.code || 'BESTBUY_SKU_FAILED', message: err.message });
  }
});

router.get('/product/upc/:upc', async (req, res) => {
  if (!isBestBuyIntegrationEnabled()) {
    return res.status(503).json({ code: 'BESTBUY_NOT_CONFIGURED', message: 'Not configured.' });
  }
  try {
    const data = await getBestBuyProductByUpc(req.params.upc);
    res.json(stripSecrets(data));
  } catch (err) {
    res.status(err.status || 503).json({ code: err.code || 'BESTBUY_UPC_FAILED', message: err.message });
  }
});

router.get('/compare', async (req, res) => {
  try {
    const params = {
      query: req.query.q || req.query.query,
      sku: req.query.sku,
      upc: req.query.upc,
      modelNumber: req.query.modelNumber,
      manufacturer: req.query.manufacturer,
    };
    const data = await getMarketplaceCandidates(params);
    res.json(stripSecrets(data));
  } catch (err) {
    warn('BESTBUY_COMPARE_FAILED', { message: err.message });
    res.status(err.status || 500).json({
      code: err.code || 'MARKETPLACE_COMPARE_FAILED',
      message: err.message,
    });
  }
});

module.exports = router;

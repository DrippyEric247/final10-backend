const express = require('express');
const optionalUserAuth = require('../middleware/optionalUserAuth');
const {
  getCanonicalDeal,
  recordDealShareEvent,
  buildDealSocialPreview,
  renderDealOgHtml,
  buildPublicDealShareUrl,
  parseCanonicalDealId,
  resolveListingIdentity,
  buildCanonicalDealId,
  sanitizeShareSource,
} = require('../services/canonicalDealService');
const { DEAL_SHARE_EVENT_TYPES } = require('../models/DealShareEvent');

const router = express.Router();

router.use(optionalUserAuth);

/** Resolve canonical deal ID from a listing payload (for client prefetch). */
router.post('/resolve-id', (req, res) => {
  try {
    const identity = resolveListingIdentity(req.body?.listing || req.body);
    if (!identity) {
      return res.status(400).json({ code: 'INVALID_LISTING', message: 'Listing identity missing' });
    }
    const dealId = buildCanonicalDealId(identity.marketplace, identity.listingId);
    return res.json({
      dealId,
      marketplace: identity.marketplace,
      listingId: identity.listingId,
      shareUrl: buildPublicDealShareUrl(dealId, sanitizeShareSource(req.body?.shareSource)),
    });
  } catch (err) {
    return res.status(err.status || 500).json({
      code: err.code || 'RESOLVE_FAILED',
      message: err.message || 'Could not resolve deal ID',
    });
  }
});

/** Public deal lookup — works logged out. */
router.get('/:dealId', async (req, res) => {
  try {
    const shareSource = sanitizeShareSource(req.query?.src);
    const deal = await getCanonicalDeal(req.params.dealId, { shareSource });
    return res.json(deal);
  } catch (err) {
    const status = err.status || 500;
    return res.status(status).json({
      code: err.code || 'DEAL_LOOKUP_FAILED',
      message: err.message || 'Deal could not be loaded',
    });
  }
});

/** Social preview metadata JSON. */
router.get('/:dealId/preview', async (req, res) => {
  try {
    const deal = await getCanonicalDeal(req.params.dealId, {
      shareSource: sanitizeShareSource(req.query?.src),
    });
    const shareUrl = buildPublicDealShareUrl(deal.dealId, req.query?.src);
    const preview = buildDealSocialPreview(deal, shareUrl);
    return res.json({ preview, dealId: deal.dealId, status: deal.status });
  } catch (err) {
    return res.status(err.status || 500).json({
      code: err.code || 'PREVIEW_FAILED',
      message: err.message || 'Preview unavailable',
    });
  }
});

/** OG HTML for crawlers / link unfurlers. */
router.get('/:dealId/og', async (req, res) => {
  try {
    const deal = await getCanonicalDeal(req.params.dealId, {
      shareSource: sanitizeShareSource(req.query?.src),
    });
    const shareUrl = buildPublicDealShareUrl(deal.dealId, req.query?.src);
    const preview = buildDealSocialPreview(deal, shareUrl);
    const redirectUrl = shareUrl;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.send(renderDealOgHtml(preview, redirectUrl));
  } catch (err) {
    return res.status(err.status || 500).send('Deal preview unavailable');
  }
});

/** Privacy-conscious share analytics. */
router.post('/:dealId/events', async (req, res) => {
  try {
    const eventType = String(req.body?.eventType || '').trim();
    if (!DEAL_SHARE_EVENT_TYPES.includes(eventType)) {
      return res.status(400).json({ code: 'INVALID_EVENT', message: 'Unknown event type' });
    }
    const parsed = parseCanonicalDealId(req.params.dealId);
    if (!parsed) {
      return res.status(400).json({ code: 'INVALID_DEAL_ID', message: 'Invalid deal ID' });
    }
    const result = await recordDealShareEvent({
      dealId: parsed.dealId,
      eventType,
      shareSource: sanitizeShareSource(req.body?.shareSource || req.query?.src),
      userId: req.user?.id || req.user?._id || null,
      marketplace: parsed.marketplace,
      listingId: parsed.listingId,
    });
    return res.json(result);
  } catch (err) {
    console.error('[deals/events]', err?.message || err);
    return res.status(500).json({ code: 'EVENT_FAILED', message: 'Could not record event' });
  }
});

module.exports = router;

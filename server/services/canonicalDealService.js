/**
 * Canonical Final10 deal lookup — live marketplace fetch + historical snapshot fallback.
 */
const CanonicalDealSnapshot = require('../models/CanonicalDealSnapshot');
const DealShareEvent = require('../models/DealShareEvent');
const {
  buildCanonicalDealId,
  parseCanonicalDealId,
  resolveListingIdentity,
} = require('../lib/canonicalDealId');
const { normalizeEbayItemSummary } = require('./ebayListingNormalizer');
const { ebayBrowseGet } = require('./ebayBrowseClient');
const { attachMarketValue, getMarketValue } = require('./marketValueService');
const { evaluateListingTrust } = require('../lib/listingRanking/trustScoreEngine');
const { evaluateBestMove } = require('../lib/listingRanking/bestMoveEngine');
const { buildSellerTrustEvidence } = require('../lib/listingRanking/sellerTrustEvidence');
const { scoreListing } = require('./listingRankingService');

const ALLOWED_MARKETPLACE_HOSTS = new Set([
  'ebay.com',
  'www.ebay.com',
  'm.ebay.com',
]);

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

function isAllowedMarketplaceUrl(url) {
  if (!url || typeof url !== 'string') return false;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') return false;
    const host = parsed.hostname.toLowerCase();
    return ALLOWED_MARKETPLACE_HOSTS.has(host);
  } catch {
    return false;
  }
}

function deriveDealStatus(listing) {
  if (!listing) return 'unavailable';
  const seconds = Number(listing.secondsRemaining);
  if (Number.isFinite(seconds) && seconds <= 0 && listing.isAuction) return 'ended';
  if (listing.listingUnavailable || listing.unavailable) return 'unavailable';
  if (listing.soldOut || listing.sold) return 'sold';
  if (listing.removed) return 'removed';
  if (listing.expired) return 'expired';
  return 'active';
}

function buildPublicDealPayload({
  dealId,
  marketplace,
  listingId,
  listing,
  status,
  sellerEvidence,
  rank,
  fromSnapshot = false,
  lastUpdatedAt,
}) {
  const price = Number(listing?.buyNowPrice ?? listing?.currentBidPrice ?? listing?.price ?? 0);
  const marketValue = Number(listing?.marketValue ?? 0);
  const savings = marketValue > 0 && price > 0 ? Math.max(0, marketValue - price) : 0;
  const marketplaceUrl = isAllowedMarketplaceUrl(listing?.itemWebUrl)
    ? listing.itemWebUrl
    : null;

  return {
    dealId,
    marketplace,
    listingId,
    status,
    fromSnapshot,
    lastUpdatedAt: lastUpdatedAt || new Date().toISOString(),
    listing: {
      ...listing,
      listingId,
      itemId: listing?.itemId || listingId,
      marketplaceUrl,
      estimatedSavings: savings,
      estimatedSavingsPct: marketValue > 0 ? Math.round((savings / marketValue) * 100) : 0,
    },
    sellerEvidence,
    bestMove: rank
      ? {
          recommendationType: rank.signals?.recommendationType || rank.recommendationType,
          confidenceScore: rank.signals?.dealScore || rank.rankScore,
          labels: rank.labels || [],
          risky: Boolean(rank.risky),
        }
      : null,
    marketplaceUrl,
    isPublic: true,
  };
}

async function fetchEbayListingLive(listingId) {
  const itemIdEnc = encodeURIComponent(listingId);
  const raw = await ebayBrowseGet(`item/${itemIdEnc}`);
  const normalized = normalizeEbayItemSummary(raw);
  try {
    const stats = await getMarketValue({
      q: String(normalized.title || '').split(/\s+/).slice(0, 6).join(' '),
    });
    attachMarketValue(normalized, stats);
  } catch (err) {
    console.warn('[canonical-deal] market value lookup failed:', err?.message || err);
  }
  return normalized;
}

async function upsertSnapshotFromListing(dealId, marketplace, listingId, listing, status) {
  const marketplaceUrl = isAllowedMarketplaceUrl(listing?.itemWebUrl) ? listing.itemWebUrl : null;
  const doc = {
    dealId,
    marketplace,
    listingId,
    status,
    snapshot: listing,
    marketplaceUrl,
    title: listing?.title || null,
    imageUrl: listing?.imageUrl || listing?.image || null,
    lastFetchedAt: new Date(),
  };
  return CanonicalDealSnapshot.findOneAndUpdate(
    { dealId },
    { $set: doc },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

async function getCanonicalDeal(dealIdRaw, options = {}) {
  const parsed = parseCanonicalDealId(dealIdRaw);
  if (!parsed) {
    const err = new Error('Invalid deal link');
    err.status = 400;
    err.code = 'INVALID_DEAL_ID';
    throw err;
  }

  const { marketplace, listingId } = parsed;
  const dealId = parsed.dealId || buildCanonicalDealId(marketplace, listingId);
  let listing = null;
  let status = 'active';
  let fromSnapshot = false;
  let lastUpdatedAt = new Date().toISOString();

  const existing = await CanonicalDealSnapshot.findOne({ dealId }).lean();

  if (marketplace === 'ebay') {
    try {
      listing = await fetchEbayListingLive(listingId);
      status = deriveDealStatus(listing);
      lastUpdatedAt = new Date().toISOString();
      await upsertSnapshotFromListing(dealId, marketplace, listingId, listing, status);
    } catch (err) {
      const httpStatus = err?.status;
      if (existing?.snapshot) {
        listing = existing.snapshot;
        status =
          httpStatus === 404
            ? existing.status === 'active'
              ? 'unavailable'
              : existing.status
            : existing.status || 'unavailable';
        fromSnapshot = true;
        lastUpdatedAt = existing.lastFetchedAt || existing.updatedAt || lastUpdatedAt;
      } else {
        const mapped = new Error(
          httpStatus === 404
            ? 'This listing is no longer available on the marketplace.'
            : err.message || 'Deal could not be loaded.'
        );
        mapped.status = httpStatus === 404 ? 404 : 503;
        mapped.code = httpStatus === 404 ? 'DEAL_NOT_FOUND' : 'DEAL_LOOKUP_FAILED';
        throw mapped;
      }
    }
  } else {
    const err = new Error('Unsupported marketplace');
    err.status = 400;
    err.code = 'UNSUPPORTED_MARKETPLACE';
    throw err;
  }

  const trust = evaluateListingTrust(listing);
  const sellerEvidence = buildSellerTrustEvidence(listing, trust);
  const rank = scoreListing({ ...listing, listingId, itemId: listingId });

  return buildPublicDealPayload({
    dealId,
    marketplace,
    listingId,
    listing,
    status,
    sellerEvidence,
    rank,
    fromSnapshot,
    lastUpdatedAt,
    shareSource: sanitizeShareSource(options.shareSource),
  });
}

async function recordDealShareEvent({
  dealId,
  eventType,
  shareSource,
  userId = null,
  marketplace = 'ebay',
  listingId = null,
}) {
  const parsed = parseCanonicalDealId(dealId);
  const mp = parsed?.marketplace || marketplace;
  const lid = parsed?.listingId || listingId;
  const src = sanitizeShareSource(shareSource);

  await DealShareEvent.create({
    dealId: parsed?.dealId || dealId,
    marketplace: mp,
    listingId: lid,
    eventType,
    shareSource: src,
    userId: userId || null,
  });

  const counterField = {
    deal_share_clicked: 'shareCounts.clicked',
    deal_link_copied: 'shareCounts.copied',
    shared_deal_opened: 'shareCounts.opened',
    shared_deal_marketplace_clicked: 'shareCounts.marketplaceClicked',
  }[eventType];

  if (counterField) {
    await CanonicalDealSnapshot.updateOne(
      { dealId: parsed?.dealId || dealId },
      {
        $inc: { [counterField]: 1 },
        $set: { lastSharedAt: new Date() },
      }
    ).catch(() => {});
  }

  return { recorded: true, eventType, shareSource: src };
}

function buildDealSocialPreview(dealPayload, shareUrl) {
  const listing = dealPayload?.listing || {};
  const title = String(listing.title || 'Final10 Deal').slice(0, 120);
  const price = Number(listing.buyNowPrice ?? listing.currentBidPrice ?? listing.price ?? 0);
  const savings = Number(listing.estimatedSavings ?? 0);
  const image = listing.imageUrl || listing.image || null;
  const descParts = [];
  if (price > 0) descParts.push(`$${Math.round(price)}`);
  if (savings > 0) descParts.push(`Est. $${Math.round(savings)} savings`);
  descParts.push('Found by Final10');
  const description = descParts.join(' • ').slice(0, 200);

  return {
    title,
    description,
    image,
    url: shareUrl,
    twitterCard: 'summary_large_image',
  };
}

function renderDealOgHtml(preview, redirectUrl) {
  const esc = (s) =>
    String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/"/g, '&quot;');
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${esc(preview.title)}</title>
  <meta name="description" content="${esc(preview.description)}" />
  <meta property="og:title" content="${esc(preview.title)}" />
  <meta property="og:description" content="${esc(preview.description)}" />
  <meta property="og:url" content="${esc(preview.url)}" />
  <meta property="og:type" content="website" />
  ${preview.image ? `<meta property="og:image" content="${esc(preview.image)}" />` : ''}
  <meta name="twitter:card" content="${esc(preview.twitterCard)}" />
  <meta name="twitter:title" content="${esc(preview.title)}" />
  <meta name="twitter:description" content="${esc(preview.description)}" />
  ${preview.image ? `<meta name="twitter:image" content="${esc(preview.image)}" />` : ''}
  <meta http-equiv="refresh" content="0;url=${esc(redirectUrl)}" />
</head>
<body>
  <p><a href="${esc(redirectUrl)}">View deal on Final10</a></p>
</body>
</html>`;
}

function getPublicShareBaseUrl() {
  const fromEnv =
    process.env.FRONTEND_URL ||
    process.env.CLIENT_URL ||
    process.env.REACT_APP_CLIENT_URL ||
    'https://www.final10.app';
  return String(fromEnv).trim().replace(/\/+$/, '');
}

function buildPublicDealShareUrl(dealId, shareSource) {
  const base = getPublicShareBaseUrl();
  const src = sanitizeShareSource(shareSource);
  const q = src && src !== 'share' ? `?src=${encodeURIComponent(src)}` : '';
  return `${base}/deal/${encodeURIComponent(dealId)}${q}`;
}

module.exports = {
  sanitizeShareSource,
  isAllowedMarketplaceUrl,
  buildCanonicalDealId,
  parseCanonicalDealId,
  resolveListingIdentity,
  getCanonicalDeal,
  recordDealShareEvent,
  buildDealSocialPreview,
  renderDealOgHtml,
  buildPublicDealShareUrl,
  getPublicShareBaseUrl,
};

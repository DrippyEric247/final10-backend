/**
 * Canonical Final10 deal identifiers — marketplace + listing ID encoded as base64url.
 * Example URL: https://final10.app/deal/{dealId}?src=tiktok
 */

const ALLOWED_MARKETPLACES = new Set(['ebay']);

function buildCanonicalDealId(marketplace, listingId) {
  const mp = String(marketplace || 'ebay').trim().toLowerCase();
  const id = String(listingId || '').trim();
  if (!mp || !id) {
    const err = new Error('marketplace and listingId are required');
    err.status = 400;
    err.code = 'INVALID_DEAL_ID';
    throw err;
  }
  if (!ALLOWED_MARKETPLACES.has(mp)) {
    const err = new Error(`Unsupported marketplace: ${mp}`);
    err.status = 400;
    err.code = 'UNSUPPORTED_MARKETPLACE';
    throw err;
  }
  return Buffer.from(`${mp}:${id}`, 'utf8').toString('base64url');
}

function parseCanonicalDealId(dealId) {
  const raw = String(dealId || '').trim();
  if (!raw || raw.length > 512) return null;
  try {
    const decoded = Buffer.from(raw, 'base64url').toString('utf8');
    const sep = decoded.indexOf(':');
    if (sep <= 0) return null;
    const marketplace = decoded.slice(0, sep).trim().toLowerCase();
    const listingId = decoded.slice(sep + 1).trim();
    if (!marketplace || !listingId || !ALLOWED_MARKETPLACES.has(marketplace)) return null;
    return { marketplace, listingId, dealId: raw };
  } catch {
    return null;
  }
}

function resolveListingIdentity(listing) {
  if (!listing || typeof listing !== 'object') return null;
  const marketplace = String(listing.marketplace || listing.source || 'ebay').trim().toLowerCase();
  const listingId = String(
    listing.listingId || listing.itemId || listing.id || listing.itemID || ''
  ).trim();
  if (!listingId) return null;
  return { marketplace, listingId };
}

module.exports = {
  ALLOWED_MARKETPLACES,
  buildCanonicalDealId,
  parseCanonicalDealId,
  resolveListingIdentity,
};

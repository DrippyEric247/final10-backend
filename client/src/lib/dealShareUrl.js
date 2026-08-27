/**
 * Canonical deal ID + share URL helpers (client).
 */

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

export function listingKey(item) {
  return String(item?.listingId || item?.itemId || item?.id || '').trim();
}

export function sanitizeDealShareSource(source) {
  const src = String(source || 'share').trim().toLowerCase();
  return VALID_SHARE_SOURCES.has(src) ? src : 'share';
}

export function resolveListingMarketplace(listing) {
  const mp = String(listing?.marketplace || listing?.source || 'ebay').trim().toLowerCase();
  return mp || 'ebay';
}

/** Build canonical deal ID locally (matches server base64url encoding). */
export function buildCanonicalDealId(marketplace, listingId) {
  const mp = resolveListingMarketplace({ marketplace, source: marketplace });
  const id = String(listingId || '').trim();
  if (!id) return null;
  const raw = `${mp}:${id}`;
  const binary = unescape(encodeURIComponent(raw));
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function resolveDealIdFromListing(listing) {
  const listingId = listingKey(listing);
  if (!listingId) return null;
  return buildCanonicalDealId(resolveListingMarketplace(listing), listingId);
}

function getShareBaseUrl() {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin.replace(/\/+$/, '');
  }
  return 'https://www.final10.app';
}

/**
 * ONE canonical share-link generator for all deal cards.
 * @param {object} deal - listing/deal object
 * @param {string} [source] - tracking source (does not change deal identity)
 */
export function getDealShareUrl(deal, source = 'share') {
  const dealId = resolveDealIdFromListing(deal);
  if (!dealId) return null;
  const src = sanitizeDealShareSource(source);
  const base = getShareBaseUrl();
  const q = src && src !== 'share' ? `?src=${encodeURIComponent(src)}` : '';
  return `${base}/deal/${encodeURIComponent(dealId)}${q}`;
}

export function getDealShareTitle(deal) {
  return String(deal?.title || 'Final10 Deal').trim() || 'Final10 Deal';
}

export function getDealShareText(deal) {
  const title = getDealShareTitle(deal);
  const price = Number(deal?.buyNowPrice ?? deal?.currentBidPrice ?? deal?.price ?? 0);
  if (price > 0) {
    return `${title} — $${Math.round(price)} on Final10`;
  }
  return `${title} — found on Final10`;
}

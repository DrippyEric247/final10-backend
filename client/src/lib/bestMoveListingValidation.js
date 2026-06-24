/**
 * Best Move listing validation — direct item URLs, images, titles, category fit.
 */

import { getBestListingImageUrl, isValidProductImageUrl } from './listingImageUrl';
import { inferCategoryFromQuery, normalizeBestMoveCategory } from './bestMoveFallbackConfig';

const LOG_PREFIX = '[BestMoveValidation]';

const SEARCH_URL_PATTERNS = [
  /\/sch\//i,
  /\/b\//i,
  /[?&]_nkw=/i,
  /[?&]search=/i,
  /\bsearch\b/i,
  /\bcategory\b/i,
  /\bbrowse\b/i,
];

const CATEGORY_TITLE_HINTS = Object.freeze({
  gaming: /playstation|ps5|xbox|nintendo|switch|rtx|gpu|gaming|headset|monitor|controller/i,
  auto: /bmw|obd|scanner|wrench|jack|socket|automotive|diagnostic|car\s+part|vehicle/i,
  home: /desk|chair|purifier|vacuum|thermostat|furniture|smart\s+home|mattress|lamp/i,
  electronics: /iphone|ipad|airpods|macbook|laptop|monitor|apple\s+watch|samsung|tablet/i,
  tech: /iphone|ipad|airpods|macbook|laptop|monitor|apple\s+watch|samsung|tablet/i,
  fashion: /jordan|nike|sneaker|hoodie|jacket|watch|designer|apparel|shirt|shoe/i,
  sneakers: /jordan|nike|dunk|yeezy|sneaker|new\s+balance|adidas/i,
  luxury: /rolex|omega|luxury|designer|gucci|louis|chanel/i,
  collectibles: /pokemon|card|collectible|comic|funko|graded|mtg/i,
});

export function isEbaySearchOrBrowseUrl(url) {
  const u = String(url || '').trim();
  if (!u) return true;
  return SEARCH_URL_PATTERNS.some((pat) => pat.test(u));
}

export function isDirectEbayItemUrl(url) {
  const u = String(url || '').trim();
  if (!u || !/^https?:\/\//i.test(u)) return false;
  if (isEbaySearchOrBrowseUrl(u)) return false;
  return /\/itm\//i.test(u) || /\/p\//i.test(u) || /ebay\.com\/itm\//i.test(u);
}

export function resolveDirectItemUrl(item) {
  if (!item || typeof item !== 'object') return '';
  const candidates = [
    item.itemWebUrl,
    item.viewItemURL,
    item.viewItemUrl,
    item.listingUrl,
    item.url,
    item.itemUrl,
  ];
  for (const raw of candidates) {
    const u = String(raw || '').trim();
    if (isDirectEbayItemUrl(u)) return u;
  }
  const id = item.itemId ?? item.id;
  if (id != null && String(id).trim() && !String(id).startsWith('f10-mock')) {
    return `https://www.ebay.com/itm/${encodeURIComponent(String(id).trim())}`;
  }
  return '';
}

export function resolveListingImageUrl(item) {
  if (!item || typeof item !== 'object') return '';
  const o = { ...item };
  if (!o.imageUrl && o.galleryURL) o.imageUrl = o.galleryURL;
  if (!o.imageUrl && o.image?.imageUrl) o.imageUrl = o.image.imageUrl;
  if (!o.imageUrl && Array.isArray(o.thumbnailImages) && o.thumbnailImages[0]) {
    const t = o.thumbnailImages[0];
    o.imageUrl = typeof t === 'string' ? t : t.imageUrl || t.url;
  }
  if (!o.imageUrl && Array.isArray(o.additionalImages) && o.additionalImages[0]) {
    const a = o.additionalImages[0];
    o.imageUrl = typeof a === 'string' ? a : a.imageUrl || a.url;
  }
  const best = getBestListingImageUrl(o);
  return isValidProductImageUrl(best) ? best : '';
}

export function normalizeBestMoveListing(item) {
  if (!item || typeof item !== 'object') return null;
  const imageUrl = resolveListingImageUrl(item);
  const itemWebUrl = resolveDirectItemUrl(item);
  return {
    ...item,
    imageUrl: imageUrl || undefined,
    itemWebUrl: itemWebUrl || undefined,
  };
}

function pickPrice(item) {
  const n = (v) => {
    const x = Number(v);
    return Number.isFinite(x) && x > 0 ? x : null;
  };
  return (
    n(item.buyNowPrice) ??
    n(item.currentBidPrice) ??
    n(item.currentBid) ??
    n(item.price) ??
    null
  );
}

export function titleMatchesCategory(title, category) {
  const cat = normalizeBestMoveCategory(category);
  if (!cat) return true;
  const pat = CATEGORY_TITLE_HINTS[cat];
  if (!pat) return true;
  return pat.test(String(title || ''));
}

export function validateBestMoveListing(item, options = {}) {
  const reasons = [];
  const category =
    normalizeBestMoveCategory(options.category) ||
    inferCategoryFromQuery(options.query) ||
    '';

  if (!item || typeof item !== 'object') {
    reasons.push('missing_item');
    return { valid: false, reasons, item: null };
  }

  const normalized = normalizeBestMoveListing(item);
  const title = String(normalized.title || '').trim();
  if (title.length < 4) reasons.push('missing_title');

  const price = pickPrice(normalized);
  if (!price) reasons.push('missing_price');

  const imageUrl = normalized.imageUrl || '';
  if (!imageUrl || !isValidProductImageUrl(imageUrl)) reasons.push('missing_image');

  const itemWebUrl = normalized.itemWebUrl || '';
  if (!itemWebUrl) {
    reasons.push('missing_direct_url');
  } else if (!isDirectEbayItemUrl(itemWebUrl)) {
    reasons.push('search_url_rejected');
  }

  const trust = Number(normalized.trustScore);
  const minTrust = Number(options.minTrust ?? 0);
  if (options.requireTrust && !Number.isFinite(trust)) {
    reasons.push('missing_trust');
  } else if (Number.isFinite(trust) && trust < minTrust) {
    reasons.push('low_trust');
  }

  if (options.enforceCategory && category && !titleMatchesCategory(title, category)) {
    reasons.push('wrong_category');
  }

  if (options.minDealScore != null) {
    const ds = Number(normalized.dealScore ?? normalized.bestMoveDecision?.dealScore);
    if (!Number.isFinite(ds) || ds < options.minDealScore) {
      reasons.push('weak_deal_score');
    }
  }

  const valid = reasons.length === 0;
  if (!valid && options.log !== false) {
    logBestMoveRejection(normalized, reasons, options);
  }

  return { valid, reasons, item: valid ? normalized : normalized };
}

export function logBestMoveRejection(item, reasons, meta = {}) {
  // eslint-disable-next-line no-console
  console.info(LOG_PREFIX, 'rejected', {
    reasons: Array.isArray(reasons) ? reasons : [reasons],
    itemId: item?.itemId ?? item?.id,
    title: String(item?.title || '').slice(0, 80),
    url: String(item?.itemWebUrl || '').slice(0, 120),
    image: Boolean(item?.imageUrl),
    category: meta.category,
    source: meta.source,
    query: meta.query,
  });
}

export function filterValidBestMoveListings(items, options = {}) {
  const list = Array.isArray(items) ? items : [];
  const valid = [];
  for (const raw of list) {
    const result = validateBestMoveListing(raw, { ...options, log: true });
    if (result.valid) valid.push(result.item);
  }
  return valid;
}

export function isBestMoveDisplayable(item, options = {}) {
  return validateBestMoveListing(item, options).valid;
}

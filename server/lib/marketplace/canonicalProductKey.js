/**
 * Canonical product identity for cross-marketplace comparison (Best Move V2 prep).
 * Priority: UPC/GTIN → manufacturer model → marketplace SKU → brand+model strict.
 */

function normalizeToken(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^\w]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function normalizeUpc(raw) {
  const digits = String(raw || '').replace(/\D/g, '');
  if (!digits || digits.length < 8) return null;
  return digits;
}

/**
 * @param {object} input
 * @param {string} [input.upc]
 * @param {string} [input.gtin]
 * @param {string} [input.manufacturer]
 * @param {string} [input.brand]
 * @param {string} [input.modelNumber]
 * @param {string} [input.model]
 * @param {string} [input.sku]
 * @param {string} [input.marketplace]
 */
function buildCanonicalProductKey(input = {}) {
  const upc = normalizeUpc(input.upc || input.gtin);
  if (upc) return `gtin:${upc}`;

  const manufacturer = normalizeToken(input.manufacturer || input.brand);
  const modelNumber = normalizeToken(input.modelNumber || input.model);
  if (manufacturer && modelNumber && modelNumber.length >= 3) {
    return `model:${manufacturer}:${modelNumber}`;
  }

  const sku = String(input.sku || '').trim();
  const marketplace = normalizeToken(input.marketplace || 'unknown');
  if (sku) return `${marketplace}:sku:${sku}`;

  if (manufacturer && modelNumber) {
    return `brand-model:${manufacturer}:${modelNumber}`;
  }

  return null;
}

/**
 * Strict match — same canonical key only (no fuzzy title matching).
 */
function canonicalProductKeysMatch(a, b) {
  const keyA = typeof a === 'string' ? a : buildCanonicalProductKey(a);
  const keyB = typeof b === 'string' ? b : buildCanonicalProductKey(b);
  if (!keyA || !keyB) return false;
  return keyA === keyB;
}

/**
 * Returns true when two listings represent the same product under strict identity rules.
 */
function listingsStrictIdentityMatch(listingA, listingB) {
  const keyA = listingA?.canonicalProductKey || buildCanonicalProductKey(listingA);
  const keyB = listingB?.canonicalProductKey || buildCanonicalProductKey(listingB);
  if (!keyA || !keyB) return false;
  if (keyA === keyB) return true;

  // Allow GTIN match when one side only had SKU-derived key but UPC present on both payloads
  const upcA = normalizeUpc(listingA?.upc);
  const upcB = normalizeUpc(listingB?.upc);
  if (upcA && upcB && upcA === upcB) return true;

  const manA = normalizeToken(listingA?.brand || listingA?.manufacturer);
  const manB = normalizeToken(listingB?.brand || listingB?.manufacturer);
  const modA = normalizeToken(listingA?.model || listingA?.modelNumber);
  const modB = normalizeToken(listingB?.model || listingB?.modelNumber);
  if (manA && manB && modA && modB && manA === manB && modA === modB && modA.length >= 3) {
    return true;
  }

  return false;
}

module.exports = {
  buildCanonicalProductKey,
  canonicalProductKeysMatch,
  listingsStrictIdentityMatch,
  normalizeUpc,
};

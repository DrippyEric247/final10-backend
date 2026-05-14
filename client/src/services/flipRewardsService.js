import api from './authService';

export function extractSellerListingIdFromPaste(raw) {
  const s = String(raw || '').trim();
  if (!s) return null;
  const m = s.match(/(\d{10,13})/);
  return m ? m[1] : null;
}

/**
 * @param {object} body
 * @param {string} body.sellerListingId
 * @param {string} [body.listingType]
 * @param {number} body.buyPrice
 * @param {number} body.suggestedSellMin
 * @param {number} body.suggestedSellMax
 * @param {number} body.predictedDaysToSell
 * @param {number} [body.flipScore]
 * @param {boolean} [body.fromAiSuggestion]
 * @param {string} [body.dealItemId]
 * @param {string} [body.promotedListingId]
 */
export async function registerFlipListing(body) {
  const res = await api.post('/api/flip-rewards/register-listing', body);
  return res.data;
}

/**
 * @param {object} body
 * @param {string} body.sellerListingId
 * @param {number} body.soldPrice
 * @param {string} [body.soldAt] ISO
 * @param {number} [body.feePct]
 * @param {string} [body.verification] user | api
 * @param {string} [body.idempotencyKey]
 */
export async function confirmFlipSale(body) {
  const res = await api.post('/api/flip-rewards/confirm-sale', body);
  return res.data;
}

export async function cancelFlipListingTracking(body) {
  const res = await api.post('/api/flip-rewards/cancel-listing', body);
  return res.data;
}

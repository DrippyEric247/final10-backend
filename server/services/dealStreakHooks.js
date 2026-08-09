/**
 * Trusted hooks that feed the authoritative Deal Streak system.
 */
const { recordQualifyingDeal } = require('./dealStreakService');

function fireQualifyingDealRecorded(userId, params) {
  if (!userId || !params?.sourceId) return;
  setImmediate(() => {
    recordQualifyingDeal(String(userId), params).catch((err) => {
      console.warn('[deal-streak] record failed:', err?.message || err);
    });
  });
}

function recordQualifyingDealFromProgressionEvent(userId, event) {
  if (!event || event.type !== 'auction_won') return;
  const payload = event.payload || {};
  fireQualifyingDealRecorded(userId, {
    sourceType: 'auction_won',
    sourceId: String(payload.auctionId || '').trim(),
    categoryRaw: payload.category || payload.categoryId || null,
    meta: {
      marketplace: payload.marketplace,
      winAmount: payload.winAmount,
      eventId: event.id,
    },
  });
}

function recordQualifyingDealFromPurchase(userId, { listingId, categoryRaw, meta } = {}) {
  fireQualifyingDealRecorded(userId, {
    sourceType: 'deal_purchase',
    sourceId: String(listingId || '').trim(),
    categoryRaw,
    meta,
  });
}

module.exports = {
  fireQualifyingDealRecorded,
  recordQualifyingDealFromProgressionEvent,
  recordQualifyingDealFromPurchase,
};

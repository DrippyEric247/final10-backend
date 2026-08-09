/**
 * Fire-and-forget contract progress hooks from trusted server actions.
 */
const { recordContractTrigger, recordContractProgressFromProgressionEvent } = require('./contractProgressService');

function fireContractTrigger(userId, trigger, opts = {}) {
  if (!userId || !trigger) return;
  setImmediate(() => {
    recordContractTrigger(String(userId), trigger, opts).catch((err) => {
      console.warn('[contracts] trigger failed:', trigger, err?.message || err);
    });
  });
}

function fireContractProgressionEvent(userId, eventType) {
  if (!userId || !eventType) return;
  setImmediate(() => {
    recordContractProgressFromProgressionEvent(String(userId), eventType).catch((err) => {
      console.warn('[contracts] progression hook failed:', eventType, err?.message || err);
    });
  });
}

function isDeepDiscountListing(listing = {}) {
  const market =
    Number(
      listing.marketValue ??
        listing.estimatedMarketValue ??
        listing.msrp ??
        listing.retailPrice
    ) || 0;
  const price =
    Number(listing.price ?? listing.buyNowPrice ?? listing.currentBidPrice ?? listing.feedPrice) ||
    0;
  if (market <= 0 || price <= 0) return false;
  return (market - price) / market >= 0.4;
}

module.exports = {
  fireContractTrigger,
  fireContractProgressionEvent,
  isDeepDiscountListing,
};

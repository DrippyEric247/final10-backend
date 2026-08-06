/** Savvy store redeem catalog — server source of truth. */

const SAVVY_STORE_ITEMS = Object.freeze([
  { id: 'credit_500', label: '$5 Discount Credit', costSavvy: 500, creditCents: 500, premiumDays: 0 },
  { id: 'credit_1000', label: '$10 Discount Credit', costSavvy: 1000, creditCents: 1000, premiumDays: 0 },
  { id: 'premium_day_1000', label: 'Premium Pass (1 Day)', costSavvy: 1000, creditCents: 0, premiumDays: 1 },
]);

const SAVVY_POINTS_PER_DOLLAR = 100;

function findStoreItem(itemId) {
  return SAVVY_STORE_ITEMS.find((x) => x.id === String(itemId || '').trim()) || null;
}

module.exports = {
  SAVVY_STORE_ITEMS,
  SAVVY_POINTS_PER_DOLLAR,
  findStoreItem,
};

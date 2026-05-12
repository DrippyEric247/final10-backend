const { recommendDeal } = require('./dealRecommendationService');

const ENDING_SOON_SECONDS = 60 * 60 * 2;

function toMoney(value, fallback = null) {
  if (value == null || value === '') return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeBuyingOptions(item) {
  const raw = Array.isArray(item.buyingOptions) ? item.buyingOptions : [];
  return raw.map((x) => String(x || '').toUpperCase()).filter(Boolean);
}

function normalizeEbayItemSummary(item) {
  const buyingOptions = normalizeBuyingOptions(item);
  const isAuction = buyingOptions.includes('AUCTION');
  const isBuyNow = buyingOptions.includes('FIXED_PRICE');
  const hasBothOptions = isAuction && isBuyNow;
  const primaryPrice = toMoney(item.price?.value, null);
  const currentBidPrice = toMoney(item.currentBidPrice?.value, isAuction ? primaryPrice : null);
  const buyNowRaw = item.buyNowPrice?.value ?? item.buyItNowPrice?.value ?? null;
  const buyNowPrice = toMoney(buyNowRaw, isBuyNow ? primaryPrice : null);
  const end = item.itemEndDate ? new Date(item.itemEndDate) : null;
  const secondsRemaining =
    end && !Number.isNaN(end.getTime())
      ? Math.max(0, Math.floor((end.getTime() - Date.now()) / 1000))
      : 0;

  const normalized = {
    itemId: item.itemId,
    title: item.title,
    image: item.image?.imageUrl || '/fallback.png',
    imageUrl: item.image?.imageUrl || '/fallback.png',
    itemWebUrl: item.itemWebUrl,
    currentBidPrice,
    buyNow: buyNowRaw ?? null,
    buyNowPrice,
    price: primaryPrice,
    currency: item.price?.currency || 'USD',
    bidCount: Number(item.bidCount) || 0,
    itemEndDate: item.itemEndDate || null,
    condition: item.condition || '',
    seller: item.seller?.username || 'unknown',
    sellerUsername: item.seller?.username || 'unknown',
    buyingOptions,
    isAuction,
    isBuyNow,
    hasBothOptions,
    secondsRemaining,
    endingSoon: secondsRemaining > 0 && secondsRemaining <= ENDING_SOON_SECONDS,
    source: 'ebay',
  };

  const rec = recommendDeal(normalized);
  return { ...normalized, ...rec };
}

function toLegacyAuctionShape(item) {
  return {
    id: item.itemId,
    _id: item.itemId,
    title: item.title,
    image: item.imageUrl,
    images: item.imageUrl ? [{ url: item.imageUrl, alt: item.title }] : [],
    currentBid: item.currentBidPrice ?? item.price,
    currentPrice: item.price,
    price: item.price,
    currency: item.currency,
    endTime: item.itemEndDate,
    endsIn: item.itemEndDate,
    endsAtHuman: item.itemEndDate ? new Date(item.itemEndDate).toLocaleString() : '',
    bidCount: item.bidCount,
    bids: item.bidCount,
    itemUrl: item.itemWebUrl,
    url: item.itemWebUrl,
    platform: 'eBay',
    timeRemaining: item.secondsRemaining,
    sellerUsername: item.sellerUsername || undefined,
  };
}

module.exports = {
  ENDING_SOON_SECONDS,
  normalizeEbayItemSummary,
  toLegacyAuctionShape,
};

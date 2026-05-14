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

  const cat0 = Array.isArray(item.categories) ? item.categories[0] : null;
  const seller = item.seller || {};
  const feedbackScore = Number(seller.feedbackScore);
  const pctRaw =
    seller.feedbackPercentage ?? seller.positiveFeedbackPercentage ?? seller.feedbackPercent;
  let sellerFeedbackPercent = null;
  if (pctRaw != null && pctRaw !== '') {
    const p = Number(String(pctRaw).replace(/%/g, '').trim());
    sellerFeedbackPercent = Number.isFinite(p) ? p : null;
  }
  const sellerFeedbackCount =
    Number.isFinite(feedbackScore) && feedbackScore > 0 ? feedbackScore : null;
  const sellerJoinIso = seller.sellerRegistrationDate || seller.accountCreationDate || null;
  let sellerAccountAgeDays = null;
  if (sellerJoinIso) {
    const t = new Date(sellerJoinIso).getTime();
    if (!Number.isNaN(t)) {
      sellerAccountAgeDays = Math.max(0, Math.floor((Date.now() - t) / 86400000));
    }
  }

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
    seller: seller.username || 'unknown',
    sellerUsername: seller.username || 'unknown',
    sellerFeedbackPercent,
    /** eBay feedback score ≈ unique buyer transactions; used as sold volume proxy when needed */
    sellerFeedbackCount,
    sellerCompletedSalesCount: sellerFeedbackCount,
    sellerTopRated: Boolean(
      item.topRatedBuyingExperience ||
        seller.topRatedBuyingExperience ||
        seller.sellerRepScore === 'TOP_RATED' ||
        /top\s*rated/i.test(String(seller.topRatedBuyingExperience || seller.sellerRepScore || ''))
    ),
    sellerAccountAgeDays,
    sellerAccountType: seller.sellerAccountType || null,
    buyingOptions,
    isAuction,
    isBuyNow,
    hasBothOptions,
    secondsRemaining,
    endingSoon: secondsRemaining > 0 && secondsRemaining <= ENDING_SOON_SECONDS,
    source: 'ebay',
    primaryCategoryId: cat0?.categoryId ? String(cat0.categoryId) : null,
    primaryCategoryName: cat0?.categoryName ? String(cat0.categoryName) : null,
    leafCategoryIds: Array.isArray(item.leafCategoryIds)
      ? item.leafCategoryIds.map((x) => String(x)).filter(Boolean)
      : [],
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
    seller: item.seller,
    sellerFeedbackPercent: item.sellerFeedbackPercent ?? undefined,
    sellerFeedbackCount: item.sellerFeedbackCount ?? undefined,
    sellerCompletedSalesCount: item.sellerCompletedSalesCount ?? undefined,
    sellerTopRated: item.sellerTopRated ?? undefined,
    sellerAccountAgeDays: item.sellerAccountAgeDays ?? undefined,
    sellerAccountType: item.sellerAccountType ?? undefined,
    sellerTopRated: item.sellerTopRated ?? undefined,
    // True Market Value enrichment (added by marketValueService)
    marketValue: item.marketValue ?? null,
    marketStats: item.marketStats || null,
    marketConfidence: item.marketConfidence || null,
    marketLabel: item.marketLabel || null,
    savings: item.savings ?? null,
    savingsPct: item.savingsPct ?? null,
    dealBadges: Array.isArray(item.dealBadges) ? item.dealBadges : [],
  };
}

module.exports = {
  ENDING_SOON_SECONDS,
  normalizeEbayItemSummary,
  toLegacyAuctionShape,
};

const RECOMMENDATION_TYPES = {
  BUY_NOW_BETTER: 'buy_now_better',
  AUCTION_BETTER: 'auction_better',
  WAIT_AND_WATCH: 'wait_and_watch',
  PASS: 'pass',
};

function toNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function clamp01(v) {
  return Math.max(0, Math.min(1, v));
}

function recommendDeal(item) {
  const currentBid = toNum(item.currentBidPrice);
  const buyNow = toNum(item.buyNowPrice);
  const bidCount = Number(item.bidCount) || 0;
  const secs = Number(item.secondsRemaining) || 0;
  const hasBoth = Boolean(item.hasBothOptions);
  const isAuction = Boolean(item.isAuction);
  const isBuyNow = Boolean(item.isBuyNow);

  if (hasBoth && currentBid != null && buyNow != null) {
    const diff = buyNow - currentBid;
    const ratio = currentBid > 0 ? diff / currentBid : 1;
    if (diff >= 0 && ratio <= 0.08) {
      return {
        recommendationType: RECOMMENDATION_TYPES.BUY_NOW_BETTER,
        recommendationReason: `Buy It Now is only $${diff.toFixed(0)} more - safer move`,
        confidenceScore: clamp01(0.84 - ratio),
      };
    }
    if (ratio >= 0.2 && bidCount <= 4) {
      return {
        recommendationType: RECOMMENDATION_TYPES.AUCTION_BETTER,
        recommendationReason: 'Low bid count and price gap favor auction upside',
        confidenceScore: clamp01(0.72 + Math.min(ratio, 0.3)),
      };
    }
  }

  if (isAuction && currentBid != null) {
    if (secs > 60 * 60 * 6 && bidCount <= 2) {
      return {
        recommendationType: RECOMMENDATION_TYPES.WAIT_AND_WATCH,
        recommendationReason: 'Watch this one - time remaining is long and bid activity is still low',
        confidenceScore: 0.64,
      };
    }
    if (bidCount >= 18) {
      return {
        recommendationType: RECOMMENDATION_TYPES.PASS,
        recommendationReason: 'Pass for now - bidding pressure is already high',
        confidenceScore: 0.78,
      };
    }
    return {
      recommendationType: RECOMMENDATION_TYPES.AUCTION_BETTER,
      recommendationReason: 'Low bid count and active auction make bidding the stronger move',
      confidenceScore: clamp01(0.58 + Math.max(0, (6 - bidCount) * 0.04)),
    };
  }

  if (isBuyNow && buyNow != null) {
    if (buyNow > 2000) {
      return {
        recommendationType: RECOMMENDATION_TYPES.PASS,
        recommendationReason: 'Pass for now - value edge looks weak at this price',
        confidenceScore: 0.7,
      };
    }
    return {
      recommendationType: RECOMMENDATION_TYPES.BUY_NOW_BETTER,
      recommendationReason: 'Buy It Now avoids auction volatility',
      confidenceScore: 0.67,
    };
  }

  return {
    recommendationType: RECOMMENDATION_TYPES.WAIT_AND_WATCH,
    recommendationReason: 'Watch this one - market setup is still unclear',
    confidenceScore: 0.55,
  };
}

module.exports = {
  RECOMMENDATION_TYPES,
  recommendDeal,
};

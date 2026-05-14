/**
 * Server-side deal recommendation. Reads the True Market Value enrichment
 * (median sold/comparable price + confidence) when present and tilts the
 * recommendation accordingly:
 *
 *   - listing >=15% under market  → strong "go" signal
 *   - listing above market        → "pass" / "wait" signal
 *   - high seller trust            → confidence boost
 */

const RECOMMENDATION_TYPES = {
  BUY_NOW_BETTER: 'buy_now_better',
  AUCTION_BETTER: 'auction_better',
  WAIT_AND_WATCH: 'wait_and_watch',
  PASS: 'pass',
};

function toNum(v) {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function clamp01(v) {
  return Math.max(0, Math.min(1, v));
}

function pickListingPrice(item) {
  const candidates = [item.buyNowPrice, item.currentBidPrice, item.price];
  for (const c of candidates) {
    const n = toNum(c);
    if (n != null && n > 0) return n;
  }
  return null;
}

function trustBoost(item) {
  const fbPct = toNum(item.sellerFeedbackPercent);
  const fbCount = toNum(item.sellerFeedbackCount);
  let boost = 0;
  if (fbPct != null && fbPct >= 99) boost += 0.05;
  if (fbCount != null && fbCount >= 500) boost += 0.05;
  if (item.sellerTopRated === true || item.sellerTopRated === 'true') boost += 0.05;
  return Math.min(0.15, boost);
}

function recommendDeal(item) {
  const currentBid = toNum(item.currentBidPrice);
  const buyNow = toNum(item.buyNowPrice);
  const bidCount = Number(item.bidCount) || 0;
  const secs = Number(item.secondsRemaining) || 0;
  const hasBoth = Boolean(item.hasBothOptions);
  const isAuction = Boolean(item.isAuction);
  const isBuyNow = Boolean(item.isBuyNow);

  const market = toNum(item.marketValue);
  const live = pickListingPrice(item);
  const savingsPct =
    market != null && live != null && market > 0 ? (market - live) / market : null;
  const marketConfidence = String(item.marketConfidence || '').toLowerCase();
  const trust = trustBoost(item);

  // True-market-value override: when comp data is solid and the listing is
  // already well under market, surface it as a strong move regardless of
  // bidder noise. Above-market listings get pushed to PASS.
  if (savingsPct != null && marketConfidence !== 'low') {
    if (savingsPct >= 0.15) {
      const baseConfidence = clamp01(0.7 + savingsPct * 0.6 + trust);
      if (isAuction) {
        return {
          recommendationType: RECOMMENDATION_TYPES.AUCTION_BETTER,
          recommendationReason: `Listing is ${(savingsPct * 100).toFixed(0)}% under True Market Value`,
          confidenceScore: baseConfidence,
        };
      }
      return {
        recommendationType: RECOMMENDATION_TYPES.BUY_NOW_BETTER,
        recommendationReason: `Buy Now is ${(savingsPct * 100).toFixed(0)}% under True Market Value`,
        confidenceScore: baseConfidence,
      };
    }
    if (savingsPct <= -0.05) {
      return {
        recommendationType: RECOMMENDATION_TYPES.PASS,
        recommendationReason: `Listing is above True Market Value by ${(Math.abs(savingsPct) * 100).toFixed(0)}%`,
        confidenceScore: clamp01(0.7 + Math.min(0.2, Math.abs(savingsPct))),
      };
    }
  }

  if (hasBoth && currentBid != null && buyNow != null) {
    const diff = buyNow - currentBid;
    const ratio = currentBid > 0 ? diff / currentBid : 1;
    if (diff >= 0 && ratio <= 0.08) {
      return {
        recommendationType: RECOMMENDATION_TYPES.BUY_NOW_BETTER,
        recommendationReason: `Buy It Now is only $${diff.toFixed(0)} more - safer move`,
        confidenceScore: clamp01(0.84 - ratio + trust),
      };
    }
    if (ratio >= 0.2 && bidCount <= 4) {
      return {
        recommendationType: RECOMMENDATION_TYPES.AUCTION_BETTER,
        recommendationReason: 'Low bid count and price gap favor auction upside',
        confidenceScore: clamp01(0.72 + Math.min(ratio, 0.3) + trust),
      };
    }
  }

  if (isAuction && currentBid != null) {
    if (secs > 60 * 60 * 6 && bidCount <= 2) {
      return {
        recommendationType: RECOMMENDATION_TYPES.WAIT_AND_WATCH,
        recommendationReason: 'Watch this one - time remaining is long and bid activity is still low',
        confidenceScore: clamp01(0.64 + trust),
      };
    }
    if (bidCount >= 18) {
      return {
        recommendationType: RECOMMENDATION_TYPES.PASS,
        recommendationReason: 'Pass for now - bidding pressure is already high',
        confidenceScore: clamp01(0.78 + trust * 0.5),
      };
    }
    return {
      recommendationType: RECOMMENDATION_TYPES.AUCTION_BETTER,
      recommendationReason: 'Low bid count and active auction make bidding the stronger move',
      confidenceScore: clamp01(0.58 + Math.max(0, (6 - bidCount) * 0.04) + trust),
    };
  }

  if (isBuyNow && buyNow != null) {
    if (buyNow > 2000) {
      return {
        recommendationType: RECOMMENDATION_TYPES.PASS,
        recommendationReason: 'Pass for now - value edge looks weak at this price',
        confidenceScore: clamp01(0.7 + trust * 0.5),
      };
    }
    return {
      recommendationType: RECOMMENDATION_TYPES.BUY_NOW_BETTER,
      recommendationReason: 'Buy It Now avoids auction volatility',
      confidenceScore: clamp01(0.67 + trust),
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

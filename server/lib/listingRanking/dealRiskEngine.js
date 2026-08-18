const { toNum, clamp } = require('./utils');

function hasUsefulTitle(title) {
  const trimmed = String(title || '').trim();
  if (trimmed.length < 10) return false;
  if (/^(item|listing|good deal|great deal|for sale)$/i.test(trimmed)) return false;
  return true;
}

function inferImageCount(input) {
  const direct = toNum(input.imageCount);
  if (direct != null && direct >= 0) return direct;
  return null;
}

function listingLooksHiRes(url) {
  const u = String(url || '').toLowerCase();
  return /s-l1600|s-l1400|s-l1280|\/zoom\//i.test(u);
}

function getComparablePrice(input) {
  return toNum(input.buyNowPrice) ?? toNum(input.currentBidPrice) ?? toNum(input.price);
}

function evaluateDealRisk(input) {
  const flags = [];
  const warnings = [];
  const dealHighlights = [];
  let score = 78;

  const comparablePrice = getComparablePrice(input);
  const marketValue = toNum(input.marketValue);
  const shippingCost = Math.max(0, toNum(input.shippingCost) || 0);
  const imageUrl = String(input.imageUrl || '').trim();
  const hasImage = Boolean(imageUrl);
  const title = String(input.title || '');
  const hasCondition = Boolean(String(input.condition || '').trim());
  const imageCount = inferImageCount(input);

  let belowMarketPct = null;
  if (marketValue != null && comparablePrice != null && marketValue > 0) {
    belowMarketPct = (marketValue - comparablePrice) / marketValue;
    if (belowMarketPct > 0.12 && belowMarketPct <= 0.38) {
      dealHighlights.push('Under typical market range');
      score += 2;
    }
    if (belowMarketPct > 0.35) {
      score -= 14;
      flags.push('price_far_below_market');
      warnings.push('Price is unusually low vs market — double-check listing details.');
    }
    if (belowMarketPct > 0.5) {
      score -= 10;
      if (!flags.includes('price_far_below_market')) flags.push('price_far_below_market');
    }
    if (belowMarketPct <= 0.08) dealHighlights.push('Priced near market');
  }

  if (comparablePrice != null && comparablePrice > 0 && shippingCost / comparablePrice > 0.35) {
    score -= 12;
    flags.push('high_shipping');
    warnings.push('Shipping is high relative to item price.');
  }

  if (!hasImage) {
    score -= 18;
    flags.push('missing_image');
    warnings.push('Listing is missing photos.');
  } else if (imageCount != null && imageCount >= 3 && listingLooksHiRes(imageUrl)) {
    dealHighlights.push('Strong listing imagery');
    score += 4;
  }

  if (!hasUsefulTitle(title)) {
    score -= 8;
    flags.push('suspicious_title');
    warnings.push('Title looks sparse or generic.');
  }

  if (!hasCondition) {
    score -= 6;
    flags.push('incomplete_metadata');
    warnings.push('Condition not specified.');
  }

  if (/wholesale|replica|100% authentic guarantee|wire only|cashapp/i.test(title)) {
    score -= 12;
    flags.push('suspicious_title');
    warnings.push('Listing wording warrants extra scrutiny.');
  }

  score = clamp(Math.round(score), 5, 100);
  return { dealRiskScore: score, flags, warnings, dealHighlights };
}

module.exports = { evaluateDealRisk };

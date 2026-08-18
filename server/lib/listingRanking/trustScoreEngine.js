const { toNum, clamp } = require('./utils');
const { evaluateSellerTrust } = require('./sellerTrustEngine');
const { evaluateDealRisk } = require('./dealRiskEngine');

function isSavvyVerified(value) {
  if (typeof value === 'boolean') return value;
  const s = String(value || '').trim().toLowerCase();
  return s === 'true' || s === '1' || s === 'yes';
}

function pushUnique(arr, value) {
  if (!arr.includes(value)) arr.push(value);
}

function getTrustLevel(sellerScore) {
  if (sellerScore >= 80) return 'high';
  if (sellerScore >= 55) return 'medium';
  if (sellerScore >= 36) return 'low';
  return 'unverified';
}

function resolveLegacyTrustLevel(params) {
  const { sellerScore, sellerBand, hasSellerIdentity, severeFraud, established, mega } = params;
  if (severeFraud) return 'low';
  if (established || mega) {
    if (sellerScore >= 55) return 'high';
    return 'medium';
  }
  if (sellerBand === 'elite' || sellerBand === 'high') return 'high';
  if (sellerBand === 'medium') return 'medium';
  if (sellerBand === 'low') return 'low';
  if (!hasSellerIdentity && sellerScore < 30) return 'unverified';
  return sellerScore >= 36 ? 'medium' : 'low';
}

function computeAiConfidence(sellerScore, dealScore, trustLevel, safeToRecommend) {
  let c = sellerScore * 0.62 + dealScore * 0.38;
  if (!safeToRecommend) c *= 0.88;
  if (trustLevel === 'unverified') c *= 0.82;
  else if (trustLevel === 'low') c *= 0.9;
  return clamp(Math.round(c), 12, 97);
}

function trustScoreInputFromListing(item) {
  const images = item.images;
  let imageCount = null;
  if (Array.isArray(images)) imageCount = images.length;
  const thumbs = item.thumbnailImages ?? item.additionalImages;
  if (imageCount == null && Array.isArray(thumbs)) imageCount = thumbs.length;

  const imgUrl =
    (typeof item.imageUrl === 'string' && item.imageUrl) ||
    (typeof item.image === 'string' && item.image) ||
    null;

  const rawSeller = item.seller;
  const s = typeof rawSeller === 'object' && rawSeller !== null ? rawSeller : null;
  const nestedPct = s
    ? s.feedbackPercentage ?? s.positiveFeedbackPercentage
    : undefined;
  const nestedScore = s ? toNum(s.feedbackScore) : null;
  const nestedJoin =
    s && (s.sellerRegistrationDate || s.accountCreationDate)
      ? String(s.sellerRegistrationDate || s.accountCreationDate)
      : null;
  let nestedAgeDays = null;
  if (nestedJoin) {
    const t = new Date(nestedJoin).getTime();
    if (!Number.isNaN(t)) nestedAgeDays = Math.max(0, Math.floor((Date.now() - t) / 86400000));
  }

  const flatPct = toNum(item.sellerFeedbackPercent);
  let sellerFeedbackPercent = item.sellerFeedbackPercent;
  if (flatPct == null && nestedPct != null) sellerFeedbackPercent = nestedPct;

  const flatCount = toNum(item.sellerFeedbackCount);
  const sellerFeedbackCount = flatCount ?? nestedScore ?? item.sellerFeedbackScore;
  const flatAge = toNum(item.sellerAccountAgeDays);
  const sellerAccountAgeDays = flatAge ?? nestedAgeDays ?? toNum(item.sellerRegistrationDays);

  return {
    title: item.title ?? null,
    imageUrl: imgUrl,
    imageCount: imageCount ?? item.imageCount ?? null,
    marketValue: item.marketValue ?? null,
    price: item.price ?? null,
    currentBidPrice: item.currentBidPrice ?? item.currentBid ?? null,
    buyNowPrice: item.buyNowPrice ?? null,
    shippingCost: item.shippingCost ?? null,
    condition: item.condition ?? null,
    sellerFeedbackPercent: sellerFeedbackPercent ?? null,
    sellerFeedbackCount: sellerFeedbackCount ?? null,
    sellerCompletedSalesCount: item.sellerCompletedSalesCount ?? null,
    sellerTopRated: item.sellerTopRated ?? null,
    sellerAccountAgeDays: sellerAccountAgeDays ?? null,
    sellerResponseHours: item.sellerResponseHours ?? null,
    sellerRepeatBuyerRate: item.sellerRepeatBuyerRate ?? null,
    seller:
      (typeof item.seller === 'string' ? item.seller : null) ??
      (typeof item.sellerUsername === 'string' ? item.sellerUsername : null) ??
      (s?.username != null ? String(s.username) : null),
    sellerAccountType: item.sellerAccountType ?? s?.sellerAccountType ?? null,
    sellerReturnsAccepted: item.sellerReturnsAccepted ?? null,
    savvyVerifiedSeller: item.savvyVerifiedSeller ?? null,
  };
}

function evaluateTrustScore(input) {
  const savvyVerified = isSavvyVerified(input.savvyVerifiedSeller);
  const sellerName = String(input.seller || '').trim();
  const hasSellerIdentity = Boolean(sellerName && !/^(unknown|ebay seller)$/i.test(sellerName));

  const seller = evaluateSellerTrust(input);
  const deal = evaluateDealRisk(input);

  const severeFraud =
    deal.flags.includes('suspicious_title') &&
    (deal.dealRiskScore < 18 || /replica|counterfeit/i.test(String(input.title || '')));

  const trustLevel = resolveLegacyTrustLevel({
    sellerScore: seller.sellerTrustScore,
    sellerBand: seller.band,
    hasSellerIdentity,
    severeFraud,
    established: seller.isEstablishedSeller,
    mega: seller.isMegaReputation,
  });

  const riskFlags = [...deal.flags];
  if (!hasSellerIdentity) pushUnique(riskFlags, 'missing_seller');
  if (seller.band === 'low') pushUnique(riskFlags, 'low_feedback');
  if (severeFraud) pushUnique(riskFlags, 'severe_fraud_signal');

  const safeToRecommend =
    trustLevel !== 'unverified' &&
    (seller.isEstablishedSeller || seller.isMegaReputation || seller.sellerTrustScore >= 42) &&
    deal.dealRiskScore >= 28 &&
    !severeFraud &&
    hasSellerIdentity;

  const aiConfidence = computeAiConfidence(
    seller.sellerTrustScore,
    deal.dealRiskScore,
    trustLevel,
    safeToRecommend
  );

  return {
    trustScore: seller.sellerTrustScore,
    trustLevel,
    sellerTrustScore: seller.sellerTrustScore,
    sellerTrustBand: seller.band,
    dealRiskScore: deal.dealRiskScore,
    dealRiskFlags: deal.flags,
    dealHighlights: deal.dealHighlights,
    riskFlags,
    safeToRecommend,
    aiConfidence,
    savvyVerifiedSeller: savvyVerified,
    isEstablishedSeller: seller.isEstablishedSeller,
    isMegaReputation: seller.isMegaReputation,
  };
}

function evaluateListingTrust(item, patch = {}) {
  const base = trustScoreInputFromListing(item);
  return evaluateTrustScore({ ...base, ...patch });
}

module.exports = {
  trustScoreInputFromListing,
  evaluateTrustScore,
  evaluateListingTrust,
  getTrustLevel,
};

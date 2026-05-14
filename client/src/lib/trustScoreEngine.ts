import type { BestMoveResult } from '../types/bestMove';
import type {
  MergedDealTrustDecision,
  TrustLevel,
  TrustRiskFlag,
  TrustScoreInput,
  TrustScoreResult,
} from '../types/trustScore';
import { evaluateDealRisk } from './dealRiskEngine';
import { evaluateSellerTrust } from './sellerTrustEngine';

function toNum(value: number | string | null | undefined): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function isSavvyVerified(value: TrustScoreInput['savvyVerifiedSeller']): boolean {
  if (typeof value === 'boolean') return value;
  const s = String(value || '').trim().toLowerCase();
  return s === 'true' || s === '1' || s === 'yes';
}

function pushUnique<T>(arr: T[], value: T) {
  if (!arr.includes(value)) arr.push(value);
}

/**
 * Legacy 0–100 buckets for feeds / rewards — driven primarily by **seller** trust,
 * not deal price. “Unverified” is reserved for missing identity + weak signals only.
 */
export function getTrustLevel(sellerScore: number): TrustLevel {
  if (sellerScore >= 80) return 'high';
  if (sellerScore >= 55) return 'medium';
  if (sellerScore >= 36) return 'low';
  return 'unverified';
}

function resolveLegacyTrustLevel(params: {
  sellerScore: number;
  sellerBand: TrustScoreResult['sellerTrustBand'];
  hasSellerIdentity: boolean;
  severeFraud: boolean;
  established: boolean;
  mega: boolean;
}): TrustLevel {
  const { sellerScore, hasSellerIdentity, severeFraud, established, mega } = params;

  if (severeFraud) return 'low';

  if (established || mega) {
    if (sellerScore >= 55) return 'high';
    return 'medium';
  }

  if (params.sellerBand === 'elite' || params.sellerBand === 'high') return 'high';
  if (params.sellerBand === 'medium') return 'medium';
  if (params.sellerBand === 'low') return 'low';

  if (!hasSellerIdentity && sellerScore < 30) return 'unverified';
  return sellerScore >= 36 ? 'medium' : 'low';
}

function pickSellerWarning(sellerBand: TrustScoreResult['sellerTrustBand']): string | null {
  if (sellerBand === 'low') return 'Low seller confidence.';
  return null;
}

function pickDealWarning(deal: ReturnType<typeof evaluateDealRisk>): string | null {
  if (deal.flags.includes('price_far_below_market')) return 'Price lower than typical market range.';
  if (deal.flags.includes('high_shipping')) return 'Shipping cost looks high for this item.';
  if (deal.flags.includes('missing_image')) return 'Listing is missing photos.';
  return null;
}

function computeAiConfidence(
  sellerScore: number,
  dealScore: number,
  trustLevel: TrustLevel,
  safeToRecommend: boolean
): number {
  let c = sellerScore * 0.62 + dealScore * 0.38;
  if (!safeToRecommend) c *= 0.88;
  if (trustLevel === 'unverified') c *= 0.82;
  else if (trustLevel === 'low') c *= 0.9;
  return clamp(Math.round(c), 12, 97);
}

/** Builds TrustScoreInput from normalized marketplace listing blobs (eBay, feeds). */
export function trustScoreInputFromListing(item: Record<string, unknown>): TrustScoreInput {
  const images = item.images;
  let imageCount: number | null = null;
  if (Array.isArray(images)) imageCount = images.length;
  const thumbs = item.thumbnailImages ?? item.additionalImages;
  if (imageCount == null && Array.isArray(thumbs)) imageCount = thumbs.length;

  const imgUrl =
    (typeof item.imageUrl === 'string' && item.imageUrl) ||
    (typeof item.image === 'string' && item.image) ||
    null;

  const rawSeller = item.seller;
  const s =
    typeof rawSeller === 'object' && rawSeller !== null
      ? (rawSeller as Record<string, unknown>)
      : null;

  const nestedPct = s
    ? (s.feedbackPercentage as string | number | undefined) ??
      (s.positiveFeedbackPercentage as string | number | undefined)
    : undefined;
  const nestedScore = s ? toNum(s.feedbackScore as number | string | undefined) : null;
  const nestedJoin =
    s && (s.sellerRegistrationDate || s.accountCreationDate)
      ? String(s.sellerRegistrationDate || s.accountCreationDate)
      : null;
  let nestedAgeDays: number | null = null;
  if (nestedJoin) {
    const t = new Date(nestedJoin).getTime();
    if (!Number.isNaN(t)) nestedAgeDays = Math.max(0, Math.floor((Date.now() - t) / 86400000));
  }

  const flatPct = toNum(item.sellerFeedbackPercent as number | string | undefined);
  let sellerFeedbackPercent: number | string | null | undefined = item.sellerFeedbackPercent as
    | number
    | string
    | undefined;
  if (flatPct == null && nestedPct != null) sellerFeedbackPercent = nestedPct as number | string;

  const flatCount = toNum(item.sellerFeedbackCount as number | string | undefined);
  const sellerFeedbackCount =
    flatCount ??
    nestedScore ??
    (item.sellerFeedbackScore as number | string | undefined);

  const flatAge = toNum(item.sellerAccountAgeDays as number | string | undefined);
  const sellerAccountAgeDays =
    flatAge ?? nestedAgeDays ?? toNum(item.sellerRegistrationDays as number | string | undefined);

  return {
    title: (item.title as string) ?? null,
    imageUrl: imgUrl,
    imageCount: imageCount ?? (item.imageCount as number | string | undefined) ?? null,
    listingDescriptionLength:
      (item.descriptionLength as number | undefined) ??
      (typeof item.shortDescription === 'string' ? item.shortDescription.length : undefined) ??
      null,
    marketValue: (item.marketValue as number | string | undefined) ?? null,
    price: (item.price as number | string | undefined) ?? null,
    currentBidPrice:
      (item.currentBidPrice as number | string | undefined) ??
      (item.currentBid as number | string | undefined) ??
      null,
    buyNowPrice: (item.buyNowPrice as number | string | undefined) ?? null,
    shippingCost: (item.shippingCost as number | string | undefined) ?? null,
    condition: (item.condition as string | undefined) ?? null,
    sellerFeedbackPercent: sellerFeedbackPercent ?? null,
    sellerFeedbackCount: sellerFeedbackCount ?? null,
    sellerCompletedSalesCount:
      (item.sellerCompletedSalesCount as number | string | undefined) ?? null,
    sellerTopRated: (item.sellerTopRated as boolean | string | undefined) ?? null,
    sellerAccountAgeDays: sellerAccountAgeDays ?? null,
    sellerReturnRatePercent: (item.sellerReturnRatePercent as number | string | undefined) ?? null,
    sellerResponseHours: (item.sellerResponseHours as number | string | undefined) ?? null,
    sellerCategorySalesCount:
      (item.sellerCategorySalesCount as number | string | undefined) ?? null,
    sellerRepeatBuyerRate: (item.sellerRepeatBuyerRate as number | string | undefined) ?? null,
    seller:
      (typeof item.seller === 'string' ? item.seller : null) ??
      (typeof item.sellerUsername === 'string' ? item.sellerUsername : null) ??
      (s?.username != null ? String(s.username) : null),
    sellerAccountType: (item.sellerAccountType as string | undefined) ?? (s?.sellerAccountType as string) ?? null,
    sellerReturnsAccepted: (item.sellerReturnsAccepted as boolean | string | undefined) ?? null,
    savvyVerifiedSeller: (item.savvyVerifiedSeller as boolean | undefined) ?? null,
  };
}

export function evaluateTrustScore(input: TrustScoreInput): TrustScoreResult {
  const savvyVerified = isSavvyVerified(input.savvyVerifiedSeller);
  const sellerName = String(input.seller || '').trim();
  const hasSellerIdentity = Boolean(
    sellerName && !/^(unknown|ebay seller)$/i.test(sellerName)
  );

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

  const riskFlags: TrustRiskFlag[] = [...deal.flags];
  if (!hasSellerIdentity) pushUnique(riskFlags, 'missing_seller');
  if (seller.band === 'low') pushUnique(riskFlags, 'low_feedback');
  if (severeFraud) pushUnique(riskFlags, 'severe_fraud_signal');

  const safeToRecommend =
    trustLevel !== 'unverified' &&
    (seller.isEstablishedSeller || seller.isMegaReputation || seller.sellerTrustScore >= 42) &&
    deal.dealRiskScore >= 28 &&
    !severeFraud &&
    hasSellerIdentity;

  const savvyWarningHeadline = pickSellerWarning(seller.band);
  const dealWarningHeadline = pickDealWarning(deal);

  const trustReasons = [...seller.reasons];
  const trustWarnings: string[] = [];
  if (savvyWarningHeadline) trustWarnings.push(savvyWarningHeadline);
  if (deal.warnings.length) trustWarnings.push(...deal.warnings);

  const aiConfidence = computeAiConfidence(
    seller.sellerTrustScore,
    deal.dealRiskScore,
    trustLevel,
    safeToRecommend
  );

  if (savvyVerified && !trustReasons.some((r) => /Savvy Verified/i.test(r))) {
    trustReasons.unshift('Savvy Verified Seller.');
  }

  return {
    trustScore: seller.sellerTrustScore,
    trustLevel,
    sellerTrustScore: seller.sellerTrustScore,
    sellerTrustBand: seller.band,
    sellerTrustReasons: seller.reasons,
    dealRiskScore: deal.dealRiskScore,
    dealRiskFlags: deal.flags,
    dealRiskWarnings: deal.warnings,
    dealHighlights: deal.dealHighlights,
    trustReasons,
    trustWarnings,
    riskFlags,
    safeToRecommend,
    aiConfidence,
    savvyWarningHeadline,
    dealWarningHeadline,
    savvyVerifiedSeller: savvyVerified,
    isEstablishedSeller: seller.isEstablishedSeller,
    isMegaReputation: seller.isMegaReputation,
  };
}

export function getTrustSummary(_listing: TrustScoreInput, trustResult: TrustScoreResult): string {
  if (trustResult.sellerTrustBand === 'elite' || trustResult.sellerTrustBand === 'high') {
    return trustResult.sellerTrustReasons[0] || trustResult.trustReasons[0] || 'Trusted seller profile.';
  }
  if (trustResult.dealWarningHeadline) return trustResult.dealWarningHeadline;
  if (trustResult.savvyWarningHeadline) return trustResult.savvyWarningHeadline;
  if (trustResult.trustLevel === 'medium') {
    return trustResult.trustWarnings[0] || 'Mixed signals — review listing details.';
  }
  return trustResult.trustWarnings[0] || 'Proceed with extra verification.';
}

function bestMoveLabel(bestMove: BestMoveResult['bestMove']): string {
  if (bestMove === 'buy_now') return 'Buy Now';
  if (bestMove === 'bid') return 'Bid';
  if (bestMove === 'watch') return 'Watch';
  return 'Pass';
}

export function mergeDealAndTrustDecision(
  dealResult: BestMoveResult,
  trustResult: TrustScoreResult
): MergedDealTrustDecision {
  const baseMove = bestMoveLabel(dealResult.bestMove);
  const highValue = dealResult.dealScore >= 75;
  const dealCaution =
    trustResult.dealRiskFlags.includes('price_far_below_market') && trustResult.dealRiskScore < 45;

  if (trustResult.trustLevel === 'unverified' || trustResult.trustLevel === 'low') {
    return {
      headline: '⚠️ Savvy recommends caution',
      caution: true,
      supportLine:
        trustResult.savvyWarningHeadline ||
        'Seller signals are thin — verify before you commit.',
    };
  }

  if (
    highValue &&
    dealCaution &&
    (trustResult.sellerTrustBand === 'high' ||
      trustResult.sellerTrustBand === 'elite' ||
      trustResult.isEstablishedSeller ||
      trustResult.isMegaReputation) &&
    (dealResult.bestMove === 'buy_now' || dealResult.bestMove === 'bid')
  ) {
    return {
      headline: '🔥 Strong deal — trusted seller',
      caution: true,
      supportLine:
        trustResult.dealWarningHeadline ||
        `${baseMove} looks strong; price is unusually low vs comps — still worth a careful read.`,
    };
  }

  if (highValue && dealCaution && (dealResult.bestMove === 'buy_now' || dealResult.bestMove === 'bid')) {
    return {
      headline: '⚠️ Strong value — check listing',
      caution: true,
      supportLine:
        trustResult.dealWarningHeadline ||
        'Unusual pricing vs market — confirm item condition and terms.',
    };
  }

  return {
    headline: `🔥 Best Move: ${baseMove}`,
    caution: false,
    supportLine: getTrustSummary({}, trustResult),
  };
}

export function getAdjustedReward(
  baseRewardInput: number | string | null | undefined,
  trustLevel: TrustLevel
): {
  adjustedReward: number;
  multiplier: number;
  rewardTag: 'Secure reward' | 'Moderate trust' | 'Risky reward' | 'Blocked — verify seller';
} {
  const parsed = Number(baseRewardInput);
  const baseReward = Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
  const multiplier =
    trustLevel === 'high' ? 1 : trustLevel === 'medium' ? 0.85 : trustLevel === 'low' ? 0.35 : 0;
  const adjustedReward = Math.max(0, Math.round(baseReward * multiplier));
  const rewardTag =
    trustLevel === 'high'
      ? 'Secure reward'
      : trustLevel === 'medium'
        ? 'Moderate trust'
        : trustLevel === 'low'
          ? 'Risky reward'
          : 'Blocked — verify seller';
  return { adjustedReward, multiplier, rewardTag };
}

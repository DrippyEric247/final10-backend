import type { TrustScoreInput, TrustScoreResult } from '../types/trustScore';
import { trustScoreInputFromListing } from './trustScoreEngine';
import { formatFeedbackCount } from './sellerTrustDisplay';

export type SellerEvidenceState =
  | 'GOOD'
  | 'CHECK_DETAILS'
  | 'LIMITED_HISTORY'
  | 'CONCERN_DETECTED'
  | 'SELLER_DATA_UNAVAILABLE';

export type Final10RiskLevel =
  | 'low_risk'
  | 'moderate_risk'
  | 'high_risk'
  | 'limited_evidence'
  | 'unknown';

export type Final10RemarkCode =
  | 'NEW_SELLER'
  | 'ESTABLISHED_SELLER'
  | 'TOP_RATED_SELLER'
  | 'LIMITED_FEEDBACK_COUNT'
  | 'LOW_FEEDBACK_COUNT'
  | 'HIGH_SALES_VOLUME'
  | 'RETURNS_ACCEPTED'
  | 'NO_RETURNS'
  | 'RECENT_NEGATIVE_FEEDBACK'
  | 'STRONG_LONG_TERM_HISTORY'
  | 'LIMITED_SELLING_HISTORY'
  | 'MARKETPLACE_VERIFIED'
  | 'LIMITED_EVIDENCE';

export type Final10Remark = {
  code: Final10RemarkCode;
  label: string;
  explanation: string;
};

export type MarketplaceSellerRating = {
  type: 'positiveFeedbackPercent';
  value: number | null;
  display: string | null;
};

export type SellerTrustEvidence = {
  marketplace: 'ebay' | 'unknown';
  username: string | null;
  positiveFeedbackPercent: number | null;
  feedbackCount: number | null;
  marketplaceRating: MarketplaceSellerRating;
  marketplaceBadges: string[];
  returnsAccepted: boolean | null;
  evidenceState: SellerEvidenceState;
  /** Marketplace facts shown to the user (eBay feedback %, count, etc.). */
  evidence: string[];
  /** Structured Final10 seller notes — always explainable. */
  final10Remarks: Final10Remark[];
  /** Plain-language seller concerns. */
  sellerConcerns: string[];
  /** Listing/deal notes — separate from seller reputation. */
  listingConcerns: string[];
  /** Material concerns surfaced to the user. */
  materialConcerns: string[];
  /** Primary compact Final10 note for cards. */
  final10Note: string;
  riskLevel: Final10RiskLevel;
  riskReasons: string[];
  isTopRated: boolean;
  accountAgeDays: number | null;
  /** Internal only — never shown in user-facing UI. */
  internalTrustScore: number | null;
};

const LISTING_CONCERN_PATTERNS = [
  /price lower than typical/i,
  /shipping cost/i,
  /missing photos/i,
  /incomplete metadata/i,
  /suspicious title/i,
  /under market/i,
  /listing/i,
];

export const RISK_LEVEL_LABEL: Record<Final10RiskLevel, string> = {
  low_risk: 'Low risk',
  moderate_risk: 'Moderate risk',
  high_risk: 'Higher risk',
  limited_evidence: 'Limited evidence',
  unknown: 'Unknown',
};

function toNum(value: unknown): number | null {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function parseFeedbackPercent(raw: unknown): number | null {
  if (raw == null || raw === '') return null;
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  const s = String(raw).replace(/%/g, '').trim();
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function isTopRated(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  const s = String(value || '').trim().toLowerCase();
  return s === 'true' || s === 'yes' || s === 'top-rated' || s === 'top_rated';
}

function parseReturnsAccepted(value: unknown): boolean | null {
  if (value == null || value === '') return null;
  if (typeof value === 'boolean') return value;
  const s = String(value).trim().toLowerCase();
  if (['true', 'yes', 'accepted', 'returns accepted'].includes(s)) return true;
  if (['false', 'no', 'not accepted', 'no returns'].includes(s)) return false;
  return null;
}

function isListingConcern(text: string): boolean {
  return LISTING_CONCERN_PATTERNS.some((re) => re.test(text));
}

function isPositiveTrustReason(text: string): boolean {
  return /strong positive|above 99|very strong|high feedback|large feedback|established seller|top rated|fast response|business|return policy|repeat-buyer|years old|verified seller|savvy verified/i.test(
    text
  );
}

function isSellerWarningConcern(text: string): boolean {
  return /negative|weaker|limited|incomplete|missing|low-history|newer|unverified|dispute/i.test(text);
}

/** Official marketplace reputation line — never an internal Final10 score. */
export function formatMarketplaceRatingDisplay(pct: number | null): string | null {
  if (pct == null) return null;
  const formatted = pct % 1 === 0 ? pct.toFixed(0) : pct.toFixed(1);
  return `${formatted}% Positive Feedback`;
}

function formatPositiveLine(pct: number | null, count: number | null): string | null {
  const rating = formatMarketplaceRatingDisplay(pct);
  if (!rating && count == null) return null;
  const countStr = count != null ? `${formatFeedbackCount(count)} ratings` : null;
  if (rating && countStr) return `${rating} • ${countStr}`;
  return rating || countStr;
}

function deriveEvidenceState(params: {
  pct: number | null;
  count: number | null;
  sellerConcerns: string[];
  hasData: boolean;
}): SellerEvidenceState {
  const { pct, count, sellerConcerns, hasData } = params;
  if (!hasData) return 'SELLER_DATA_UNAVAILABLE';
  if (sellerConcerns.some((c) => /weaker than typical|severe|missing seller identity/i.test(c))) {
    return 'CONCERN_DETECTED';
  }
  if (pct != null && pct < 95) return 'CHECK_DETAILS';
  if (pct != null && pct < 98 && sellerConcerns.some(isSellerWarningConcern)) return 'CHECK_DETAILS';
  if (count != null && count <= 10) return 'LIMITED_HISTORY';
  if (count != null && count < 20) return 'LIMITED_HISTORY';
  if (sellerConcerns.some(isSellerWarningConcern)) return 'CHECK_DETAILS';
  return 'GOOD';
}

function buildDefaultFinal10Note(state: SellerEvidenceState, remarks: Final10Remark[]): string {
  if (state === 'SELLER_DATA_UNAVAILABLE') {
    return 'Marketplace reputation data was not available for this listing.';
  }
  const primary = remarks.find((r) =>
    ['NEW_SELLER', 'LIMITED_EVIDENCE', 'RECENT_NEGATIVE_FEEDBACK'].includes(r.code)
  );
  if (primary) return primary.explanation;
  if (state === 'LIMITED_HISTORY') {
    return 'Perfect feedback so far, but the seller has limited transaction history.';
  }
  if (state === 'CONCERN_DETECTED' || state === 'CHECK_DETAILS') {
    return remarks.find((r) => r.code === 'RECENT_NEGATIVE_FEEDBACK')?.explanation
      || 'Review seller feedback before purchasing.';
  }
  const established = remarks.find((r) => r.code === 'ESTABLISHED_SELLER');
  if (established) return established.explanation;
  return 'No major seller concerns detected.';
}

function deriveFinal10Remarks(params: {
  pct: number | null;
  count: number | null;
  accountAgeDays: number | null;
  topRated: boolean;
  returnsAccepted: boolean | null;
  savvyVerified: boolean;
}): Final10Remark[] {
  const { pct, count, accountAgeDays, topRated, returnsAccepted, savvyVerified } = params;
  const remarks: Final10Remark[] = [];

  const isNew =
    (count != null && count <= 20) ||
    (accountAgeDays != null && accountAgeDays < 90 && (count == null || count < 50));

  const isEstablished =
    (count != null && count >= 500 && pct != null && pct >= 98) ||
    (count != null && count >= 1000) ||
    (count != null && count >= 250 && pct != null && pct >= 99);

  if (topRated) {
    remarks.push({
      code: 'TOP_RATED_SELLER',
      label: 'Top Rated Seller',
      explanation: 'eBay marks this seller as Top Rated.',
    });
  }

  if (isEstablished) {
    remarks.push({
      code: 'ESTABLISHED_SELLER',
      label: 'Established Seller',
      explanation: 'Large feedback history and strong marketplace reputation.',
    });
  } else if (isNew) {
    remarks.push({
      code: 'NEW_SELLER',
      label: 'New Seller',
      explanation:
        'Perfect feedback so far, but the seller has limited transaction history.',
    });
  }

  if (count != null && count >= 5000) {
    remarks.push({
      code: 'HIGH_SALES_VOLUME',
      label: 'High Sales Volume',
      explanation: `${formatFeedbackCount(count)} marketplace ratings on record.`,
    });
  }

  if (count != null && count <= 10) {
    remarks.push({
      code: 'LOW_FEEDBACK_COUNT',
      label: 'Low Feedback Count',
      explanation: `Only ${count} marketplace rating${count === 1 ? '' : 's'} so far.`,
    });
  } else if (count != null && count < 20) {
    remarks.push({
      code: 'LIMITED_FEEDBACK_COUNT',
      label: 'Limited Feedback Count',
      explanation: `${count} ratings — positive so far, but history is still building.`,
    });
  }

  if (accountAgeDays != null && accountAgeDays >= 730 && count != null && count >= 100) {
    remarks.push({
      code: 'STRONG_LONG_TERM_HISTORY',
      label: 'Strong Long-Term History',
      explanation: 'Seller account has years of marketplace activity.',
    });
  }

  if (returnsAccepted === true) {
    remarks.push({
      code: 'RETURNS_ACCEPTED',
      label: 'Returns Accepted',
      explanation: 'This listing indicates returns are accepted.',
    });
  } else if (returnsAccepted === false) {
    remarks.push({
      code: 'NO_RETURNS',
      label: 'No Returns',
      explanation: 'Returns may not be accepted on this listing.',
    });
  }

  if (pct != null && pct < 98 && count != null && count >= 20) {
    remarks.push({
      code: 'RECENT_NEGATIVE_FEEDBACK',
      label: 'Recent Negative Feedback',
      explanation:
        'Seller feedback percentage is lower than typical for established marketplace sellers. Review recent feedback before buying.',
    });
  }

  if (savvyVerified) {
    remarks.push({
      code: 'MARKETPLACE_VERIFIED',
      label: 'Savvy Verified',
      explanation: 'Final10 has additional verification signals for this seller.',
    });
  }

  if (
    (count != null && count < 20 && pct != null && pct >= 95) ||
    (pct == null && count == null)
  ) {
    remarks.push({
      code: 'LIMITED_EVIDENCE',
      label: 'Limited Evidence',
      explanation: 'Final10 found limited marketplace history for this seller.',
    });
  }

  const seen = new Set<Final10RemarkCode>();
  return remarks.filter((r) => {
    if (seen.has(r.code)) return false;
    seen.add(r.code);
    return true;
  });
}

function deriveRiskAssessment(params: {
  pct: number | null;
  count: number | null;
  sellerConcerns: string[];
  returnsAccepted: boolean | null;
  hasData: boolean;
  remarks: Final10Remark[];
}): { riskLevel: Final10RiskLevel; riskReasons: string[]; materialConcerns: string[] } {
  const { pct, count, sellerConcerns, returnsAccepted, hasData, remarks } = params;
  const reasons: string[] = [];
  const material: string[] = [];

  if (!hasData || pct == null) {
    return {
      riskLevel: 'unknown',
      riskReasons: ['MARKETPLACE_DATA_UNAVAILABLE'],
      materialConcerns: ['Marketplace reputation data unavailable'],
    };
  }

  if (pct != null) reasons.push(`${pct % 1 === 0 ? pct.toFixed(0) : pct.toFixed(1)}% positive feedback`);
  if (count != null) reasons.push(`${formatFeedbackCount(count)} ratings`);
  if (remarks.some((r) => r.code === 'TOP_RATED_SELLER')) reasons.push('Top Rated Seller');
  if (returnsAccepted === true) reasons.push('Returns accepted');
  if (returnsAccepted === false) reasons.push('No returns');

  if (pct != null && pct < 90) {
    material.push('Lower positive-feedback percentage than typical trusted sellers');
  } else if (pct != null && pct < 95) {
    material.push('Feedback percentage below typical established sellers');
  }

  if (count != null && count < 10) {
    material.push('Limited seller history');
    reasons.push('LOW_FEEDBACK_COUNT');
  } else if (count != null && count < 20) {
    reasons.push('LIMITED_FEEDBACK_COUNT');
  }

  if (returnsAccepted === false) material.push('No returns indicated');

  for (const c of sellerConcerns.slice(0, 2)) {
    if (!material.includes(c)) material.push(c);
  }

  let riskLevel: Final10RiskLevel = 'low_risk';

  if (pct != null && pct < 90) {
    riskLevel = 'high_risk';
  } else if (
    (pct != null && pct < 95) ||
    sellerConcerns.some((c) => /weaker|negative/i.test(c))
  ) {
    riskLevel = 'moderate_risk';
  } else if (count != null && count < 20 && pct != null && pct >= 95) {
    riskLevel = 'limited_evidence';
  } else if (count != null && count >= 100 && pct != null && pct >= 98) {
    riskLevel = 'low_risk';
  }

  return { riskLevel, riskReasons: reasons, materialConcerns: material.slice(0, 4) };
}

function mapSellerConcerns(trust: TrustScoreResult | null | undefined, input: TrustScoreInput): string[] {
  const concerns: string[] = [];
  const reasons = trust?.sellerTrustReasons || trust?.trustReasons || [];

  for (const reason of reasons) {
    if (!reason || isListingConcern(reason) || isPositiveTrustReason(reason)) continue;
    if (isSellerWarningConcern(reason)) concerns.push(reason);
  }

  if (trust?.savvyWarningHeadline && !isListingConcern(trust.savvyWarningHeadline)) {
    concerns.push(trust.savvyWarningHeadline);
  }

  const pct = parseFeedbackPercent(input.sellerFeedbackPercent);
  const count =
    toNum(input.sellerFeedbackCount) ??
    toNum(input.sellerCompletedSalesCount);

  if (count != null && count <= 10 && pct != null && pct >= 95) {
    concerns.unshift(
      'Perfect feedback so far, but the seller has limited transaction history.'
    );
  } else if (count != null && count < 20 && pct != null && pct >= 98) {
    concerns.unshift('Limited feedback volume so far — ratings are positive but still building.');
  }

  if (pct != null && pct < 98 && pct >= 95 && count != null && count >= 20) {
    concerns.push(
      'Seller feedback percentage is lower than typical for established marketplace sellers. Review recent feedback before buying.'
    );
  } else if (pct != null && pct < 95 && pct >= 90) {
    concerns.push('Some negative feedback detected. Review seller feedback before purchasing.');
  } else if (pct != null && pct < 90) {
    concerns.push('Feedback percentage is weaker than typical trusted sellers.');
  }

  const sellerName = String(input.seller || '').trim();
  if (!sellerName || /^(unknown|ebay seller)$/i.test(sellerName)) {
    if (pct == null && count == null) {
      concerns.push('Seller identity is incomplete in marketplace data.');
    }
  }

  return [...new Set(concerns)].slice(0, 4);
}

function mapListingConcerns(trust: TrustScoreResult | null | undefined): string[] {
  const concerns: string[] = [];
  const isSellerRelated = (text: string) => /seller|feedback|reputation|trust profile/i.test(text);

  if (trust?.dealWarningHeadline && !isSellerRelated(trust.dealWarningHeadline)) {
    concerns.push(trust.dealWarningHeadline);
  }
  for (const w of trust?.dealRiskWarnings || []) {
    if (w && !isSellerRelated(w)) concerns.push(w);
  }
  for (const h of trust?.dealHighlights || []) {
    if (/under market|below market|lower than/i.test(h)) {
      concerns.push(`Listing note: ${h}`);
    }
  }
  return [...new Set(concerns)].slice(0, 3);
}

function hasSellerMarketplaceData(input: TrustScoreInput): boolean {
  const pct = parseFeedbackPercent(input.sellerFeedbackPercent);
  const count =
    toNum(input.sellerFeedbackCount) ?? toNum(input.sellerCompletedSalesCount);
  const sellerName = String(input.seller || '').trim();
  const hasNamedSeller = Boolean(sellerName && !/^(unknown|ebay seller)$/i.test(sellerName));
  return pct != null || count != null || hasNamedSeller;
}

/** Build normalized seller evidence from listing + optional trust evaluation. */
export function buildSellerTrustEvidence(
  listingOrInput: Record<string, unknown> | TrustScoreInput,
  trustResult?: TrustScoreResult | null
): SellerTrustEvidence {
  const raw = listingOrInput as Record<string, unknown>;
  const looksLikeListing =
    raw &&
    typeof raw === 'object' &&
    ('itemId' in raw ||
      'listingId' in raw ||
      'itemWebUrl' in raw ||
      'currentBidPrice' in raw ||
      'buyNowPrice' in raw ||
      'marketValue' in raw);
  const input = looksLikeListing
    ? trustScoreInputFromListing(raw)
    : (listingOrInput as TrustScoreInput);

  const pct = parseFeedbackPercent(input.sellerFeedbackPercent);
  const count =
    toNum(input.sellerFeedbackCount) ??
    toNum(input.sellerCompletedSalesCount);
  const accountAgeDays = toNum(input.sellerAccountAgeDays);
  const topRated = isTopRated(input.sellerTopRated);
  const returnsAccepted = parseReturnsAccepted(input.sellerReturnsAccepted);
  const savvyVerified = Boolean(trustResult?.savvyVerifiedSeller || input.savvyVerifiedSeller);
  const username = String(input.seller || '').trim() || null;

  const sellerConcerns = mapSellerConcerns(trustResult, input);
  const listingConcerns = mapListingConcerns(trustResult);
  const hasData = hasSellerMarketplaceData(input);

  const final10Remarks = deriveFinal10Remarks({
    pct,
    count,
    accountAgeDays,
    topRated,
    returnsAccepted,
    savvyVerified,
  });

  const evidenceState = deriveEvidenceState({
    pct,
    count,
    sellerConcerns,
    hasData,
  });

  const { riskLevel, riskReasons, materialConcerns } = deriveRiskAssessment({
    pct,
    count,
    sellerConcerns,
    returnsAccepted,
    hasData,
    remarks: final10Remarks,
  });

  const marketplaceRating: MarketplaceSellerRating = {
    type: 'positiveFeedbackPercent',
    value: pct,
    display: formatMarketplaceRatingDisplay(pct),
  };

  const marketplaceBadges: string[] = [];
  if (topRated) marketplaceBadges.push('Top Rated Seller');
  if (returnsAccepted === true) marketplaceBadges.push('Returns Accepted');
  if (returnsAccepted === false) marketplaceBadges.push('No Returns');

  const evidence: string[] = [];
  if (marketplaceRating.display) evidence.push(marketplaceRating.display);
  if (count != null) evidence.push(`${formatFeedbackCount(count)} ratings`);
  if (topRated) evidence.push('eBay Top Rated Seller');
  if (accountAgeDays != null && accountAgeDays >= 365) {
    const years = Math.floor(accountAgeDays / 365);
    evidence.push(`${years}+ year seller account`);
  }
  if (returnsAccepted === true) evidence.push('Returns accepted');
  if (returnsAccepted === false) evidence.push('No returns');
  if (!marketplaceRating.display && !count && username) {
    evidence.push('eBay seller profile available');
  }

  const final10Note = buildDefaultFinal10Note(evidenceState, final10Remarks);

  return {
    marketplace: 'ebay',
    username,
    positiveFeedbackPercent: pct,
    feedbackCount: count,
    marketplaceRating,
    marketplaceBadges,
    returnsAccepted,
    evidenceState,
    evidence,
    final10Remarks,
    sellerConcerns: sellerConcerns.filter((c) => !isListingConcern(c)),
    listingConcerns,
    materialConcerns,
    final10Note,
    riskLevel,
    riskReasons,
    isTopRated: topRated,
    accountAgeDays,
    internalTrustScore: trustResult?.sellerTrustScore ?? trustResult?.trustScore ?? null,
  };
}

/** Compact one-line summary for tight card layouts. */
export function sellerTrustEvidenceSummary(evidence: SellerTrustEvidence): string {
  const line = formatPositiveLine(
    evidence.positiveFeedbackPercent,
    evidence.feedbackCount
  );
  return line || 'Seller reputation unavailable';
}

export const EVIDENCE_STATE_LABEL: Record<SellerEvidenceState, string> = {
  GOOD: 'Good',
  CHECK_DETAILS: 'Check details',
  LIMITED_HISTORY: 'Limited history',
  CONCERN_DETECTED: 'Concern detected',
  SELLER_DATA_UNAVAILABLE: 'Seller data unavailable',
};

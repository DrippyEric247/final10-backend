/**
 * Evidence-first seller trust — marketplace facts + explainable Final10 notes.
 * Internal trust scores remain in sellerTrustEngine for ranking only.
 */
const { trustScoreInputFromListing, evaluateListingTrust } = require('./trustScoreEngine');

const RISK_LEVEL_LABEL = {
  low_risk: 'Low risk',
  moderate_risk: 'Moderate risk',
  high_risk: 'Higher risk',
  limited_evidence: 'Limited evidence',
  unknown: 'Unknown',
};

function formatFeedbackCount(count) {
  if (count == null || !Number.isFinite(count)) return '—';
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (count >= 10_000) return `${Math.round(count / 1000)}k`;
  if (count >= 1000) return `${(count / 1000).toFixed(1).replace(/\.0$/, '')}k`;
  return count.toLocaleString('en-US');
}

function formatMarketplaceRatingDisplay(pct) {
  if (pct == null) return null;
  const formatted = pct % 1 === 0 ? pct.toFixed(0) : pct.toFixed(1);
  return `${formatted}% Positive Feedback`;
}

const LISTING_CONCERN_PATTERNS = [
  /price lower than typical/i,
  /shipping cost/i,
  /missing photos/i,
  /incomplete metadata/i,
  /suspicious title/i,
  /under market/i,
  /listing/i,
];

function toNum(value) {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function parseFeedbackPercent(raw) {
  if (raw == null || raw === '') return null;
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  const s = String(raw).replace(/%/g, '').trim();
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function isTopRated(value) {
  if (typeof value === 'boolean') return value;
  const s = String(value || '').trim().toLowerCase();
  return s === 'true' || s === 'yes' || s === 'top-rated' || s === 'top_rated';
}

function parseReturnsAccepted(value) {
  if (value == null || value === '') return null;
  if (typeof value === 'boolean') return value;
  const s = String(value).trim().toLowerCase();
  if (['true', 'yes', 'accepted', 'returns accepted'].includes(s)) return true;
  if (['false', 'no', 'not accepted', 'no returns'].includes(s)) return false;
  return null;
}

function isListingConcern(text) {
  return LISTING_CONCERN_PATTERNS.some((re) => re.test(text));
}

function isPositiveTrustReason(text) {
  return /strong positive|above 99|very strong|high feedback|large feedback|established seller|top rated|fast response|business|return policy|repeat-buyer|years old|verified seller|savvy verified/i.test(
    text
  );
}

function isSellerWarningConcern(text) {
  return /negative|weaker|limited|incomplete|missing|low-history|newer|unverified|dispute/i.test(text);
}

function deriveEvidenceState({ pct, count, sellerConcerns, hasData }) {
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

function deriveFinal10Remarks({ pct, count, accountAgeDays, topRated, returnsAccepted, savvyVerified }) {
  const remarks = [];
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
      explanation: 'Perfect feedback so far, but the seller has limited transaction history.',
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
  if (savvyVerified) {
    remarks.push({
      code: 'MARKETPLACE_VERIFIED',
      label: 'Savvy Verified',
      explanation: 'Final10 has additional verification signals for this seller.',
    });
  }

  const seen = new Set();
  return remarks.filter((r) => {
    if (seen.has(r.code)) return false;
    seen.add(r.code);
    return true;
  });
}

function deriveRiskAssessment({ pct, count, sellerConcerns, returnsAccepted, hasData, remarks }) {
  const reasons = [];
  const material = [];

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

  if (pct != null && pct < 90) material.push('Lower positive-feedback percentage than typical trusted sellers');
  if (count != null && count < 10) material.push('Limited seller history');

  let riskLevel = 'low_risk';
  if (pct != null && pct < 90) riskLevel = 'high_risk';
  else if (pct != null && pct < 95) riskLevel = 'moderate_risk';
  else if (count != null && count < 20 && pct != null && pct >= 95) riskLevel = 'limited_evidence';

  for (const c of sellerConcerns.slice(0, 2)) {
    if (!material.includes(c)) material.push(c);
  }

  return { riskLevel, riskReasons: reasons, materialConcerns: material.slice(0, 4) };
}

function buildDefaultFinal10Note(state, remarks) {
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
  const established = remarks.find((r) => r.code === 'ESTABLISHED_SELLER');
  if (established) return established.explanation;
  return 'No major seller concerns detected.';
}

function mapSellerConcerns(trust, input) {
  const concerns = [];
  const reasons = trust?.sellerTrustReasons || trust?.trustReasons || [];

  for (const reason of reasons) {
    if (!reason || isListingConcern(reason) || isPositiveTrustReason(reason)) continue;
    if (isSellerWarningConcern(reason)) concerns.push(reason);
  }

  if (trust?.savvyWarningHeadline && !isListingConcern(trust.savvyWarningHeadline)) {
    concerns.push(trust.savvyWarningHeadline);
  }

  const pct = parseFeedbackPercent(input.sellerFeedbackPercent);
  const count = toNum(input.sellerFeedbackCount) ?? toNum(input.sellerCompletedSalesCount);

  if (count != null && count <= 10 && pct != null && pct >= 95) {
    concerns.unshift('Perfect feedback so far, but the seller has limited transaction history.');
  }

  if (pct != null && pct < 98 && pct >= 95 && count != null && count >= 20) {
    concerns.push(
      'Seller feedback percentage is lower than typical for established marketplace sellers. Review recent feedback before buying.'
    );
  } else if (pct != null && pct < 90) {
    concerns.push('Feedback percentage is weaker than typical trusted sellers.');
  }

  return [...new Set(concerns)].slice(0, 4);
}

function mapListingConcerns(trust) {
  const concerns = [];
  const isSellerRelated = (text) => /seller|feedback|reputation|trust profile/i.test(text);
  if (trust?.dealWarningHeadline && !isSellerRelated(trust.dealWarningHeadline)) {
    concerns.push(trust.dealWarningHeadline);
  }
  for (const w of trust?.dealRiskWarnings || []) {
    if (w && !isSellerRelated(w)) concerns.push(w);
  }
  return [...new Set(concerns)].slice(0, 3);
}

function hasSellerMarketplaceData(input) {
  const pct = parseFeedbackPercent(input.sellerFeedbackPercent);
  const count = toNum(input.sellerFeedbackCount) ?? toNum(input.sellerCompletedSalesCount);
  const sellerName = String(input.seller || '').trim();
  const hasNamedSeller = Boolean(sellerName && !/^(unknown|ebay seller)$/i.test(sellerName));
  return pct != null || count != null || hasNamedSeller;
}

function buildSellerTrustEvidence(listingOrInput, trustResult) {
  const input =
    listingOrInput && listingOrInput.sellerFeedbackPercent != null
      ? listingOrInput
      : trustScoreInputFromListing(listingOrInput || {});
  const trust = trustResult || evaluateListingTrust(listingOrInput || input);

  const pct = parseFeedbackPercent(input.sellerFeedbackPercent);
  const count = toNum(input.sellerFeedbackCount) ?? toNum(input.sellerCompletedSalesCount);
  const accountAgeDays = toNum(input.sellerAccountAgeDays);
  const topRated = isTopRated(input.sellerTopRated);
  const returnsAccepted = parseReturnsAccepted(input.sellerReturnsAccepted);
  const savvyVerified = Boolean(trust?.savvyVerifiedSeller || input.savvyVerifiedSeller);
  const username = String(input.seller || '').trim() || null;

  const sellerConcerns = mapSellerConcerns(trust, input);
  const listingConcerns = mapListingConcerns(trust);
  const hasData = hasSellerMarketplaceData(input);

  const final10Remarks = deriveFinal10Remarks({
    pct,
    count,
    accountAgeDays,
    topRated,
    returnsAccepted,
    savvyVerified,
  });

  const evidenceState = deriveEvidenceState({ pct, count, sellerConcerns, hasData });
  const { riskLevel, riskReasons, materialConcerns } = deriveRiskAssessment({
    pct,
    count,
    sellerConcerns,
    returnsAccepted,
    hasData,
    remarks: final10Remarks,
  });

  const marketplaceRating = {
    type: 'positiveFeedbackPercent',
    value: pct,
    display: formatMarketplaceRatingDisplay(pct),
  };

  const marketplaceBadges = [];
  if (topRated) marketplaceBadges.push('Top Rated Seller');
  if (returnsAccepted === true) marketplaceBadges.push('Returns Accepted');
  if (returnsAccepted === false) marketplaceBadges.push('No Returns');

  const evidence = [];
  if (marketplaceRating.display) evidence.push(marketplaceRating.display);
  if (count != null) evidence.push(`${formatFeedbackCount(count)} ratings`);
  if (topRated) evidence.push('eBay Top Rated Seller');
  if (returnsAccepted === true) evidence.push('Returns accepted');
  if (returnsAccepted === false) evidence.push('No returns');

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
    final10Note: buildDefaultFinal10Note(evidenceState, final10Remarks),
    riskLevel,
    riskReasons,
    isTopRated: topRated,
    accountAgeDays,
    internalTrustScore: trust?.sellerTrustScore ?? trust?.trustScore ?? null,
  };
}

module.exports = {
  buildSellerTrustEvidence,
  deriveEvidenceState,
  formatMarketplaceRatingDisplay,
  RISK_LEVEL_LABEL,
};

/**
 * Evidence-first seller trust presentation — marketplace facts + explainable Final10 notes.
 * Internal trust scores remain in sellerTrustEngine for ranking only.
 */
const { trustScoreInputFromListing, evaluateListingTrust } = require('./trustScoreEngine');

function formatFeedbackCount(count) {
  if (count == null || !Number.isFinite(count)) return '—';
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (count >= 10_000) return `${Math.round(count / 1000)}k`;
  if (count >= 1000) return `${(count / 1000).toFixed(1).replace(/\.0$/, '')}k`;
  return count.toLocaleString('en-US');
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

function formatPositiveLine(pct, count) {
  if (pct == null && count == null) return null;
  const pctStr = pct != null ? `${pct % 1 === 0 ? pct.toFixed(0) : pct.toFixed(1)}% Positive` : null;
  const countStr = count != null ? `${formatFeedbackCount(count)} feedback` : null;
  if (pctStr && countStr) return `${pctStr} • ${countStr}`;
  return pctStr || countStr;
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

function buildDefaultFinal10Note(state, sellerConcerns) {
  if (state === 'SELLER_DATA_UNAVAILABLE') {
    return "We don't have enough seller information to evaluate this seller yet.";
  }
  if (state === 'LIMITED_HISTORY') {
    return sellerConcerns[0] || 'Feedback is positive, but seller history is still limited.';
  }
  if (state === 'CONCERN_DETECTED') {
    return sellerConcerns[0] || 'Review seller feedback before purchasing.';
  }
  if (state === 'CHECK_DETAILS') {
    return sellerConcerns[0] || 'Review seller details before purchasing.';
  }
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
    concerns.unshift(
      'Newer / low-history seller — feedback is positive, but there is limited transaction history.'
    );
  } else if (count != null && count < 20 && pct != null && pct >= 98) {
    concerns.unshift('Limited feedback volume so far — ratings are positive but still building.');
  }

  if (pct != null && pct < 98 && pct >= 95) {
    concerns.push('Some recent negative feedback detected. Review seller feedback before purchasing.');
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

function mapListingConcerns(trust) {
  const concerns = [];
  const isSellerRelated = (text) => /seller|feedback|reputation|trust profile/i.test(text);

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
  const username = String(input.seller || '').trim() || null;

  const sellerConcerns = mapSellerConcerns(trust, input);
  const listingConcerns = mapListingConcerns(trust);
  const hasData = hasSellerMarketplaceData(input);

  const evidenceState = deriveEvidenceState({ pct, count, sellerConcerns, hasData });

  const evidence = [];
  const positiveLine = formatPositiveLine(pct, count);
  if (positiveLine) evidence.push(positiveLine);
  if (topRated) evidence.push('eBay Top Rated Seller');
  if (accountAgeDays != null && accountAgeDays >= 365) {
    const years = Math.floor(accountAgeDays / 365);
    evidence.push(`${years}+ year seller account`);
  }
  if (!positiveLine && username) evidence.push('eBay seller profile available');

  return {
    marketplace: 'ebay',
    username,
    positiveFeedbackPercent: pct,
    feedbackCount: count,
    evidenceState,
    evidence,
    sellerConcerns: sellerConcerns.filter((c) => !isListingConcern(c)),
    listingConcerns,
    final10Note: buildDefaultFinal10Note(
      evidenceState,
      sellerConcerns.filter((c) => !isListingConcern(c))
    ),
    isTopRated: topRated,
    accountAgeDays,
    internalTrustScore: trust?.sellerTrustScore ?? trust?.trustScore ?? null,
  };
}

module.exports = {
  buildSellerTrustEvidence,
  deriveEvidenceState,
  formatPositiveLine,
};

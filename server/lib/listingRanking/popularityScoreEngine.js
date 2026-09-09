/**
 * Popularity / relevance layer for Best Move ranking.
 *
 * Ranking priority (configured weights, not user-facing scores):
 *   popularity → deal quality floor → trust/evidence (handled upstream)
 *
 * Signal types:
 *   OBSERVED  — bidCount marketplace activity proxy (only signal we treat as measured)
 *   INFERRED  — profile brand/family/keyword match from configurable interest profiles
 */

const {
  LOW_INTEREST_PATTERNS,
  getCategoryInterestProfile,
  normalizeInterestCategory,
} = require('./categoryInterestProfiles');

/** Tunable during beta — does not replace deal/trust scoring. */
const POPULARITY_RANK_WEIGHTS = Object.freeze({
  /** Weight inside popularity sub-score (0–100). */
  profileMatch: 0.52,
  /** OBSERVED bid activity proxy. */
  marketplaceActivity: 0.28,
  /** INFERRED hero/keyword alignment. */
  keywordRelevance: 0.2,
  /** Added to composite rank / instant score (popularityScore * weight). */
  compositeBoost: 0.16,
  /** Added to onboarding finalist composite. */
  finalistBoost: 0.11,
  /** Max popularity boost when deal quality is weak (dealScore < floor). */
  maxBoostWhenWeakDeal: 7,
  /** Deal score floor — below this, popularity boost is capped. */
  weakDealScoreFloor: 45,
  /** Savings % that unlocks full popularity boost even if deal score is moderate. */
  strongSavingsPct: 14,
  /** Diversity penalty per duplicate brand/family in top-N selection. */
  diversityPenaltyPerDuplicate: 11,
  /** How many top slots diversity applies to. */
  diversityWindow: 10,
});

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function normalizeTitle(title) {
  return String(title || '').trim().toLowerCase();
}

function titleMatchesTerm(title, term) {
  const t = normalizeTitle(title);
  const needle = String(term || '').trim().toLowerCase();
  if (!needle) return false;
  if (needle.includes(' ')) return t.includes(needle);
  const re = new RegExp(`\\b${needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
  return re.test(t);
}

function isLowInterestTitle(title) {
  const t = String(title || '');
  return LOW_INTEREST_PATTERNS.some((pat) => pat.test(t));
}

function scoreProfileMatch(title, profile) {
  if (!profile) return { score: 35, matchedBrand: null, matchedFamily: null, matchedKeyword: null };
  if (isLowInterestTitle(title)) {
    return { score: 8, matchedBrand: null, matchedFamily: null, matchedKeyword: null, lowInterest: true };
  }

  let matchedBrand = null;
  for (const brand of profile.brands || []) {
    if (titleMatchesTerm(title, brand)) {
      matchedBrand = brand;
      break;
    }
  }

  let matchedFamily = null;
  for (const family of profile.productFamilies || []) {
    if (titleMatchesTerm(title, family)) {
      matchedFamily = family;
      break;
    }
  }

  let matchedKeyword = null;
  for (const keyword of profile.keywords || []) {
    if (titleMatchesTerm(title, keyword)) {
      matchedKeyword = keyword;
      break;
    }
  }

  let score = 28;
  if (matchedBrand) score += 38;
  if (matchedFamily) score += 24;
  if (matchedKeyword) score += 14;
  if (matchedBrand && matchedFamily) score += 6;

  return {
    score: clamp(score, 0, 100),
    matchedBrand,
    matchedFamily,
    matchedKeyword,
    lowInterest: false,
  };
}

/** OBSERVED — bidCount is the only marketplace demand signal available today. */
function scoreMarketplaceActivity(listing) {
  const bidCount = Math.max(0, Number(listing?.bidCount) || 0);
  const activity = clamp(bidCount * 8 + Math.min(bidCount, 10) * 3, 0, 100);
  return { score: activity, bidCount, source: 'observed' };
}

function scoreKeywordRelevance(title, profile) {
  if (!profile?.keywords?.length) return { score: 40, source: 'inferred' };
  const hit = profile.keywords.some((kw) => titleMatchesTerm(title, kw));
  return { score: hit ? 88 : 32, source: 'inferred' };
}

/**
 * Compute popularity relevance 0–100 with transparent signal breakdown.
 */
function computePopularityScore(listing, category) {
  const normalizedCategory = normalizeInterestCategory(category);
  const profile = getCategoryInterestProfile(normalizedCategory);
  const title = normalizeTitle(listing?.title);

  const profileMatch = scoreProfileMatch(title, profile);
  const marketplaceActivity = scoreMarketplaceActivity(listing);
  const keywordRelevance = scoreKeywordRelevance(title, profile);

  const w = POPULARITY_RANK_WEIGHTS;
  const score = clamp(
    profileMatch.score * w.profileMatch +
      marketplaceActivity.score * w.marketplaceActivity +
      keywordRelevance.score * w.keywordRelevance,
    0,
    100
  );

  return {
    score: Math.round(score * 10) / 10,
    category: normalizedCategory,
    signals: {
      profileMatch: {
        value: profileMatch.score,
        source: 'inferred',
        matchedBrand: profileMatch.matchedBrand,
        matchedFamily: profileMatch.matchedFamily,
        matchedKeyword: profileMatch.matchedKeyword,
        lowInterest: Boolean(profileMatch.lowInterest),
      },
      marketplaceActivity: {
        value: marketplaceActivity.score,
        source: marketplaceActivity.source,
        bidCount: marketplaceActivity.bidCount,
      },
      keywordRelevance: {
        value: keywordRelevance.score,
        source: keywordRelevance.source,
      },
    },
  };
}

/**
 * Popularity boost for composite ranking — capped when deal quality is poor.
 */
function computePopularityBoost(popularityScore, { dealScore = 0, savingsPct = 0 } = {}) {
  const w = POPULARITY_RANK_WEIGHTS;
  const base = (Number(popularityScore) || 0) * w.compositeBoost;
  const deal = Number(dealScore) || 0;
  const savings = Number(savingsPct) || 0;

  if (deal >= 65 || savings >= w.strongSavingsPct) {
    return Math.round(base * 10) / 10;
  }
  if (deal < w.weakDealScoreFloor && savings < 8) {
    return Math.round(Math.min(base, w.maxBoostWhenWeakDeal) * 10) / 10;
  }
  return Math.round(base * 0.65 * 10) / 10;
}

function extractDiversityKey(listing, category) {
  const title = normalizeTitle(listing?.title);
  const profile = getCategoryInterestProfile(normalizeInterestCategory(category));
  if (!profile) return title.slice(0, 40) || 'unknown';

  for (const brand of profile.brands || []) {
    if (titleMatchesTerm(title, brand)) return `brand:${brand}`;
  }
  for (const family of profile.productFamilies || []) {
    if (titleMatchesTerm(title, family)) return `family:${family}`;
  }
  const words = title.split(/\s+/).filter(Boolean).slice(0, 3);
  return words.join('-') || 'generic';
}

/**
 * Re-rank scored rows with diversity penalty so one product family cannot dominate top-N.
 */
function applyDiversityRanking(rows, { scoreKey = 'rankScore', categoryKey = 'category', limit = 10 } = {}) {
  const list = Array.isArray(rows) ? [...rows] : [];
  if (list.length <= 1) return list;

  const windowSize = POPULARITY_RANK_WEIGHTS.diversityWindow;
  const penalty = POPULARITY_RANK_WEIGHTS.diversityPenaltyPerDuplicate;
  const selected = [];
  const pool = list.sort((a, b) => (Number(b[scoreKey]) || 0) - (Number(a[scoreKey]) || 0));
  const familyCounts = new Map();

  while (pool.length && selected.length < Math.min(limit, windowSize)) {
    let bestIdx = 0;
    let bestAdjusted = -Infinity;

    for (let i = 0; i < pool.length; i += 1) {
      const row = pool[i];
      const listing = row.listing || row.item || row;
      const category = row[categoryKey] || row.interest || row.category || '';
      const base = Number(row[scoreKey]) || 0;
      const key = extractDiversityKey(listing, category);
      const dupes = familyCounts.get(key) || 0;
      const adjusted = base - dupes * penalty;
      if (adjusted > bestAdjusted) {
        bestAdjusted = adjusted;
        bestIdx = i;
      }
    }

    const [pick] = pool.splice(bestIdx, 1);
    const listing = pick.listing || pick.item || pick;
    const category = pick[categoryKey] || pick.interest || pick.category || '';
    const key = extractDiversityKey(listing, category);
    familyCounts.set(key, (familyCounts.get(key) || 0) + 1);
    selected.push(pick);
  }

  const remainder = pool.sort(
    (a, b) => (Number(b[scoreKey]) || 0) - (Number(a[scoreKey]) || 0)
  );
  return [...selected, ...remainder];
}

module.exports = {
  POPULARITY_RANK_WEIGHTS,
  computePopularityScore,
  computePopularityBoost,
  extractDiversityKey,
  applyDiversityRanking,
  isLowInterestTitle,
};

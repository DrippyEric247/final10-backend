/**
 * Quick Snipes Best Move resolver — ranks listings and falls back to Auctions,
 * Trending, or curated lanes so the tab never feels empty.
 */

import ebayService from '../services/ebayService';
import { evaluateBestMove } from './bestMoveEngine';
import { evaluateTrustScore, trustScoreInputFromListing } from './trustScoreEngine';
import { scoreListing } from './listingSectionsEngine';
import { getTopCategories } from './userBehavior';

const LOG_PREFIX = '[QuickSnipesBestMove]';

export const FALLBACK_SOURCES = Object.freeze({
  QUICK_SNIPES: 'quick_snipes',
  QUICK_SNIPES_RELAXED: 'quick_snipes_relaxed',
  AUCTIONS: 'auctions',
  TRENDING: 'trending',
  CURATED: 'curated_category',
});

const CURATED_FALLBACK_QUERIES = Object.freeze([
  { query: 'playstation 5 console', category: 'gaming', label: 'Gaming' },
  { query: 'rtx 4090 graphics card', category: 'gaming', label: 'PC Gaming' },
  { query: 'air jordan 1 retro', category: 'sneakers', label: 'Sneakers' },
  { query: 'bmw m performance parts', category: 'auto', label: 'Automotive' },
  { query: 'gaming desk setup', category: 'home', label: 'Home Tech' },
  { query: 'iphone unlocked', category: 'electronics', label: 'Electronics' },
]);

function qsLog(event, payload = {}) {
  // eslint-disable-next-line no-console
  console.info(LOG_PREFIX, event, payload);
}

function feedbackCount(item) {
  const s = item.seller;
  if (s && typeof s === 'object') {
    const n = Number(s.feedbackScore ?? s.feedbackCount);
    if (Number.isFinite(n)) return n;
  }
  const flat = Number(item.sellerFeedbackCount ?? item.sellerFeedbackScore);
  return Number.isFinite(flat) ? flat : 0;
}

function shippingConfidence(item) {
  const cost = Number(item.shippingCost);
  if (Number.isFinite(cost) && cost === 0) return 92;
  if (Number.isFinite(cost) && cost > 0 && cost < 12) return 78;
  if (item.freeShipping || item.shippingFree) return 88;
  return 55;
}

export function getConfidenceLabel(confidenceScore) {
  const s = Number(confidenceScore) || 0;
  if (s >= 90) return { key: 'legendary', label: 'Legendary Find', pct: s };
  if (s >= 75) return { key: 'high', label: 'High Confidence', pct: s };
  if (s >= 60) return { key: 'watching', label: 'Worth Watching', pct: s };
  return { key: 'standard', label: 'Standard Deal', pct: s };
}

/** Enrich raw eBay listing with trust + Best Move decision (same shape as LocalDeals). */
export function enrichQuickSnipeItem(item) {
  const baseTrustInput = trustScoreInputFromListing(item);
  const trust = evaluateTrustScore({
    ...baseTrustInput,
    imageUrl: item.imageUrl || baseTrustInput.imageUrl,
    seller: item.seller || baseTrustInput.seller,
    savvyVerifiedSeller: item.savvyVerifiedSeller ?? baseTrustInput.savvyVerifiedSeller,
  });

  const decision = evaluateBestMove({
    currentBid: item.currentBidPrice,
    buyNowPrice: item.buyNowPrice,
    marketValue: item.marketValue,
    marketConfidence: item.marketConfidence,
    trustScore: trust.trustScore,
    bidCount: item.bidCount,
    secondsRemaining: item.secondsRemaining,
    condition: item.condition,
    shippingCost: item.shippingCost,
    isAuction: item.isAuction,
    isBuyNow: item.isBuyNow,
  });

  return {
    ...item,
    source: item.source || 'ebay',
    marketValue: item.marketValue ?? item.buyNowPrice ?? item.currentBidPrice ?? item.price ?? null,
    shippingCost: item.shippingCost ?? 0,
    dealScore: decision.dealScore,
    recommendationType: decision.recommendationType,
    recommendationReason: decision.recommendationReason,
    confidenceScore: decision.confidenceScore,
    bestMoveDecision: decision,
    trustScore: trust.trustScore,
    trustLevel: trust.trustLevel,
    aiConfidence: trust.aiConfidence,
    savvyWarningHeadline: trust.savvyWarningHeadline,
    savvyVerifiedSeller: trust.savvyVerifiedSeller,
    safeToRecommend: trust.safeToRecommend,
  };
}

function extractRankSignals(item, liveTick = 0) {
  return {
    trustScore: Number(item.trustScore) || 0,
    trustLevel: item.trustLevel,
    price: item.buyNowPrice ?? item.currentBidPrice ?? item.price,
    marketValue: item.marketValue,
    secondsRemaining: Math.max(0, Number(item.secondsRemaining || 0) - liveTick),
  };
}

function inferInterest(row) {
  const cat = String(row.categoryId || row.category || '').toLowerCase();
  const title = String(row.title || '').toLowerCase();
  if (cat) return cat;
  if (/bmw|b58|exhaust|wheel|rim|automotive|car part|m760/.test(title)) return 'auto';
  if (/ps5|xbox|switch|rtx|gaming|pc|desk/.test(title)) return 'gaming';
  if (/iphone|airpods|ipad|apple watch|macbook/.test(title)) return 'electronics';
  if (/pokemon|sports card|hot wheels|mtg/.test(title)) return 'collectibles';
  if (/jordan|yeezy|nike|sneaker/.test(title)) return 'sneakers';
  return 'all';
}

export function isExtraordinaryDeal(scored) {
  const item = scored.item;
  const trust = Number(item.trustScore) || 0;
  const savings = Number(scored.savings) || 0;
  const savingsPct = Number(scored.savingsPct) || 0;
  const risky =
    scored.risky ||
    !item.safeToRecommend ||
    item.trustLevel === 'unverified' ||
    (trust < 32 && feedbackCount(item) < 5);
  return (
    !risky &&
    trust >= 70 &&
    (savings >= 80 || savingsPct >= 18) &&
    (Number(item.bidCount || 0) >= 2 || Number(item.confidenceScore || item.aiConfidence) >= 70)
  );
}

/**
 * Rank Quick Snipes listings for display and Best Move selection.
 */
export function rankQuickSnipeListings(items, liveTick = 0) {
  const userInterests = getTopCategories(3).map((x) => String(x.category || '').toLowerCase());

  const scored = (Array.isArray(items) ? items : []).map((item) => {
    const s = scoreListing(item, (row) => extractRankSignals(row, liveTick));
    const price = Number(item.buyNowPrice ?? item.currentBidPrice ?? item.price ?? 0);
    const market = Number(item.marketValue ?? 0);
    const savings = Math.max(0, market - price);
    const savingsPct = market > 0 ? (savings / market) * 100 : 0;
    const trust = Number(item.trustScore) || 0;
    const sellerRep = Math.min(100, feedbackCount(item) / 8);
    const shipConf = shippingConfidence(item);
    const urgency = s.timeUrgency || 0;
    const watchers = Math.max(0, Number(item.bidCount || 0) * 8);
    const activity = watchers + (Number(item.confidenceScore || item.aiConfidence) || 0) * 0.6;
    const interest = inferInterest(item);
    const personalizedBoost = userInterests.includes(interest) ? 28 : 0;

    const compositeRank =
      Math.min(300, savings) * 0.85 +
      Math.min(60, savingsPct) * 2.2 +
      trust * 1.35 +
      sellerRep * 0.9 +
      shipConf * 0.35 +
      urgency * 0.55 +
      activity * 0.75 +
      personalizedBoost;

    const wowScore =
      Math.min(300, savings) * 0.9 +
      Math.min(60, savingsPct) * 2.4 +
      trust * 1.4 +
      activity +
      personalizedBoost;

    const risky =
      !item.safeToRecommend ||
      item.trustLevel === 'unverified' ||
      (trust < 32 && feedbackCount(item) < 5);

    const confidenceScore = Math.round(
      Math.min(
        98,
        trust * 0.42 +
          Math.min(40, savingsPct) * 0.9 +
          sellerRep * 0.2 +
          shipConf * 0.12 +
          (item.savvyVerifiedSeller ? 8 : 0)
      )
    );

    return {
      item,
      ...s,
      risky,
      wowScore,
      compositeRank,
      savings,
      savingsPct,
      extraordinary: false,
      personalizedBoost,
      interest,
      confidenceScore,
      sellerRep,
      shipConf,
      activity,
    };
  });

  scored.forEach((row) => {
    row.extraordinary = isExtraordinaryDeal(row);
  });

  scored.sort((a, b) => {
    if (a.risky !== b.risky) return a.risky ? 1 : -1;
    return b.compositeRank - a.compositeRank || b.bestMoveScore - a.bestMoveScore;
  });

  return scored;
}

export function buildSavvyPickReason(scored, { isFallback = false } = {}) {
  const item = scored.item;
  const trust = Math.round(Number(item.trustScore || 0));
  const savingsPct = Math.round(Number(scored.savingsPct || 0));
  const bids = Math.max(1, Number(item.bidCount || 0));
  const shipNote =
    scored.shipConf >= 85
      ? 'shipping looks solid'
      : scored.shipConf >= 70
        ? 'reasonable shipping'
        : 'verify shipping before you move';

  if (isFallback) {
    return `Savvy Scout didn't find a legendary snipe yet, but this is the strongest deal available based on ${savingsPct > 0 ? `${savingsPct}% savings, ` : ''}${trust}% trust, and ${bids} watcher${bids === 1 ? '' : 's'} on similar listings. ${shipNote.charAt(0).toUpperCase() + shipNote.slice(1)}.`;
  }

  return `Savvy Scout picked this for ${trust}% trust, ${savingsPct > 0 ? `${savingsPct}% below market, ` : ''}seller reputation, and rising activity (${bids} watching).`;
}

function pickToBestMove(scored, source, { isFallback = false } = {}) {
  if (!scored?.item) return null;
  const confidence = getConfidenceLabel(
    scored.confidenceScore ?? scored.item.confidenceScore ?? scored.item.aiConfidence
  );
  return {
    item: scored.item,
    savings: scored.savings,
    savingsPct: scored.savingsPct,
    trustScore: Number(scored.item.trustScore) || 0,
    confidence,
    pickReason: buildSavvyPickReason(scored, { isFallback }),
    source,
    isFallback,
    extraordinary: Boolean(scored.extraordinary),
    compositeRank: scored.compositeRank,
  };
}

function itemsFromEbayPayload(data) {
  const raw = data?.normalizedItems || data?.items || [];
  return raw.map(enrichQuickSnipeItem);
}

function inferTrendingCategory(query) {
  const q = String(query || '').toLowerCase();
  if (/ps5|xbox|gaming|rtx|nintendo|desk/.test(q)) return 'gaming';
  if (/bmw|m760|carbon|automotive|wheel|exhaust/.test(q)) return 'auto';
  if (/desk|chair|home|kitchen|smart home/.test(q)) return 'home';
  if (/jordan|sneaker|nike|yeezy/.test(q)) return 'sneakers';
  if (/iphone|macbook|tech|electronics|airpods/.test(q)) return 'electronics';
  if (/rolex|watch|omega|luxury/.test(q)) return 'luxury';
  if (/pokemon|card|collectible/.test(q)) return 'collectibles';
  if (/fashion|jacket|designer/.test(q)) return 'fashion';
  return 'all';
}

function pickCuratedQuery(query) {
  const q = String(query || '').toLowerCase();
  const match = CURATED_FALLBACK_QUERIES.find((c) => q.includes(c.query.split(' ')[0]) || c.query.includes(q.split(' ')[0]));
  if (match) return match;
  if (/ps5|playstation/.test(q)) return CURATED_FALLBACK_QUERIES[0];
  if (/m760|bmw|carbon/.test(q)) return CURATED_FALLBACK_QUERIES[3];
  if (/desk|gaming desk/.test(q)) return CURATED_FALLBACK_QUERIES[4];
  return CURATED_FALLBACK_QUERIES[Math.floor(Math.random() * CURATED_FALLBACK_QUERIES.length)];
}

const BETA_FETCH_LIMIT = 20;

async function fetchAuctionsLane(query, limit = BETA_FETCH_LIMIT) {
  const data = await ebayService.searchItems({
    q: query,
    listingMode: 'mixed',
    limit: Math.min(limit, BETA_FETCH_LIMIT),
  });
  return itemsFromEbayPayload(data);
}

async function fetchTrendingLane(query, limit = BETA_FETCH_LIMIT) {
  const category = inferTrendingCategory(query);
  const data = await ebayService.getTrendingItems(category, Math.min(limit, BETA_FETCH_LIMIT));
  return itemsFromEbayPayload(data);
}

async function fetchCuratedLane(query, limit = BETA_FETCH_LIMIT) {
  const curated = pickCuratedQuery(query);
  const data = await ebayService.searchItems({
    q: curated.query,
    listingMode: 'mixed',
    limit: Math.min(limit, BETA_FETCH_LIMIT),
  });
  const items = itemsFromEbayPayload(data);
  return { items, curated };
}

/**
 * Resolve the best move for Quick Snipes with multi-lane fallback.
 */
export async function resolveQuickSnipesBestMove({
  query = '',
  primaryItems = [],
  liveTick = 0,
} = {}) {
  const q = String(query || '').trim();
  qsLog('query_start', { query: q, primaryRawCount: primaryItems.length });

  const tryPick = (items, source, isFallback) => {
    const ranked = rankQuickSnipeListings(items, liveTick);
    qsLog('filter_stats', {
      query: q,
      source,
      rawCount: items.length,
      afterRank: ranked.length,
      extraordinaryCount: ranked.filter((r) => r.extraordinary).length,
    });
    if (!ranked.length) return null;
    const extraordinary = ranked.find((r) => r.extraordinary);
    if (extraordinary && !isFallback) {
      return pickToBestMove(extraordinary, source, { isFallback: false });
    }
    return pickToBestMove(ranked[0], source, { isFallback: true });
  };

  if (primaryItems.length > 0) {
    const extraordinary = rankQuickSnipeListings(primaryItems, liveTick).filter((r) => r.extraordinary);
    if (extraordinary.length > 0) {
      const pick = pickToBestMove(extraordinary[0], FALLBACK_SOURCES.QUICK_SNIPES, { isFallback: false });
      qsLog('final_pick', { query: q, source: pick.source, isFallback: false, title: pick.item?.title });
      return pick;
    }
    const relaxed = tryPick(primaryItems, FALLBACK_SOURCES.QUICK_SNIPES_RELAXED, true);
    if (relaxed) {
      qsLog('final_pick', { query: q, source: relaxed.source, isFallback: true, title: relaxed.item?.title });
      return relaxed;
    }
  }

  if (q) {
    try {
      const auctionItems = await fetchAuctionsLane(q);
      const pick = tryPick(auctionItems, FALLBACK_SOURCES.AUCTIONS, true);
      if (pick) {
        qsLog('final_pick', { query: q, source: pick.source, fallbackSource: 'auctions', title: pick.item?.title });
        return pick;
      }
    } catch (err) {
      qsLog('auctions_fallback_error', { query: q, error: err?.message || String(err) });
    }

    try {
      const trendingItems = await fetchTrendingLane(q);
      const pick = tryPick(trendingItems, FALLBACK_SOURCES.TRENDING, true);
      if (pick) {
        qsLog('final_pick', { query: q, source: pick.source, fallbackSource: 'trending', title: pick.item?.title });
        return pick;
      }
    } catch (err) {
      qsLog('trending_fallback_error', { query: q, error: err?.message || String(err) });
    }

    try {
      const { items: curatedItems, curated } = await fetchCuratedLane(q);
      const pick = tryPick(curatedItems, FALLBACK_SOURCES.CURATED, true);
      if (pick) {
        qsLog('final_pick', {
          query: q,
          source: pick.source,
          fallbackSource: 'curated',
          curatedQuery: curated.query,
          title: pick.item?.title,
        });
        pick.pickReason = `${pick.pickReason} Pulled from curated ${curated.label} lane while Savvy keeps scanning for legendary finds.`;
        return pick;
      }
    } catch (err) {
      qsLog('curated_fallback_error', { query: q, error: err?.message || String(err) });
    }
  }

  qsLog('final_pick', { query: q, source: null, exhausted: true });
  return null;
}

/** Intent-filter empty → top ranked from full pool (mirrors Auctions tab). */
export function applyIntentPoolFallback(allItems, intentFiltered, liveTick = 0) {
  if (intentFiltered.length > 0) return { items: intentFiltered, usedPoolFallback: false };
  if (!allItems.length) return { items: [], usedPoolFallback: false };
  const ranked = rankQuickSnipeListings(allItems, liveTick);
  qsLog('intent_pool_fallback', {
    rawCount: allItems.length,
    intentFilteredCount: 0,
    poolFallbackCount: Math.min(10, ranked.length),
  });
  return {
    items: ranked.slice(0, 10).map((r) => r.item),
    usedPoolFallback: true,
  };
}

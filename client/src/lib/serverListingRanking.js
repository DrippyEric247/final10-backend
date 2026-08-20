/**
 * Server-authoritative listing ranking (Wave 4).
 * Authenticated production flows should prefer this over client-side scorers.
 */

import { useEffect, useMemo, useState } from 'react';
import { api, STORAGE_KEY } from './api';

export function hasAuthTokenForRanking() {
  try {
    return Boolean(localStorage.getItem(STORAGE_KEY));
  } catch {
    return false;
  }
}

/**
 * @param {object[]} listings Raw listing payloads
 * @returns {Promise<{ ok: boolean, results: object[], effectivePlan?: string, tierBoostApplied?: number }|null>}
 */
export async function rankListingsOnServer(listings) {
  if (!Array.isArray(listings) || !listings.length) {
    return { ok: true, results: [] };
  }
  if (!hasAuthTokenForRanking()) return null;

  try {
    const { data } = await api.post('/listings/rank', {
      listings: listings.slice(0, 100),
    });
    return data;
  } catch {
    return null;
  }
}

/** Merge server rank row onto a listing for presentation. */
export function applyServerRankToListing(item, rankRow) {
  if (!rankRow || !item) return item;
  const signals = rankRow.signals || {};
  const trustLevel =
    signals.trustLevel ??
    (signals.trustScore >= 75 ? 'high' : signals.trustScore >= 50 ? 'medium' : 'low');
  return {
    ...item,
    trustScore: signals.trustScore ?? item.trustScore,
    trustLevel,
    dealScore: signals.dealScore ?? item.dealScore,
    recommendationType: signals.recommendationType ?? item.recommendationType,
    confidenceScore: signals.dealScore ?? item.confidenceScore,
    safeToRecommend: signals.safeToRecommend ?? item.safeToRecommend,
    sellerEvidence: rankRow.sellerEvidence ?? item.sellerEvidence ?? null,
    rankScore: rankRow.rankScore,
    rankPosition: rankRow.rankPosition,
    rankLabels: Array.isArray(rankRow.labels) ? rankRow.labels : [],
    rankSignals: signals,
    serverRanked: true,
    risky: Boolean(rankRow.risky),
  };
}

/** Build map listingId -> rank row */
export function indexServerRankResults(results) {
  const map = new Map();
  if (!Array.isArray(results)) return map;
  for (const row of results) {
    const id = String(row?.listingId || '');
    if (id) map.set(id, row);
  }
  return map;
}

export function listingKey(item) {
  return String(item?.listingId || item?.itemId || item?.id || '');
}

/** Merge server ranks into listing array (returns new array). */
export function mergeServerRanksIntoListings(listings, rankById) {
  if (!rankById || !rankById.size) return listings;
  return listings.map((item) => {
    const row = rankById.get(listingKey(item));
    return row ? applyServerRankToListing(item, row) : item;
  });
}

/**
 * React hook — fetches server ranks for authenticated users.
 * @param {object[]} listings
 * @returns {{ rankById: Map|null, serverRanked: boolean }}
 */
export function useServerListingRanks(listings) {
  const [rankById, setRankById] = useState(null);
  const listingFingerprint = useMemo(() => {
    if (!Array.isArray(listings) || !listings.length) return '';
    return listings
      .slice(0, 100)
      .map((item) => listingKey(item))
      .join('|');
  }, [listings]);

  useEffect(() => {
    let cancelled = false;
    if (!listingFingerprint || !hasAuthTokenForRanking()) {
      setRankById(null);
      return undefined;
    }
    void (async () => {
      const payload = await rankListingsOnServer(listings);
      if (cancelled) return;
      if (payload?.results) {
        setRankById(indexServerRankResults(payload.results));
      } else {
        setRankById(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [listingFingerprint, listings]);

  return {
    rankById,
    serverRanked: Boolean(rankById?.size),
  };
}

/** Build Best Move card decision purely from server rank signals (no client re-score). */
export function bestMoveDecisionFromServerItem(item) {
  const rec = String(item?.recommendationType || 'pass');
  const dealScore = Number(item?.dealScore) || 0;
  const bestMove =
    rec === 'buy_now_better'
      ? 'buy_now'
      : rec === 'auction_better'
        ? 'bid'
        : rec === 'wait_and_watch'
          ? 'watch'
          : 'pass';
  const forceBestMove = dealScore >= 75 && (bestMove === 'buy_now' || bestMove === 'bid');
  let cardVariant = 'pass';
  if (bestMove === 'watch') cardVariant = 'watch';
  else if (bestMove === 'buy_now') cardVariant = forceBestMove ? 'best_move' : 'buy_now';
  else if (bestMove === 'bid') cardVariant = forceBestMove ? 'best_move' : 'auction_opportunity';

  return {
    bestMove,
    confidence: dealScore >= 75 ? 'high' : dealScore >= 50 ? 'medium' : 'low',
    reason: Array.isArray(item?.rankLabels) ? item.rankLabels.join(', ') : rec,
    estimatedSavings: 0,
    cardVariant,
    dealScore,
    recommendationType: rec,
    recommendationReason: rec,
    confidenceScore: dealScore / 100,
  };
}

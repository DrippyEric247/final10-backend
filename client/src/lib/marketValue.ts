/**
 * Final10 — client-side helpers for the True Market Value engine.
 *
 * These functions:
 *   - normalize the market stats payload returned by /api/market-value
 *     and the enriched item payload returned by /api/ebay/search,
 *   - compute display-friendly savings / confidence labels,
 *   - re-derive the 5 deal badges client-side so we can light them up
 *     even on cards that haven't been server-enriched yet (e.g. seeded
 *     fixtures, optimistic updates, demo data).
 *
 * The engine itself lives on the server (`server/services/marketValueService.js`).
 * This module is intentionally pure and dependency-free so it can also be
 * imported by the bestMoveEngine, dual-earn chip, and Savvy AI helpers.
 */

export type MarketSource = 'sold' | 'active';
export type MarketConfidence = 'high' | 'medium' | 'low';

export type MarketStats = {
  source: MarketSource;
  label: string;
  average: number | null;
  median: number | null;
  min: number | null;
  max: number | null;
  count: number;
  confidence: MarketConfidence;
  coefficientOfVariation: number | null;
  sampledAt: number;
};

export type DealBadgeId =
  | 'under_market'
  | 'rare_price'
  | 'elite_snipe'
  | 'trending_up'
  | 'smart_buy';

export type DealBadge = {
  id: DealBadgeId;
  emoji: string;
  label: string;
};

export type ListingForMarket = {
  marketValue?: number | string | null;
  marketStats?: MarketStats | null;
  marketConfidence?: MarketConfidence | string | null;
  marketLabel?: string | null;
  savings?: number | string | null;
  savingsPct?: number | string | null;
  buyNowPrice?: number | string | null;
  currentBidPrice?: number | string | null;
  price?: number | string | null;
  isAuction?: boolean;
  bidCount?: number | string | null;
  secondsRemaining?: number | string | null;
  dealBadges?: DealBadge[] | null;
};

export const TRUE_MARKET_VALUE_LABEL = 'True Market Value';
export const TRUE_MARKET_VALUE_TOOLTIP =
  'Savvy compares live listings against real sold-market data.';

export const BADGE_LIBRARY: Record<DealBadgeId, DealBadge> = {
  under_market: { id: 'under_market', emoji: '🔥', label: 'Under Market' },
  rare_price: { id: 'rare_price', emoji: '⚡', label: 'Rare Price' },
  elite_snipe: { id: 'elite_snipe', emoji: '💎', label: 'Elite Snipe' },
  trending_up: { id: 'trending_up', emoji: '📈', label: 'Trending Up' },
  smart_buy: { id: 'smart_buy', emoji: '🧠', label: 'Smart Buy' },
};

function toNum(value: number | string | null | undefined): number | null {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function pickListingPrice(item: ListingForMarket): number | null {
  return toNum(item.buyNowPrice) ?? toNum(item.currentBidPrice) ?? toNum(item.price);
}

export function getMarketValue(item: ListingForMarket): number | null {
  return toNum(item.marketValue) ?? toNum(item.marketStats?.median);
}

export function getMarketConfidence(item: ListingForMarket): MarketConfidence | null {
  const fromStats = item.marketStats?.confidence;
  const explicit = (item.marketConfidence || '').toString().toLowerCase();
  const value = (fromStats || explicit) as MarketConfidence | '';
  if (value === 'high' || value === 'medium' || value === 'low') return value;
  return null;
}

export function getMarketLabel(item: ListingForMarket): string {
  return (
    item.marketStats?.label ||
    item.marketLabel ||
    'Based on recent sold listings'
  );
}

export function getMarketSource(item: ListingForMarket): MarketSource | null {
  return item.marketStats?.source || null;
}

export function getSampleSize(item: ListingForMarket): number {
  return Number(item.marketStats?.count) || 0;
}

/**
 * Returns the absolute and percentage savings versus True Market Value.
 * Falls back to deriving from raw fields when the server didn't enrich.
 * Returns null savings (not zero) when we can't compute confidently.
 */
export function getSavings(item: ListingForMarket): {
  amount: number | null;
  pct: number | null;
} {
  const explicit = toNum(item.savings);
  const explicitPct = toNum(item.savingsPct);
  if (explicit != null) {
    return { amount: explicit, pct: explicitPct };
  }
  const market = getMarketValue(item);
  const live = pickListingPrice(item);
  if (market == null || live == null || market <= 0) return { amount: null, pct: null };
  const diff = market - live;
  return {
    amount: Number(diff.toFixed(2)),
    pct: Number(((diff / market) * 100).toFixed(2)),
  };
}

export function formatConfidenceLabel(c: MarketConfidence | null | undefined): string {
  if (c === 'high') return 'High';
  if (c === 'medium') return 'Medium';
  if (c === 'low') return 'Low';
  return 'Unknown';
}

export function formatConfidenceTone(c: MarketConfidence | null | undefined): string {
  if (c === 'high') return 'bg-emerald-500/15 border-emerald-400/40 text-emerald-200';
  if (c === 'medium') return 'bg-amber-500/15 border-amber-400/40 text-amber-200';
  if (c === 'low') return 'bg-rose-500/10 border-rose-400/40 text-rose-200';
  return 'bg-gray-700 border-gray-500/40 text-gray-200';
}

/**
 * Re-derive the 5 deal badges on the client when the server didn't ship
 * them (fallback for seeded data / older endpoints). Keeps the rules in
 * sync with `server/services/marketValueService.js#computeDealBadges`.
 */
export function computeBadgesForListing(item: ListingForMarket): DealBadge[] {
  if (Array.isArray(item.dealBadges) && item.dealBadges.length) {
    const seen = new Set<string>();
    return item.dealBadges.filter((b) => {
      if (!b || !b.id || seen.has(b.id)) return false;
      seen.add(b.id);
      return true;
    });
  }

  const market = getMarketValue(item);
  const live = pickListingPrice(item);
  const confidence = getMarketConfidence(item);
  const sampleSize = getSampleSize(item);
  if (market == null || live == null || market <= 0 || sampleSize === 0) return [];

  const badges: DealBadge[] = [];
  const savingsPct = ((market - live) / market) * 100;

  if (savingsPct >= 10) badges.push(BADGE_LIBRARY.under_market);
  if (savingsPct >= 30 && confidence !== 'low') badges.push(BADGE_LIBRARY.rare_price);

  const isAuction = Boolean(item.isAuction);
  const bidCount = Number(item.bidCount) || 0;
  const secs = Number(item.secondsRemaining) || 0;
  if (isAuction && savingsPct >= 20 && bidCount <= 3 && secs > 0 && secs <= 60 * 60) {
    badges.push(BADGE_LIBRARY.elite_snipe);
  }

  const avg = item.marketStats?.average;
  const med = item.marketStats?.median;
  if (avg != null && med != null && med > 0 && avg > med * 1.05) {
    badges.push(BADGE_LIBRARY.trending_up);
  }

  if (savingsPct >= 15 && confidence === 'high') badges.push(BADGE_LIBRARY.smart_buy);

  const seen = new Set<string>();
  return badges.filter((b) => {
    if (seen.has(b.id)) return false;
    seen.add(b.id);
    return true;
  });
}

export function isAboveMarket(item: ListingForMarket): boolean {
  const { pct } = getSavings(item);
  return pct != null && pct < 0;
}

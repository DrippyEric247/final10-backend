import React from 'react';
import { computeBadgesForListing, type ListingForMarket, type DealBadge } from '../../lib/marketValue';

type Props = {
  item: ListingForMarket;
  /** Maximum number of badges to show (defaults to all five). */
  max?: number;
  className?: string;
};

const TONE_BY_BADGE: Record<DealBadge['id'], string> = {
  under_market: 'border-orange-400/45 bg-orange-500/15 text-orange-100',
  rare_price: 'border-yellow-300/45 bg-yellow-300/10 text-yellow-100',
  elite_snipe: 'border-cyan-300/45 bg-cyan-400/10 text-cyan-100',
  trending_up: 'border-emerald-300/45 bg-emerald-400/10 text-emerald-100',
  smart_buy: 'border-purple-300/45 bg-purple-400/10 text-purple-100',
};

/**
 * Renders the True Market Value badge row:
 *   🔥 Under Market   ⚡ Rare Price   💎 Elite Snipe   📈 Trending Up   🧠 Smart Buy
 *
 * Pulls badges from `item.dealBadges` when present (server-enriched), and
 * recomputes locally otherwise so cards still light up consistently across
 * surfaces that don't go through the eBay enrichment path.
 */
export default function DealBadges({ item, max = 5, className = '' }: Props) {
  const badges = computeBadgesForListing(item).slice(0, max);
  if (!badges.length) return null;

  return (
    <div className={`flex flex-wrap gap-1.5 ${className}`} data-testid="deal-badges">
      {badges.map((badge) => (
        <span
          key={badge.id}
          className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide ${
            TONE_BY_BADGE[badge.id] || 'border-gray-500/40 bg-gray-700/40 text-gray-200'
          }`}
          title={badge.label}
        >
          <span aria-hidden="true">{badge.emoji}</span>
          {badge.label}
        </span>
      ))}
    </div>
  );
}

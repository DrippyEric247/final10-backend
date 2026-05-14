import React from 'react';
import { Clock, ExternalLink } from 'lucide-react';
import ListingCardImage from '../listings/ListingCardImage';
import TrueMarketValueBlock from '../market/TrueMarketValueBlock';
import DealBadges from '../market/DealBadges';
import EbayDealCardSavvyRewards from './EbayDealCardSavvyRewards';
import { getMarketValue, getSavings, type ListingForMarket } from '../../lib/marketValue';

type DealItem = ListingForMarket & {
  itemId?: string;
  title?: string;
  imageUrl?: string;
  image?: unknown;
  images?: unknown;
  itemWebUrl?: string;
  currency?: string;
  isBuyNow?: boolean;
  hasBothOptions?: boolean;
  dealScore?: number;
  recommendationType?: string;
  recommendationReason?: string;
  savingsAmount?: number | string;
};

type DealCardProps = {
  item: DealItem;
  onMeaningfulView?: (item: DealItem, action: string) => void;
  hidePass?: boolean;
};

const recommendationLabel: Record<string, string> = {
  auction_better: 'Bid',
  buy_now_better: 'Buy Now',
  wait_and_watch: 'Watch',
  pass: 'Skip',
};

function formatPrice(value: number | string | null | undefined, currency = 'USD') {
  if (value == null || value === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(n);
}

function formatTime(seconds: number | string | null | undefined) {
  if (seconds == null) return 'Ended';
  const s = Number(seconds);
  if (!Number.isFinite(s) || s <= 0) return 'Ended';
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h ${m}m left`;
  return `${Math.max(m, 1)}m left`;
}

function pickBestMove(item: DealItem) {
  if (item.recommendationType && recommendationLabel[item.recommendationType]) {
    return recommendationLabel[item.recommendationType];
  }
  if (item.isAuction && item.isBuyNow) {
    const bid = Number(item.currentBidPrice ?? item.price);
    const buy = Number(item.buyNowPrice);
    if (Number.isFinite(bid) && Number.isFinite(buy) && bid < buy * 0.9) return 'Bid';
    return 'Buy Now';
  }
  if (item.isAuction) return 'Bid';
  if (item.isBuyNow) return 'Buy Now';
  return 'Watch';
}

export default function DealCard({ item, onMeaningfulView, hidePass = false }: DealCardProps) {
  if (hidePass && item.recommendationType === 'pass') return null;

  const currency = item.currency || 'USD';
  const currentBid = formatPrice(item.currentBidPrice ?? item.price, currency);
  const buyNow = formatPrice(item.buyNowPrice, currency);
  const trueMarketValue = getMarketValue(item);
  const marketSavings = getSavings(item);
  const fallbackSavings = Number(item.savingsAmount);
  const savingsNumber =
    marketSavings.amount != null
      ? marketSavings.amount
      : Number.isFinite(fallbackSavings)
        ? fallbackSavings
        : NaN;
  const savingsText =
    Number.isFinite(savingsNumber) && savingsNumber > 0 ? formatPrice(savingsNumber, currency) : null;

  const bestMove = pickBestMove(item);
  const isBestMove = bestMove === 'Bid' || bestMove === 'Buy Now';
  const isAvoid = bestMove === 'Skip';
  const glow = isBestMove ? 'shadow-[0_0_28px_rgba(168,85,247,0.2)] border-purple-400/50' : 'border-gray-700';
  const badgeTone = isAvoid
    ? 'bg-red-500/20 text-red-300 border-red-500/40'
    : isBestMove
      ? 'bg-purple-500/20 text-purple-200 border-purple-400/50'
      : 'bg-gray-700 text-gray-200 border-gray-600';
  const cardTitle = item.title || 'eBay listing';
  const placeholder = 'https://via.placeholder.com/640x480?text=Final10';
  const actionLabel = bestMove === 'Bid' ? 'View Deal' : bestMove === 'Buy Now' ? 'View Deal' : 'View Deal';

  return (
    <article className={`f10-listing-surface rounded-2xl overflow-hidden border transition-all duration-200 ${glow}`}>
      <div className="bg-gray-900">
        <ListingCardImage
          item={item}
          alt={cardTitle}
          aspectRatio="4 / 3"
          borderRadius="0"
          frameClassName="bg-gray-900"
          fallbackSrc={placeholder}
        />
      </div>

      <div className="p-4 sm:p-5">
        <h3 className="text-white text-base sm:text-lg font-semibold leading-tight line-clamp-2 mb-3">{cardTitle}</h3>

        <div className="space-y-1.5 text-sm">
          {item.isAuction ? (
            <div className="flex items-center justify-between">
              <span className="text-gray-400">Current bid</span>
              <span className="text-white font-semibold">{currentBid || '—'}</span>
            </div>
          ) : null}
          {buyNow ? (
            <div className="flex items-center justify-between">
              <span className="text-gray-400">Buy it now</span>
              <span className="text-green-300 font-semibold">{buyNow}</span>
            </div>
          ) : null}
          {item.isAuction ? (
            <div className="flex items-center justify-between">
              <span className="text-gray-400 inline-flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                Time
              </span>
              <span className="text-amber-300 font-medium">{formatTime(item.secondsRemaining)}</span>
            </div>
          ) : null}
        </div>

        <div className={`mt-4 rounded-xl border px-3 py-2.5 ${badgeTone}`}>
          <p className="text-sm font-semibold">🔥 Best Move: {bestMove}</p>
          {item.recommendationReason ? (
            <p className="text-xs mt-1 opacity-90">{item.recommendationReason}</p>
          ) : null}
        </div>

        {trueMarketValue != null ? (
          <TrueMarketValueBlock item={item} currency={currency} className="mt-3" />
        ) : null}

        <DealBadges item={item} className="mt-3" />

        <EbayDealCardSavvyRewards
          item={item}
          effectiveSavings={Number.isFinite(savingsNumber) && savingsNumber > 0 ? savingsNumber : 0}
          currency={currency}
        />

        {savingsText && trueMarketValue == null ? (
          <div className="mt-3 flex items-center justify-between text-sm text-emerald-300 font-medium">
            <span>You save</span>
            <span>{savingsText}</span>
          </div>
        ) : null}

        <a
          href={item.itemWebUrl}
          target="_blank"
          rel="noreferrer"
          onClick={() => onMeaningfulView?.(item, 'open_listing')}
          className="mt-4 w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold transition-colors"
        >
          {actionLabel}
          <ExternalLink className="h-4 w-4" />
        </a>
      </div>
    </article>
  );
}

import React from 'react';
import { Clock, ShoppingCart } from 'lucide-react';
import ListingCardImage from '../listings/ListingCardImage';

function formatPrice(value, currency = 'USD') {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(n);
}

function formatTime(seconds) {
  const s = Number(seconds);
  if (!Number.isFinite(s) || s <= 0) return 'Ended';
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function recommendationColor(type) {
  if (type === 'buy_now_better') return 'bg-green-500/20 text-green-300 border-green-500/30';
  if (type === 'auction_better') return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
  if (type === 'wait_and_watch') return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30';
  return 'bg-red-500/20 text-red-300 border-red-500/30';
}

export default function EbayListingCard({
  item,
  onMeaningfulView,
  hidePass = false,
}) {
  if (hidePass && item.recommendationType === 'pass') return null;
  const badge =
    item.hasBothOptions ? 'Both' : item.isAuction ? 'Auction' : item.isBuyNow ? 'Buy It Now' : 'Listing';

  const openItem = () => {
    onMeaningfulView?.(item, 'open_listing');
  };

  return (
    <article className="bg-gray-800 rounded-xl p-4 border border-gray-700 hover:border-purple-500/40 transition-colors">
      <div className="flex gap-4">
        <div className="w-24 shrink-0">
          <ListingCardImage
            item={item}
            alt={item.title || 'eBay listing'}
            aspectRatio="1 / 1"
            borderRadius="12px"
            fallbackSrc="https://via.placeholder.com/96x96?text=eBay"
          />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className="px-2 py-1 rounded-full text-xs bg-purple-500/20 text-purple-300 border border-purple-500/30">
              {badge}
            </span>
            <span className="px-2 py-1 rounded-full text-xs bg-gray-700 text-gray-200 border border-gray-600">
              Best Move
            </span>
            {item.endingSoon ? (
              <span className="px-2 py-1 rounded-full text-xs bg-red-500/20 text-red-300 border border-red-500/30">
                Ending Soon
              </span>
            ) : null}
          </div>
          <h3 className="text-white font-semibold line-clamp-2 mb-2">{item.title}</h3>
          <div className="text-sm text-gray-300 mb-1">
            {item.isAuction ? `Current bid: ${formatPrice(item.currentBidPrice || item.price, item.currency)}` : `Price: ${formatPrice(item.buyNowPrice || item.price, item.currency)}`}
          </div>
          {item.isBuyNow && item.buyNowPrice ? (
            <div className="text-sm text-green-300 mb-1">Buy It Now: {formatPrice(item.buyNowPrice, item.currency)}</div>
          ) : null}
          {item.isAuction ? (
            <div className="text-sm text-gray-400 mb-1">Bids: {item.bidCount || 0}</div>
          ) : null}
          {item.isAuction ? (
            <div className="text-sm text-red-300 mb-3 flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              {formatTime(item.secondsRemaining)} left
            </div>
          ) : null}
          {item.recommendationType ? (
            <div className={`rounded-lg border px-2.5 py-2 text-xs mb-3 ${recommendationColor(item.recommendationType)}`}>
              <div className="font-semibold mb-1">{item.recommendationType.replace(/_/g, ' ')}</div>
              <div>{item.recommendationReason}</div>
            </div>
          ) : null}

          <div className="flex gap-2 flex-wrap">
            <a
              href={item.itemWebUrl}
              target="_blank"
              rel="noreferrer"
              onClick={openItem}
              className="px-3 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium inline-flex items-center gap-2"
            >
              <ShoppingCart className="h-4 w-4" />
              View on eBay
            </a>
            <button onClick={() => onMeaningfulView?.(item, 'track_this')} className="px-3 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-white text-sm">
              Track this
            </button>
            <button onClick={() => onMeaningfulView?.(item, 'watch_auction')} className="px-3 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-white text-sm">
              Watch auction
            </button>
            <button onClick={() => onMeaningfulView?.(item, 'compare_buy_now')} className="px-3 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-white text-sm">
              Compare vs Buy It Now
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}


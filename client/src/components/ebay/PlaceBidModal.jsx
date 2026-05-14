import React, { useState } from 'react';
import { useEbayConnectionStatus, usePlaceEbayBid } from '../../hooks/usePlaceEbayBid';
import ebayService from '../../services/ebayService';

function fmt(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
}

export default function PlaceBidModal({
  open,
  item,
  onClose,
  onBidPlaced,
  onConnectRequired,
}) {
  const [maxAmount, setMaxAmount] = useState('');
  const [localError, setLocalError] = useState('');
  const statusQ = useEbayConnectionStatus(open);
  const bidMutation = usePlaceEbayBid();

  const connection = statusQ.data?.status || 'not_connected';
  const connected = connection === 'connected';
  const canBid = connected;
  const secondsRemaining = Number(item?.timeRemaining || 0);

  if (!open || !item) return null;

  const submit = async () => {
    setLocalError('');
    const amount = Number(maxAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setLocalError('Enter a valid max bid amount.');
      return;
    }
    try {
      const result = await bidMutation.mutateAsync({
        itemId: item.id || item.itemId,
        maxAmount: amount,
        currency: item.currency || 'USD',
      });
      if (result?.mode === 'redirect_required') {
        window.open(result.itemWebUrl, '_blank', 'noopener,noreferrer');
        return;
      }
      if (result?.success) {
        onBidPlaced?.(result, item, amount, secondsRemaining);
      }
    } catch (err) {
      setLocalError(err?.response?.data?.message || err?.message || 'Bid request failed.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-end sm:items-center justify-center p-3">
      <div className="w-full max-w-lg bg-gray-900 border border-gray-700 rounded-2xl p-4 sm:p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-white font-bold text-lg">Place Max Bid</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white">✕</button>
        </div>
        <div className="text-sm text-gray-300 mb-2 font-semibold">{item.title}</div>
        <div className="text-sm text-gray-400 mb-3">
          Current bid: {fmt(item.currentBid || item.price)} • Bids: {item.bidCount || 0} • Time left: {Math.max(0, Math.floor(secondsRemaining / 60))}m
        </div>
        <div className="text-xs text-gray-400 mb-3">
          eBay uses proxy bidding. We submit your max bid, and eBay only raises your live bid as needed.
        </div>
        <input
          value={maxAmount}
          onChange={(e) => setMaxAmount(e.target.value)}
          type="number"
          step="0.01"
          min="0"
          placeholder="Enter max bid amount"
          className="w-full rounded-lg px-3 py-2 bg-gray-800 border border-gray-700 text-white mb-3"
        />
        {(localError || bidMutation.error) ? (
          <div className="text-sm text-red-300 mb-3">{localError || bidMutation.error?.message}</div>
        ) : null}
        {!canBid ? (
          <button
            onClick={async () => {
              onConnectRequired?.();
              try {
                const url = await ebayService.getConnectLink('/auctions?ebay=connected');
                if (url) window.location.href = url;
              } catch (err) {
                setLocalError(
                  err?.response?.data?.message ||
                    'Unable to start eBay connection flow right now.'
                );
              }
            }}
            className="w-full rounded-lg px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold"
          >
            Connect eBay to Bid
          </button>
        ) : (
          <button
            onClick={submit}
            disabled={bidMutation.isPending}
            className="w-full rounded-lg px-4 py-2.5 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-700 text-white font-semibold"
          >
            {bidMutation.isPending ? 'Placing bid...' : 'Place Max Bid'}
          </button>
        )}
      </div>
    </div>
  );
}


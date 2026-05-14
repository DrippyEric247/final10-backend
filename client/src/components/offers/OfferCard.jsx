import React, { useMemo } from "react";
import { Clock3, ShieldAlert, TrendingUp } from "lucide-react";
import SavvyRewardBadge from "../rewards/SavvyRewardBadge";
import ListingCardImage from "../listings/ListingCardImage";
import { bestMoveTag, offerReason } from "../../lib/offerEngine";

function sourceTag(sourceType) {
  if (sourceType === "marketplace") return "eBay";
  if (sourceType === "promoted") return "Promoted";
  if (sourceType === "featured") return "Featured";
  return "Future Coupon";
}

function demandTone(level) {
  if (level === "high") return "border-rose-400/45 bg-rose-500/20 text-rose-200";
  if (level === "medium") return "border-amber-400/45 bg-amber-500/20 text-amber-200";
  return "border-sky-400/45 bg-sky-500/20 text-sky-200";
}

function formatRemaining(expiresAt) {
  const ms = Number(expiresAt) - Date.now();
  if (ms <= 0) return "Expired";
  const m = Math.floor(ms / 60000);
  const h = Math.floor(m / 60);
  const mins = m % 60;
  return h > 0 ? `${h}h ${mins}m` : `${Math.max(1, mins)}m`;
}

function formatCurrency(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

export default function OfferCard({
  offer,
  onToggleSave,
  onTrackClick,
  onClaimReward,
  isTracking = false,
  isClaiming = false,
  hasClicked = false,
  hasClaimed = false,
}) {
  const move = useMemo(() => bestMoveTag(offer), [offer]);
  const urgent = Number(offer.expiresAt) - Date.now() < 4 * 60 * 60 * 1000;
  const lowTrust = Number(offer.trustScore) < 60;

  return (
    <article
      className={`f10-listing-surface rounded-2xl border overflow-hidden ${
        offer.savingsPct >= 25 ? "border-amber-400/45 shadow-[0_0_32px_rgba(251,191,36,0.18)]" : "border-purple-500/25"
      }`}
    >
      <div className="relative bg-gray-850">
        <ListingCardImage
          item={{ imageUrl: offer.image, image: offer.image, title: offer.title }}
          alt={offer.title || "Offer"}
          aspectRatio="4 / 3"
          borderRadius="0"
          frameClassName="bg-gray-900"
          fallbackSrc="https://via.placeholder.com/640x480/111827/A78BFA?text=Offer"
        />
        <span className="absolute top-3 left-3 rounded-full border border-black/20 bg-black/60 px-2.5 py-1 text-[11px] font-semibold text-white">
          {sourceTag(offer.sourceType)}
        </span>
        <span className="absolute top-3 right-3 rounded-full border border-emerald-400/35 bg-emerald-500/15 px-2.5 py-1 text-[11px] font-semibold text-emerald-200">
          🔥 Best Move: {move}
        </span>
      </div>

      <div className="p-4 sm:p-5">
        <h3 className="text-lg font-semibold text-white line-clamp-2">{offer.title}</h3>
        <div className="mt-1 text-xs text-gray-400">{offer.category}</div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="rounded-xl border border-gray-700/80 bg-black/25 px-3 py-2">
            <div className="text-[11px] text-gray-400">Current price</div>
            <div className="text-base font-bold text-white">{formatCurrency(offer.price)}</div>
          </div>
          <div className="rounded-xl border border-gray-700/80 bg-black/25 px-3 py-2">
            <div className="text-[11px] text-gray-400">Market value</div>
            <div className="text-base font-semibold text-gray-200">{formatCurrency(offer.marketValue)}</div>
          </div>
          <div className="rounded-xl border border-emerald-400/35 bg-emerald-500/10 px-3 py-2">
            <div className="text-[11px] text-emerald-300">Save</div>
            <div className="text-base font-bold text-emerald-300">{formatCurrency(offer.savings)}</div>
          </div>
          <div className={`rounded-xl border px-3 py-2 ${demandTone(offer.demandLevel)}`}>
            <div className="text-[11px]">Demand</div>
            <div className="text-base font-bold capitalize">{offer.demandLevel}</div>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between gap-2">
          <div className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-semibold ${
            urgent ? "border-orange-400/45 bg-orange-500/20 text-orange-200" : "border-gray-600 bg-gray-800 text-gray-300"
          }`}>
            <Clock3 className="h-3.5 w-3.5" />
            {formatRemaining(offer.expiresAt)}
          </div>
          <div className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-semibold ${
            lowTrust ? "border-rose-400/45 bg-rose-500/20 text-rose-200" : "border-emerald-400/45 bg-emerald-500/20 text-emerald-200"
          }`}>
            {lowTrust ? <ShieldAlert className="h-3.5 w-3.5" /> : <TrendingUp className="h-3.5 w-3.5" />}
            Trust {offer.trustScore}
          </div>
        </div>

        {lowTrust ? (
          <div className="mt-2 text-xs font-semibold text-rose-300">⚠ Risk label: low trust</div>
        ) : null}

        <SavvyRewardBadge
          className="mt-3"
          baseSavvy={offer.rewardPoints}
          trustScore={offer.trustScore}
          price={offer.price}
          savings={offer.savings}
          live
        />

        <div className="mt-3 rounded-lg border border-gray-700/80 bg-black/30 px-3 py-2">
          <p className="text-xs text-gray-200">{offerReason(offer)}</p>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => onTrackClick?.(offer)}
            disabled={isTracking}
            className="inline-flex items-center justify-center rounded-xl px-4 py-3 text-sm font-bold text-white bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 disabled:opacity-60"
          >
            {isTracking ? "Tracking..." : "View Deal"}
          </button>
          <button
            type="button"
            onClick={() => onToggleSave?.(offer.id)}
            className="inline-flex items-center justify-center rounded-xl border border-purple-400/40 bg-purple-500/10 px-4 py-3 text-sm font-bold text-purple-200 hover:bg-purple-500/20"
          >
            {offer.saved ? "Saved" : "Save"}
          </button>
        </div>

        <div className="mt-2">
          {hasClaimed ? (
            <button
              type="button"
              disabled
              className="w-full rounded-xl border border-emerald-400/40 bg-emerald-500/15 px-4 py-2.5 text-sm font-semibold text-emerald-200 cursor-not-allowed"
            >
              Claimed
            </button>
          ) : (
            <button
              type="button"
              disabled={!hasClicked || isClaiming}
              onClick={() => onClaimReward?.(offer)}
              className="w-full rounded-xl border border-amber-400/40 bg-amber-500/10 px-4 py-2.5 text-sm font-semibold text-amber-200 disabled:opacity-60"
            >
              {isClaiming ? "Claiming..." : "I Used This Deal"}
            </button>
          )}
        </div>
      </div>
    </article>
  );
}


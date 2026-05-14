import React, { useEffect, useMemo, useState } from "react";
import { evaluateBestMove } from "../../lib/bestMoveEngine";
import { evaluateTrustScore, trustScoreInputFromListing } from "../../lib/trustScoreEngine";
import { emitBuyerEarnToast } from "../../lib/dualEarn";
import ListingCardImage from "../listings/ListingCardImage";
import { formatPrice, formatTime } from "./DealCard";
import "../../styles/QuickSnipesHeroCard.css";

/** Center-hero countdown: MM:SS under 1h, HH:MM:SS under 24h, else compact days. */
function formatHeroCountdown(totalSeconds) {
  const s = Math.floor(Number(totalSeconds));
  if (!Number.isFinite(s) || s <= 0) return null;
  if (s >= 86400) return formatTime(s);
  if (s >= 3600) {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  }
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

function toNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** One quoted AI line: signal + verdict (feels smarter than raw marketplace). */
function buildSavvyAiQuote(item, decision) {
  const bids = toNum(item.bidCount) ?? 0;
  const price = toNum(item.buyNowPrice) ?? toNum(item.currentBidPrice) ?? toNum(item.price);
  const mv = toNum(item.marketValue);
  let comp = "Active bidding";
  if (bids <= 3) comp = "Low competition";
  else if (bids <= 8) comp = "Moderate bidding";
  let value = "";
  if (price != null && mv != null && mv > 0 && price < mv * 0.97) value = "under market value";
  else if (decision.estimatedSavings > 0) value = "priced with upside";
  const lead = [comp, value].filter(Boolean).join(" + ");

  let verdict = "Move with discipline.";
  if (decision.bestMove === "bid" || decision.bestMove === "buy_now") {
    if (decision.confidence === "high") verdict = "Strong buy.";
    else if (decision.confidence === "medium") verdict = "Solid buy — check timing.";
    else verdict = "Cautious buy — verify details.";
  } else if (decision.bestMove === "watch") {
    verdict = "Watch closely.";
  } else {
    verdict = "Pass for now.";
  }

  return lead ? `${lead}. ${verdict}` : verdict;
}

/** Big top-right line: SAVE $1,319 */
function savingsSaveLine(item, decision, currency) {
  const price = toNum(item.buyNowPrice) ?? toNum(item.currentBidPrice) ?? toNum(item.price);
  const mv = toNum(item.marketValue);
  if (price != null && mv != null && mv > price && mv > 0) {
    const raw = mv - price;
    if (raw > 0) return { line: `SAVE ${formatPrice(raw, currency)}`, sub: `vs market ${formatPrice(mv, currency)}` };
  }
  if (decision.estimatedSavings > 0) {
    return { line: `SAVE ${formatPrice(decision.estimatedSavings, currency)}`, sub: "Savvy-estimated edge" };
  }
  return { line: "SAVE —", sub: "Market comp loading" };
}

function heroBadgeLabel(decision) {
  const isSavvyBest =
    decision.cardVariant === "best_move" ||
    decision.bestMove === "bid" ||
    decision.bestMove === "buy_now";
  return isSavvyBest ? "⚡ Savvy Best Move" : "💎 #1 Ranked Deal";
}

function trustEdgeLabel(trustResult) {
  const band = trustResult.sellerTrustBand;
  if (band === "elite") return { text: "🟢 Elite Verified Seller", tier: "high" };
  if (band === "high") return { text: "🟢 Trusted Seller", tier: "high" };
  if (band === "medium") return { text: "🟡 Established Seller", tier: "med" };
  if (band === "low") return { text: "🔴 Limited seller history", tier: "low" };
  return { text: "🟡 Seller profile partial", tier: "med" };
}

function competitionEdgeLabel(bids) {
  const b = Number(bids) || 0;
  if (b <= 3) return { text: "Competition: LOW 🔥", tier: "low" };
  if (b <= 12) return { text: "Competition: MEDIUM", tier: "med" };
  return { text: "Competition: HIGH", tier: "high" };
}

/**
 * Full-width hero for the #1 Quick Snipes row — distinct visual system from grid DealCards.
 */
export default function QuickSnipesHeroCard({
  entry,
  onMeaningfulView,
  boostedPower = false,
  subscriptionTier = "free",
  onPremiumClick,
}) {
  const item = entry?.item;
  const initialSeconds = Number(item?.secondsRemaining);
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    setElapsed(0);
  }, [item?.itemId]);
  useEffect(() => {
    if (!Number.isFinite(initialSeconds) || initialSeconds <= 0) return undefined;
    const id = window.setInterval(() => setElapsed((n) => n + 1), 1000);
    return () => window.clearInterval(id);
  }, [initialSeconds, item?.itemId]);

  const trustResult = useMemo(() => {
    if (!item) return null;
    const base = trustScoreInputFromListing(item);
    return evaluateTrustScore({
      ...base,
      imageUrl: item.imageUrl || base.imageUrl,
      seller: item.seller || base.seller,
      savvyVerifiedSeller: item.savvyVerifiedSeller ?? base.savvyVerifiedSeller,
    });
  }, [item]);

  const decision = useMemo(() => {
    if (!item || !trustResult) return null;
    return (
      item.bestMoveDecision ||
      evaluateBestMove({
        currentBid: item.currentBidPrice,
        buyNowPrice: item.buyNowPrice,
        marketValue: item.marketValue,
        marketConfidence: item.marketConfidence,
        trustScore: trustResult.trustScore,
        bidCount: item.bidCount,
        secondsRemaining: item.secondsRemaining,
        condition: item.condition,
        shippingCost: item.shippingCost,
        isAuction: item.isAuction,
        isBuyNow: item.isBuyNow,
      })
    );
  }, [item, trustResult]);

  if (!item || !decision || !trustResult) return null;

  const title = item.title || "Listing";
  const currency = item.currency || "USD";
  const priceDisplay = item.isAuction
    ? formatPrice(item.currentBidPrice, currency)
    : formatPrice(item.price, currency);
  const marketDisplay = item.marketValue != null ? formatPrice(item.marketValue, currency) : null;
  const { line: savingsLine, sub: savingsSub } = savingsSaveLine(item, decision, currency);
  const liveSec =
    Number.isFinite(initialSeconds) && initialSeconds > 0
      ? Math.max(0, initialSeconds - elapsed)
      : initialSeconds;
  const countdownDigits = Number.isFinite(liveSec) && liveSec > 0 ? formatHeroCountdown(liveSec) : null;
  const savvyQuote = buildSavvyAiQuote(item, decision);
  const bids = toNum(item.bidCount) ?? 0;
  const badgeText = heroBadgeLabel(decision);
  const trustEdge = trustEdgeLabel(trustResult);
  const compEdge = competitionEdgeLabel(bids);
  const url = item.itemWebUrl;
  const spend =
    toNum(item.buyNowPrice) ?? toNum(item.currentBidPrice) ?? toNum(item.price) ?? 0;
  const estPoints = spend > 0 ? Math.max(1, Math.round(spend)) : 1;

  const fireEarn = (actionKey) => {
    if (decision.bestMove === "pass") return;
    const action =
      actionKey === "buy"
        ? decision.bestMove === "bid"
          ? "bid"
          : "smart_buy"
        : actionKey === "watch"
          ? "watch"
          : null;
    if (action) emitBuyerEarnToast(estPoints, action);
  };

  const openListing = (action) => {
    if (!url) return;
    onMeaningfulView?.(item, action);
    fireEarn(action === "hero_buy" ? "buy" : action === "hero_watch" ? "watch" : "buy");
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const buyRecommended = decision.bestMove === "bid" || decision.bestMove === "buy_now";
  const watchRecommended = decision.bestMove === "watch";
  const passRecommended = decision.bestMove === "pass";

  const showPremiumHook = subscriptionTier === "free" && typeof onPremiumClick === "function";

  return (
    <>
    <article className="qs-hero" aria-label="Featured quick snipe">
      <div className={`quickCard${boostedPower ? " quickCard--boosted" : ""}`}>
        <div className="qs-hero__media">
          <ListingCardImage
            item={item}
            alt={title}
            aspectRatio="21 / 9"
            borderRadius="0"
            frameClassName="bg-zinc-950"
          />
          <span className="qs-hero__badge">{badgeText}</span>
          <div className="qs-hero__savings">
            <span className="qs-hero__savings-line">{savingsLine}</span>
            <span className="qs-hero__savings-sub">{savingsSub}</span>
          </div>
          <div className="qs-hero__countdown" aria-live="polite">
            {countdownDigits ? (
              <span className="qs-hero__countdown-face">
                <span aria-hidden>⏳ </span>
                {countdownDigits}
              </span>
            ) : (
              <span className="qs-hero__countdown-face qs-hero__countdown-face--ended">Ended</span>
            )}
          </div>
        </div>
      </div>

      <div className="qs-hero__below">
        <div className="qs-hero__core">
          <h2 className="qs-hero__title">{title}</h2>
          <div className="qs-hero__pv">
            <span className="qs-hero__price">{priceDisplay}</span>
            {marketDisplay ? (
              <>
                <span className="qs-hero__arrow" aria-hidden>
                  →
                </span>
                <span className="qs-hero__market-label">Market:</span>
                <span className="qs-hero__market">{marketDisplay}</span>
              </>
            ) : (
              <>
                <span className="qs-hero__arrow" aria-hidden>
                  →
                </span>
                <span className="qs-hero__market-label">Market:</span>
                <span className="qs-hero__market">—</span>
              </>
            )}
          </div>
          <div className="qs-hero__trust-row">
            <span className={`qs-hero__trust-pill qs-hero__trust-pill--${trustEdge.tier}`}>{trustEdge.text}</span>
            <span className={`qs-hero__comp-pill qs-hero__comp-pill--${compEdge.tier}`}>{compEdge.text}</span>
            <span className="qs-hero__ai-confidence">
              AI confidence <strong>{trustResult.aiConfidence}%</strong>
            </span>
          </div>
          {trustResult.savvyWarningHeadline ? (
            <p className="qs-hero__trust-warn">{trustResult.savvyWarningHeadline}</p>
          ) : null}
          <p className="qs-hero__edge">Your edge vs raw eBay</p>
        </div>

        <div className="qs-hero__strip" role="group" aria-label="Quick decision">
          {url ? (
            <a
              href={url}
              className={`qs-hero__strip-btn qs-hero__strip-btn--buy ${buyRecommended ? "" : "qs-hero__strip-btn--dim"}`}
              target="_blank"
              rel="noreferrer"
              aria-label="Buy on eBay"
              onClick={(e) => {
                e.preventDefault();
                openListing("hero_buy");
              }}
            >
              <span className="qs-hero__strip-slot">[ ✅ BUY ]</span>
            </a>
          ) : (
            <span className={`qs-hero__strip-btn qs-hero__strip-btn--buy qs-hero__strip-btn--dim`}>
              <span className="qs-hero__strip-slot">[ ✅ BUY ]</span>
            </span>
          )}
          {url ? (
            <a
              href={url}
              className={`qs-hero__strip-btn qs-hero__strip-btn--watch ${watchRecommended ? "qs-hero__strip-btn--hot" : ""}`}
              target="_blank"
              rel="noreferrer"
              aria-label="Watch on eBay"
              onClick={(e) => {
                e.preventDefault();
                onMeaningfulView?.(item, "hero_watch");
                fireEarn("watch");
                window.open(url, "_blank", "noopener,noreferrer");
              }}
            >
              <span className="qs-hero__strip-slot">[ 👀 WATCH ]</span>
            </a>
          ) : (
            <span className="qs-hero__strip-btn qs-hero__strip-btn--watch">
              <span className="qs-hero__strip-slot">[ 👀 WATCH ]</span>
            </span>
          )}
          <button
            type="button"
            className={`qs-hero__strip-btn qs-hero__strip-btn--pass ${passRecommended ? "qs-hero__strip-btn--pass--suggested" : ""}`}
            aria-label="Pass on this listing"
            onClick={() => onMeaningfulView?.(item, "hero_pass")}
          >
            <span className="qs-hero__strip-slot">[ ❌ PASS ]</span>
          </button>
        </div>

        <div className="qs-hero__ai">
          <div className="qs-hero__ai-label">🧠 Savvy says:</div>
          <p className="qs-hero__ai-quote">“{savvyQuote}”</p>
        </div>
      </div>
    </article>

    {showPremiumHook ? (
      <div className="qs-hero__premium-veil">
        <div className="qs-hero__premium-veil__inner">
          <p className="qs-hero__premium-title">🔒 Even better move exists</p>
          <p className="qs-hero__premium-sub">Upgrade to unlock stronger deals</p>
          <button type="button" className="qs-hero__premium-cta" onClick={onPremiumClick}>
            Upgrade
          </button>
        </div>
      </div>
    ) : null}
    </>
  );
}

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { AutoFlipSuggestion } from "./AutoFlipSuggestions";
import FlipScoreCallout from "./FlipScoreCallout";
import SavvyFlipSaleRewardModal, {
  type SavvyFlipSaleRewardPayload,
} from "./SavvyFlipSaleRewardModal";
import { useAuth } from "../../context/AuthContext";
import { estimateMaxSavvyPointsForFlip } from "../../lib/flipSavvyPotential";
import { isPremiumSeller } from "../../lib/sellerPremium";
import {
  confirmFlipSale,
  extractSellerListingIdFromPaste,
} from "../../services/flipRewardsService";
import "../../styles/SellerTrendIntel.css";

const DEFAULT_FEE_PCT = 13.5;
const FEE_MIN = 12;
const FEE_MAX = 15;

type Props = {
  deal: AutoFlipSuggestion;
  onClose: () => void;
};

function formatMoney(currency: string, n: number) {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency || "USD",
      maximumFractionDigits: 2,
    }).format(n);
  } catch {
    return `${currency} ${n.toFixed(2)}`;
  }
}

function parseMoney(raw: string): number {
  const n = parseFloat(String(raw).replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

type ProfitZone = "good" | "risk" | "bad";

function profitZone(net: number, roiPct: number, buy: number): ProfitZone {
  if (net <= 0) return "bad";
  if (roiPct < 8 || (buy > 0 && net < buy * 0.04)) return "risk";
  return "good";
}

export default function FlipProfitCalculatorModal({ deal, onClose }: Props) {
  const { user, refreshProfile } = useAuth();
  const [buy, setBuy] = useState(() => String(deal.buyPrice));
  const [sell, setSell] = useState(() => String(deal.estimatedResellPrice));
  const [feePct, setFeePct] = useState(DEFAULT_FEE_PCT);
  const [shipping, setShipping] = useState("");
  const [sellerListingIdRaw, setSellerListingIdRaw] = useState("");
  const [saleErr, setSaleErr] = useState<string | null>(null);
  const [saleBusy, setSaleBusy] = useState(false);
  const [rewardOpen, setRewardOpen] = useState(false);
  const [rewardPayload, setRewardPayload] = useState<SavvyFlipSaleRewardPayload | null>(null);
  const idemRef = useRef<string>("");

  const applyDeal = useCallback(() => {
    setBuy(String(deal.buyPrice));
    setSell(String(deal.estimatedResellPrice));
    setFeePct(DEFAULT_FEE_PCT);
    setShipping("");
  }, [deal]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const buyN = useMemo(() => parseMoney(buy), [buy]);
  const sellN = useMemo(() => parseMoney(sell), [sell]);
  const shipN = useMemo(() => parseMoney(shipping || "0"), [shipping]);

  const { netProfit, roiPct, breakEven } = useMemo(() => {
    const f = feePct / 100;
    const safeF = Math.min(Math.max(f, 0), 0.999);
    const afterFee = sellN * (1 - safeF);
    const net = afterFee - buyN - shipN;
    const roi = buyN > 0 ? (net / buyN) * 100 : 0;
    const denom = 1 - safeF;
    const be = denom > 0 ? (buyN + shipN) / denom : 0;
    return {
      netProfit: net,
      roiPct: roi,
      breakEven: Number.isFinite(be) ? be : 0,
    };
  }, [buyN, sellN, shipN, feePct]);

  const zone = profitZone(netProfit, roiPct, buyN);
  const cur = deal.currency || "USD";
  const maxSavvyUpside = useMemo(() => {
    if (deal.flipScore == null || !Number.isFinite(deal.flipScore)) return null;
    return estimateMaxSavvyPointsForFlip({
      flipScore: deal.flipScore,
      fromAi: true,
      isPremium: isPremiumSeller(),
    });
  }, [deal.flipScore]);

  const claimFlipSale = useCallback(async () => {
    setSaleErr(null);
    if (!user) {
      setSaleErr("Log in to bank Savvy Points for verified flips.");
      return;
    }
    const sid = extractSellerListingIdFromPaste(sellerListingIdRaw);
    if (!sid) {
      setSaleErr("Paste your live resale listing id (digits from your post), not the buy link.");
      return;
    }
    if (!sellN || sellN <= 0) {
      setSaleErr("Enter what you sold for (or keep “What you sell for” filled).");
      return;
    }
    idemRef.current =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `flip_sale_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    setSaleBusy(true);
    try {
      const res = await confirmFlipSale({
        sellerListingId: sid,
        soldPrice: sellN,
        feePct,
        verification: "user",
        idempotencyKey: idemRef.current,
      });
      if (!res.success) {
        setSaleErr(typeof res.message === "string" ? res.message : "Could not apply rewards.");
        return;
      }
      const bd = Array.isArray(res.breakdown) ? res.breakdown : [];
      setRewardPayload({
        headline: res.headline || "🔥 Smart Flip Complete!",
        subcopy: res.subcopy || "💰 You made a smart move",
        savvyLine: res.savvyLine || `+${res.totalPoints ?? 0} Savvy Points banked`,
        totalPoints: Number(res.totalPoints) || 0,
        theoreticalTotal: res.theoreticalTotal,
        dailyCapShortfall: res.dailyCapShortfall,
        executionLine:
          typeof res.executionLine === "string" && res.executionLine.trim()
            ? res.executionLine.trim()
            : null,
        eliteBadgeUnlocked: Boolean(res.eliteBadgeUnlocked),
        flipGamification: res.flipGamification ?? null,
        breakdown: bd.map((row: { label?: string; points?: number; cap?: boolean }) => ({
          label: String(row.label || ""),
          points: Number(row.points) || 0,
          cap: Boolean(row.cap),
        })),
      });
      setRewardOpen(true);
      void refreshProfile?.();
    } catch (e: unknown) {
      const msg =
        e && typeof e === "object" && "response" in e
          ? (e as { response?: { data?: { message?: string } } }).response?.data?.message
          : null;
      setSaleErr(msg || "Server could not verify this flip yet. Check listing id and timing rules.");
    } finally {
      setSaleBusy(false);
    }
  }, [user, sellerListingIdRaw, sellN, feePct, refreshProfile]);

  const node = (
    <div
      className="seller-pcalc-backdrop"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="seller-pcalc-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="seller-pcalc-title"
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" className="seller-pcalc-close" onClick={onClose} aria-label="Close">
          ×
        </button>

        <h2 id="seller-pcalc-title" className="seller-pcalc-title">
          See your take
        </h2>
        <p className="seller-pcalc-deal-title">{deal.title}</p>

        <FlipScoreCallout row={deal} variant="card" />
        {maxSavvyUpside != null ? (
          <p className="seller-flip-savvy-potential seller-flip-savvy-potential--calc">
            This flip could earn you up to +{maxSavvyUpside} Savvy Points
          </p>
        ) : null}

        <div className="seller-pcalc-actions-top">
          <button type="button" className="seller-pcalc-autofill" onClick={applyDeal}>
            Auto-fill from this deal
          </button>
        </div>

        <div className="seller-pcalc-fields">
          <label className="seller-pcalc-label">
            What you pay
            <input
              className="seller-pcalc-input"
              type="number"
              inputMode="decimal"
              min={0}
              step={0.01}
              value={buy}
              onChange={(e) => setBuy(e.target.value)}
            />
          </label>

          <label className="seller-pcalc-label">
            What you sell for
            <input
              className="seller-pcalc-input"
              type="number"
              inputMode="decimal"
              min={0}
              step={0.01}
              value={sell}
              onChange={(e) => setSell(e.target.value)}
            />
          </label>

          <div className="seller-pcalc-label seller-pcalc-fee-block">
            <div className="seller-pcalc-fee-head">
              <span>Marketplace cut (% of sale)</span>
              <span className="seller-pcalc-fee-value">{feePct.toFixed(1)}%</span>
            </div>
            <input
              className="seller-pcalc-range"
              type="range"
              min={FEE_MIN}
              max={FEE_MAX}
              step={0.5}
              value={feePct}
              onChange={(e) => setFeePct(parseFloat(e.target.value))}
            />
            <div className="seller-pcalc-range-ticks">
              <span>{FEE_MIN}%</span>
              <span>{FEE_MAX}%</span>
            </div>
          </div>

          <label className="seller-pcalc-label">
            Shipping cost <span className="seller-pcalc-optional">(optional)</span>
            <input
              className="seller-pcalc-input"
              type="number"
              inputMode="decimal"
              min={0}
              step={0.01}
              placeholder="0"
              value={shipping}
              onChange={(e) => setShipping(e.target.value)}
            />
          </label>
        </div>

        <div className={`seller-pcalc-results seller-pcalc-results--${zone}`}>
          <div className="seller-pcalc-results-eyebrow">What you actually keep</div>
          <div className="seller-pcalc-line seller-pcalc-line--hero">
            <span>You make:</span>
            <strong>{formatMoney(cur, netProfit)}</strong>
          </div>
          <div className="seller-pcalc-line">
            <span>Return on your money:</span>
            <strong>{roiPct.toFixed(1)}%</strong>
          </div>
          <div className="seller-pcalc-line">
            <span>Break-even ask:</span>
            <strong>{formatMoney(cur, breakEven)}</strong>
          </div>
        </div>

        {user ? (
          <div className="seller-pcalc-savvy-block">
            <h3 className="seller-pcalc-savvy-title">Savvy Points — flip rewards</h3>
            <p className="seller-pcalc-savvy-hint">
              After you post on the marketplace, drop <strong>your</strong> live listing id here (digits
              only). When the sale clears our anti-abuse window, one tap banks Savvy for the flip stack.
            </p>
            <label className="seller-pcalc-label">
              Your live listing id
              <input
                className="seller-pcalc-input"
                type="text"
                inputMode="numeric"
                autoComplete="off"
                placeholder="e.g. 12-digit eBay item id"
                value={sellerListingIdRaw}
                onChange={(e) => setSellerListingIdRaw(e.target.value)}
              />
            </label>
            <div className="seller-pcalc-savvy-actions">
              {saleErr ? (
                <p className="seller-pcalc-savvy-err" role="alert">
                  {saleErr}
                </p>
              ) : null}
              <button
                type="button"
                className="seller-flip-btn"
                disabled={saleBusy}
                onClick={() => void claimFlipSale()}
              >
                {saleBusy ? "Checking…" : "I sold it — claim Savvy Points"}
              </button>
            </div>
          </div>
        ) : null}

        {deal.itemWebUrl ? (
          <div className="seller-pcalc-foot">
            <a
              className="seller-flip-btn"
              href={deal.itemWebUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              Open this ask
            </a>
          </div>
        ) : null}
      </div>
    </div>
  );

  if (typeof document === "undefined") return null;
  return (
    <>
      {createPortal(node, document.body)}
      <SavvyFlipSaleRewardModal
        open={rewardOpen}
        payload={rewardPayload}
        onClose={() => {
          setRewardOpen(false);
          setRewardPayload(null);
        }}
      />
    </>
  );
}

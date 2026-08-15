import React, { useEffect, useMemo, useRef, useState } from "react";
import { SavvyPointsIcon } from "./SavvyPointsIcon";
import { useDealRewardEstimate } from "../../hooks/useDealRewardEstimate";
import { useSavvyRewardPreview } from "../../hooks/useSavvyRewardPreview";
import {
  applyBetaRewardUnlock,
  getBetaRewardsActiveLabel,
  getBetaRewardsCompactLabel,
  BETA_REWARD_DISPLAY_TRUST_SCORE,
  isRewardsLockedTier,
  shouldShowRewardsLocked,
} from "../../lib/betaRewardsDisplay";

/**
 * Unified Savvy reward display used by every listing/deal card in the app.
 *
 * Contract:
 * - Never renders a bare "0 Savvy".
 * - Low-trust listings show a clear "Rewards locked" state (no number).
 * - Medium-trust listings show a reduced estimate with a yellow cue.
 * - High-trust listings show the full reward with a green cue.
 * - Whenever the user has an active Savvy multiplier (>1.0x), the boosted
 *   payout is shown alongside the base, e.g. "+113 Savvy (2.0x = +226)".
 *
 * Why a component (not just a helper): the reward conversation is a first-
 * class trust + progression signal in Final10. Routing every card through
 * this one visual guarantees consistency and lets us tune the economy from
 * a single place.
 */

// Keep thresholds aligned with `trustScoreEngine.getTrustLevel`:
//   high: >= 80, medium: >= 55, low: < 55
export const LOW_TRUST_THRESHOLD = 55;
export const HIGH_TRUST_THRESHOLD = 80;

// Per-tier reward multipliers. Low is hard-zero so the user spec
// "no rewards for low-trust listings" is enforced globally.
export const TRUST_REWARD_MULTIPLIER = Object.freeze({
  high: 1.0,
  medium: 0.6,
  low: 0,
  unverified: 0,
});

export function getRewardTrustTier(trustScore) {
  const score = Number(trustScore);
  if (!Number.isFinite(score)) return "medium";
  if (score >= HIGH_TRUST_THRESHOLD) return "high";
  if (score >= LOW_TRUST_THRESHOLD) return "medium";
  if (score >= 36) return "low";
  return "unverified";
}

/**
 * Compute an acceptable `base` Savvy amount when the caller didn't provide
 * one. We intentionally keep the math transparent so users can reason about
 * "bigger savings = more Savvy".
 */
function deriveBaseSavvy({ baseSavvy, price, savings }) {
  const provided = Number(baseSavvy);
  if (Number.isFinite(provided) && provided > 0) return provided;
  const p = Number(price);
  const s = Number(savings);
  const savingsPortion = Number.isFinite(s) && s > 0 ? s * 0.8 : 0;
  const pricePortion = Number.isFinite(p) && p > 0 ? p * 0.2 : 0;
  const derived = Math.round(savingsPortion + pricePortion);
  return Math.max(40, derived);
}

/**
 * Trust-tier base derivation only — multiplier/final amounts come from server preview.
 * @deprecated for payout totals — use server estimate hooks instead.
 */
export function computeSavvyReward({
  baseSavvy,
  trustScore,
  price,
  savings,
  multiplier = 1,
} = {}) {
  const tier = getRewardTrustTier(trustScore);
  const base = deriveBaseSavvy({ baseSavvy, price, savings });
  const trustMult = TRUST_REWARD_MULTIPLIER[tier];
  const baseAfterTrust = Math.max(0, Math.round(base * trustMult));
  return {
    tier,
    base,
    baseAfterTrust,
    boosted: baseAfterTrust,
    final: baseAfterTrust,
    trustMultiplier: trustMult,
    userMultiplier: 1,
  };
}

function buildTrustOnlyReward({ baseSavvy, trustScore, price, savings }) {
  return computeSavvyReward({ baseSavvy, trustScore, price, savings, multiplier: 1 });
}

const TIER_CLASSES = {
  high: {
    wrap: "border-emerald-400/45 bg-emerald-500/12",
    text: "text-emerald-200",
    accent: "text-emerald-100",
  },
  medium: {
    wrap: "border-amber-400/45 bg-amber-500/12",
    text: "text-amber-200",
    accent: "text-amber-100",
  },
  low: {
    wrap: "border-rose-500/40 bg-rose-500/10",
    text: "text-rose-200",
    accent: "text-rose-100",
  },
  unverified: {
    wrap: "border-slate-500/45 bg-slate-900/40",
    text: "text-slate-200",
    accent: "text-slate-100",
  },
};

/**
 * Smoothly tween from one whole number to another. Keeps renders cheap by
 * only firing animation frames while the value is actively changing.
 */
function useTweenedNumber(target, durationMs = 520) {
  const safeTarget = Number.isFinite(target) ? Math.max(0, Math.round(target)) : 0;
  const [display, setDisplay] = useState(safeTarget);
  const fromRef = useRef(safeTarget);
  const rafRef = useRef(0);

  useEffect(() => {
    if (safeTarget === display) return;
    const start = performance.now();
    const from = fromRef.current;
    const delta = safeTarget - from;

    const step = (now) => {
      const t = Math.min(1, (now - start) / Math.max(1, durationMs));
      // easeOutCubic for a snappy-but-soft tick.
      const eased = 1 - Math.pow(1 - t, 3);
      const next = Math.round(from + delta * eased);
      setDisplay(next);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        fromRef.current = safeTarget;
      }
    };

    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafRef.current);
    // We intentionally exclude `display` so we don't restart mid-tween.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [safeTarget, durationMs]);

  return display;
}

/**
 * @param {{
 *   listingId?: string,
 *   rewardSource?: string,
 *   baseSavvy?: number,
 *   trustScore: number,
 *   price?: number,
 *   savings?: number,
 *   multiplier?: number,
 *   live?: boolean,
 *   compact?: boolean,
 *   className?: string,
 *   showIcon?: boolean,
 * }} props
 */
export default function SavvyRewardBadge({
  listingId,
  rewardSource = "deal_purchase",
  baseSavvy,
  trustScore,
  price,
  savings,
  multiplier: _multiplierOverride,
  live = false,
  compact = false,
  className = "",
  showIcon = true,
}) {
  const tier = getRewardTrustTier(trustScore);
  const rewardsLockedLocal = isRewardsLockedTier(tier);
  const betaPreviewUnlock = rewardsLockedLocal && !shouldShowRewardsLocked(tier);
  const effectiveTrustScore = betaPreviewUnlock ? BETA_REWARD_DISPLAY_TRUST_SCORE : trustScore;

  const dealSnapshot = useMemo(() => {
    const id = String(listingId || "").trim();
    if (!id) return null;
    return {
      listingId: id,
      trustScore: effectiveTrustScore,
      price,
      savings,
      estimatedPointsEarned: baseSavvy,
      baseSavvy,
    };
  }, [listingId, effectiveTrustScore, price, savings, baseSavvy]);

  const { estimate: dealEstimate, loading: dealLoading } = useDealRewardEstimate(dealSnapshot || {});

  const trustOnlyBase = useMemo(
    () => buildTrustOnlyReward({ baseSavvy, trustScore: effectiveTrustScore, price, savings }).baseAfterTrust,
    [baseSavvy, effectiveTrustScore, price, savings]
  );

  const previewBase = dealEstimate?.baseSavvy ?? trustOnlyBase ?? Math.round(Number(baseSavvy) || 0);
  const previewSource = dealSnapshot ? "deal_purchase" : rewardSource;

  const { preview: sourcePreview, loading: previewLoading } = useSavvyRewardPreview(
    !dealSnapshot && previewBase > 0 && !rewardsLockedLocal
      ? { baseAmount: previewBase, source: previewSource }
      : null
  );

  const serverReward = useMemo(() => {
    if (dealEstimate && dealEstimate.eligible !== false && dealEstimate.state !== "not_eligible") {
      return {
        tier: getRewardTrustTier(effectiveTrustScore),
        baseAfterTrust: dealEstimate.baseSavvy ?? previewBase,
        boosted: dealEstimate.totalSavvy ?? previewBase,
        final: dealEstimate.totalSavvy ?? previewBase,
        userMultiplier: dealEstimate.appliedMultiplier ?? dealEstimate.effectiveMultiplier ?? 1,
        multiplierEligible: dealEstimate.multiplierEligible !== false,
        rewardClass: dealEstimate.rewardClass || "earning",
      };
    }
    if (sourcePreview) {
      return {
        tier: getRewardTrustTier(effectiveTrustScore),
        baseAfterTrust: sourcePreview.baseAmount ?? previewBase,
        boosted: sourcePreview.finalAmount ?? previewBase,
        final: sourcePreview.finalAmount ?? previewBase,
        userMultiplier: sourcePreview.appliedMultiplier ?? 1,
        multiplierEligible: Boolean(sourcePreview.multiplierEligible),
        rewardClass: sourcePreview.rewardClass || "fixed",
      };
    }
    return buildTrustOnlyReward({ baseSavvy, trustScore: effectiveTrustScore, price, savings });
  }, [dealEstimate, sourcePreview, effectiveTrustScore, previewBase, baseSavvy, price, savings]);

  const rawReward = serverReward;

  const { reward, rewardsLocked, betaUnlocked, betaLabel } = useMemo(
    () => {
      const resolved = applyBetaRewardUnlock({
        reward: rawReward,
        baseSavvy,
        trustScore,
        price,
        savings,
      });
      return {
        reward: resolved.reward,
        rewardsLocked: resolved.rewardsLocked,
        betaUnlocked: resolved.betaUnlocked,
        betaLabel: resolved.betaLabel,
      };
    },
    [rawReward, baseSavvy, trustScore, price, savings]
  );

  const loading = dealLoading || previewLoading;

  const tweenedBoosted = useTweenedNumber(reward.boosted);
  const tierClass = TIER_CLASSES[reward.tier] || TIER_CLASSES.medium;
  const prefix = live ? "Earn" : "Est. earn";
  const betaCompactLabel = getBetaRewardsCompactLabel();
  const betaFullLabel = betaLabel || getBetaRewardsActiveLabel();
  // Treat values within 1% of 1.0x as "no boost" so floating-point noise
  // doesn't flicker the boost suffix on/off.
  const hasBoost =
    !rewardsLocked &&
    !loading &&
    reward.multiplierEligible !== false &&
    reward.userMultiplier > 1.01;
  const baseLabel = rewardsLocked
    ? "🔒 Rewards locked"
    : betaUnlocked
      ? compact
        ? `✨ ${betaCompactLabel}`
        : `+${reward.baseAfterTrust.toLocaleString()} Savvy`
      : `${prefix} ${reward.tier === "medium" ? "~" : ""}+${reward.baseAfterTrust.toLocaleString()} Savvy`;

  const multiplierLabel = `${reward.userMultiplier.toFixed(reward.userMultiplier >= 10 ? 0 : 1)}×`;

  const ariaLabel = hasBoost
    ? `${baseLabel}. ${multiplierLabel} multiplier boosts to plus ${reward.boosted.toLocaleString()} Savvy.`
    : baseLabel;

  // Compact chip-style (for grid overlays, carousels, etc.).
  if (compact) {
    return (
      <span
        className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-extrabold shadow-sm ${tierClass.wrap} ${tierClass.text} ${className}`}
        title={
          rewardsLocked
            ? "No rewards are issued on low-trust or unverified listings."
            : betaUnlocked
              ? betaFullLabel
              : ariaLabel
        }
        aria-label={ariaLabel}
      >
        {showIcon && !rewardsLocked ? <SavvyPointsIcon size={12} /> : null}
        <span>{baseLabel}</span>
        {betaUnlocked && compact ? (
          <span className="savvy-reward-badge__beta-amt">+{reward.baseAfterTrust.toLocaleString()}</span>
        ) : null}
        {hasBoost ? (
          <span className="savvy-reward-badge__boost-chip">
            <span className="savvy-reward-badge__mult">{multiplierLabel}</span>
            <span className="savvy-reward-badge__eq">=</span>
            <span className="savvy-reward-badge__boosted">+{tweenedBoosted.toLocaleString()}</span>
          </span>
        ) : null}
      </span>
    );
  }

  return (
    <div
      className={`rounded-xl border px-3 py-2.5 ${tierClass.wrap} ${className}`}
      role="status"
      aria-label={ariaLabel}
    >
      <div className="flex items-center justify-between gap-2">
        <div className={`inline-flex items-center gap-2 text-[12px] ${tierClass.text}`}>
          {showIcon && !rewardsLocked ? (
            <SavvyPointsIcon size={18} glow className="shrink-0" />
          ) : (
            <span className="text-base" aria-hidden>
              🔒
            </span>
          )}
          <span className="font-semibold">
            {rewardsLocked
              ? reward.tier === "unverified"
                ? "Unverified seller"
                : "Low trust listing"
              : betaUnlocked
                ? betaFullLabel
                : reward.tier === "medium"
                  ? "Reduced — medium trust"
                  : "Full payout — high trust"}
          </span>
        </div>
        <div className={`flex flex-wrap items-baseline justify-end gap-x-1.5 gap-y-0.5 text-sm font-extrabold ${tierClass.accent}`}>
          <span>{baseLabel}</span>
          {hasBoost ? (
            <span className="savvy-reward-badge__boost">
              <span className="savvy-reward-badge__paren">(</span>
              <span className="savvy-reward-badge__mult" key={multiplierLabel}>
                {multiplierLabel}
              </span>
              <span className="savvy-reward-badge__eq">=</span>
              <span
                className="savvy-reward-badge__boosted"
                key={reward.boosted}
              >
                +{tweenedBoosted.toLocaleString()}
              </span>
              <span className="savvy-reward-badge__paren">)</span>
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}

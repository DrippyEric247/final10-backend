import React, { useEffect, useMemo, useRef, useState } from "react";
import { SavvyPointsIcon } from "./SavvyPointsIcon";
import { useFinal10Power } from "../../context/Final10PowerContext";
import { getDevFeatureTests, isDev } from "../../lib/devOverride";
import { getEffectiveSubscriptionTier, getTierMultiplier } from "../../lib/tierMultiplier";

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
 * Pure computation hook — expose so cards that need the number outside the
 * visual badge (e.g. a "gem burst" animation) can stay consistent.
 *
 * Returned shape:
 *  - `base`: raw, un-adjusted base Savvy from the caller.
 *  - `baseAfterTrust`: the listing-trust adjusted base (this is the "+113"
 *    number users see before any user-multiplier boost).
 *  - `boosted`: `baseAfterTrust * userMultiplier`, rounded.
 *  - `final`: alias of `boosted` (kept for backwards compatibility).
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
  const userMult = Math.max(0, Number(multiplier) || 1);
  const baseAfterTrust = Math.max(0, Math.round(base * trustMult));
  const boosted = Math.max(0, Math.round(baseAfterTrust * userMult));
  return {
    tier,
    base,
    baseAfterTrust,
    boosted,
    final: boosted,
    trustMultiplier: trustMult,
    userMultiplier: userMult,
  };
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
 * Read the user's active Savvy multiplier from the global Final10 Power
 * context. Falls back to `1` (no boost) when the context isn't mounted —
 * lets the badge keep working in isolated stories/tests.
 */
function useUserMultiplier() {
  const { snapshot } = useFinal10Power();
  const value = Number(snapshot?.currentMultiplier);
  const powerMult = Number.isFinite(value) && value > 0 ? value : 1;
  let tierMult = getTierMultiplier();
  if (isDev && getDevFeatureTests().premiumBadges && getEffectiveSubscriptionTier() === "free") {
    tierMult = getTierMultiplier("core");
  }
  return Math.max(1, powerMult * tierMult);
}

/**
 * @param {{
 *   baseSavvy?: number,   // caller-computed base (pre-trust) Savvy
 *   trustScore: number,   // 0–100
 *   price?: number,       // fallback for auto-computing base
 *   savings?: number,     // fallback for auto-computing base
 *   multiplier?: number,  // explicit override; otherwise pulled from context
 *   live?: boolean,       // use "Earn" instead of "Est. earn" prefix
 *   compact?: boolean,    // chip-style (single line, smaller)
 *   className?: string,
 *   showIcon?: boolean,   // default true
 * }} props
 */
export default function SavvyRewardBadge({
  baseSavvy,
  trustScore,
  price,
  savings,
  multiplier,
  live = false,
  compact = false,
  className = "",
  showIcon = true,
}) {
  const contextMultiplier = useUserMultiplier();
  // Caller may pass an explicit override (e.g. promo cards). Otherwise we
  // read the user's live multiplier from global state.
  const effectiveMultiplier =
    multiplier != null && Number.isFinite(Number(multiplier))
      ? Math.max(0, Number(multiplier))
      : contextMultiplier;

  const reward = useMemo(
    () =>
      computeSavvyReward({
        baseSavvy,
        trustScore,
        price,
        savings,
        multiplier: effectiveMultiplier,
      }),
    [baseSavvy, trustScore, price, savings, effectiveMultiplier]
  );

  const tweenedBoosted = useTweenedNumber(reward.boosted);
  const rewardsLocked = reward.tier === "low" || reward.tier === "unverified";
  const tierClass = TIER_CLASSES[reward.tier] || TIER_CLASSES.medium;
  const prefix = live ? "Earn" : "Est. earn";
  // Treat values within 1% of 1.0x as "no boost" so floating-point noise
  // doesn't flicker the boost suffix on/off.
  const hasBoost = !rewardsLocked && reward.userMultiplier > 1.01;
  const baseLabel = rewardsLocked
    ? "🔒 Rewards locked"
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
        title={rewardsLocked ? "No rewards are issued on low-trust or unverified listings." : ariaLabel}
        aria-label={ariaLabel}
      >
        {showIcon && !rewardsLocked ? <SavvyPointsIcon size={12} /> : null}
        <span>{baseLabel}</span>
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

/**
 * Universal boost strip reads Final10 Power System (single source of truth).
 * @see final10PowerEngine.js — formula + persistence
 * @see final10PowerConfig.js — tunable numbers
 */

import { getPowerBarView } from "./final10PowerEngine";
import { POWER, POWER_TIERS, POWER_UX } from "./final10PowerConfig";

/** @deprecated Use getPowerSnapshot().currentPowerPoints */
export function computeActivityPoints() {
  return getPowerBarView().currentPowerPoints;
}

function nextTierLabelForTarget(target) {
  const ascending = [...POWER_TIERS].sort((a, b) => a.min - b.min);
  for (const t of ascending) {
    if (Math.abs(t.min - target) < 1e-5) return t.label;
  }
  if (target >= POWER.MAX_MULTIPLIER - 0.02) return "Peak";
  return "Next";
}

/** @returns {{ points: number, currentBoost: number, currentLabel: string, nextBoost: number|null, progressPercent: number, goalHint: string, multiplierDisplay?: string, currentTier?: string, currentTierKey?: string, tierTagline?: string, barTooltip?: string, oneLinePowerLabel?: string }} */
export function getUniversalBoostState() {
  const v = getPowerBarView();
  const tagline =
    POWER_UX.TIER_TAGLINE_BY_KEY[v.currentTierKey] ||
    POWER_UX.TIER_TAGLINE_BY_KEY.base;
  const gap = v.nextTierTarget - v.currentMultiplier;
  const atCap = v.currentMultiplier >= POWER.MAX_MULTIPLIER - 0.01;
  const goalHint = atCap
    ? "Peak tier"
    : `${nextTierLabelForTarget(v.nextTierTarget)} · ${gap >= 0.01 ? `${gap.toFixed(2)}x left` : "—"}`;

  return {
    points: v.currentPowerPoints,
    currentBoost: v.currentMultiplier,
    currentLabel: v.currentLabel,
    multiplierDisplay: v.multiplierDisplay,
    currentTier: v.currentTier,
    currentTierKey: v.currentTierKey,
    nextBoost: v.nextTierTarget,
    nextLabel: null,
    progressPercent: v.progressPercent,
    goalHint,
    tierTagline: tagline,
    barTooltip: POWER_UX.BAR_TOOLTIP,
    oneLinePowerLabel: `${v.multiplierDisplay} — ${tagline}`,
  };
}

export function formatBoost(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return "1.0x";
  const t = Math.round(x * 100) / 100;
  return `${t}x`;
}

/** Fired when a profile daily task completes — universal bar flashes + recomputes. */
export const UNIVERSAL_BAR_TASK_PULSE_EVENT = "f10-universal-bar-task-pulse";

/** Call after local activity writes (same tab). */
export function notifyUniversalProgressRefresh() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("f10-universal-progress-refresh"));
  window.dispatchEvent(new CustomEvent("f10-power-core-updated"));
}

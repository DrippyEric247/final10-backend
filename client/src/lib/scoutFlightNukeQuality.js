/**
 * Nuke Flight visual quality tiers.
 *
 * Gameplay never depends on the tier — only particle budgets, shake, and flash do.
 * Reduced-motion always wins so the Nuke atmosphere survives without the motion.
 */

import { NUKE_DEBRIS_LIMITS, NUKE_QUALITY_SCALE } from './scoutFlightNukeConfig';

export const NUKE_QUALITY = Object.freeze({
  HIGH: 'high',
  LOW: 'low',
  REDUCED: 'reduced',
});

export function prefersReducedMotion() {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

/**
 * Pick a tier from reduced-motion preference and coarse device capability hints.
 * @returns {'high'|'low'|'reduced'}
 */
export function detectNukeQualityTier() {
  if (prefersReducedMotion()) return NUKE_QUALITY.REDUCED;
  if (typeof navigator === 'undefined') return NUKE_QUALITY.HIGH;

  const cores = Number(navigator.hardwareConcurrency) || 0;
  const memory = Number(navigator.deviceMemory) || 0;
  if ((cores && cores <= 4) || (memory && memory <= 4)) return NUKE_QUALITY.LOW;

  const dpr = typeof window !== 'undefined' ? Number(window.devicePixelRatio) || 1 : 1;
  const narrow = typeof window !== 'undefined' && window.innerWidth <= 480;
  if (narrow && dpr >= 3) return NUKE_QUALITY.LOW;

  return NUKE_QUALITY.HIGH;
}

/** @param {'high'|'low'|'reduced'} tier */
export function getDebrisLimits(tier) {
  return NUKE_DEBRIS_LIMITS[tier] || NUKE_DEBRIS_LIMITS.high;
}

/** @param {'high'|'low'|'reduced'} tier */
export function getQualityScale(tier) {
  const scale = NUKE_QUALITY_SCALE[tier];
  return typeof scale === 'number' ? scale : 1;
}

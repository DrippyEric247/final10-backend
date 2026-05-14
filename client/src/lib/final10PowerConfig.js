/**
 * Final10 Power System — tune all formula inputs here.
 *
 * Formula (additive boosts on top of 1.0x base):
 *   total = min(MAX_MULTIPLIER, 1 + activity + streak + skill + promo + sync)
 *
 * Tier labels map to total multiplier ranges in final10PowerEngine.js
 */
export const POWER = {
  /** Hard cap on displayed total multiplier */
  MAX_MULTIPLIER: 5.5,

  /** Per-event increments toward capped buckets (not all are 1:1 with displayed x) */
  INCREMENTS: {
    save: 0.05,
    dealView: 0.02,
    dailyLogin: 0.05,
    skillLowCompetition: 0.1,
    skillAiGem: 0.15,
    skillSnipeOrCloser: 0.2,
    /** Promo boost is derived live from promoted count × this (see CAPS.promo) */
    promoPerItem: 0.1,
  },

  /** Maximum contribution from each boost family (additive caps) */
  CAPS: {
    activity: 0.5,
    skill: 0.65,
    promo: 0.5,
    sync: 0.5,
  },

  /**
   * Login streak (consecutive local calendar days with a login) → boost.
   * Highest matching row wins (not stacked).
   */
  LOGIN_STREAK_BOOST: [
    { minDays: 7, boost: 0.4 },
    { minDays: 5, boost: 0.25 },
    { minDays: 3, boost: 0.15 },
    { minDays: 2, boost: 0.1 },
  ],

  /** Momentum messaging: actions within this window count together */
  MOMENTUM_WINDOW_MS: 45_000,
  MOMENTUM_MESSAGES: [
    { min: 6, text: "LOCKED IN" },
    { min: 4, text: "You're heating up 🔥" },
    { min: 2, text: "Momentum building…" },
  ],

  /** UI pop numbers (decoupled from raw 0.05 increments for readability) */
  DISPLAY: {
    savePowerPop: 14,
    dealViewPowerPop: 3,
    dailyLoginPowerPop: 8,
    skillGemPowerPop: 12,
    snipePowerPop: 18,
    scanPowerPop: 11,
  },

  /** AI assistant: within this delta of next tier threshold → nudge */
  NEAR_TIER_DELTA: 0.07,

  /** Throttle duplicate near-tier assistant signals per tier step */
  ASSISTANT_NEAR_TIER_COOLDOWN_MS: 120_000,
};

/** Tier display names by minimum multiplier (inclusive lower bound) */
export const POWER_TIERS = [
  { min: 4.0, key: "savvy_god", label: "Savvy God" },
  { min: 3.0, key: "elite", label: "Elite" },
  { min: 2.5, key: "heating_up", label: "Heating Up" },
  { min: 2.0, key: "locked_in", label: "Locked In" },
  { min: 1.5, key: "active", label: "Active" },
  { min: 1.0, key: "base", label: "Base" },
];

/**
 * Copy + micro-labels for the universal bar (no formula impact).
 */
export const POWER_UX = {
  /** Native tooltip on the power readout */
  BAR_TOOLTIP:
    "Do actions → gain Power → climb tiers. Saves, scans, deals, and promos all count.",
  /** Always-visible one-liner under the bar */
  BAR_HINT_LINE: "Do actions → gain Power → earn more",
  /** Shown as “1.5x — You're Active” */
  TIER_TAGLINE_BY_KEY: {
    base: "Keep going",
    active: "You're Active",
    locked_in: "Locked In",
    heating_up: "Heating Up",
    elite: "Elite",
    savvy_god: "Savvy God",
  },
  /** Small toast when local tasks tick */
  TASK_STEP_POWER_POP: 6,
  PROMO_POWER_POP: 10,
};

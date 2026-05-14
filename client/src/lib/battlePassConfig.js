/**
 * Battle Pass — season layout, XP grants, rewards (tune here).
 * Integrates with Power via f10_bp_power_lint (read in final10PowerEngine).
 */

export const BATTLE_PASS_SEASON = {
  id: "neon_hunt_s1",
  name: "Neon Hunt",
  subtitle: "Season 1 · Deals & auctions",
  /** CSS variable seeds for BattlePassPage */
  theme: {
    "--bp-accent": "#22d3ee",
    "--bp-accent-2": "#a855f7",
    "--bp-gold": "#fbbf24",
    "--bp-track": "rgba(15, 23, 42, 0.92)",
    "--bp-premium-glow": "rgba(251, 191, 36, 0.45)",
  },
};

/**
 * Cumulative XP required to **complete** tier N (index 0 = tier 1).
 * e.g. at 50 XP you've finished tier 1.
 */
export const BATTLE_PASS_CUMULATIVE_XP = [
  50, 120, 210, 320, 450, 600, 780, 980, 1200, 1450,
];

/** @typedef {{ type: 'points'|'emblem'|'card'|'boost'|'bp_xp', value?: number, id?: string, label: string }} BPReward */

/** @type {{ level: number; free: BPReward; premium: BPReward }[]} */
export const BATTLE_PASS_TIERS = [
  { level: 1, free: { type: "points", value: 40, label: "+40 pts" }, premium: { type: "bp_xp", value: 35, label: "Bonus 35 BP XP" } },
  { level: 2, free: { type: "boost", value: 0.02, label: "+0.02x Power (season)" }, premium: { type: "points", value: 80, label: "+80 pts" } },
  { level: 3, free: { type: "points", value: 55, label: "+55 pts" }, premium: { type: "emblem", id: "sigil_bp_neon", label: "Neon Sigil emblem" } },
  { level: 4, free: { type: "bp_xp", value: 50, label: "+50 BP XP" }, premium: { type: "card", id: "card_bp_neon_lane", label: "Neon Lane card" } },
  { level: 5, free: { type: "boost", value: 0.02, label: "+0.02x Power (season)" }, premium: { type: "points", value: 120, label: "+120 pts" } },
  { level: 6, free: { type: "points", value: 70, label: "+70 pts" }, premium: { type: "boost", value: 0.03, label: "+0.03x Power (season)" } },
  { level: 7, free: { type: "emblem", id: "sigil_bp_hunter", label: "Hunter emblem" }, premium: { type: "points", value: 150, label: "+150 pts" } },
  { level: 8, free: { type: "card", id: "card_bp_strike", label: "Strike card" }, premium: { type: "bp_xp", value: 100, label: "+100 BP XP" } },
  { level: 9, free: { type: "points", value: 90, label: "+90 pts" }, premium: { type: "boost", value: 0.03, label: "+0.03x Power (season)" } },
  { level: 10, free: { type: "card", id: "card_bp_finale", label: "Finale card" }, premium: { type: "emblem", id: "sigil_bp_apex", label: "Apex emblem" } },
];

/** XP per action source (additive when event fires) */
export const BATTLE_PASS_XP = {
  save_item: 15,
  scan: 25,
  task_step: 20,
  tasks_complete_bonus: 55,
  daily_login: 10,
  auction_win: 45,
  promote: 12,
  deal_view: 5,
  bundle_snipe: 35,
  /** Profile weekly task streak increased (cleared all dailies for another week). */
  streak_week: 28,
  /** Season mission rewards pass explicit XP via overrideAmount. */
  bp_season_task: 0,
};

export const BP_STORAGE_KEY = "f10_battle_pass_state_v1";
export const BP_COSMETIC_KEY = "f10_bp_unlocked_cosmetics";
export const BP_POWER_LINT_KEY = "f10_bp_power_lint";
export const BP_PREMIUM_KEY_PREFIX = "f10_bp_premium_";

export const BP_UPDATE_EVENT = "f10-battlepass-update";
export const BP_TIER_COMPLETE_EVENT = "f10-battlepass-tier-complete";

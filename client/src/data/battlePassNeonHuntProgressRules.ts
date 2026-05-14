import type { TaskProgressRule } from "../types/battlePassProgress";

/**
 * Progress rules for Neon Hunt S1 — aligned with `NEON_HUNT_TASK_SEASON` task ids.
 * Tweak thresholds here without touching matcher code.
 */
export const NEON_HUNT_PROGRESS_RULES_BY_TASK_ID: Record<string, TaskProgressRule> = {
  nh_daily_scan_grid: {
    kind: "count",
    actionTypes: ["auction_scanned"],
    endingSoonSecondsMax: 600,
  },
  nh_daily_quick_trigger: {
    kind: "count",
    actionTypes: ["bid_placed"],
    secondsRemainingAtMost: 600,
  },
  nh_daily_power_charge: {
    kind: "count",
    actionTypes: ["power_boost_claimed", "daily_login_claimed"],
  },
  nh_weekly_auction_hunter: {
    kind: "count",
    actionTypes: ["auction_won"],
  },
  nh_weekly_momentum: {
    kind: "accumulate",
    actionTypes: ["savvy_points_earned"],
  },
  nh_weekly_locked_in: {
    kind: "threshold",
    actionTypes: ["streak_updated"],
  },
  nh_season_neon_snipe: {
    kind: "count",
    actionTypes: ["auction_won"],
    secondsRemainingAtMost: 10,
  },
  nh_season_climb: {
    kind: "accumulate",
    actionTypes: ["rank_changed"],
  },
  nh_season_power_surge: {
    kind: "threshold",
    actionTypes: ["power_multiplier_changed"],
    multiplierAtLeast: 1.5,
  },
  nh_season_full_override: {
    kind: "count",
    actionTypes: ["task_completed"],
    sourceTaskTypes: ["daily", "weekly"],
    ignoreCompletedTaskIds: ["nh_season_full_override"],
  },
};

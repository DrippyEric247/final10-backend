import { buildRankedLeaderboard } from "../data/leaderboardMock";
import { getUniversalBoostState } from "./universalBoostProgress";

function numLS(key) {
  try {
    const v = Number(localStorage.getItem(key));
    return Number.isFinite(v) ? v : 0;
  } catch {
    return 0;
  }
}

function readWeeklyActivity(weekKey) {
  try {
    const raw = JSON.parse(localStorage.getItem("f10_weekly_activity_scores") || "{}");
    const v = raw?.[weekKey];
    return Number.isFinite(Number(v)) ? Number(v) : 0;
  } catch {
    return 0;
  }
}

function getCurrentRank(ctx) {
  if (!ctx.authUser) return 99;
  const rows = buildRankedLeaderboard(ctx.authUser);
  const row = rows.find((r) => r.isCurrentUser);
  return row?.rank ?? 99;
}

/**
 * Mock / sim keys (f10_bp_sim_*) are for demos; replace with API-driven writes later.
 * @param {string} key
 * @param {import("../types/battlePassTasks").TaskResolverContext} ctx
 */
export function resolveTaskMetric(key, ctx) {
  switch (key) {
    case "placeholder_always_zero":
      return 0;

    case "scan_ending_soon":
      return Math.max(numLS("f10_bp_metric_scan_ending"), numLS("f10_bp_sim_scan_ending"));

    case "bid_final_ten":
      return Math.max(numLS("f10_bp_metric_final_bids"), numLS("f10_bp_sim_final_bids"));

    case "daily_power_claimed": {
      const last = localStorage.getItem("f10_bp_last_power_claim_day") || "";
      if (last === ctx.localYmd) return 1;
      return numLS("f10_bp_sim_power_claimed");
    }

    case "auction_wins_week": {
      const total = Math.max(numLS("f10_auction_wins"), numLS("f10_bp_sim_auction_wins"));
      return Math.max(0, total - (ctx.weekStartAuctionWins || 0));
    }

    case "savvy_points_week":
      return Math.max(readWeeklyActivity(ctx.weekKey), numLS("f10_bp_sim_savvy_week"));

    case "streak_days_best": {
      let bundle = 0;
      try {
        const raw = JSON.parse(localStorage.getItem("f10_bundle_streak_data") || "{}");
        bundle = Number(raw.streak) || 0;
      } catch {
        /* ignore */
      }
      let tw = 0;
      try {
        const raw = JSON.parse(localStorage.getItem("f10_task_streak_data") || "{}");
        tw = Number(raw.streak) || 0;
      } catch {
        /* ignore */
      }
      const sim = numLS("f10_bp_sim_streak_days");
      return Math.max(bundle, tw, sim);
    }

    case "neon_snipe_win":
      return Math.min(1, Math.max(numLS("f10_bp_metric_neon_snipe"), numLS("f10_bp_sim_neon_snipe")));

    case "rank_gain_season": {
      if (ctx.seasonRankAnchor == null) return 0;
      const current = getCurrentRank(ctx);
      return Math.max(0, ctx.seasonRankAnchor - current);
    }

    case "power_multiplier_threshold": {
      const m = getUniversalBoostState().currentBoost;
      return m >= 1.5 - 1e-6 ? 1 : 0;
    }

    case "season_missions_completed_tally":
      return Math.max(0, Math.floor(ctx.seasonMissionTally));

    default:
      return 0;
  }
}

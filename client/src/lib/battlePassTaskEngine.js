import { buildRankedLeaderboard } from "../data/leaderboardMock";
import { grantBpMissionRewards } from "./battlePassEngine";
import { resolveTaskMetric } from "./battlePassTaskResolvers";

export const BP_THEME_TASK_STORAGE_KEY = "f10_bp_theme_tasks_v1";

function localYmd(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function isoWeekKey(d = new Date()) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

function safeJson(key, fallback) {
  try {
    const v = JSON.parse(localStorage.getItem(key) || "null");
    return v ?? fallback;
  } catch {
    return fallback;
  }
}

function loadPersist(seasonId) {
  const raw = safeJson(BP_THEME_TASK_STORAGE_KEY, null);
  const dailyKey = localYmd();
  const weeklyKey = isoWeekKey();
  const base = {
    seasonId,
    dailyKey,
    weeklyKey,
    seasonRankAnchor: null,
    weekStartAuctionWins: 0,
    progress: {},
    grantedSignatures: {},
    seasonMissionTally: 0,
  };
  if (!raw || raw.seasonId !== seasonId) {
    return base;
  }
  return {
    ...base,
    ...raw,
    progress: typeof raw.progress === "object" && raw.progress ? raw.progress : {},
    grantedSignatures:
      typeof raw.grantedSignatures === "object" && raw.grantedSignatures ? raw.grantedSignatures : {},
    seasonMissionTally: Number(raw.seasonMissionTally) || 0,
    weekStartAuctionWins: Number(raw.weekStartAuctionWins) || 0,
    seasonRankAnchor:
      raw.seasonRankAnchor != null && Number.isFinite(Number(raw.seasonRankAnchor))
        ? Number(raw.seasonRankAnchor)
        : null,
  };
}

function savePersist(p) {
  try {
    localStorage.setItem(BP_THEME_TASK_STORAGE_KEY, JSON.stringify(p));
  } catch {
    /* ignore */
  }
}

function numLS(key) {
  try {
    const v = Number(localStorage.getItem(key));
    return Number.isFinite(v) ? v : 0;
  } catch {
    return 0;
  }
}

function periodSignature(task, dailyKey, weeklyKey) {
  if (task.type === "daily") return `d:${dailyKey}`;
  if (task.type === "weekly") return `w:${weeklyKey}`;
  return "season";
}

function grantSignature(taskId, period) {
  return `${taskId}@${period}`;
}

function applyGrant(task) {
  const { reward } = task;
  const payload = {
    xp: reward.xp,
    savvyPoints: reward.savvyPoints,
  };
  if (reward.bonus?.kind === "power_lint" && reward.bonus.value) {
    payload.powerLintDelta = reward.bonus.value;
  }
  if (reward.bonus?.kind === "cosmetic" && reward.bonus.id) {
    payload.cosmeticId = reward.bonus.id;
  }
  grantBpMissionRewards(payload);
}

function currentRank(authUser) {
  if (!authUser) return 99;
  const rows = buildRankedLeaderboard(authUser);
  const row = rows.find((r) => r.isCurrentUser);
  return row?.rank ?? 99;
}

/**
 * Sync progress, handle daily/weekly resets, grant rewards, return view models.
 * @param {{ season: import("../types/battlePassTasks").SeasonDefinition; authUser: import("../types/battlePassTasks").TaskResolverContext["authUser"] }} opts
 * @returns {import("../types/battlePassTasks").BattlePassTaskViewModel[]}
 */
export function syncThemedBattlePassTasks(opts) {
  const { season, authUser } = opts;
  const seasonId = season.id;
  const dailyKey = localYmd();
  const weeklyKey = isoWeekKey();

  let p = loadPersist(seasonId);

  if (p.dailyKey !== dailyKey) {
    for (const t of season.tasks) {
      if (t.type === "daily") delete p.progress[t.id];
    }
    Object.keys(p.grantedSignatures).forEach((k) => {
      if (k.includes("@d:")) delete p.grantedSignatures[k];
    });
    p.dailyKey = dailyKey;
  }

  if (p.weeklyKey !== weeklyKey) {
    for (const t of season.tasks) {
      if (t.type === "weekly") delete p.progress[t.id];
    }
    Object.keys(p.grantedSignatures).forEach((k) => {
      if (k.includes("@w:")) delete p.grantedSignatures[k];
    });
    p.weekStartAuctionWins = numLS("f10_auction_wins");
    p.weeklyKey = weeklyKey;
  }

  if (p.seasonRankAnchor == null && authUser) {
    p.seasonRankAnchor = currentRank(authUser);
  }

  const tallyLast = season.tasks.filter((t) => t.metricKey === "season_missions_completed_tally");
  const rest = season.tasks.filter((t) => t.metricKey !== "season_missions_completed_tally");
  const ordered = [...rest, ...tallyLast];

  const view = [];

  for (const task of ordered) {
    const ctx = {
      localYmd: dailyKey,
      weekKey: weeklyKey,
      authUser,
      seasonRankAnchor: p.seasonRankAnchor,
      weekStartAuctionWins: p.weekStartAuctionWins,
      seasonMissionTally: p.seasonMissionTally,
    };

    const live = resolveTaskMetric(task.metricKey, ctx);
    const prev = Number(p.progress[task.id]) || 0;
    const merged = Math.min(task.requirement, Math.max(prev, live));
    p.progress[task.id] = merged;

    const period = periodSignature(task, dailyKey, weeklyKey);
    const gsig = grantSignature(task.id, period);
    const done = merged >= task.requirement;

    if (done && !p.grantedSignatures[gsig]) {
      applyGrant(task);
      p.grantedSignatures[gsig] = true;
      if (task.type === "daily" || task.type === "weekly") {
        p.seasonMissionTally += 1;
      }
    }

    view.push({
      ...task,
      progress: merged,
      completed: done,
    });
  }

  savePersist(p);
  return view;
}

/** Dev / mock: bump a sim metric counter */
export function bumpBpTaskSimMetric(key, delta = 1) {
  const map = {
    scan_ending_soon: "f10_bp_sim_scan_ending",
    bid_final_ten: "f10_bp_sim_final_bids",
    daily_power_claimed: "f10_bp_sim_power_claimed",
    auction_wins_week: "f10_bp_sim_auction_wins",
    savvy_points_week: "f10_bp_sim_savvy_week",
    streak_days_best: "f10_bp_sim_streak_days",
    neon_snipe_win: "f10_bp_sim_neon_snipe",
  };
  const ls = map[key];
  if (!ls) return;
  try {
    const cur = Number(localStorage.getItem(ls)) || 0;
    localStorage.setItem(ls, String(cur + delta));
  } catch {
    /* ignore */
  }
}

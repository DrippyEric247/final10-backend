import { getDevFeatureTests, isDev } from "../lib/devOverride";

/**
 * @typedef {{
 *   userId: string;
 *   username: string;
 *   displayName: string;
 *   score: number;
 *   rankBadge: string;
 *   vipTier: number;
 *   emblemId: string;
 *   callingCardId: string;
 *   streakWeeks: number;
 *   taskStreakWeeks: number;
 *   bpTierCleared: number;
 *   bpXp: number;
 *   bpSeasonName: string;
 *   systemsCompleted: number;
 *   powerTierLabel: string;
 *   favoriteLane: string;
 * }} MockLeaderboardPlayer
 */

export {
  VIP_LABELS,
  LEADERBOARD_BRACKETS,
  getLeaderboardBracket,
  deriveRankBadge,
} from "../lib/leaderboardRanks";

/** @deprecated Demo players removed — use GET /api/leaderboard/players. */
export const MOCK_LEADERBOARD_PLAYERS = [];

function safeJson(key, fallback) {
  try {
    const v = JSON.parse(localStorage.getItem(key) || "null");
    return v ?? fallback;
  } catch {
    return fallback;
  }
}

/**
 * Legacy helper for rivalry/tasks — returns only the signed-in user when present.
 * Main leaderboard page uses the server API.
 * @param {{ id?: string|number; username?: string; firstName?: string; email?: string; savvyPoints?: number } | null} authUser
 */
export function buildRankedLeaderboard(authUser) {
  if (!authUser) return [];

  const savvyBal = Math.max(0, Math.round(Number(authUser.savvyPoints) || 0));
  const meta = safeJson("f10_leaderboard_meta", {});
  const boostedFallback = Math.max(0, Math.floor(Number(meta.leaderboardScore) || 0));
  const vip = safeJson("f10_vip_rank_data", {});
  let vipTier = Math.min(5, Math.max(0, Number(vip.tier) || 0));
  if (isDev && getDevFeatureTests().leaderboardEffects) {
    vipTier = Math.max(vipTier, 4);
  }
  const savvy = safeJson("f10_savvy_sync_state", {});
  const systemsDone = Number(savvy.completedSystemsCount) || 0;

  let emblemId = "sigil_starter";
  let callingCardId = "card_default";
  try {
    emblemId = localStorage.getItem("f10_equipped_emblem") || emblemId;
    callingCardId = localStorage.getItem("f10_equipped_calling_card") || callingCardId;
  } catch {
    /* ignore */
  }

  const uname =
    authUser.username ||
    (authUser.email && String(authUser.email).split("@")[0]) ||
    "You";
  const display = authUser.firstName || uname;

  return [
    {
      userId: String(authUser.id ?? `local-${uname}`),
      username: uname,
      displayName: display,
      score: savvyBal || boostedFallback || 0,
      rankBadge: "Rising",
      vipTier,
      emblemId,
      callingCardId,
      streakWeeks: Number(meta.streakWeeks) || 0,
      taskStreakWeeks: Number(meta.taskStreakWeeks) || 0,
      bpTierCleared: 0,
      bpXp: 0,
      bpSeasonName: "Beta Season",
      systemsCompleted: Math.min(6, systemsDone),
      powerTierLabel: "—",
      favoriteLane: "Your loadout",
      isCurrentUser: true,
      rank: 1,
    },
  ];
}

import { MOCK_LEADERBOARD_PLAYERS } from "./leaderboardMock";

export const DEFAULT_RIVAL_USER_ID = "mock-1";

/** Swap for CMS / API — drives chase reward copy. */
export const MOCK_CHASE_REWARD = {
  passBonusXp: 250,
  streakLine: "Close the gap this week for a streak boost",
};

/** Mock-only fields layered on leaderboard rows — replace with API. */
export const RIVAL_EXTRA_BY_USER_ID = {
  "mock-1": { powerMultiplier: 2.28, auctionsWon: 14, savvyPointsThisWeek: 168 },
  "mock-2": { powerMultiplier: 2.02, auctionsWon: 11, savvyPointsThisWeek: 155 },
  "mock-3": { powerMultiplier: 1.88, auctionsWon: 9, savvyPointsThisWeek: 140 },
  "mock-4": { powerMultiplier: 1.62, auctionsWon: 6, savvyPointsThisWeek: 118 },
  "mock-5": { powerMultiplier: 1.45, auctionsWon: 5, savvyPointsThisWeek: 102 },
  "mock-6": { powerMultiplier: 1.32, auctionsWon: 3, savvyPointsThisWeek: 88 },
  "mock-7": { powerMultiplier: 1.22, auctionsWon: 2, savvyPointsThisWeek: 76 },
  "mock-8": { powerMultiplier: 1.55, auctionsWon: 7, savvyPointsThisWeek: 95 },
};

const KNOWN_IDS = new Set(MOCK_LEADERBOARD_PLAYERS.map((p) => p.userId));

/**
 * Map `?versus=` to a mock userId. Defaults to NeonSniper for instant testing.
 * @param {string | null} raw
 */
export function resolveRivalUserId(raw) {
  if (!raw || !raw.trim()) return DEFAULT_RIVAL_USER_ID;
  const s = raw.trim();
  if (KNOWN_IDS.has(s)) return s;
  const lower = s.toLowerCase();
  if (lower === "neon" || lower === "neonsniper" || lower === "mock-1") return "mock-1";
  const byName = MOCK_LEADERBOARD_PLAYERS.find(
    (p) => p.username.toLowerCase() === lower || p.displayName.toLowerCase() === lower
  );
  return byName?.userId ?? DEFAULT_RIVAL_USER_ID;
}

/**
 * @param {string} userId
 * @param {{ userId: string; rank: number }[]} rankedRows
 */
export function buildThemStatsFromRanked(userId, rankedRows) {
  const p = MOCK_LEADERBOARD_PLAYERS.find((x) => x.userId === userId);
  if (!p) return null;
  const row = rankedRows.find((r) => r.userId === userId);
  const rank = row?.rank ?? rankedRows.length + 2;
  const ex = RIVAL_EXTRA_BY_USER_ID[userId] ?? {
    powerMultiplier: 1.35,
    auctionsWon: 0,
    savvyPointsThisWeek: 80,
  };
  return {
    userId: p.userId,
    displayName: p.displayName,
    leaderboardScore: p.score,
    leaderboardRank: rank,
    powerMultiplier: ex.powerMultiplier,
    bundleStreakWeeks: p.streakWeeks,
    taskStreakWeeks: p.taskStreakWeeks,
    vipTier: p.vipTier,
    seasonTiersCleared: p.bpTierCleared,
    auctionsWon: ex.auctionsWon,
    savvyPointsThisWeek: ex.savvyPointsThisWeek,
  };
}

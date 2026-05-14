import { MOCK_CHASE_REWARD } from "../data/rivalryMock.js";
import { VIP_LABELS } from "../data/leaderboardMock";

function vipLine(tier) {
  const t = Math.min(5, Math.max(0, tier));
  const label = VIP_LABELS[t] || "—";
  return label ? `T${t} · ${label}` : `T${t}`;
}

function cmpHigher(a, b) {
  if (a === b) return "tie";
  return a > b ? "you" : "them";
}

/** Lower rank # is better (1 beats 8). */
function cmpRank(youRank, themRank) {
  if (youRank === themRank) return "tie";
  return youRank < themRank ? "you" : "them";
}

export function computeRivalryStatus(you, them) {
  const scoreBehind = them.leaderboardScore - you.leaderboardScore;
  const rankBehind = you.leaderboardRank - them.leaderboardRank;

  const scoreTight = Math.abs(scoreBehind) <= Math.max(900, them.leaderboardScore * 0.07);
  const rankTight = Math.abs(rankBehind) <= 2;
  if (scoreTight && rankTight) return "neck-and-neck";

  const aheadOnScore = you.leaderboardScore > them.leaderboardScore;
  const aheadOnRank = you.leaderboardRank < them.leaderboardRank;
  if (aheadOnScore && aheadOnRank) return "ahead";
  if (aheadOnScore && scoreBehind <= -500) return "ahead";
  if (aheadOnRank && scoreBehind < 2500) return "ahead";

  const chaseCeil = Math.max(3200, them.leaderboardScore * 0.2);
  if (scoreBehind > 0 && scoreBehind <= chaseCeil) return "close-chase";

  return "underdog-run";
}

function buildSummary(you, them, rivalStatus) {
  const scoreGap = Math.abs(you.leaderboardScore - them.leaderboardScore);
  const rankGap = Math.abs(you.leaderboardRank - them.leaderboardRank);
  const rankAhead = you.leaderboardRank < them.leaderboardRank;
  const rankGapLine =
    rankGap === 0
      ? "Rank gap: tied"
      : rankAhead
      ? `Rank gap: ${rankGap} place${rankGap === 1 ? "" : "s"} · you’re higher`
      : `Rank gap: ${rankGap} place${rankGap === 1 ? "" : "s"} to climb`;

  const shortThem =
    them.displayName.length > 14 ? `${them.displayName.slice(0, 12)}…` : them.displayName;

  let catchUpLine;
  let scoreGapLine;
  if (you.leaderboardScore >= them.leaderboardScore) {
    catchUpLine = `You’re ahead — defend the lead vs ${shortThem}.`;
    scoreGapLine =
      scoreGap === 0 ? "Score gap: tied" : `Score gap: ${scoreGap.toLocaleString()} (your lead)`;
  } else {
    const need = them.leaderboardScore - you.leaderboardScore;
    catchUpLine = `You need ${need.toLocaleString()} more to catch ${shortThem}.`;
    scoreGapLine = `Score gap: ${need.toLocaleString()}`;
  }

  return {
    scoreGap,
    rankGap,
    scoreGapLine,
    rankGapLine,
    catchUpLine,
    rivalStatus,
  };
}

export function buildRivalryComparison(you, them) {
  const rivalStatus = computeRivalryStatus(you, them);
  const summary = buildSummary(you, them, rivalStatus);

  const rows = [
    {
      id: "leaderboardScore",
      label: "Leaderboard score",
      winner: cmpHigher(you.leaderboardScore, them.leaderboardScore),
      youDisplay: you.leaderboardScore.toLocaleString(),
      themDisplay: them.leaderboardScore.toLocaleString(),
    },
    {
      id: "leaderboardRank",
      label: "Current rank",
      winner: cmpRank(you.leaderboardRank, them.leaderboardRank),
      youDisplay: `#${you.leaderboardRank}`,
      themDisplay: `#${them.leaderboardRank}`,
    },
    {
      id: "powerMultiplier",
      label: "Power multiplier",
      winner: cmpHigher(you.powerMultiplier, them.powerMultiplier),
      youDisplay: `${you.powerMultiplier.toFixed(2)}x`,
      themDisplay: `${them.powerMultiplier.toFixed(2)}x`,
    },
    {
      id: "bundleStreak",
      label: "Current streak",
      winner: cmpHigher(you.bundleStreakWeeks, them.bundleStreakWeeks),
      youDisplay: `${you.bundleStreakWeeks} wk`,
      themDisplay: `${them.bundleStreakWeeks} wk`,
    },
    {
      id: "taskStreak",
      label: "Task streak",
      winner: cmpHigher(you.taskStreakWeeks, them.taskStreakWeeks),
      youDisplay: `${you.taskStreakWeeks} wk`,
      themDisplay: `${them.taskStreakWeeks} wk`,
    },
    {
      id: "vipTier",
      label: "VIP tier",
      winner: cmpHigher(you.vipTier, them.vipTier),
      youDisplay: vipLine(you.vipTier),
      themDisplay: vipLine(them.vipTier),
    },
    {
      id: "seasonTiers",
      label: "Season tiers cleared",
      winner: cmpHigher(you.seasonTiersCleared, them.seasonTiersCleared),
      youDisplay: `${you.seasonTiersCleared}`,
      themDisplay: `${them.seasonTiersCleared}`,
    },
    {
      id: "auctionsWon",
      label: "Auctions won",
      winner: cmpHigher(you.auctionsWon, them.auctionsWon),
      youDisplay: `${you.auctionsWon}`,
      themDisplay: `${them.auctionsWon}`,
    },
    {
      id: "savvyWeekly",
      label: "Savvy pts (this week)",
      winner: cmpHigher(you.savvyPointsThisWeek, them.savvyPointsThisWeek),
      youDisplay: you.savvyPointsThisWeek.toLocaleString(),
      themDisplay: them.savvyPointsThisWeek.toLocaleString(),
    },
  ];

  return { rows, summary };
}

export function defaultChaseReward(them) {
  const name =
    them.displayName.length > 18 ? `${them.displayName.slice(0, 16)}…` : them.displayName;
  const xp = MOCK_CHASE_REWARD.passBonusXp;
  return {
    passBonusXp: xp,
    passTargetDisplayName: them.displayName,
    passLine: `Pass ${name} to unlock +${xp} bonus XP`,
    streakLine: MOCK_CHASE_REWARD.streakLine,
  };
}

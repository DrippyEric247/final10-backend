export function sortActivitiesByRecency(items) {
  return [...items].sort((a, b) => b.timestampMs - a.timestampMs);
}

export function formatActivityTimestamp(timestampMs, nowMs = Date.now()) {
  const diff = Math.max(0, nowMs - timestampMs);
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  return new Date(timestampMs).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function fallbackGoal() {
  return {
    id: "fallback",
    goalType: "fallback",
    title: "Keep your momentum",
    subtitle: "Every action moves you up the board.",
    progressCurrent: 0,
    progressTarget: 1,
    remainingLabel: "Next win waiting",
    reward: {
      headline: "+250 bonus XP",
      detail: "Mystery streak bonus",
      accent: "violet",
    },
    ctaLabel: "Keep Climbing",
    ctaActionId: "keep_climbing",
  };
}

/** Picks the most compelling next objective using priority + closeness heuristics. */
export function pickNextBestGoal(input) {
  const candidates = [];

  const {
    rivalDisplayName,
    pointsBehindRival,
    tasksCompleted,
    tasksTotal,
    streakWeeks,
    taskStreakWeeks,
    bpXp,
    bpMaxXp,
    bpCompletedTiers,
    bpTotalTiers,
    auctionsWon,
    auctionNextMilestoneAt,
    weeklyActivityScore,
    vipMaintainThreshold,
    vipPromoteThreshold,
    hasSilverRank,
    vipStatusMode,
    leaderboardRank,
    leaderboardScore,
  } = input;

  if (tasksTotal > 0 && tasksCompleted < tasksTotal) {
    const remaining = tasksTotal - tasksCompleted;
    const ratio = tasksCompleted / tasksTotal;
    candidates.push({
      score: 92 + ratio * 25,
      goal: {
        id: "tasks",
        goalType: "task_completion",
        title: remaining === 1 ? "One task left today" : `Complete ${remaining} more tasks`,
        subtitle: "Extend your streak and bank bonus points",
        progressCurrent: tasksCompleted,
        progressTarget: tasksTotal,
        remainingLabel: `${remaining} task${remaining === 1 ? "" : "s"}`,
        reward: {
          headline: "Power multiplier boost",
          detail: "Full clear = max daily bonus",
          accent: "cyan",
        },
        ctaLabel: remaining === 1 ? "Finish strong" : "Protect My Streak",
        ctaActionId: "finish_tasks",
      },
    });
  }

  if (
    rivalDisplayName &&
    pointsBehindRival != null &&
    pointsBehindRival > 0 &&
    pointsBehindRival < 25000
  ) {
    const closeness = 1 - Math.min(pointsBehindRival / 12000, 0.95);
    candidates.push({
      score: 88 + closeness * 30,
      goal: {
        id: "rank_chase",
        goalType: "rank_chase",
        title: `Pass ${rivalDisplayName}`,
        subtitle: "Close the gap on the leaderboard",
        progressCurrent: Math.max(0, leaderboardScore),
        progressTarget: leaderboardScore + pointsBehindRival,
        remainingLabel: `${pointsBehindRival.toLocaleString()} pts`,
        reward: {
          headline: "+250 bonus XP",
          detail: "New calling card on overtake",
          accent: "gold",
        },
        ctaLabel: "Chase Rank #1",
        ctaActionId: "chase_rank",
      },
    });
  }

  if (hasSilverRank && vipStatusMode === "atRisk") {
    const need = Math.max(0, vipMaintainThreshold - weeklyActivityScore);
    candidates.push({
      score: 86,
      goal: {
        id: "vip_risk",
        goalType: "streak_protection",
        title: "Protect VIP status",
        subtitle: `Stay above ${vipMaintainThreshold} weekly activity`,
        progressCurrent: weeklyActivityScore,
        progressTarget: vipMaintainThreshold,
        remainingLabel: `${need} activity pts`,
        reward: {
          headline: "VIP trial perk",
          detail: "Hold tier through Sunday",
          accent: "violet",
        },
        ctaLabel: "Protect My Streak",
        ctaActionId: "protect_vip",
      },
    });
  } else if (hasSilverRank && vipStatusMode === "unlocking") {
    const need = Math.max(0, vipPromoteThreshold - weeklyActivityScore);
    candidates.push({
      score: 78,
      goal: {
        id: "vip_promo",
        goalType: "vip_promotion",
        title: "Max out VIP this week",
        subtitle: `Hit ${vipPromoteThreshold} activity for full perks`,
        progressCurrent: weeklyActivityScore,
        progressTarget: vipPromoteThreshold,
        remainingLabel: `${need} activity pts`,
        reward: {
          headline: "VIP trial perk",
          detail: "Full VIP lane unlock",
          accent: "emerald",
        },
        ctaLabel: "Keep Climbing",
        ctaActionId: "vip_promote",
      },
    });
  }

  if (bpCompletedTiers < bpTotalTiers && bpMaxXp > 0) {
    const remainingXp = Math.max(0, bpMaxXp - bpXp);
    const ratio = bpXp / bpMaxXp;
    if (remainingXp > 0) {
      candidates.push({
        score: 74 + ratio * 22,
        goal: {
          id: "season",
          goalType: "season_completion",
          title: "Finish the season",
          subtitle: "Battle pass rewards waiting",
          progressCurrent: bpXp,
          progressTarget: bpMaxXp,
          remainingLabel: `${remainingXp.toLocaleString()} BP XP`,
          reward: {
            headline: "New calling card",
            detail: "Tier rewards + lint",
            accent: "violet",
          },
          ctaLabel: "Finish the Season",
          ctaActionId: "finish_season",
        },
      });
    }
  }

  const nextAuction =
    Math.ceil((auctionsWon + 1) / auctionNextMilestoneAt) * auctionNextMilestoneAt;
  const winsToBadge = Math.max(0, nextAuction - auctionsWon);
  if (winsToBadge > 0 && winsToBadge <= 5 && auctionsWon < nextAuction) {
    candidates.push({
      score: 70,
      goal: {
        id: "auction",
        goalType: "auction_milestone",
        title: `Win ${winsToBadge} more auction${winsToBadge === 1 ? "" : "s"}`,
        subtitle: "Unlock the next closer badge",
        progressCurrent: auctionsWon,
        progressTarget: nextAuction,
        remainingLabel: `${winsToBadge} win${winsToBadge === 1 ? "" : "s"}`,
        reward: {
          headline: "Badge + savvy spike",
          detail: "Shows on leaderboard row",
          accent: "gold",
        },
        ctaLabel: "Keep Climbing",
        ctaActionId: "auction_badge",
      },
    });
  }

  if (taskStreakWeeks > 0 && taskStreakWeeks < 7) {
    candidates.push({
      score: 65 + taskStreakWeeks * 2,
      goal: {
        id: "task_streak",
        goalType: "streak_protection",
        title: `${7 - taskStreakWeeks} weeks to a legendary task streak`,
        subtitle: "Don’t miss a weekly clear",
        progressCurrent: taskStreakWeeks,
        progressTarget: 7,
        remainingLabel: `${7 - taskStreakWeeks} wk`,
        reward: {
          headline: "+250 bonus XP",
          detail: "Streak milestone chest",
          accent: "cyan",
        },
        ctaLabel: "Protect My Streak",
        ctaActionId: "task_streak",
      },
    });
  }

  if (leaderboardRank > 1 && leaderboardRank <= 15) {
    candidates.push({
      score: 60,
      goal: {
        id: "top_rank",
        goalType: "rank_chase",
        title: `You’re #${leaderboardRank} — eyes on the podium`,
        subtitle: "Push score sync + power for the jump",
        progressCurrent: Math.max(0, 15 - leaderboardRank),
        progressTarget: 14,
        remainingLabel: `${leaderboardRank - 1} rank${leaderboardRank === 2 ? "" : "s"}`,
        reward: {
          headline: "Power multiplier boost",
          detail: "Top-3 spotlight flair",
          accent: "gold",
        },
        ctaLabel: "Chase Rank #1",
        ctaActionId: "podium_chase",
      },
    });
  }

  if (streakWeeks > 0 && streakWeeks < 4) {
    candidates.push({
      score: 58,
      goal: {
        id: "bundle_streak",
        goalType: "streak_protection",
        title: "Extend your bundle streak",
        subtitle: "Lock another weekly bundle",
        progressCurrent: streakWeeks,
        progressTarget: 4,
        remainingLabel: `${4 - streakWeeks} wk`,
        reward: {
          headline: "Savvy sync bonus",
          detail: "Multiplier stack",
          accent: "emerald",
        },
        ctaLabel: "Keep Climbing",
        ctaActionId: "bundle_streak",
      },
    });
  }

  if (!candidates.length) {
    return fallbackGoal();
  }

  candidates.sort((a, b) => b.score - a.score);
  return candidates[0].goal;
}

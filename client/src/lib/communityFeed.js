/**
 * Community milestone feed — merges server milestones with local win-feed highlights.
 */

import { listWins, computeWeeklyHighlights, computeFeedStats } from "./winFeed";

const FALLBACK_MILESTONES = [
  {
    id: "seed-beta-1",
    type: "beta_signup",
    headline: "Beta wave growing",
    detail: "New scouts joining the Savvy Universe every day.",
    icon: "🚀",
    createdAt: Date.now() - 2 * 3600000,
  },
  {
    id: "seed-goal-1",
    type: "goal_progress",
    headline: "Community goal climbing",
    detail: "Savvy Points pool passed the halfway mark toward our next reward.",
    icon: "🎯",
    createdAt: Date.now() - 5 * 3600000,
  },
  {
    id: "seed-share-1",
    type: "share",
    headline: "Shares stacking up",
    detail: "Members are spreading Final10 wins across socials.",
    icon: "📣",
    createdAt: Date.now() - 9 * 3600000,
  },
];

function formatMoney(n) {
  const num = Number(n) || 0;
  return num.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

function relativeTime(ts) {
  const t = Number(ts) || 0;
  if (!t) return "";
  const diff = Date.now() - t;
  const m = Math.round(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  return `${d}d ago`;
}

function winsToMilestones(wins) {
  const items = [];
  const highlights = computeWeeklyHighlights(wins);
  const stats = computeFeedStats(wins);

  if (highlights.biggestSave) {
    items.push({
      id: `win-big-${highlights.biggestSave.id}`,
      type: "big_save",
      headline: `$${formatMoney(highlights.biggestSave.savings)} saved`,
      detail: `${highlights.biggestSave.title} · @${highlights.biggestSave.username}`,
      icon: "💎",
      createdAt: highlights.biggestSave.createdAt || Date.now() - 3600000,
    });
  }

  if (highlights.weeklyTop) {
    items.push({
      id: `win-top-${highlights.weeklyTop.username}`,
      type: "weekly_winner",
      headline: `@${highlights.weeklyTop.username} leads this week`,
      detail: `${highlights.weeklyTop.wins} wins · $${formatMoney(highlights.weeklyTop.totalSavings)} saved`,
      icon: "👑",
      createdAt: Date.now() - 2 * 3600000,
    });
  }

  if (stats.totalWins >= 3) {
    items.push({
      id: "wins-milestone",
      type: "wins_milestone",
      headline: `${stats.totalWins} wins posted this week`,
      detail: `Community saved $${formatMoney(stats.totalSavings)} together`,
      icon: "🏆",
      createdAt: Date.now() - 4 * 3600000,
    });
  }

  const recent = [...wins]
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
    .slice(0, 3);

  for (const w of recent) {
    items.push({
      id: `win-post-${w.id}`,
      type: "new_win",
      headline: `@${w.username} posted a win`,
      detail: w.savings ? `Saved $${formatMoney(w.savings)} on ${w.title}` : w.title,
      icon: "✨",
      createdAt: w.createdAt || Date.now(),
    });
  }

  return items;
}

function normalizeServerMilestone(row) {
  return {
    id: String(row.id || row._id || Math.random()),
    type: row.type || "milestone",
    headline: row.headline || row.title || "Community milestone",
    detail: row.detail || row.message || "",
    icon: row.icon || "🌟",
    createdAt: row.createdAt ? new Date(row.createdAt).getTime() : Date.now(),
  };
}

/**
 * Build the merged feed for the Community Hub.
 * @param {Array<object>|null} serverMilestones
 */
export function buildCommunityFeed(serverMilestones) {
  const local = winsToMilestones(listWins());
  const remote = Array.isArray(serverMilestones)
    ? serverMilestones.map(normalizeServerMilestone)
    : [];

  const merged = [...remote, ...local, ...FALLBACK_MILESTONES];
  const seen = new Set();

  return merged
    .filter((item) => {
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    })
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
    .slice(0, 12)
    .map((item) => ({ ...item, relative: relativeTime(item.createdAt) }));
}

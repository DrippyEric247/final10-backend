/** Shared rank / bracket helpers for leaderboard UI. */

export const VIP_LABELS = [
  "",
  "VIP Bronze",
  "VIP Silver",
  "VIP Gold",
  "VIP Platinum",
  "VIP Legend",
];

export const LEADERBOARD_BRACKETS = [
  { id: "bronze", label: "Bronze", min: 0, max: 4999 },
  { id: "silver", label: "Silver", min: 5000, max: 9999 },
  { id: "gold", label: "Gold", min: 10000, max: 14999 },
  { id: "elite", label: "Elite", min: 15000, max: Number.POSITIVE_INFINITY },
];

export function getLeaderboardBracket(score) {
  const safe = Number(score || 0);
  return LEADERBOARD_BRACKETS.find((b) => safe >= b.min && safe <= b.max) || LEADERBOARD_BRACKETS[0];
}

export function deriveRankBadge(score, rank) {
  if (rank === 1) return "Champion";
  const bracket = getLeaderboardBracket(score);
  if (bracket.id === "elite") return "Elite";
  if (bracket.id === "gold") return "Gold";
  if (bracket.id === "silver") return "Silver";
  return bracket.label;
}

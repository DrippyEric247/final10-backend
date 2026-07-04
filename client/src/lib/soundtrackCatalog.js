/**
 * Client soundtrack metadata mirror (no private file paths).
 * Playback and downloads use authenticated `/api/soundtracks/*` routes.
 */

export const SOUNDTRACK_SOURCE_LABELS = Object.freeze({
  battle_pass: "Battle Pass",
  beta_founder: "Beta Founder",
  event: "Event",
  season_reward: "Season Reward",
});

export function soundtrackSourceLabel(source) {
  return SOUNDTRACK_SOURCE_LABELS[source] || "Savvy Universe";
}

import type { SeasonDefinition } from "../types/battlePassTasks";
import type { TaskProgressRule } from "../types/battlePassProgress";
import { NEON_HUNT_PROGRESS_RULES_BY_TASK_ID } from "./battlePassNeonHuntProgressRules";

/** No events match until real rules are registered for this task id. */
export const IDLE_TASK_PROGRESS_RULE: TaskProgressRule = {
  kind: "count",
  actionTypes: [],
};

const REGISTRY: Record<string, Record<string, TaskProgressRule>> = {
  neon_hunt_s1: NEON_HUNT_PROGRESS_RULES_BY_TASK_ID,
};

/**
 * Resolve rules for every task in a season. Unknown ids fall back to `IDLE_TASK_PROGRESS_RULE`.
 * Add new seasons to `REGISTRY` as they ship.
 */
export function resolveProgressRulesForSeason(season: SeasonDefinition): Record<string, TaskProgressRule> {
  const base = REGISTRY[season.id] ?? {};
  const out: Record<string, TaskProgressRule> = {};
  for (const t of season.tasks) {
    out[t.id] = base[t.id] ?? IDLE_TASK_PROGRESS_RULE;
  }
  return out;
}

/**
 * For tests / backend handoff: merge API-delivered rules over static registry.
 */
export function mergeSeasonProgressRules(
  season: SeasonDefinition,
  serverRules?: Record<string, TaskProgressRule> | null
): Record<string, TaskProgressRule> {
  const resolved = resolveProgressRulesForSeason(season);
  if (!serverRules) return resolved;
  return { ...resolved, ...serverRules };
}

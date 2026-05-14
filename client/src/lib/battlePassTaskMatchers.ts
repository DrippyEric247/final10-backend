import type { BattlePassActionEvent } from "../types/battlePassActionEvents";
import type { ActiveBattlePassTaskState, BattlePassProgressContext } from "../types/battlePassProgress";

/**
 * Max allowed `secondsRemaining` on the payload for the event to count (inclusive upper bound).
 * Undefined = no time gate.
 * For `auction_scanned` with no explicit rule caps, falls back to context (default 600).
 */
export function maxSecondsRemainingForPayload(
  task: ActiveBattlePassTaskState,
  ctx?: BattlePassProgressContext
): number | undefined {
  const parts: number[] = [];
  if (task.rule.secondsRemainingAtMost != null) parts.push(task.rule.secondsRemainingAtMost);
  if (task.rule.endingSoonSecondsMax != null) parts.push(task.rule.endingSoonSecondsMax);
  if (parts.length) return Math.min(...parts);
  if (task.rule.actionTypes.includes("auction_scanned")) {
    return ctx?.endingSoonSeconds ?? 600;
  }
  return undefined;
}

/**
 * Whether this event should be considered for the task at all (type + payload guards).
 */
export function doesTaskMatchEvent(
  task: ActiveBattlePassTaskState,
  event: BattlePassActionEvent,
  ctx?: BattlePassProgressContext
): boolean {
  if (task.completed) return false;
  if (!task.rule.actionTypes.includes(event.type)) return false;

  switch (event.type) {
    case "auction_scanned":
    case "bid_placed":
    case "auction_won": {
      const cap = maxSecondsRemainingForPayload(task, ctx);
      if (cap == null) return true;
      return event.payload.secondsRemaining <= cap;
    }
    case "task_completed": {
      const p = event.payload;
      if (task.rule.ignoreCompletedTaskIds?.includes(p.taskId)) return false;
      if (task.rule.sourceTaskTypes?.length) {
        return task.rule.sourceTaskTypes.includes(p.taskType);
      }
      return true;
    }
    case "power_multiplier_changed": {
      if (task.rule.multiplierAtLeast == null) return true;
      return event.payload.newMultiplier >= task.rule.multiplierAtLeast - 1e-9;
    }
    default:
      return true;
  }
}

/**
 * Non-negative delta to apply to progress (before clamping in the engine).
 */
export function getTaskProgressIncrement(
  task: ActiveBattlePassTaskState,
  event: BattlePassActionEvent,
  ctx?: BattlePassProgressContext
): number {
  if (!doesTaskMatchEvent(task, event, ctx)) return 0;

  switch (task.rule.kind) {
    case "count":
      return 1;
    case "accumulate": {
      if (event.type === "savvy_points_earned") {
        return Math.max(0, event.payload.amount);
      }
      if (event.type === "rank_changed") {
        const { previousRank, newRank } = event.payload;
        if (newRank >= previousRank) return 0;
        return Math.max(0, previousRank - newRank);
      }
      return 0;
    }
    case "threshold": {
      if (event.type === "streak_updated") {
        const target = Math.min(task.requirement, Math.max(0, event.payload.days));
        return Math.max(0, target - task.progress);
      }
      if (event.type === "power_multiplier_changed") {
        const minM = task.rule.multiplierAtLeast ?? 1.5;
        if (event.payload.newMultiplier + 1e-9 >= minM) {
          return Math.max(0, task.requirement - task.progress);
        }
        return 0;
      }
      return 0;
    }
    default:
      return 0;
  }
}

/**
 * Whether the task should be marked complete given clamped progress.
 */
export function shouldCompleteTask(
  task: ActiveBattlePassTaskState,
  nextProgress: number,
  event: BattlePassActionEvent,
  ctx?: BattlePassProgressContext
): boolean {
  if (task.completed) return false;
  if (!doesTaskMatchEvent(task, event, ctx)) return false;

  switch (task.rule.kind) {
    case "threshold": {
      if (event.type === "streak_updated") {
        return event.payload.days >= task.requirement;
      }
      if (event.type === "power_multiplier_changed") {
        const minM = task.rule.multiplierAtLeast ?? 1.5;
        return event.payload.newMultiplier + 1e-9 >= minM;
      }
      return nextProgress >= task.requirement;
    }
    default:
      return nextProgress >= task.requirement;
  }
}

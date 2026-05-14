import type { BattlePassActionEvent, BattlePassActionType } from "./battlePassActionEvents";
import type { BattlePassTaskDefinition, TaskReward, TaskType } from "./battlePassTasks";

/** How progress advances when an event matches. */
export type ProgressKind = "count" | "accumulate" | "threshold";

/**
 * Matcher + advance rules for a task (paired with `BattlePassTaskDefinition` by id).
 */
export interface TaskProgressRule {
  kind: ProgressKind;
  /** Event types that can affect this task (OR). */
  actionTypes: BattlePassActionType[];
  /**
   * `auction_scanned`, `bid_placed`, `auction_won`: require `payload.secondsRemaining <= n`.
   * Omit for no time gate.
   */
  secondsRemainingAtMost?: number;
  /**
   * `auction_scanned`: "ending soon" — same as secondsRemainingAtMost in practice.
   * If both set, the stricter (smaller) bound wins.
   */
  endingSoonSecondsMax?: number;
  /**
   * `task_completed`: only count completions whose `payload.taskType` is in this list.
   */
  sourceTaskTypes?: Array<TaskType | string>;
  /** `task_completed`: ignore completions for these task ids (e.g. meta mission). */
  ignoreCompletedTaskIds?: string[];
  /**
   * `power_multiplier_changed` threshold tasks: complete when `newMultiplier >= this`.
   * (Separate from `requirement` count on the task definition for display.)
   */
  multiplierAtLeast?: number;
}

/** Runtime task row for the progress engine (in-memory). */
export interface ActiveBattlePassTaskState {
  id: string;
  title: string;
  description: string;
  type: TaskType;
  themeTag: string;
  requirement: number;
  metricKey: string;
  reward: TaskReward;
  progress: number;
  completed: boolean;
  /** Set when rewards have been applied — never grant twice. */
  rewardGranted: boolean;
  rule: TaskProgressRule;
}

export interface BattlePassProgressContext {
  /** Default cap for "ending soon" scans when rule omits `endingSoonSecondsMax`. Default 600. */
  endingSoonSeconds?: number;
  /** Safety cap for nested `task_completed` processing. Default 24. */
  maxCascadeSteps?: number;
  /** Append human-readable trace entries. */
  debug?: boolean;
}

export interface BattlePassGrantPayload {
  xp: number;
  savvyPoints: number;
  powerLintDelta?: number;
  cosmeticId?: string;
}

export interface GrantedRewardRecord {
  taskId: string;
  payload: BattlePassGrantPayload;
}

export interface ProcessBattlePassEventResult {
  updatedTasks: ActiveBattlePassTaskState[];
  completedTasks: ActiveBattlePassTaskState[];
  grantedRewards: GrantedRewardRecord[];
  /** Synthetic `task_completed` events emitted for cascade/meta tasks */
  emittedEvents: BattlePassActionEvent[];
  /** Populated only when `BattlePassProgressContext.debug` is true */
  debugLog: string[];
}

/** Build engine state from season definitions + per-id rules. */
export function buildActiveBattlePassTasks(
  definitions: BattlePassTaskDefinition[],
  rulesByTaskId: Record<string, TaskProgressRule>,
  initialProgress?: Partial<Record<string, { progress?: number; completed?: boolean; rewardGranted?: boolean }>>
): ActiveBattlePassTaskState[] {
  return definitions.map((d) => {
    const rule = rulesByTaskId[d.id];
    if (!rule) {
      throw new Error(`Missing TaskProgressRule for task id "${d.id}"`);
    }
    const init = initialProgress?.[d.id];
    return {
      id: d.id,
      title: d.title,
      description: d.description,
      type: d.type,
      themeTag: d.themeTag,
      requirement: d.requirement,
      metricKey: d.metricKey,
      reward: d.reward,
      progress: Math.max(0, init?.progress ?? 0),
      completed: Boolean(init?.completed),
      rewardGranted: Boolean(init?.rewardGranted),
      rule,
    };
  });
}

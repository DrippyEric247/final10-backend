import type { BattlePassActionEvent } from "./battlePassActionEvents";
import type { BattlePassGrantPayload } from "./battlePassProgress";
import type { BattlePassTaskViewModel } from "./battlePassTasks";

export interface BattlePassRecentCompletion {
  taskId: string;
  title: string;
  taskType: string;
  at: number;
}

export interface BattlePassRecentReward {
  taskId: string;
  title: string;
  payload: BattlePassGrantPayload;
  at: number;
}

export interface BattlePassProgressDebugEntry {
  at: number;
  message: string;
  event?: BattlePassActionEvent;
  /** Present when emitted from `useBattlePassProgress` so UI can group cascade steps per action */
  traceGroupId?: number;
}

/** Optional seed for `autoSeedDemoProgress` (task id → partial state). */
export type BattlePassDemoSeed = Partial<
  Record<string, { progress?: number; completed?: boolean; rewardGranted?: boolean }>
>;

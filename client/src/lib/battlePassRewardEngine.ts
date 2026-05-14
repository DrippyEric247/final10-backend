import type { BattlePassActionEvent } from "../types/battlePassActionEvents";
import type { ActiveBattlePassTaskState, BattlePassGrantPayload } from "../types/battlePassProgress";
import type { TaskReward } from "../types/battlePassTasks";
import { createTaskCompletedEvent } from "./battlePassActionEventFactory";
import { grantBpMissionRewards } from "./battlePassEngine";

function summarizeReward(reward: TaskReward): string {
  const parts = [`+${reward.xp} XP`, `+${reward.savvyPoints} savvy`];
  if (reward.bonus?.label) parts.push(reward.bonus.label);
  return parts.join(", ");
}

/** Pure mapping from task reward → grant payload (no side effects). */
export function buildTaskCompletionReward(task: ActiveBattlePassTaskState): BattlePassGrantPayload {
  const { reward } = task;
  const payload: BattlePassGrantPayload = {
    xp: Math.max(0, reward.xp),
    savvyPoints: Math.max(0, reward.savvyPoints),
  };
  if (reward.bonus?.kind === "power_lint" && reward.bonus.value != null) {
    payload.powerLintDelta = Math.max(0, Number(reward.bonus.value));
  }
  if (reward.bonus?.kind === "cosmetic" && reward.bonus.id) {
    payload.cosmeticId = reward.bonus.id;
  }
  return payload;
}

export function buildTaskCompletedEvent(task: ActiveBattlePassTaskState, userId: string): BattlePassActionEvent {
  return createTaskCompletedEvent(
    { userId },
    {
      taskId: task.id,
      taskType: task.type,
      rewardSummary: summarizeReward(task.reward),
    }
  );
}

/**
 * Applies grants via existing battle pass engine (browser local). No-op on server bundle.
 */
export function applyBattlePassGrantPayload(payload: BattlePassGrantPayload): void {
  grantBpMissionRewards({
    xp: payload.xp,
    savvyPoints: payload.savvyPoints,
    powerLintDelta: payload.powerLintDelta,
    cosmeticId: payload.cosmeticId,
  });
}

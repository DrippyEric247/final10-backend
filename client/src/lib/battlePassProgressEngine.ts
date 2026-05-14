import type { BattlePassActionEvent } from "../types/battlePassActionEvents";
import type {
  ActiveBattlePassTaskState,
  BattlePassProgressContext,
  GrantedRewardRecord,
  ProcessBattlePassEventResult,
} from "../types/battlePassProgress";
import {
  buildTaskCompletedEvent,
  buildTaskCompletionReward,
  applyBattlePassGrantPayload,
} from "./battlePassRewardEngine";
import { doesTaskMatchEvent, getTaskProgressIncrement, shouldCompleteTask } from "./battlePassTaskMatchers";

function cloneTask(t: ActiveBattlePassTaskState): ActiveBattlePassTaskState {
  return { ...t, rule: { ...t.rule } };
}

/**
 * Applies one battle pass action event to in-memory task state.
 * Completing a task grants rewards once, emits a `task_completed` follow-up, and processes
 * follow-ups in the same run (loop-safe up to `context.maxCascadeSteps`).
 */
export function processBattlePassActionEvent(
  event: BattlePassActionEvent,
  activeTasks: ActiveBattlePassTaskState[],
  context?: BattlePassProgressContext
): ProcessBattlePassEventResult {
  const debugLog: string[] = [];
  const log = (msg: string) => {
    if (context?.debug) debugLog.push(msg);
  };

  let tasks = activeTasks.map(cloneTask);
  const completedTasks: ActiveBattlePassTaskState[] = [];
  const grantedRewards: GrantedRewardRecord[] = [];
  const emittedEvents: BattlePassActionEvent[] = [];

  const queue: BattlePassActionEvent[] = [event];
  let steps = 0;
  const maxSteps = context?.maxCascadeSteps ?? 24;

  while (queue.length > 0 && steps < maxSteps) {
    steps += 1;
    const current = queue.shift()!;
    log(`step ${steps}: ${current.type} id=${current.id}`);

    const followUps: BattlePassActionEvent[] = [];

    tasks = tasks.map((t) => {
      if (t.completed) return t;
      if (!doesTaskMatchEvent(t, current, context)) return t;

      const inc = getTaskProgressIncrement(t, current, context);
      let nextProgress = t.progress;

      if (inc > 0) {
        nextProgress = Math.max(t.progress, Math.min(t.requirement, t.progress + inc));
      }

      if (nextProgress === t.progress) {
        if (!shouldCompleteTask(t, nextProgress, current, context)) return t;
      }

      const willComplete = shouldCompleteTask(t, nextProgress, current, context);
      let next: ActiveBattlePassTaskState = { ...t, progress: nextProgress };

      if (willComplete) {
        const grantPayload = buildTaskCompletionReward(next);
        applyBattlePassGrantPayload(grantPayload);
        grantedRewards.push({ taskId: next.id, payload: grantPayload });
        next = {
          ...next,
          completed: true,
          rewardGranted: true,
          progress: t.requirement,
        };
        completedTasks.push(next);
        const followUp = buildTaskCompletedEvent(next, current.userId);
        emittedEvents.push(followUp);
        followUps.push(followUp);
        log(`completed task ${next.id}`);
      }

      return next;
    });

    queue.push(...followUps);
  }

  if (queue.length > 0) {
    log(`halted: maxCascadeSteps (${maxSteps}) reached with ${queue.length} event(s) queued`);
  }

  return {
    updatedTasks: tasks,
    completedTasks,
    grantedRewards,
    emittedEvents,
    debugLog,
  };
}

export { doesTaskMatchEvent, getTaskProgressIncrement, shouldCompleteTask } from "./battlePassTaskMatchers";
export {
  buildTaskCompletionReward,
  buildTaskCompletedEvent,
  applyBattlePassGrantPayload,
} from "./battlePassRewardEngine";

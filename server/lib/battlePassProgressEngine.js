/**
 * Port of client battle pass progress engine (no browser side effects).
 */

function cloneTask(t) {
  return { ...t, rule: { ...t.rule } };
}

function maxSecondsRemainingForPayload(task, ctx) {
  const parts = [];
  if (task.rule.secondsRemainingAtMost != null) parts.push(task.rule.secondsRemainingAtMost);
  if (task.rule.endingSoonSecondsMax != null) parts.push(task.rule.endingSoonSecondsMax);
  if (parts.length) return Math.min(...parts);
  if (task.rule.actionTypes.includes('auction_scanned')) {
    return ctx?.endingSoonSeconds ?? 600;
  }
  return undefined;
}

function doesTaskMatchEvent(task, event, ctx) {
  if (task.completed) return false;
  if (!task.rule.actionTypes.includes(event.type)) return false;

  switch (event.type) {
    case 'auction_scanned':
    case 'bid_placed':
    case 'auction_won': {
      const cap = maxSecondsRemainingForPayload(task, ctx);
      if (cap == null) return true;
      return event.payload.secondsRemaining <= cap;
    }
    case 'task_completed': {
      const p = event.payload;
      if (task.rule.ignoreCompletedTaskIds?.includes(p.taskId)) return false;
      if (task.rule.sourceTaskTypes?.length) {
        return task.rule.sourceTaskTypes.includes(p.taskType);
      }
      return true;
    }
    case 'power_multiplier_changed': {
      if (task.rule.multiplierAtLeast == null) return true;
      return event.payload.newMultiplier >= task.rule.multiplierAtLeast - 1e-9;
    }
    default:
      return true;
  }
}

function getTaskProgressIncrement(task, event, ctx) {
  if (!doesTaskMatchEvent(task, event, ctx)) return 0;

  switch (task.rule.kind) {
    case 'count':
      return 1;
    case 'accumulate': {
      if (event.type === 'savvy_points_earned') {
        return Math.max(0, event.payload.amount);
      }
      if (event.type === 'rank_changed') {
        const { previousRank, newRank } = event.payload;
        if (newRank >= previousRank) return 0;
        return Math.max(0, previousRank - newRank);
      }
      return 0;
    }
    case 'threshold': {
      if (event.type === 'streak_updated') {
        const target = Math.min(task.requirement, Math.max(0, event.payload.days));
        return Math.max(0, target - task.progress);
      }
      if (event.type === 'power_multiplier_changed') {
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

function shouldCompleteTask(task, nextProgress, event, ctx) {
  if (task.completed) return false;
  if (!doesTaskMatchEvent(task, event, ctx)) return false;

  switch (task.rule.kind) {
    case 'threshold': {
      if (event.type === 'streak_updated') {
        return event.payload.days >= task.requirement;
      }
      if (event.type === 'power_multiplier_changed') {
        const minM = task.rule.multiplierAtLeast ?? 1.5;
        return event.payload.newMultiplier + 1e-9 >= minM;
      }
      return nextProgress >= task.requirement;
    }
    default:
      return nextProgress >= task.requirement;
  }
}

function buildTaskCompletionReward(task) {
  const { reward } = task;
  const payload = {
    xp: Math.max(0, reward.xp || 0),
    savvyPoints: Math.max(0, reward.savvyPoints || 0),
  };
  if (reward.bonus?.kind === 'power_lint' && reward.bonus.value != null) {
    payload.powerLintDelta = Math.max(0, Number(reward.bonus.value));
  }
  if (reward.bonus?.kind === 'cosmetic' && reward.bonus.id) {
    payload.cosmeticId = reward.bonus.id;
  }
  return payload;
}

function summarizeReward(reward) {
  const parts = [`+${reward.xp} XP`, `+${reward.savvyPoints} savvy`];
  if (reward.bonus?.label) parts.push(reward.bonus.label);
  return parts.join(', ');
}

function buildTaskCompletedEvent(task, userId, sourceEventId) {
  return {
    id: `task_done_${task.id}_${sourceEventId}`,
    type: 'task_completed',
    userId,
    timestamp: Date.now(),
    payload: {
      taskId: task.id,
      taskType: task.type,
      rewardSummary: summarizeReward(task.reward),
    },
  };
}

function buildActiveBattlePassTasks(definitions, rulesByTaskId, initialProgress) {
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

function processBattlePassActionEvent(event, activeTasks, context) {
  const debugLog = [];
  const log = (msg) => {
    if (context?.debug) debugLog.push(msg);
  };

  let tasks = activeTasks.map(cloneTask);
  const completedTasks = [];
  const grantedRewards = [];
  const emittedEvents = [];

  const queue = [event];
  let steps = 0;
  const maxSteps = context?.maxCascadeSteps ?? 24;

  while (queue.length > 0 && steps < maxSteps) {
    steps += 1;
    const current = queue.shift();
    log(`step ${steps}: ${current.type} id=${current.id}`);

    const followUps = [];

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
      let next = { ...t, progress: nextProgress };

      if (willComplete) {
        const grantPayload = buildTaskCompletionReward(next);
        grantedRewards.push({ taskId: next.id, payload: grantPayload });
        next = {
          ...next,
          completed: true,
          rewardGranted: true,
          progress: t.requirement,
        };
        completedTasks.push(next);
        const followUp = buildTaskCompletedEvent(next, current.userId, current.id);
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

module.exports = {
  buildActiveBattlePassTasks,
  processBattlePassActionEvent,
  buildTaskCompletionReward,
  doesTaskMatchEvent,
};

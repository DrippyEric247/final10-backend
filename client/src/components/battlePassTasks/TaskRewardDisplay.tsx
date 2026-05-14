import type { TaskReward } from "../../types/battlePassTasks";

export interface TaskRewardDisplayProps {
  reward: TaskReward;
  compact?: boolean;
}

export function TaskRewardDisplay({ reward, compact }: TaskRewardDisplayProps) {
  const bonusLabel =
    reward.bonus?.label ||
    (reward.bonus?.kind === "power_lint" && reward.bonus.value != null
      ? `+${reward.bonus.value}× power`
      : null);

  return (
    <div className={`f10-bp-task-rewards ${compact ? "f10-bp-task-rewards--compact" : ""}`}>
      <span className="f10-bp-task-reward-pill">+{reward.xp} XP</span>
      <span className="f10-bp-task-reward-pill">+{reward.savvyPoints} savvy</span>
      {bonusLabel ? <span className="f10-bp-task-reward-pill f10-bp-task-reward-pill--bonus">{bonusLabel}</span> : null}
    </div>
  );
}

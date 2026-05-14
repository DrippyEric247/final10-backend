import { Check } from "lucide-react";
import type { BattlePassTaskViewModel } from "../../types/battlePassTasks";
import { TaskProgressBar } from "./TaskProgressBar";
import { TaskRewardDisplay } from "./TaskRewardDisplay";

export interface TaskCardProps {
  task: BattlePassTaskViewModel;
}

export function TaskCard({ task }: TaskCardProps) {
  return (
    <article
      className={`f10-bp-task-card ${task.completed ? "f10-bp-task-card--completed" : "f10-bp-task-card--active"}`}
    >
      <div className="f10-bp-task-card-top">
        <div className="f10-bp-task-card-title-row">
          {task.completed ? (
            <span className="f10-bp-task-check" aria-hidden>
              <Check className="f10-bp-task-check-icon" strokeWidth={3} />
            </span>
          ) : null}
          <h4 className="f10-bp-task-title">{task.title}</h4>
        </div>
        <span className="f10-bp-task-theme-tag">{task.themeTag}</span>
      </div>
      <p className="f10-bp-task-desc">{task.description}</p>
      <TaskProgressBar task={task} />
      <div className="f10-bp-task-card-foot">
        <span className="f10-bp-task-reward-label">Rewards</span>
        <TaskRewardDisplay reward={task.reward} compact />
      </div>
    </article>
  );
}

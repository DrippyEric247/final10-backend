import type { BattlePassTaskViewModel } from "../../types/battlePassTasks";

export interface TaskProgressBarProps {
  task: Pick<BattlePassTaskViewModel, "progress" | "requirement" | "completed">;
}

export function TaskProgressBar({ task }: TaskProgressBarProps) {
  const pct =
    task.requirement > 0
      ? Math.min(100, Math.round((100 * task.progress) / task.requirement))
      : task.completed
        ? 100
        : 0;

  return (
    <div className="f10-bp-task-progress" role="progressbar" aria-valuenow={task.progress} aria-valuemin={0} aria-valuemax={task.requirement}>
      <div className="f10-bp-task-progress-track">
        <div
          className={`f10-bp-task-progress-fill ${task.completed ? "f10-bp-task-progress-fill--done" : ""}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="f10-bp-task-progress-meta">
        <span>
          {task.progress} / {task.requirement}
        </span>
        {!task.completed ? <span className="f10-bp-task-progress-pct">{pct}%</span> : null}
      </div>
    </div>
  );
}

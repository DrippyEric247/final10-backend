import type { BattlePassTaskViewModel, TaskType } from "../../types/battlePassTasks";
import { TaskCard } from "./TaskCard";

const SECTION_LABEL: Record<TaskType, string> = {
  daily: "Daily missions",
  weekly: "Weekly missions",
  season: "Season missions",
};

export interface TaskSectionProps {
  type: TaskType;
  tasks: BattlePassTaskViewModel[];
}

export function TaskSection({ type, tasks }: TaskSectionProps) {
  if (!tasks.length) return null;

  return (
    <section className="f10-bp-task-section" aria-labelledby={`f10-bp-task-section-${type}`}>
      <h3 className="f10-bp-task-section-title" id={`f10-bp-task-section-${type}`}>
        {SECTION_LABEL[type]}
      </h3>
      <ul className="f10-bp-task-section-list">
        {tasks.map((t) => (
          <li key={t.id}>
            <TaskCard task={t} />
          </li>
        ))}
      </ul>
    </section>
  );
}

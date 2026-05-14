import { useMemo, type CSSProperties } from "react";
import type { BattlePassTaskViewModel, SeasonDefinition, TaskType } from "../../types/battlePassTasks";
import type { BattlePassRecentCompletion, BattlePassRecentReward } from "../../types/battlePassState";
import { TaskSection } from "./TaskSection";
import { BattlePassActivityStrip } from "./BattlePassActivityStrip";
import "../../styles/battlePassTasks.css";

export interface BattlePassTaskListProps {
  season: SeasonDefinition;
  tasks: BattlePassTaskViewModel[];
  activityCompletions?: BattlePassRecentCompletion[];
  activityRewards?: BattlePassRecentReward[];
}

function groupByType(tasks: BattlePassTaskViewModel[]): Record<TaskType, BattlePassTaskViewModel[]> {
  const out: Record<TaskType, BattlePassTaskViewModel[]> = {
    daily: [],
    weekly: [],
    season: [],
  };
  for (const t of tasks) {
    out[t.type].push(t);
  }
  return out;
}

export function BattlePassTaskList({
  season,
  tasks,
  activityCompletions = [],
  activityRewards = [],
}: BattlePassTaskListProps) {
  const grouped = useMemo(() => groupByType(tasks), [tasks]);

  const themeVars = useMemo(
    () =>
      ({
        "--bp-task-accent": season.themeUi.accent,
        "--bp-task-accent-2": season.themeUi.accent2,
        "--bp-task-glow": season.themeUi.glow,
        "--bp-task-surface": season.themeUi.surface,
      }) as CSSProperties,
    [season.themeUi]
  );

  return (
    <div className="f10-bp-task-list-root" style={themeVars}>
      <header className="f10-bp-task-list-header">
        <p className="f10-bp-task-list-tagline">Complete missions. Earn power. Dominate the leaderboard.</p>
        <div className="f10-bp-task-list-season-meta">
          <h2 className="f10-bp-task-list-season-name">{season.name}</h2>
          <p className="f10-bp-task-list-theme">{season.theme}</p>
          <p className="f10-bp-task-list-desc">{season.description}</p>
        </div>
      </header>

      <BattlePassActivityStrip completions={activityCompletions} rewards={activityRewards} />

      <div className="f10-bp-task-sections">
        <TaskSection type="daily" tasks={grouped.daily} />
        <TaskSection type="weekly" tasks={grouped.weekly} />
        <TaskSection type="season" tasks={grouped.season} />
      </div>
    </div>
  );
}

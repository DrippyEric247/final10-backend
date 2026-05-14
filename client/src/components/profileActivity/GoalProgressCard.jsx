import React, { useMemo } from "react";

export function GoalProgressCard({ goal }) {
  const pct = useMemo(() => {
    const { progressCurrent, progressTarget } = goal;
    if (progressTarget <= 0) return 0;
    const raw = (progressCurrent / progressTarget) * 100;
    return Math.max(0, Math.min(100, Math.round(raw)));
  }, [goal]);

  return (
    <div className="f10-pa-goal-card">
      <h3 className="f10-pa-goal-title">{goal.title}</h3>
      {goal.subtitle ? <p className="f10-pa-goal-sub">{goal.subtitle}</p> : null}
      <div className="f10-pa-goal-bar-wrap">
        <div className="f10-pa-goal-bar-label">
          <span>Progress</span>
          <strong className="tabular-nums">{goal.remainingLabel} left</strong>
        </div>
        <div
          className="f10-pa-goal-bar-outer"
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div className="f10-pa-goal-bar-fill" style={{ width: `${pct}%` }} />
        </div>
      </div>
    </div>
  );
}

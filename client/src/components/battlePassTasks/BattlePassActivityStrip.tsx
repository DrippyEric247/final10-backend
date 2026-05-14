import type { BattlePassRecentCompletion, BattlePassRecentReward } from "../../types/battlePassState";

export interface BattlePassActivityStripProps {
  completions: BattlePassRecentCompletion[];
  rewards: BattlePassRecentReward[];
}

function formatTime(ts: number): string {
  try {
    return new Date(ts).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  } catch {
    return "";
  }
}

export function BattlePassActivityStrip({ completions, rewards }: BattlePassActivityStripProps) {
  if (completions.length === 0 && rewards.length === 0) return null;

  return (
    <div className="f10-bp-activity-strip" aria-live="polite">
      {completions.length > 0 ? (
        <div className="f10-bp-activity-block">
          <h4 className="f10-bp-activity-heading">Mission complete</h4>
          <ul className="f10-bp-activity-list">
            {completions.slice(0, 5).map((c) => (
              <li key={`${c.taskId}-${c.at}`} className="f10-bp-activity-row f10-bp-activity-row--done">
                <span className="f10-bp-activity-title">{c.title}</span>
                <span className="f10-bp-activity-meta">
                  {c.taskType} · {formatTime(c.at)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {rewards.length > 0 ? (
        <div className="f10-bp-activity-block">
          <h4 className="f10-bp-activity-heading">Rewards granted</h4>
          <ul className="f10-bp-activity-list">
            {rewards.slice(0, 5).map((r) => (
              <li key={`${r.taskId}-${r.at}`} className="f10-bp-activity-row f10-bp-activity-row--reward">
                <span className="f10-bp-activity-title">{r.title}</span>
                <span className="f10-bp-activity-pills">
                  {r.payload.xp > 0 ? <span className="f10-bp-activity-pill">+{r.payload.xp} XP</span> : null}
                  {r.payload.savvyPoints > 0 ? (
                    <span className="f10-bp-activity-pill">+{r.payload.savvyPoints} savvy</span>
                  ) : null}
                  {r.payload.powerLintDelta != null && r.payload.powerLintDelta > 0 ? (
                    <span className="f10-bp-activity-pill">+{r.payload.powerLintDelta}× power</span>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

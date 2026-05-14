import { useMemo } from "react";
import type { UseBattlePassProgressResult } from "../../hooks/useBattlePassProgress";
import { BattlePassEventTrace } from "./BattlePassEventTrace";

export type BattlePassDevPanelProps = Pick<
  UseBattlePassProgressResult,
  | "simulateAuctionScan"
  | "simulateBidPlaced"
  | "simulateAuctionWin"
  | "simulateDailyLogin"
  | "simulatePowerBoostClaim"
  | "simulateSavvyPointsEarned"
  | "simulateRankImproved"
  | "simulatePowerMultiplierChange"
  | "resetDailyTasks"
  | "resetWeeklyTasks"
  | "resetSeasonProgress"
  | "debugLog"
  | "tasks"
> & {
  disabled?: boolean;
};

function BattlePassDevPanelInner({
  simulateAuctionScan,
  simulateBidPlaced,
  simulateAuctionWin,
  simulateDailyLogin,
  simulatePowerBoostClaim,
  simulateSavvyPointsEarned,
  simulateRankImproved,
  simulatePowerMultiplierChange,
  resetDailyTasks,
  resetWeeklyTasks,
  resetSeasonProgress,
  debugLog,
  tasks,
  disabled,
}: BattlePassDevPanelProps) {
  const taskTitleLookup = useMemo(() => {
    const m: Record<string, string> = {};
    for (const t of tasks) {
      m[t.id] = t.title;
    }
    return m;
  }, [tasks]);

  const btn = (label: string, onClick: () => void) => (
    <button type="button" className="f10-bp-dev-btn" disabled={disabled} onClick={onClick}>
      {label}
    </button>
  );

  return (
    <aside className="f10-bp-dev-panel" aria-label="Battle pass development tools">
      <div className="f10-bp-dev-panel-hd">
        <span className="f10-bp-dev-badge">Dev</span>
        <span className="f10-bp-dev-title">Simulate events</span>
      </div>
      <div className="f10-bp-dev-grid">
        {btn("Scan auction", simulateAuctionScan)}
        {btn("Last-minute bid", simulateBidPlaced)}
        {btn("Win auction", simulateAuctionWin)}
        {btn("Daily login", simulateDailyLogin)}
        {btn("Power boost", simulatePowerBoostClaim)}
        {btn("Earn 500 pts", () => simulateSavvyPointsEarned(500))}
        {btn("Improve rank", simulateRankImproved)}
        {btn("Reach 1.5× power", () => simulatePowerMultiplierChange(1.5))}
      </div>
      <div className="f10-bp-dev-reset-row">
        {btn("Reset daily", resetDailyTasks)}
        {btn("Reset weekly", resetWeeklyTasks)}
        {btn("Reset season", resetSeasonProgress)}
      </div>
      {debugLog.length > 0 ? (
        <div className="f10-bp-dev-feed">
          <div className="f10-bp-dev-feed-label">Event trace</div>
          <BattlePassEventTrace entries={debugLog} taskTitleLookup={taskTitleLookup} maxGroups={12} />
        </div>
      ) : null}
    </aside>
  );
}

export function BattlePassDevPanel(props: BattlePassDevPanelProps) {
  if (process.env.NODE_ENV === "production") {
    return null;
  }
  return <BattlePassDevPanelInner {...props} />;
}

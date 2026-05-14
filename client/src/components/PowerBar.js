import React from "react";

export default function PowerBar({
  currentTier = 1,
  nextTier = 1,
  progress = 0,
  progressLabel = "",
  motivationalLabel = "Build your power",
  showNearCompleteGlow = false,
  gainText = "",
  levelUpText = "",
  className = "",
}) {
  const pct = Math.max(0, Math.min(1, Number(progress) || 0));
  return (
    <div className={`f10-powerbar ${showNearCompleteGlow ? "f10-powerbar--near" : ""} ${className}`}>
      <div className="f10-powerbar-row">
        <div className="f10-powerbar-tier f10-powerbar-tier--left">{Number(currentTier).toFixed(2)}x</div>
        <div className="f10-powerbar-middle">
          <div className="f10-powerbar-track">
            <div className="f10-powerbar-fill" style={{ width: `${Math.round(pct * 100)}%` }} />
            <div className="f10-powerbar-glint" />
            <div className="f10-powerbar-progress-label">{progressLabel}</div>
          </div>
          <div className="f10-powerbar-motivation">{motivationalLabel}</div>
          {gainText ? <div className="f10-powerbar-gain">{gainText}</div> : null}
          {levelUpText ? <div className="f10-powerbar-levelup">{levelUpText}</div> : null}
        </div>
        <div className="f10-powerbar-tier f10-powerbar-tier--right">{Number(nextTier).toFixed(2)}x</div>
      </div>
    </div>
  );
}

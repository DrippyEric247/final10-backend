import React from "react";
import { FloatingPointBurst } from "./FloatingPointBurst";
import { PointsEarnedToast, type PointsRewardVisualTier } from "./PointsEarnedToast";
import { SavvyPointsIcon } from "./SavvyPointsIcon";

export function PointsEarnedEffect({
  amount,
  source,
  tier,
}: {
  amount: number;
  source: string;
  tier: PointsRewardVisualTier;
}) {
  const sourceClass =
    source === "tier_up"
      ? "points-earned-effect--source-tier-up"
      : source === "daily_login"
      ? "points-earned-effect--source-daily-login"
      : source === "task_complete"
      ? "points-earned-effect--source-task-complete"
      : "";
  return (
    <div className={`points-earned-effect points-earned-effect--${tier} ${sourceClass}`} aria-live="polite" aria-atomic="true">
      <div className="points-earned-effect__sweep" />
      <div className="points-earned-effect__main-coin">
        <SavvyPointsIcon size={tier === "large" ? 72 : tier === "medium" ? 58 : 46} glow animated />
      </div>
      <FloatingPointBurst tier={tier} />
      <PointsEarnedToast amount={amount} source={source} tier={tier} />
    </div>
  );
}


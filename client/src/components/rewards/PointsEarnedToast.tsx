import React from "react";
import { SavvyPointsIcon } from "./SavvyPointsIcon";

export type PointsRewardVisualTier = "small" | "medium" | "large";

export function PointsEarnedToast({
  amount,
  source,
  tier,
}: {
  amount: number;
  source: string;
  tier: PointsRewardVisualTier;
}) {
  return (
    <div className={`points-earned-toast points-earned-toast--${tier}`}>
      <SavvyPointsIcon size={tier === "large" ? 30 : 24} glow animated />
      <div className="points-earned-toast__copy">
        <div className="points-earned-toast__title">+{Math.max(0, Math.round(amount)).toLocaleString()} Savvy Points</div>
        <div className="points-earned-toast__sub">{source.replace(/_/g, " ")}</div>
      </div>
    </div>
  );
}


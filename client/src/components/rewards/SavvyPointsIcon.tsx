import React from "react";
import coinImage from "../../assets/savvy-points-coin.png";
import "../../styles/PointsRewardEffects.css";

type SavvyPointsIconProps = {
  size?: number;
  animated?: boolean;
  glow?: boolean;
  className?: string;
};

export function SavvyPointsIcon({
  size = 24,
  animated = false,
  glow = false,
  className = "",
}: SavvyPointsIconProps) {
  const px = Math.max(14, Number(size) || 24);
  const cls = [
    "savvy-points-icon",
    animated ? "savvy-points-icon--animated" : "",
    glow ? "savvy-points-icon--glow" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <span className={cls} style={{ width: px, height: px }} aria-hidden>
      <img src={coinImage} alt="Savvy Points" loading="lazy" />
    </span>
  );
}


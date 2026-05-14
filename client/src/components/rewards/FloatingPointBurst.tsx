import React from "react";
import { SavvyPointsIcon } from "./SavvyPointsIcon";
import type { PointsRewardVisualTier } from "./PointsEarnedToast";

const BURST_POSITIONS = [
  { x: -72, y: -30, d: 0 },
  { x: -28, y: -52, d: 55 },
  { x: 18, y: -58, d: 95 },
  { x: 58, y: -28, d: 130 },
];

export function FloatingPointBurst({ tier }: { tier: PointsRewardVisualTier }) {
  const count = tier === "large" ? 4 : tier === "medium" ? 3 : 1;
  return (
    <div className="floating-point-burst" aria-hidden>
      {BURST_POSITIONS.slice(0, count).map((p, idx) => (
        <span
          key={`${p.x}-${p.y}-${idx}`}
          className="floating-point-burst__coin"
          style={
            {
              "--tx": `${p.x}px`,
              "--ty": `${p.y}px`,
              "--delay": `${p.d}ms`,
            } as React.CSSProperties
          }
        >
          <SavvyPointsIcon size={tier === "small" ? 20 : 24} glow animated />
        </span>
      ))}
    </div>
  );
}


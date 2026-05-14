import React from "react";

export function RivalryRewardCard({ config }) {
  return (
    <div className="f10-rival-reward">
      <h4>Chase reward</h4>
      <p>{config.passLine}</p>
      <p>{config.streakLine}</p>
    </div>
  );
}

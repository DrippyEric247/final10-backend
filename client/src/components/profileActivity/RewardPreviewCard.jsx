import React from "react";

const ACCENT_CLASS = {
  gold: "f10-pa-reward--gold",
  cyan: "f10-pa-reward--cyan",
  violet: "f10-pa-reward--violet",
  emerald: "f10-pa-reward--emerald",
};

export function RewardPreviewCard({ reward }) {
  return (
    <div className={`f10-pa-reward ${ACCENT_CLASS[reward.accent] || ACCENT_CLASS.violet}`}>
      <p className="f10-pa-reward-kicker">Reward preview</p>
      <p className="f10-pa-reward-headline">{reward.headline}</p>
      {reward.detail ? <p className="f10-pa-reward-detail">{reward.detail}</p> : null}
    </div>
  );
}

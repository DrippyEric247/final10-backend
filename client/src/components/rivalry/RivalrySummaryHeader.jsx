import React from "react";

export function RivalrySummaryHeader({ summary }) {
  const { scoreGapLine, rankGapLine, catchUpLine } = summary;
  return (
    <div className="f10-rival-gap-card" aria-label="Rivalry gap summary">
      <p>
        <span className="f10-rival-gap-strong">{scoreGapLine}</span>
      </p>
      <p>
        <span className="f10-rival-gap-accent">{rankGapLine}</span>
      </p>
      <p style={{ marginTop: "0.5rem" }}>{catchUpLine}</p>
    </div>
  );
}

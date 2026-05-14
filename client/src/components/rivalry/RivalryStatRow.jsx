import React from "react";

function cellClass(side, winner) {
  const base = "f10-rival-cell tabular-nums";
  if (winner === "tie") return `${base} f10-rival-cell--tie`;
  if (winner === side) return `${base} f10-rival-cell--win`;
  return `${base} f10-rival-cell--lose`;
}

export function RivalryStatRow({ row }) {
  const { label, winner, youDisplay, themDisplay } = row;
  return (
    <div className="f10-rival-row" role="listitem">
      <div className="f10-rival-row-label">{label}</div>
      <div className={cellClass("you", winner)}>{youDisplay}</div>
      <div className={cellClass("them", winner)}>{themDisplay}</div>
    </div>
  );
}

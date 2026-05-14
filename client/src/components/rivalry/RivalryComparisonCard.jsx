import React from "react";
import { motion } from "framer-motion";
import { RivalryRewardCard } from "./RivalryRewardCard.jsx";
import { RivalryStatRow } from "./RivalryStatRow.jsx";
import { RivalryStatusBadge } from "./RivalryStatusBadge.jsx";
import { RivalrySummaryHeader } from "./RivalrySummaryHeader.jsx";
import "./RivalryComparison.css";

function Skeleton() {
  return (
    <div className="f10-rival-section-inner f10-rival-skel" aria-busy="true">
      <div className="f10-rival-skel-line" style={{ width: "72%" }} />
      <div className="f10-rival-skel-line" style={{ width: "92%" }} />
      <div className="f10-rival-skel-block" style={{ marginTop: "0.75rem" }} />
      {[1, 2, 3, 4].map((k) => (
        <div key={k} className="f10-rival-skel-block" style={{ height: "3.2rem" }} />
      ))}
    </div>
  );
}

export function RivalryComparisonCard({
  rivalDisplayNameUpper,
  themShortName,
  comparison,
  chaseReward = null,
  loading = false,
  emptyMessage = "Rivalry data isn’t available for this profile yet.",
  motivationalLine = "Every move counts. Close the gap and take their spot.",
  onStartChase,
  onViewLoadout,
}) {
  if (loading) {
    return (
      <section
        className="f10-rival-section"
        aria-labelledby="f10-rival-hd"
        style={{ marginTop: "0.75rem" }}
      >
        <Skeleton />
      </section>
    );
  }

  if (!comparison) {
    return (
      <section
        className="f10-rival-section"
        aria-labelledby="f10-rival-hd"
        style={{ marginTop: "0.75rem" }}
      >
        <div className="f10-rival-section-inner">
          <h2 id="f10-rival-hd" className="f10-rival-title">
            You vs {rivalDisplayNameUpper}
          </h2>
          <p className="f10-rival-empty">{emptyMessage}</p>
        </div>
      </section>
    );
  }

  const { rows, summary } = comparison;

  return (
    <motion.section
      className="f10-rival-section"
      aria-labelledby="f10-rival-hd"
      style={{ marginTop: "0.75rem" }}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="f10-rival-section-inner">
        <div className="f10-rival-head-row">
          <h2 id="f10-rival-hd" className="f10-rival-title">
            You vs {rivalDisplayNameUpper}
          </h2>
          <RivalryStatusBadge status={summary.rivalStatus} />
        </div>
        <p className="f10-rival-motivate">{motivationalLine}</p>

        <RivalrySummaryHeader summary={summary} />

        <div className="f10-rival-cols" aria-hidden>
          <div className="f10-rival-col-hd f10-rival-col-hd--you">You</div>
          <div className="f10-rival-col-hd f10-rival-col-hd--them">
            Rival
            <span className="f10-rival-them-name">{themShortName}</span>
          </div>
        </div>

        <div role="list">
          {rows.map((row) => (
            <RivalryStatRow key={row.id} row={row} />
          ))}
        </div>

        {chaseReward ? <RivalryRewardCard config={chaseReward} /> : null}

        <div className="f10-rival-actions">
          <button type="button" className="f10-rival-btn-primary" onClick={onStartChase}>
            Start the Chase
          </button>
          <button type="button" className="f10-rival-btn-secondary" onClick={onViewLoadout}>
            View My Full Loadout
          </button>
        </div>
      </div>
    </motion.section>
  );
}

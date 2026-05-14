import React, { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { getTabJourneySnapshot, observeTabJourney } from "../../lib/tabJourney";

export default function TabJourneyPanel() {
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(true);
  const [pulse, setPulse] = useState(false);
  const [rev, setRev] = useState(0);

  const snapshot = useMemo(
    () => getTabJourneySnapshot(location.pathname),
    [location.pathname, rev]
  );

  useEffect(() => {
    const unsub = observeTabJourney(() => setRev((n) => n + 1));
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!snapshot?.record?.completedAt) return;
    setPulse(true);
    const t = window.setTimeout(() => setPulse(false), 900);
    return () => window.clearTimeout(t);
  }, [snapshot?.record?.completedAt]);

  if (!snapshot) return null;

  return (
    <aside
      className="card f10-tab-journey-panel"
      style={{
        transform: pulse ? "scale(1.02)" : "scale(1)",
        transition: "transform 180ms ease",
      }}
    >
      <div className="flex items-center justify-between gap-2 flex-wrap" style={{ marginBottom: 8 }}>
        <strong className="text-sm sm:text-base min-w-0 truncate">{snapshot.flow.tabLabel} Journey</strong>
        <button type="button" className="btn btn-ghost shrink-0 text-xs sm:text-sm px-2 py-1" onClick={() => setIsOpen((v) => !v)}>
          {isOpen ? "Hide" : "Show"}
        </button>
      </div>
      <div className="sub" style={{ marginBottom: 8 }}>
        Complete this to unlock bonus
      </div>
      <div style={{ height: 8, background: "#1f2937", borderRadius: 999, overflow: "hidden", marginBottom: 10 }}>
        <div
          style={{
            width: `${snapshot.progressPct}%`,
            height: "100%",
            background: "linear-gradient(90deg,#a855f7,#ec4899)",
            transition: "width 220ms ease",
          }}
        />
      </div>
      {isOpen && (
        <div>
          {snapshot.flow.steps.map((step) => {
            const current = Number(snapshot.record.steps[step.id] || 0);
            const done = current >= step.target;
            return (
              <div key={step.id} className="row" style={{ marginBottom: 6 }}>
                <span className="sub" style={{ color: done ? "#34d399" : "#d1d5db" }}>
                  {done ? "✓" : "○"} {step.label}
                </span>
                <span className="sub">
                  {Math.min(step.target, current)}/{step.target}
                </span>
              </div>
            );
          })}
          <div className="row" style={{ marginTop: 10 }}>
            <span className="sub">
              Bonus: +{snapshot.flow.reward} Savvy
            </span>
            <span className="sub">
              Total earned: +{snapshot.totalEarned}
            </span>
          </div>
          <p className="sub" style={{ marginTop: 8 }}>
            Both buyers and sellers earn Savvy on every deal.
          </p>
        </div>
      )}
    </aside>
  );
}


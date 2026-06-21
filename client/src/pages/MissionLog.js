import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useSavvyScoutMissions } from "../context/SavvyScoutMissionsContext";
import SavvyScoutMissionsPanel from "../components/scout/SavvyScoutMissionsPanel";
import { emitPowerToast } from "../lib/final10PowerFeedback";
import { SAVVY_SCOUT } from "../config/savvyScoutBranding";
import "../styles/SavvyScoutMissions.css";

function groupByCadence(missions) {
  const groups = { daily: [], weekly: [], seasonal: [], one_time: [], done: [] };
  for (const m of missions) {
    if (m.claimed) groups.done.push(m);
    else if (m.cadence === "daily") groups.daily.push(m);
    else if (m.cadence === "weekly") groups.weekly.push(m);
    else if (m.cadence === "seasonal") groups.seasonal.push(m);
    else groups.one_time.push(m);
  }
  return groups;
}

export default function MissionLog() {
  const { snapshot, claimMission } = useSavvyScoutMissions();
  const [claimingId, setClaimingId] = useState(null);
  const groups = groupByCadence(snapshot.missions);

  const handleClaim = async (id) => {
    setClaimingId(id);
    try {
      const res = await claimMission(id);
      if (res.ok && res.rewardSavvy) {
        emitPowerToast(res.rewardSavvy, res.message || `+${res.rewardSavvy} Savvy added to your wallet`);
      }
    } finally {
      setClaimingId(null);
    }
  };

  return (
    <div className="min-h-screen pt-20 scout-mission-log-page">
      <div className="scout-mission-log-wrap">
        <header className="scout-mission-log-hd">
          <p className="scout-mission-log-eyebrow">{SAVVY_SCOUT.shortTitle}</p>
          <h1>Mission Log</h1>
          <p className="scout-mission-log-sub">
            Secondary log for active, completed, and claimed missions. Your primary guide is the floating Savvy Scout bubble.
          </p>
        </header>

        <SavvyScoutMissionsPanel
          snapshot={snapshot}
          onClaim={handleClaim}
          claimingId={claimingId}
        />

        {["daily", "weekly", "seasonal", "one_time"].map((cadence) => {
          const list = groups[cadence];
          if (!list.length) return null;
          const title =
            cadence === "one_time"
              ? "One-time challenges"
              : `${cadence.charAt(0).toUpperCase()}${cadence.slice(1)} challenges`;
          return (
            <section key={cadence} className="scout-missions-section">
              <h2 className="scout-mission-log-section-title">{title}</h2>
              <ul className="scout-missions-list">
                {list.map((m) => (
                  <li
                    key={m.id}
                    className={`scout-mission-card ${m.claimable ? "scout-mission-card--claimable" : ""}`}
                  >
                    <div className="scout-mission-card__main">
                      <div className="scout-mission-card__title">{m.title}</div>
                      <p className="scout-mission-card__desc">{m.description}</p>
                      <div className="scout-mission-card__meta">
                        <span>
                          {m.progress}/{m.target}
                        </span>
                        <span className="scout-mission-card__reward">+{m.rewardSavvy} Savvy</span>
                      </div>
                    </div>
                    {m.claimable ? (
                      <button
                        type="button"
                        className="scout-mission-card__claim"
                        disabled={claimingId === m.id}
                        onClick={() => handleClaim(m.id)}
                      >
                        Claim
                      </button>
                    ) : null}
                  </li>
                ))}
              </ul>
            </section>
          );
        })}

        {groups.done.length > 0 ? (
          <section className="scout-missions-section">
            <h2 className="scout-mission-log-section-title">Claimed rewards</h2>
            <ul className="scout-missions-list scout-missions-list--dense">
              {groups.done.map((m) => (
                <li key={m.id} className="scout-mission-card scout-mission-card--dense scout-mission-card--done">
                  <span className="scout-mission-card__title">✓ {m.title}</span>
                  <span className="scout-mission-card__reward">+{m.rewardSavvy}</span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <p className="scout-mission-log-foot">
          <Link to="/">← Back to app</Link>
        </p>
      </div>
    </div>
  );
}

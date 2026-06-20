import React from "react";
import { Link } from "react-router-dom";
import { SAVVY_SCOUT } from "../../config/savvyScoutBranding";
import "../../styles/SavvyScoutMissions.css";

function cadenceLabel(cadence) {
  if (cadence === "daily") return "Daily";
  if (cadence === "weekly") return "Weekly";
  if (cadence === "seasonal") return "Seasonal";
  return "One-time";
}

export default function SavvyScoutMissionsPanel({
  snapshot,
  onClaim,
  claimingId = null,
  compact = false,
}) {
  const contextual = snapshot?.contextualActive || [];
  const claimable = snapshot?.claimable || [];
  const otherActive = (snapshot?.active || []).filter(
    (m) => !m.contextual && !m.claimable
  );

  return (
    <div className={`scout-missions-panel ${compact ? "scout-missions-panel--compact" : ""}`}>
      <header className="scout-missions-panel__hd">
        <div>
          <p className="scout-missions-panel__eyebrow">{SAVVY_SCOUT.shortTitle} Missions</p>
          <p className="scout-missions-panel__tagline">{snapshot?.tagline}</p>
        </div>
        <Link to="/mission-log" className="scout-missions-panel__log-link">
          Mission Log
        </Link>
      </header>

      {claimable.length > 0 ? (
        <section className="scout-missions-section">
          <h4 className="scout-missions-section__title">Ready to claim</h4>
          <ul className="scout-missions-list">
            {claimable.map((m) => (
              <li key={m.id} className="scout-mission-card scout-mission-card--claimable">
                <div className="scout-mission-card__main">
                  <div className="scout-mission-card__title">{m.title}</div>
                  <p className="scout-mission-card__desc">{m.description}</p>
                  <div className="scout-mission-card__meta">
                    <span className="scout-mission-card__reward">+{m.rewardSavvy} Savvy</span>
                    <span className="scout-mission-card__cadence">{cadenceLabel(m.cadence)}</span>
                  </div>
                </div>
                <button
                  type="button"
                  className="scout-mission-card__claim"
                  disabled={claimingId === m.id}
                  onClick={() => onClaim?.(m.id)}
                >
                  {claimingId === m.id ? "…" : "Claim"}
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {contextual.length > 0 ? (
        <section className="scout-missions-section">
          <h4 className="scout-missions-section__title">For you right now</h4>
          <ul className="scout-missions-list">
            {contextual.slice(0, compact ? 4 : 8).map((m) => (
              <li key={m.id} className="scout-mission-card">
                <div className="scout-mission-card__main">
                  <div className="scout-mission-card__title">{m.title}</div>
                  <p className="scout-mission-card__desc">{m.scoutLine || m.description}</p>
                  <div className="scout-mission-card__bar" aria-hidden>
                    <span style={{ width: `${m.progressPct}%` }} />
                  </div>
                  <div className="scout-mission-card__meta">
                    <span>
                      {m.progress}/{m.target}
                    </span>
                    <span className="scout-mission-card__reward">+{m.rewardSavvy} Savvy</span>
                  </div>
                </div>
                {m.ctaPath ? (
                  <Link to={m.ctaPath} className="scout-mission-card__cta">
                    Go
                  </Link>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {!compact && otherActive.length > 0 ? (
        <section className="scout-missions-section">
          <h4 className="scout-missions-section__title">More missions</h4>
          <ul className="scout-missions-list scout-missions-list--dense">
            {otherActive.slice(0, 6).map((m) => (
              <li key={m.id} className="scout-mission-card scout-mission-card--dense">
                <span className="scout-mission-card__title">{m.title}</span>
                <span className="scout-mission-card__reward">+{m.rewardSavvy}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {contextual.length === 0 && claimable.length === 0 ? (
        <p className="scout-missions-empty">
          Savvy Scout is scanning for new earning opportunities. Keep hunting — missions appear as you move.
        </p>
      ) : null}
    </div>
  );
}

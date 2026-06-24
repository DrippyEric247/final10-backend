import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { SCOUT_MISSION_POPUP_EVENT } from "../../lib/savvyScoutMissions";
import Final10Slogan from "../branding/Final10Slogan";
import "../../styles/SavvyScoutMissions.css";

export default function SavvyScoutMissionPopupHost({ onOpenMissions }) {
  const [popup, setPopup] = useState(null);

  useEffect(() => {
    let dismissTimer = 0;
    const handler = (e) => {
      const d = e?.detail;
      if (!d?.message) return;
      setPopup(d);
      if (dismissTimer) window.clearTimeout(dismissTimer);
      dismissTimer = window.setTimeout(() => setPopup(null), 9000);
    };
    window.addEventListener(SCOUT_MISSION_POPUP_EVENT, handler);
    return () => {
      window.removeEventListener(SCOUT_MISSION_POPUP_EVENT, handler);
      if (dismissTimer) window.clearTimeout(dismissTimer);
    };
  }, []);

  if (!popup) return null;

  return (
    <div className="scout-mission-popup" role="status" aria-live="polite">
      <button
        type="button"
        className="scout-mission-popup__close"
        aria-label="Dismiss mission tip"
        onClick={() => setPopup(null)}
      >
        ×
      </button>
      <div className="scout-mission-popup__scout">Savvy Scout</div>
      <p className="scout-mission-popup__message">{popup.message}</p>
      {popup.scoutLine ? (
        <p className="scout-mission-popup__sub">{popup.scoutLine}</p>
      ) : null}
      <div className="scout-mission-popup__actions">
        {popup.ctaPath ? (
          <Link to={popup.ctaPath} className="scout-mission-popup__btn scout-mission-popup__btn--primary">
            View mission
          </Link>
        ) : null}
        <button
          type="button"
          className="scout-mission-popup__btn"
          onClick={() => {
            setPopup(null);
            onOpenMissions?.();
          }}
        >
          Open missions
        </button>
      </div>
      {popup.rewardSavvy ? (
        <div className="scout-mission-popup__reward">+{popup.rewardSavvy} Savvy</div>
      ) : null}
      <Final10Slogan variant="toast" as="p" className="scout-mission-popup__slogan" />
    </div>
  );
}

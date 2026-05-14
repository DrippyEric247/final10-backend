import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  getEnrollment,
  getProgramBadge,
  SAVVY_PROGRAM_UPDATE_EVENT,
  VERIFICATION_STATUS,
} from "../../lib/savvyPrograms";

/**
 * Compact chip-style badge rendered on the profile and wherever we want to
 * surface the user's Business Savvy / Responder Savvy status.
 *
 * Intentionally zero-config — subscribes to the program update event so it
 * stays accurate even while enrollment changes in another tab/component.
 */
export default function ProgramBadge({ className = "", compact = false }) {
  const [enrollment, setEnrollment] = useState(() => getEnrollment());

  useEffect(() => {
    const refresh = () => setEnrollment(getEnrollment());
    window.addEventListener(SAVVY_PROGRAM_UPDATE_EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(SAVVY_PROGRAM_UPDATE_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  const badge = getProgramBadge(enrollment);
  if (!badge) return null;

  const verified = enrollment.verificationStatus === VERIFICATION_STATUS.VERIFIED;
  const classes = [
    "f10-program-badge",
    `f10-program-badge--${badge.tone}`,
    verified ? "is-verified" : "is-pending",
    compact ? "is-compact" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <Link to="/savvy-programs" className={classes} title={badge.label}>
      <span className="f10-program-badge-glyph" aria-hidden>
        {badge.id === "business_savvy" ? "🏢" : "🛡️"}
      </span>
      <span className="f10-program-badge-body">
        <strong>{badge.label}</strong>
        <small>
          {verified ? `${Math.round(badge.multiplier * 100)}% payout` : "Verification pending"}
        </small>
      </span>
    </Link>
  );
}

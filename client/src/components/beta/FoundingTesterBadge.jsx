import React from "react";
import { FOUNDING_TESTER_BADGE, FOUNDING_TESTER_THANKS } from "../../lib/betaTesterAccess";

export default function FoundingTesterBadge({ compact = false, className = "" }) {
  if (compact) {
    return (
      <span
        className={`inline-flex items-center rounded-full border border-amber-300/50 bg-amber-400/15 px-2.5 py-0.5 text-[11px] font-bold text-amber-100 ${className}`}
        title={FOUNDING_TESTER_THANKS}
      >
        {FOUNDING_TESTER_BADGE}
      </span>
    );
  }

  return (
    <div
      className={`rounded-lg border border-amber-300/50 bg-gradient-to-r from-amber-400/15 to-violet-500/10 px-3 py-1.5 text-xs ${className}`}
      role="status"
    >
      <div className="font-bold text-amber-100">{FOUNDING_TESTER_BADGE}</div>
      <div className="text-amber-100/85 font-medium">{FOUNDING_TESTER_THANKS}</div>
    </div>
  );
}

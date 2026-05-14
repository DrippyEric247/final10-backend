import React from "react";

/**
 * Visible reminder that non-production builds include dev tooling.
 * Never render in production.
 */
export default function DevModeBadge() {
  if (process.env.NODE_ENV === "production") return null;

  return (
    <div
      className="pointer-events-none fixed right-3 top-3 z-[230] select-none rounded-md border border-amber-400/35 bg-amber-950/55 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-amber-100 shadow-lg backdrop-blur-md"
      aria-hidden
    >
      DEV MODE ACTIVE
    </div>
  );
}

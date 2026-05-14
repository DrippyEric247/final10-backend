import React from "react";
import SavvyMark from "../../SavvyMark";

/**
 * Unified loading state — used for any data-heavy surface (feeds, lists,
 * dashboards). Shows the Final10 mark with a gentle pulse so the wait
 * feels branded rather than generic. `variant="inline"` is for small
 * slots inside a card; `variant="page"` fills a larger empty area.
 */
export default function LoadingState({
  label = "Loading…",
  variant = "page",
  className = "",
}) {
  const isInline = variant === "inline";
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className={[
        "f10-state",
        "f10-state--loading",
        isInline ? "f10-state--inline" : "f10-state--page",
        className,
      ].join(" ")}
    >
      <SavvyMark variant="brand" size={isInline ? 22 : 38} glow animated />
      <p className="f10-state__label">{label}</p>
    </div>
  );
}

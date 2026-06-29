import React from "react";
import { useApiCooling } from "../hooks/useApiCooling";

/** Quiet global notice when the client is backing off after HTTP 429. */
export default function ApiCoolingBanner() {
  const { isCooling, retryAfterMs } = useApiCooling();
  if (!isCooling) return null;

  const secs = Math.max(1, Math.ceil(retryAfterMs / 1000));

  return (
    <div
      className="api-cooling-banner"
      role="status"
      aria-live="polite"
      style={{
        position: "fixed",
        bottom: "max(4.5rem, calc(env(safe-area-inset-bottom, 0px) + 3.5rem))",
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 9998,
        padding: "0.4rem 0.85rem",
        borderRadius: "999px",
        fontSize: "0.75rem",
        color: "#fde68a",
        background: "rgba(30, 27, 46, 0.92)",
        border: "1px solid rgba(251, 191, 36, 0.35)",
        pointerEvents: "none",
      }}
    >
      Cooling down — retry in ~{secs}s
    </div>
  );
}

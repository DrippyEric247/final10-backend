import React from "react";
import { AlertTriangle } from "lucide-react";

/**
 * Unified error state — always prefer this over raw `throw`/`Error`
 * rendering. We hide stack traces from users and offer one clear retry
 * action. In development the original error object is logged to the
 * console for debugging.
 */
export default function ErrorState({
  title = "Something went wrong",
  description = "We couldn't load this right now. Try again in a moment.",
  error,
  onRetry,
  retryLabel = "Try again",
  className = "",
}) {
  React.useEffect(() => {
    if (error && process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.error("[ErrorState]", error);
    }
  }, [error]);

  return (
    <div
      role="alert"
      className={["f10-state", "f10-state--error", className].join(" ")}
    >
      <div className="f10-state__icon f10-state__icon--danger" aria-hidden>
        <AlertTriangle className="h-6 w-6" />
      </div>
      <h3 className="f10-state__title">{title}</h3>
      <p className="f10-state__desc">{description}</p>
      {typeof onRetry === "function" ? (
        <button
          type="button"
          onClick={onRetry}
          className="f10-state__retry"
        >
          {retryLabel}
        </button>
      ) : null}
    </div>
  );
}

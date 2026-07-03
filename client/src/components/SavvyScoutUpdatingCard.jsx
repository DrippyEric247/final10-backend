import React, { useState, useCallback } from "react";
import { useApiCooling } from "../hooks/useApiCooling";
import { manualRateLimitRetry } from "../lib/api";
import {
  SAVVY_SCOUT_UPDATING_TITLE,
  SAVVY_SCOUT_UPDATING_BODY,
  SAVVY_SCOUT_RETRY_FAILED_BODY,
} from "../lib/savvyScoutRateLimitCopy";
import "../styles/SavvyScoutUpdatingCard.css";

const SCOUT_IMG = "/assets/perk-machine/savvy-scout-alive.png";

/** Branded Savvy Scout card shown during API cooling / background 429 recovery. */
export default function SavvyScoutUpdatingCard() {
  const { isCooling, isFailed, canManualRetry } = useApiCooling();
  const [retrying, setRetrying] = useState(false);

  const handleRetry = useCallback(async () => {
    setRetrying(true);
    try {
      await manualRateLimitRetry();
    } finally {
      setRetrying(false);
    }
  }, []);

  if (!isCooling) return null;

  const message = isFailed ? SAVVY_SCOUT_RETRY_FAILED_BODY : SAVVY_SCOUT_UPDATING_BODY;

  return (
    <div className="savvy-scout-updating" role="status" aria-live="polite">
      <div className="savvy-scout-updating__card">
        <div className="savvy-scout-updating__scout-wrap" aria-hidden>
          <img src={SCOUT_IMG} alt="" className="savvy-scout-updating__scout" />
          {!isFailed ? <span className="savvy-scout-updating__scan" /> : null}
        </div>
        <div className="savvy-scout-updating__body">
          <h3 className="savvy-scout-updating__title">
            {SAVVY_SCOUT_UPDATING_TITLE}
            {!isFailed ? (
              <span className="savvy-scout-updating__dots" aria-hidden>
                <span className="savvy-scout-updating__dot" />
                <span className="savvy-scout-updating__dot" />
                <span className="savvy-scout-updating__dot" />
              </span>
            ) : null}
          </h3>
          <p className="savvy-scout-updating__message">{message}</p>
          {isFailed && canManualRetry ? (
            <div className="savvy-scout-updating__actions">
              <button
                type="button"
                className="savvy-scout-updating__retry"
                onClick={() => void handleRetry()}
                disabled={retrying}
              >
                {retrying ? "Retrying…" : "Retry"}
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

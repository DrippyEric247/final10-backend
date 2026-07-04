import React, { useState, useCallback } from "react";
import { useApiCooling } from "../hooks/useApiCooling";
import { useScoutScanActivity } from "../hooks/useScoutScanActivity";
import { manualRateLimitRetry } from "../lib/api";
import {
  SAVVY_SCOUT_SCANNING_TITLE,
  SAVVY_SCOUT_SCANNING_BODY,
  SAVVY_SCOUT_RETRY_FAILED_BODY,
} from "../lib/savvyScoutRateLimitCopy";
import "../styles/SavvyScoutUpdatingCard.css";

const SCOUT_IMG = "/assets/perk-machine/savvy-scout-alive.png";

/** Temporary Savvy Scout overlay — scanning during active search/AI, retry only on rate-limit failure. */
export default function SavvyScoutUpdatingCard() {
  const { isScanning } = useScoutScanActivity();
  const { isFailed, canManualRetry } = useApiCooling();
  const [retrying, setRetrying] = useState(false);

  const handleRetry = useCallback(async () => {
    setRetrying(true);
    try {
      await manualRateLimitRetry();
    } finally {
      setRetrying(false);
    }
  }, []);

  if (!isScanning && !isFailed) return null;

  const isScanMode = isScanning && !isFailed;
  const title = isScanMode ? SAVVY_SCOUT_SCANNING_TITLE : "Savvy Scout is reconnecting...";
  const message = isScanMode ? SAVVY_SCOUT_SCANNING_BODY : SAVVY_SCOUT_RETRY_FAILED_BODY;

  return (
    <div
      className={`savvy-scout-updating${isScanMode ? " savvy-scout-updating--scanning" : ""}`}
      role="status"
      aria-live="polite"
    >
      <div className="savvy-scout-updating__card">
        <div className="savvy-scout-updating__scout-wrap" aria-hidden>
          <img src={SCOUT_IMG} alt="" className="savvy-scout-updating__scout" />
          {isScanMode ? <span className="savvy-scout-updating__scan" /> : null}
        </div>
        <div className="savvy-scout-updating__body">
          <h3 className="savvy-scout-updating__title">
            {title}
            {isScanMode ? (
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

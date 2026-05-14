import React, { useEffect } from "react";
import { createPortal } from "react-dom";

export type FlipRewardBreakdownLine = {
  label: string;
  points: number;
  cap?: boolean;
};

export type SavvyFlipSaleRewardPayload = {
  headline: string;
  subcopy: string;
  savvyLine: string;
  totalPoints: number;
  theoreticalTotal?: number;
  dailyCapShortfall?: number;
  breakdown: FlipRewardBreakdownLine[];
  /** e.g. "You executed a 9.1 Flip Score deal" */
  executionLine?: string | null;
  eliteBadgeUnlocked?: boolean;
  flipGamification?: {
    bestFlipScoreEver: number | null;
    totalFlipsCompleted: number;
    averageFlipScore: number | null;
  } | null;
};

type Props = {
  open: boolean;
  payload: SavvyFlipSaleRewardPayload | null;
  onClose: () => void;
};

export default function SavvyFlipSaleRewardModal({ open, payload, onClose }: Props) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || !payload) return null;

  const node = (
    <div
      className="seller-flip-reward-backdrop"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="seller-flip-reward-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="seller-flip-reward-title"
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" className="seller-pcalc-close" onClick={onClose} aria-label="Close">
          ×
        </button>
        <div className="seller-flip-reward-hero">
          <h2 id="seller-flip-reward-title" className="seller-flip-reward-headline">
            {payload.headline}
          </h2>
          <p className="seller-flip-reward-subcopy">{payload.subcopy}</p>
          <p className="seller-flip-reward-big">{payload.savvyLine}</p>
          {payload.executionLine ? (
            <p className="seller-flip-reward-execution">{payload.executionLine}</p>
          ) : null}
          {payload.eliteBadgeUnlocked ? (
            <p className="seller-flip-reward-elite">Elite Flip badge unlocked — you closed an 8.5+ score lane.</p>
          ) : null}
          {payload.flipGamification ? (
            <div className="seller-flip-reward-stats" aria-label="Updated flip stats">
              <span>
                Best ever:{" "}
                <strong>
                  {payload.flipGamification.bestFlipScoreEver != null
                    ? payload.flipGamification.bestFlipScoreEver.toFixed(1)
                    : "—"}
                </strong>
              </span>
              <span>
                Flips: <strong>{payload.flipGamification.totalFlipsCompleted}</strong>
              </span>
              <span>
                Avg score:{" "}
                <strong>
                  {payload.flipGamification.averageFlipScore != null
                    ? payload.flipGamification.averageFlipScore.toFixed(1)
                    : "—"}
                </strong>
              </span>
            </div>
          ) : null}
        </div>
        <div className="seller-flip-reward-breakdown" aria-label="Point breakdown">
          <div className="seller-flip-reward-bd-title">Breakdown</div>
          <ul className="seller-flip-reward-bd-list">
            {payload.breakdown.map((row, i) => (
              <li key={`${row.label}-${row.points}-${i}`} className={row.cap ? "is-cap" : ""}>
                <span>{row.label}</span>
                <span className={row.points < 0 ? "is-neg" : ""}>
                  {row.points > 0 ? `+${row.points}` : row.points}
                </span>
              </li>
            ))}
          </ul>
          {payload.dailyCapShortfall != null && payload.dailyCapShortfall > 0 ? (
            <p className="seller-flip-reward-cap-note">
              Free plan caps flip Savvy per day. Upgrade for unlimited flip rewards and stronger profit
              multipliers.
            </p>
          ) : null}
        </div>
        <button type="button" className="seller-flip-btn seller-flip-reward-done" onClick={onClose}>
          Nice
        </button>
      </div>
    </div>
  );

  if (typeof document === "undefined") return null;
  return createPortal(node, document.body);
}

import React from "react";

export type FlipScoreTier = "elite" | "strong" | "risky" | "avoid";

export type FlipScoreFields = {
  flipScore?: number;
  flipScoreTier?: FlipScoreTier;
  flipScoreLabel?: string;
  flipScoreWhy?: string;
};

type Props = {
  row: FlipScoreFields;
  variant?: "hero" | "card";
};

const TIER_EMOJI: Record<FlipScoreTier, string> = {
  elite: "🔥",
  strong: "💰",
  risky: "⚠️",
  avoid: "❌",
};

export default function FlipScoreCallout({ row, variant = "card" }: Props) {
  const s = row.flipScore;
  const tier = row.flipScoreTier;
  const label = row.flipScoreLabel;
  const why = row.flipScoreWhy;
  if (s == null || tier == null || !label) return null;

  const wrap =
    variant === "hero" ? "seller-flip-score-wrap seller-flip-score-wrap--hero" : "seller-flip-score-wrap";

  const headline =
    s >= 6 ? "High score because:" : "Why this reads cautious:";

  return (
    <div className={`${wrap} seller-flip-score--${tier}`} aria-label={`Flip score ${s.toFixed(1)}`}>
      <div className="seller-flip-score-main">
        <span className="seller-flip-score-num">{s.toFixed(1)}</span>
        <span className="seller-flip-score-suffix">Flip Score</span>
      </div>
      <div className="seller-flip-score-badge">
        <span className="seller-flip-score-emoji" aria-hidden>
          {TIER_EMOJI[tier]}
        </span>
        <span>{label}</span>
      </div>
      {why ? (
        <p className="seller-flip-score-why">
          <strong>{headline}</strong> {why}
        </p>
      ) : null}
    </div>
  );
}

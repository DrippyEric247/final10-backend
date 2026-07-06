import React, { useEffect } from "react";
import "../../styles/PerkRewardReveal.css";

/**
 * Reward reveal for non-card Perk Machine rewards. Two intensities:
 *   - mode "cinematic" → full-screen ceremony for big moments
 *     (legendary/mythic eggs, supply drops, scout upgrades, first-ever unlocks)
 *   - mode "quick"     → fast ~1s glow-and-fly chip so grinding stays fast
 *     (common eggs, XP tokens, multipliers, shields)
 *
 * Calling cards use the dedicated unlock ceremony instead.
 *
 * @param {{ reveal: ({key,icon,eyebrow,title,subtitle,accent,tier,mode}|null), onClose: () => void }} props
 */
export default function PerkRewardReveal({ reveal, onClose }) {
  const quick = reveal?.mode === "quick";

  useEffect(() => {
    if (!reveal) return undefined;
    const id = window.setTimeout(() => onClose?.(), quick ? 1100 : 3400);
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(id);
      window.removeEventListener("keydown", onKey);
    };
  }, [reveal, quick, onClose]);

  if (!reveal) return null;

  const accent = reveal.accent || "#a5b4fc";

  // Fast, non-blocking reveal: glow chip that flies toward the balance pill.
  if (quick) {
    return (
      <div
        className="perk-quick-reveal"
        role="status"
        aria-live="polite"
        style={{ "--reveal-accent": accent }}
        key={reveal.id || reveal.key}
      >
        <div className="perk-quick-reveal__chip">
          <span className="perk-quick-reveal__icon" aria-hidden>
            {reveal.icon}
          </span>
          <span className="perk-quick-reveal__label">{reveal.title}</span>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`perk-reward-reveal perk-reward-reveal--${reveal.tier || "rare"}`}
      role="alert"
      aria-live="assertive"
      style={{ "--reveal-accent": accent }}
      onClick={() => onClose?.()}
      key={reveal.id || reveal.key}
    >
      <div className="perk-reward-reveal__backdrop" aria-hidden />
      <div className="perk-reward-reveal__card" onClick={(e) => e.stopPropagation()}>
        <div className="perk-reward-reveal__beam" aria-hidden />
        <div className="perk-reward-reveal__icon" aria-hidden>
          {reveal.icon}
        </div>
        <p className="perk-reward-reveal__eyebrow">{reveal.eyebrow}</p>
        <h3 className="perk-reward-reveal__title">{reveal.title}</h3>
        <p className="perk-reward-reveal__subtitle">{reveal.subtitle}</p>
        <button type="button" className="perk-reward-reveal__btn" onClick={() => onClose?.()}>
          Continue
        </button>
      </div>
    </div>
  );
}

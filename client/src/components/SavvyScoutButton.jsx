import { useEffect, useMemo, useState } from "react";
import scoutMascot from "../assets/savvy-scout-mascot.png";
import "../styles/SavvyScoutButton.css";

/**
 * Floating Savvy Scout mascot button — visual skin for the side assistant.
 * @param {{
 *   state?: "idle" | "searching" | "dealFound" | "excited",
 *   expanded?: boolean,
 *   unread?: number,
 *   onClick?: () => void,
 *   ariaLabel?: string,
 *   title?: string,
 * }} props
 */
export default function SavvyScoutButton({
  state = "idle",
  expanded = false,
  unread = 0,
  onClick,
  ariaLabel,
  title,
}) {
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return undefined;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReducedMotion(Boolean(mq.matches));
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  const className = useMemo(() => {
    const parts = ["savvy-scout-btn"];
    if (state && state !== "idle") parts.push(`savvy-scout-btn--${state}`);
    if (reducedMotion) parts.push("savvy-scout-btn--reduced");
    return parts.join(" ");
  }, [state, reducedMotion]);

  return (
    <button
      type="button"
      className={className}
      onClick={onClick}
      aria-expanded={expanded}
      aria-label={ariaLabel}
      title={title}
    >
      <span className="savvy-scout-btn__ring" aria-hidden />
      <span className="savvy-scout-btn__frame">
        <img
          className="savvy-scout-btn__img"
          src={scoutMascot}
          alt=""
          width={56}
          height={56}
          draggable={false}
        />
        {!reducedMotion ? <span className="savvy-scout-btn__blink" aria-hidden /> : null}
        <span className="savvy-scout-btn__mag" aria-hidden />
        <span className="savvy-scout-btn__spark" aria-hidden>
          <span />
          <span />
          <span />
          <span />
          <span />
          <span />
        </span>
      </span>
      {unread > 0 && !expanded ? (
        <span className="savvy-scout-btn__badge">{unread > 9 ? "9+" : unread}</span>
      ) : null}
    </button>
  );
}

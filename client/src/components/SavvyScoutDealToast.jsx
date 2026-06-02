import { useEffect, useState } from "react";
import scoutMascot from "../assets/savvy-scout-mascot.png";
import "../styles/SavvyScoutDealToast.css";

/**
 * Deal-found toast card shown above the Savvy Scout dock button.
 */
export default function SavvyScoutDealToast({
  title = "Deal found!",
  message = "I found something worth checking.",
  onViewDeal,
  onDismiss,
  autoHideMs = 12000,
}) {
  const [flash, setFlash] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return undefined;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReducedMotion(Boolean(mq.matches));
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (reducedMotion) {
      setFlash(false);
      return undefined;
    }
    const t = window.setTimeout(() => setFlash(false), 900);
    return () => clearTimeout(t);
  }, [reducedMotion]);

  useEffect(() => {
    if (!autoHideMs || !onDismiss) return undefined;
    const t = window.setTimeout(onDismiss, autoHideMs);
    return () => clearTimeout(t);
  }, [autoHideMs, onDismiss]);

  return (
    <div
      className={`savvy-scout-deal-toast${flash ? " savvy-scout-deal-toast--flash" : ""}`}
      role="status"
    >
      {!reducedMotion ? (
        <div className="savvy-scout-deal-toast__confetti" aria-hidden>
          <span />
          <span />
          <span />
          <span />
          <span />
        </div>
      ) : null}
      <button
        type="button"
        className="savvy-scout-deal-toast__x"
        aria-label="Dismiss deal alert"
        onClick={onDismiss}
      >
        ×
      </button>
      <div className="savvy-scout-deal-toast__scout">
        <img src={scoutMascot} alt="" width={52} height={52} draggable={false} />
      </div>
      <div className="savvy-scout-deal-toast__body">
        <div className="savvy-scout-deal-toast__eyebrow">🔥 Deal found</div>
        <div className="savvy-scout-deal-toast__title">{title}</div>
        <p className="savvy-scout-deal-toast__msg">{message}</p>
        <button type="button" className="savvy-scout-deal-toast__cta" onClick={onViewDeal}>
          View Deal
        </button>
      </div>
    </div>
  );
}

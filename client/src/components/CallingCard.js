import { useEffect, useRef, useState } from "react";

function rarityClass(rarity) {
  const r = String(rarity || "common").toLowerCase();
  if (r === "exclusive") return "f10-ccard--exclusive";
  if (r === "legendary") return "f10-ccard--legendary";
  if (r === "elite") return "f10-ccard--elite";
  if (r === "epic") return "f10-ccard--epic";
  if (r === "rare") return "f10-ccard--rare";
  return "f10-ccard--common";
}

export default function CallingCard({
  title,
  subtitle,
  rarity = "common",
  isEquipped = false,
  isUnlocked = true,
  stripe,
  flare,
  className = "",
  onClick,
  showEquippedBadge = true,
  unlockPulse = false,
  animationPreset = "",
  symbol = "",
  collection = "",
}) {
  const rootRef = useRef(null);
  const [visible, setVisible] = useState(true);
  const [touchBoost, setTouchBoost] = useState(false);

  useEffect(() => {
    const el = rootRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entries) => {
        setVisible(entries.some((e) => e.isIntersecting));
      },
      { threshold: 0.08 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={rootRef}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={(e) => {
        if (!onClick) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
      onTouchStart={() => {
        setTouchBoost(true);
        window.setTimeout(() => setTouchBoost(false), 700);
      }}
      style={{
        "--f10-card-stripe": stripe,
        "--f10-card-flare": flare,
      }}
      className={`f10-ccard ${rarityClass(rarity)} ${
        isEquipped ? "f10-ccard--equipped" : ""
      } ${isUnlocked ? "" : "f10-ccard--locked"} ${visible ? "" : "f10-ccard--paused"} ${
        touchBoost ? "f10-ccard--touch-boost" : ""
      } ${unlockPulse ? "f10-ccard--unlock" : ""} ${
        animationPreset === "first_responder" ? "f10-ccard--first-responder" : ""
      } ${className}`}
      aria-label={`${title}${isEquipped ? ", equipped" : ""}`}
    >
      <div className="f10-ccard-bg" />
      <div className="f10-ccard-shimmer" />
      <div className="f10-ccard-sweep" />
      <div className="f10-ccard-aura" />
      {animationPreset === "first_responder" ? (
        <>
          <div className="f10-ccard-orbit-ring" aria-hidden />
          <div className="f10-ccard-honor-band" aria-hidden />
        </>
      ) : null}
      <div className="f10-ccard-particles" aria-hidden>
        <span />
        <span />
        <span />
      </div>
      <div className="f10-ccard-text">
        {symbol ? <p className="f10-ccard-symbol">{symbol}</p> : null}
        <p className="f10-ccard-title">{title}</p>
        <p className="f10-ccard-sub">{subtitle}</p>
        {collection ? <p className="f10-ccard-collection">{collection}</p> : null}
      </div>
      {isEquipped && showEquippedBadge ? (
        <span className="f10-ccard-equipped">EQUIPPED</span>
      ) : null}
    </div>
  );
}

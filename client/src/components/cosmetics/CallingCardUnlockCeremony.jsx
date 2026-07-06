import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import CallingCard from "../CallingCard";
import { useAuth } from "../../context/AuthContext";
import { CALLING_CARD_UNLOCK_EVENT } from "../../lib/callingCardUnlockBus";
import { findCallingCard } from "../../lib/customizationCatalog";
import { equipCallingCardAndSync } from "../../lib/equipCallingCard";
import { playCallingCardUnlockIntro, playCallingCardUnlockResolve } from "../../lib/callingCardUnlockSound";
import "../../styles/CallingCardUnlockCeremony.css";

function rarityTier(r) {
  const x = String(r || "common").toLowerCase();
  if (x === "exclusive" || x === "legendary") return "legendary";
  if (x === "elite") return "epic";
  return x;
}

/** Star count per rarity — drives the ⭐⭐⭐ EPIC line. */
function rarityStars(r) {
  switch (String(r || "common").toLowerCase()) {
    case "exclusive":
      return 5;
    case "legendary":
      return 4;
    case "epic":
    case "elite":
      return 3;
    case "rare":
      return 2;
    default:
      return 1;
  }
}

export default function CallingCardUnlockCeremony() {
  const navigate = useNavigate();
  const { refreshProfile } = useAuth();
  const reduceMotion = useReducedMotion();
  const [session, setSession] = useState(null);
  const [equipBusy, setEquipBusy] = useState(false);
  const resolveSoundTsRef = useRef(0);

  useEffect(() => {
    const onUnlock = (e) => {
      const d = e.detail || {};
      const cardId = String(d.cardId || "").trim();
      if (!cardId) return;
      setSession({
        cardId,
        unlockReason: String(d.unlockReason || ""),
        trigger: String(d.trigger || ""),
        imageUrl: String(d.imageUrl || ""),
        duplicate: Boolean(d.duplicate),
        duplicateSavvy: Number(d.duplicateSavvy) || 0,
        _ts: Date.now(),
      });
      playCallingCardUnlockIntro();
    };
    window.addEventListener(CALLING_CARD_UNLOCK_EVENT, onUnlock);
    return () => window.removeEventListener(CALLING_CARD_UNLOCK_EVENT, onUnlock);
  }, []);

  const close = useCallback(() => {
    setSession(null);
  }, []);

  useEffect(() => {
    if (!session) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (ev) => {
      if (ev.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [session, close]);

  const onCardRevealComplete = useCallback(() => {
    if (!session) return;
    if (resolveSoundTsRef.current === session._ts) return;
    resolveSoundTsRef.current = session._ts;
    const c = findCallingCard(session.cardId);
    playCallingCardUnlockResolve(rarityTier(c.rarity));
  }, [session]);

  const onEquip = async () => {
    if (!session || equipBusy) return;
    setEquipBusy(true);
    try {
      const ok = await equipCallingCardAndSync(session.cardId);
      if (ok && typeof refreshProfile === "function") {
        await refreshProfile();
      }
    } finally {
      setEquipBusy(false);
      close();
    }
  };

  const onViewCollection = () => {
    close();
    navigate("/customization");
  };

  if (typeof document === "undefined") return null;

  const card = session ? findCallingCard(session.cardId) : null;
  const duplicate = Boolean(session?.duplicate);
  const stars = card ? rarityStars(card.rarity) : 1;
  const rarityLabel = String(card?.rarity || "common").toUpperCase();

  const reason = duplicate
    ? `+${(session?.duplicateSavvy || 0).toLocaleString()} Savvy added to your wallet`
    : session?.unlockReason?.trim() ||
      (card?.tagline ? String(card.tagline) : "") ||
      (card?.requirement ? `Earned: ${card.requirement}` : "You unlocked this card.");

  const tier = card ? rarityTier(card.rarity) : "common";
  const burst = tier === "legendary" && !duplicate;

  return createPortal(
    <AnimatePresence>
      {session && card ? (
        <motion.div
          key={`${session.cardId}-${session._ts}`}
          className={`f10-cc-unlock-root f10-cc-unlock--${tier} ${burst ? "f10-cc-unlock--burst" : ""} ${
            duplicate ? "f10-cc-unlock--duplicate" : ""
          }`}
          role="dialog"
          aria-modal="true"
          aria-labelledby="f10-cc-unlock-title"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduceMotion ? 0.12 : 0.28 }}
        >
          <motion.button
            type="button"
            className="f10-cc-unlock-backdrop"
            aria-label="Close"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={close}
          />

          <div className="f10-cc-unlock-stage" onClick={(e) => e.stopPropagation()}>
            <div className="f10-cc-unlock-beam" aria-hidden />

            <motion.p
              className="f10-cc-unlock-eyebrow"
              id="f10-cc-unlock-title"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: reduceMotion ? 0 : 0.15, duration: 0.3 }}
            >
              {duplicate ? "Duplicate!" : "Calling Card Unlocked"}
            </motion.p>

            <div className="f10-cc-unlock-particles" aria-hidden>
              {burst ? (
                <>
                  <span className="f10-cc-unlock-spark f10-cc-unlock-spark--a" />
                  <span className="f10-cc-unlock-spark f10-cc-unlock-spark--b" />
                  <span className="f10-cc-unlock-spark f10-cc-unlock-spark--c" />
                  <span className="f10-cc-unlock-spark f10-cc-unlock-spark--d" />
                </>
              ) : (
                <>
                  <span className="f10-cc-unlock-dust" />
                  <span className="f10-cc-unlock-dust f10-cc-unlock-dust--2" />
                  <span className="f10-cc-unlock-dust f10-cc-unlock-dust--3" />
                </>
              )}
            </div>

            <motion.div
              className="f10-cc-unlock-card-shell"
              initial={
                reduceMotion
                  ? { opacity: 0, scale: 0.96 }
                  : { y: 26, opacity: 0, scale: 0.7, filter: "blur(14px)" }
              }
              animate={{ y: 0, opacity: 1, scale: 1, filter: "blur(0px)" }}
              transition={
                reduceMotion
                  ? { duration: 0.2 }
                  : { type: "spring", stiffness: 120, damping: 18, mass: 0.85 }
              }
              onAnimationComplete={onCardRevealComplete}
            >
              <div className="f10-cc-unlock-card-glow" aria-hidden />
              <div className="f10-cc-unlock-sweep-host" aria-hidden>
                <div className="f10-cc-unlock-sweep" />
              </div>
              <CallingCard
                className="f10-cc-unlock-card"
                title={card.displayTitle || card.name}
                subtitle={card.displaySubtitle || card.tagline}
                rarity={card.rarity || "common"}
                isEquipped={false}
                isUnlocked
                stripe={card.stripe}
                flare={card.flare}
                showEquippedBadge={false}
                unlockPulse
                animationPreset={card.animationPreset || ""}
                symbol={card.animationPreset === "first_responder" ? "S★" : ""}
                collection={card.collection || card.group || ""}
              />
            </motion.div>

            <motion.div
              className="f10-cc-unlock-copy"
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: reduceMotion ? 0 : 0.35, duration: 0.4 }}
            >
              <div className="f10-cc-unlock-divider" aria-hidden />
              <h2 className="f10-cc-unlock-name">{card.name}</h2>
              <p className="f10-cc-unlock-reason">{reason}</p>
              <p className={`f10-cc-unlock-rarity f10-cc-unlock-rarity--${tier}`}>
                <span className="f10-cc-unlock-stars" aria-hidden>
                  {"\u2b50".repeat(stars)}
                </span>
                <span className="f10-cc-unlock-rarity-label">{rarityLabel}</span>
              </p>
              <div className="f10-cc-unlock-divider" aria-hidden />
            </motion.div>

            <motion.div
              className="f10-cc-unlock-actions"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: reduceMotion ? 0 : 0.5, duration: 0.35 }}
            >
              <button
                type="button"
                className="f10-cc-unlock-btn f10-cc-unlock-btn--primary"
                disabled={equipBusy}
                onClick={onEquip}
              >
                {equipBusy ? "Equipping…" : "Equip Now"}
              </button>
              <button type="button" className="f10-cc-unlock-btn" onClick={close}>
                Keep Current
              </button>
              <button type="button" className="f10-cc-unlock-btn f10-cc-unlock-btn--ghost" onClick={onViewCollection}>
                View Collection
              </button>
            </motion.div>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body
  );
}

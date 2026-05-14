import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import "../styles/Customization.css";
import "../styles/CallingCard.css";
import CallingCard from "../components/CallingCard";
import { useAuth } from "../context/AuthContext";
import { useCosmetics } from "../hooks/useCosmetics";
import {
  CALLING_CARDS,
  EMBLEMS,
  FIRST_RESPONDER_CARD_ID,
  findCallingCard,
  findEmblem,
  getEquippedCallingCardId,
  getEquippedEmblemId,
  setEquippedCallingCardId,
  setEquippedEmblemId,
  unlockCallingCardForDev,
} from "../lib/customizationCatalog";
import { showCallingCardUnlock } from "../lib/callingCardUnlockBus";
export default function Customization() {
  const auth = useAuth();
  const cos = useCosmetics(Boolean(auth?.token));
  const [syncTick, setSyncTick] = useState(0);
  const bumpSync = useCallback(() => setSyncTick((t) => t + 1), []);

  useEffect(() => {
    const onStorage = (e) => {
      if (e.key == null || String(e.key).startsWith("f10_")) bumpSync();
    };
    const onVis = () => {
      if (document.visibilityState === "visible") bumpSync();
    };
    window.addEventListener("storage", onStorage);
    document.addEventListener("visibilitychange", onVis);
    const id = window.setInterval(bumpSync, 4000);
    return () => {
      window.removeEventListener("storage", onStorage);
      document.removeEventListener("visibilitychange", onVis);
      clearInterval(id);
    };
  }, [bumpSync]);

  const [tab, setTab] = useState("emblems");
  const [equipMessage, setEquipMessage] = useState(null);
  const [equippedEmblem, setEquippedEmblem] = useState(() => getEquippedEmblemId());
  const [equippedCard, setEquippedCard] = useState(() => getEquippedCallingCardId());
  const [previewEmblemId, setPreviewEmblemId] = useState(null);
  const [previewCardId, setPreviewCardId] = useState(null);
  const [newCardUnlock, setNewCardUnlock] = useState(null);
  const [unlockPulseCardId, setUnlockPulseCardId] = useState(null);
  const [rarityFilter, setRarityFilter] = useState("all");
  const [collectionFilter, setCollectionFilter] = useState("all");
  const [cardDetailId, setCardDetailId] = useState(null);
  const previousCardUnlockedRef = useRef(null);
  const isDev = process.env.NODE_ENV !== "production";

  useEffect(() => {
    setEquippedEmblem(getEquippedEmblemId());
    setEquippedCard(getEquippedCallingCardId());
  }, [syncTick]);

  useEffect(() => {
    if (cos.useServer && cos.data?.equipped) {
      setEquippedEmblem(cos.data.equipped.emblemId || getEquippedEmblemId());
      setEquippedCard(cos.data.equipped.callingCardId || getEquippedCallingCardId());
    }
  }, [cos.useServer, cos.data]);

  const serverUnlockReady = cos.useServer && !cos.loading && cos.data;

  // Union of server-known unlocks and local progression. This lets cosmetics
  // driven entirely by client signals (Savvy Offers / Business Offers cards)
  // unlock for authed users even before the server schema catches up.
  const emblemUnlocked = useMemo(
    () => {
      void syncTick;
      return EMBLEMS.reduce((acc, e) => {
        const local = e.check();
        acc[e.id] = serverUnlockReady ? cos.unlockedSet.has(e.id) || local : local;
        return acc;
      }, {});
    },
    [syncTick, serverUnlockReady, cos.unlockedSet]
  );

  const cardUnlocked = useMemo(
    () => {
      void syncTick;
      return CALLING_CARDS.reduce((acc, c) => {
        const local = c.check();
        acc[c.id] = serverUnlockReady ? cos.unlockedSet.has(c.id) || local : local;
        return acc;
      }, {});
    },
    [syncTick, serverUnlockReady, cos.unlockedSet]
  );

  const loadoutEmblemId = previewEmblemId ?? equippedEmblem;
  const loadoutCardId = previewCardId ?? equippedCard;
  const loadoutEmblem = findEmblem(loadoutEmblemId);
  const loadoutCard = findCallingCard(loadoutCardId);
  const emblemPreviewLocked = previewEmblemId && !emblemUnlocked[previewEmblemId];
  const cardPreviewLocked = previewCardId && !cardUnlocked[previewCardId];
  const showingEmblemPreview = Boolean(previewEmblemId);
  const showingCardPreview = Boolean(previewCardId);

  const cardCollections = useMemo(
    () =>
      Array.from(
        new Set(CALLING_CARDS.map((c) => c.collection || c.group || "Core"))
      ).sort((a, b) => a.localeCompare(b)),
    []
  );

  const filteredCards = useMemo(
    () =>
      CALLING_CARDS.filter((c) => {
        const rarityOk = rarityFilter === "all" || String(c.rarity || "common") === rarityFilter;
        const collection = c.collection || c.group || "Core";
        const collectionOk = collectionFilter === "all" || collection === collectionFilter;
        return rarityOk && collectionOk;
      }),
    [rarityFilter, collectionFilter]
  );

  useEffect(() => {
    const prev = previousCardUnlockedRef.current;
    if (!prev) {
      previousCardUnlockedRef.current = cardUnlocked;
      return;
    }
    const newlyUnlocked = CALLING_CARDS.find((c) => cardUnlocked[c.id] && !prev[c.id]);
    previousCardUnlockedRef.current = cardUnlocked;
    if (!newlyUnlocked) return;
    if (newlyUnlocked.id === FIRST_RESPONDER_CARD_ID) {
      showCallingCardUnlock({
        cardId: newlyUnlocked.id,
        unlockReason: "Earned for joining the Savvy First Responder Program.",
        trigger: "first_responder_program",
      });
    } else {
      showCallingCardUnlock({
        cardId: newlyUnlocked.id,
        unlockReason: newlyUnlocked.description
          ? `${String(newlyUnlocked.description).replace(/\.\s*$/, "")}.`
          : "",
        trigger: "calling_card_progression",
      });
    }
    setUnlockPulseCardId(newlyUnlocked.id);
    setNewCardUnlock({ id: newlyUnlocked.id, name: newlyUnlocked.name });
    window.setTimeout(() => setUnlockPulseCardId((id) => (id === newlyUnlocked.id ? null : id)), 2300);
    window.setTimeout(() => {
      setNewCardUnlock((cur) => (cur?.id === newlyUnlocked.id ? null : cur));
    }, 2800);
  }, [cardUnlocked]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onDebug = (e) => {
      const id = e?.detail?.cardId;
      const card = CALLING_CARDS.find((c) => c.id === id) || CALLING_CARDS.find((c) => cardUnlocked[c.id]);
      if (!card) return;
      showCallingCardUnlock({
        cardId: card.id,
        unlockReason: card.requirement ? `Earned: ${card.requirement}` : "",
        trigger: "debug_unlock",
      });
      setUnlockPulseCardId(card.id);
      setNewCardUnlock({ id: card.id, name: card.name });
      window.setTimeout(() => setUnlockPulseCardId((cur) => (cur === card.id ? null : cur)), 2200);
    };
    window.addEventListener("f10-debug-unlock-calling-card", onDebug);
    if (!window.final10CallingCardDev) {
      window.final10CallingCardDev = {
        unlock: (cardId) =>
          window.dispatchEvent(
            new CustomEvent("f10-debug-unlock-calling-card", { detail: { cardId } })
          ),
        reveal: (cardId, unlockReason, trigger) =>
          showCallingCardUnlock({
            cardId: String(cardId || ""),
            unlockReason: unlockReason != null ? String(unlockReason) : "",
            trigger: trigger != null ? String(trigger) : "dev_reveal",
          }),
      };
    }
    return () => window.removeEventListener("f10-debug-unlock-calling-card", onDebug);
  }, [cardUnlocked]);

  const equipEmblem = async () => {
    if (!previewEmblemId || !emblemUnlocked[previewEmblemId]) return;
    if (cos.useServer) {
      try {
        await cos.equip("emblem", previewEmblemId);
        setEquippedEmblem(previewEmblemId);
        setPreviewEmblemId(null);
        setEquipMessage(null);
        bumpSync();
      } catch {
        setEquipMessage("Could not equip emblem. Check your connection and try again.");
      }
      return;
    }
    setEquippedEmblemId(previewEmblemId);
    setEquippedEmblem(previewEmblemId);
    setPreviewEmblemId(null);
    bumpSync();
  };

  const equipCard = async () => {
    if (!previewCardId || !cardUnlocked[previewCardId]) return;
    if (cos.useServer) {
      try {
        await cos.equip("calling_card", previewCardId);
        setEquippedCard(previewCardId);
        setPreviewCardId(null);
        setEquipMessage(null);
        bumpSync();
      } catch {
        setEquipMessage("Could not equip calling card. Check your connection and try again.");
      }
      return;
    }
    setEquippedCallingCardId(previewCardId);
    setEquippedCard(previewCardId);
    setPreviewCardId(null);
    bumpSync();
  };

  const equipCardById = async (cardId) => {
    if (!cardId || !cardUnlocked[cardId]) return;
    setPreviewCardId(cardId);
    if (cos.useServer) {
      try {
        await cos.equip("calling_card", cardId);
        setEquippedCard(cardId);
        setEquipMessage(null);
        bumpSync();
      } catch {
        setEquipMessage("Could not equip calling card. Check your connection and try again.");
      }
      return;
    }
    setEquippedCallingCardId(cardId);
    setEquippedCard(cardId);
    bumpSync();
  };

  const devUnlockFirstResponder = () => {
    const ok = unlockCallingCardForDev(FIRST_RESPONDER_CARD_ID);
    if (!ok) return;
    setUnlockPulseCardId(FIRST_RESPONDER_CARD_ID);
    setNewCardUnlock({ id: FIRST_RESPONDER_CARD_ID, name: "First In, Last Out" });
    setSyncTick((t) => t + 1);
  };

  return (
    <div className="f10-custom-page">
      <header className="f10-custom-hero">
        <h1>Customization</h1>
        <p>
          Equip emblems and calling cards to show who you are in the lane. Unlock more
          by saving deals, stacking streaks, ranking up, and running promos.
        </p>
      </header>

      {isDev ? (
        <section className="f10-dev-tools" aria-label="Developer cosmetics tools">
          <button type="button" className="f10-custom-btn" onClick={devUnlockFirstResponder}>
            Unlock First In, Last Out
          </button>
          <button
            type="button"
            className="f10-custom-btn f10-custom-btn--primary"
            onClick={() => void equipCardById(FIRST_RESPONDER_CARD_ID)}
          >
            Equip First In, Last Out
          </button>
        </section>
      ) : null}

      {auth?.token && cos.loading ? (
        <p style={{ color: "#94a3b8", margin: "8px 0 0" }} role="status">
          Loading your unlocks…
        </p>
      ) : null}
      {cos.error ? (
        <div
          style={{
            margin: "12px 0",
            padding: "12px 14px",
            borderRadius: 10,
            background: "rgba(127,29,29,0.35)",
            border: "1px solid rgba(248,113,113,0.45)",
            color: "#fecaca",
            display: "flex",
            flexWrap: "wrap",
            gap: 10,
            alignItems: "center",
          }}
          role="alert"
        >
          <span style={{ flex: "1 1 200px" }}>{cos.error}</span>
          <button type="button" className="f10-custom-btn f10-custom-btn--primary" onClick={() => void cos.reload()}>
            Retry
          </button>
        </div>
      ) : null}

      {equipMessage ? (
        <div
          style={{
            margin: "12px 0",
            padding: "10px 12px",
            borderRadius: 10,
            background: "rgba(127,29,29,0.35)",
            border: "1px solid rgba(248,113,113,0.4)",
            color: "#fecaca",
            display: "flex",
            justifyContent: "space-between",
            gap: 10,
            flexWrap: "wrap",
          }}
          role="status"
        >
          <span>{equipMessage}</span>
          <button type="button" className="f10-custom-btn f10-custom-btn--ghost" onClick={() => setEquipMessage(null)}>
            Dismiss
          </button>
        </div>
      ) : null}

      <section className="f10-loadout" aria-label="Current loadout">
        <div
          className={`f10-loadout-panel ${!emblemPreviewLocked && loadoutEmblemId === equippedEmblem && !showingEmblemPreview ? "f10-loadout-panel--glow" : ""}`}
        >
          <div className="f10-loadout-label">
            Emblem
            {showingEmblemPreview ? (
              <span
                className={`f10-loadout-badge ${emblemPreviewLocked ? "f10-loadout-badge--locked" : "f10-loadout-badge--preview"}`}
              >
                {emblemPreviewLocked ? "Locked preview" : "Preview"}
              </span>
            ) : (
              <span className="f10-loadout-badge">Equipped</span>
            )}
          </div>
          <div
            className="f10-loadout-emblem-display"
            style={{ background: loadoutEmblem.accent }}
          >
            {loadoutEmblem.glyph}
          </div>
          <h3 className="f10-loadout-emblem-name">{loadoutEmblem.name}</h3>
          <p className="f10-loadout-emblem-sub">
            {emblemPreviewLocked ? loadoutEmblem.requirement : loadoutEmblem.subtitle}
          </p>
          <div className="f10-loadout-actions">
            <button
              type="button"
              className="f10-custom-btn f10-custom-btn--primary"
              disabled={
                !previewEmblemId ||
                !emblemUnlocked[previewEmblemId] ||
                previewEmblemId === equippedEmblem
              }
              onClick={equipEmblem}
            >
              Equip emblem
            </button>
            {showingEmblemPreview ? (
              <button
                type="button"
                className="f10-custom-btn"
                onClick={() => setPreviewEmblemId(null)}
              >
                Show equipped
              </button>
            ) : null}
          </div>
        </div>

        <div
          className={`f10-loadout-panel ${!cardPreviewLocked && loadoutCardId === equippedCard && !showingCardPreview ? "f10-loadout-panel--glow" : ""}`}
        >
          <div className="f10-loadout-label">
            Calling card
            {showingCardPreview ? (
              <span
                className={`f10-loadout-badge ${cardPreviewLocked ? "f10-loadout-badge--locked" : "f10-loadout-badge--preview"}`}
              >
                {cardPreviewLocked ? "Locked preview" : "Preview"}
              </span>
            ) : (
              <span className="f10-loadout-badge">Equipped</span>
            )}
          </div>
          <CallingCard
            title={loadoutCard.displayTitle || loadoutCard.name}
            subtitle={cardPreviewLocked ? loadoutCard.requirement : loadoutCard.displaySubtitle || loadoutCard.tagline}
            rarity={loadoutCard.rarity}
            isEquipped={!cardPreviewLocked && loadoutCardId === equippedCard && !showingCardPreview}
            isUnlocked={!cardPreviewLocked}
            stripe={loadoutCard.stripe}
            flare={loadoutCard.flare}
            animationPreset={loadoutCard.animationPreset}
            symbol={loadoutCard.animationPreset === "first_responder" ? "S★" : ""}
            collection={loadoutCard.collection}
            className="f10-loadout-card-preview"
            showEquippedBadge={false}
            unlockPulse={unlockPulseCardId === loadoutCardId}
          />
          <div className="f10-loadout-actions">
            <button
              type="button"
              className="f10-custom-btn f10-custom-btn--primary"
              disabled={
                !previewCardId ||
                !cardUnlocked[previewCardId] ||
                previewCardId === equippedCard
              }
              onClick={equipCard}
            >
              Equip calling card
            </button>
            {showingCardPreview ? (
              <button
                type="button"
                className="f10-custom-btn"
                onClick={() => setPreviewCardId(null)}
              >
                Show equipped
              </button>
            ) : null}
          </div>
        </div>
      </section>
      <p className="f10-custom-section-title">Equipped Card Preview</p>

      <div className="f10-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "emblems"}
          className={`f10-tab ${tab === "emblems" ? "f10-tab--active" : ""}`}
          onClick={() => setTab("emblems")}
        >
          Emblems
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "cards"}
          className={`f10-tab ${tab === "cards" ? "f10-tab--active" : ""}`}
          onClick={() => setTab("cards")}
        >
          Calling cards
        </button>
      </div>

      {tab === "emblems" ? (
        <div className="f10-emblem-grid" role="tabpanel">
          {EMBLEMS.map((e) => {
            const unlocked = emblemUnlocked[e.id];
            const equipped = e.id === equippedEmblem;
            const previewing = e.id === previewEmblemId;
            return (
              <button
                key={e.id}
                type="button"
                className={`f10-emblem-tile ${equipped ? "f10-emblem-tile--equipped" : ""} ${previewing ? "f10-emblem-tile--preview" : ""} ${!unlocked ? "f10-emblem-tile--locked" : ""}`}
                onClick={() => setPreviewEmblemId(e.id)}
              >
                {equipped ? <span className="f10-equipped-pill">Equipped</span> : null}
                <div
                  className="f10-emblem-tile-glyph"
                  style={{ background: unlocked ? e.accent : "rgba(30,41,59,0.8)" }}
                >
                  {e.glyph}
                </div>
                <p className="f10-emblem-tile-name">{e.name}</p>
                <p className="f10-emblem-tile-req">
                  {!unlocked ? e.requirement : e.subtitle}
                </p>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="f10-cc-scroll" role="tabpanel">
          <p className="f10-custom-section-title">Calling Card Grid</p>
          <div className="f10-cc-filters">
            <label>
              Rarity
              <select value={rarityFilter} onChange={(e) => setRarityFilter(e.target.value)}>
                <option value="all">All</option>
                <option value="common">Common</option>
                <option value="rare">Rare</option>
                <option value="epic">Epic</option>
                <option value="elite">Elite</option>
                <option value="legendary">Legendary</option>
                <option value="exclusive">Exclusive</option>
              </select>
            </label>
            <label>
              Collection
              <select value={collectionFilter} onChange={(e) => setCollectionFilter(e.target.value)}>
                <option value="all">All</option>
                {cardCollections.map((collection) => (
                  <option key={collection} value={collection}>
                    {collection}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {filteredCards.map((c) => {
            const unlocked = cardUnlocked[c.id];
            const equipped = c.id === equippedCard;
            const previewing = c.id === previewCardId;
            return (
              <div
                key={c.id}
                className={`f10-cc-row ${equipped ? "f10-cc-row--equipped" : ""} ${previewing ? "f10-cc-row--preview" : ""} ${!unlocked ? "f10-cc-row--locked" : ""}`}
              >
                <button
                  type="button"
                  className="f10-cc-row-preview-btn"
                  onClick={() => setPreviewCardId(c.id)}
                >
                <CallingCard
                  title={c.displayTitle || c.name}
                  subtitle={c.displaySubtitle || c.tagline}
                  rarity={c.rarity}
                  isEquipped={equipped}
                  isUnlocked={unlocked}
                  stripe={c.stripe}
                  flare={c.flare}
                  animationPreset={c.animationPreset}
                  symbol={c.animationPreset === "first_responder" ? "S★" : ""}
                  collection={c.collection}
                  className="f10-cc-banner"
                  unlockPulse={unlockPulseCardId === c.id}
                />
                </button>
                <div className="f10-cc-meta">
                  <span className="f10-cc-rarity">
                    {(c.rarity || "common").toUpperCase()}
                  </span>
                  <span className="f10-cc-collection">{c.collection || c.group || "Core"}</span>
                  <p className="f10-cc-req">{!unlocked ? c.requirement : "Tap to preview in loadout"}</p>
                  <div className="f10-cc-actions">
                    <button
                      type="button"
                      className="f10-custom-btn f10-custom-btn--primary"
                      onClick={() => void equipCardById(c.id)}
                      disabled={!unlocked || equipped}
                    >
                      Equip
                    </button>
                    <button
                      type="button"
                      className="f10-custom-btn"
                      onClick={() => setPreviewCardId(c.id)}
                    >
                      Preview
                    </button>
                    <button
                      type="button"
                      className="f10-custom-btn"
                      onClick={() => setCardDetailId((prev) => (prev === c.id ? null : c.id))}
                    >
                      Unlock Details
                    </button>
                  </div>
                  {cardDetailId === c.id ? (
                    <p className="f10-cc-req">
                      {!unlocked ? c.requirement : c.description || c.tagline}
                    </p>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {newCardUnlock ? (
        <div className="f10-cc-unlock-toast" role="status" aria-live="polite">
          <p className="f10-cc-unlock-title">🎉 NEW CALLING CARD UNLOCKED</p>
          <p className="f10-cc-unlock-name">"{newCardUnlock.name}"</p>
        </div>
      ) : null}

      <p style={{ marginTop: 28, fontSize: 13, color: "rgba(148,163,184,0.9)" }}>
        Progress syncs from your watchlist, bundle streak, leaderboard score, promos, and
        deal activity.{" "}
        <Link to="/auctions" style={{ color: "#a5b4fc" }}>
          Hit auctions
        </Link>{" "}
        or{" "}
        <Link to="/feed" style={{ color: "#a5b4fc" }}>
          the feed
        </Link>{" "}
        to unlock more.
      </p>
    </div>
  );
}

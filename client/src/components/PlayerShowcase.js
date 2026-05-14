import { useEffect } from "react";
import CallingCard from "./CallingCard";
import "../styles/CallingCard.css";
import { findEmblem, findCallingCard } from "../lib/customizationCatalog";
import { VIP_LABELS } from "../data/leaderboardMock";

export default function PlayerShowcase({ player, open, onClose }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || !player) return null;

  const emblem = findEmblem(player.emblemId);
  const card = findCallingCard(player.callingCardId);
  const vipLabel = VIP_LABELS[Math.min(VIP_LABELS.length - 1, Math.max(0, player.vipTier || 0))];

  return (
    <div className="f10-showcase-overlay" role="dialog" aria-modal="true" aria-labelledby="f10-showcase-title">
      <button type="button" className="f10-showcase-backdrop" onClick={onClose} aria-label="Close" />
      <div className="f10-showcase-panel">
        <button type="button" className="f10-showcase-close" onClick={onClose}>
          ✕
        </button>

        <div className="f10-showcase-card-hero">
          <CallingCard
            title={card.name}
            subtitle={card.tagline}
            rarity={card.rarity || "common"}
            isEquipped
            isUnlocked
            stripe={card.stripe}
            flare={card.flare}
            className="f10-showcase-calling-card"
            showEquippedBadge={false}
          />
        </div>

        <div className="f10-showcase-header">
          <div
            className="f10-showcase-emblem"
            style={{ background: emblem.accent }}
            aria-hidden
          >
            {emblem.glyph}
          </div>
          <div>
            <h2 id="f10-showcase-title" className="f10-showcase-name">
              {player.displayName || player.username}
            </h2>
            <p className="f10-showcase-handle">@{player.username}</p>
          </div>
        </div>

        <div className="f10-showcase-tags">
          <span className="f10-showcase-tag f10-showcase-tag--rank">{player.rankBadge}</span>
          {player.vipTier > 0 && vipLabel ? (
            <span className="f10-showcase-tag f10-showcase-tag--vip">{vipLabel}</span>
          ) : null}
          <span className="f10-showcase-tag">Rank #{player.rank}</span>
        </div>

        <div className="f10-showcase-stats">
          <div className="f10-showcase-stat">
            <span className="f10-showcase-stat-label">Leaderboard</span>
            <span className="f10-showcase-stat-value">{player.score.toLocaleString()}</span>
          </div>
          <div className="f10-showcase-stat">
            <span className="f10-showcase-stat-label">Streak</span>
            <span className="f10-showcase-stat-value">{player.streakWeeks} wk</span>
          </div>
          <div className="f10-showcase-stat">
            <span className="f10-showcase-stat-label">Task streak</span>
            <span className="f10-showcase-stat-value">{player.taskStreakWeeks} wk</span>
          </div>
        </div>

        <div className="f10-showcase-section">
          <h3>Season</h3>
          <p>
            <strong>{player.bpSeasonName}</strong> · {player.bpTierCleared}/10 tiers · {player.bpXp} BP XP
          </p>
        </div>

        <div className="f10-showcase-section">
          <h3>Power & systems</h3>
          <ul className="f10-showcase-list">
            <li>
              <span>Power tier</span>
              <span>{player.powerTierLabel}</span>
            </li>
            <li>
              <span>Systems completed</span>
              <span>
                {player.systemsCompleted}/6
              </span>
            </li>
            <li>
              <span>Favorite lane</span>
              <span>{player.favoriteLane}</span>
            </li>
          </ul>
        </div>

        <p className="f10-showcase-foot">Inspect loadout · flex status</p>
      </div>
    </div>
  );
}

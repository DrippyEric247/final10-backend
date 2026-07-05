import CallingCard from "./CallingCard";
import "../styles/CallingCard.css";
import { findEmblem, findCallingCard } from "../lib/customizationCatalog";

export default function LeaderboardRow({
  player,
  rank,
  isTopThree,
  isYou,
  onInspect,
}) {
  const emblem = findEmblem(player.emblemId);
  const card = findCallingCard(player.callingCardId);
  const savvy = Math.max(0, Number(player.savvyPoints ?? player.score) || 0);
  const streakDays = Math.max(0, Number(player.streakDays ?? player.streakWeeks) || 0);
  const prestige = Math.max(0, Number(player.prestige ?? player.bpTierCleared) || 0);
  const rankBadge = player.rankBadge || (rank === 1 ? "Champion" : "Operator");

  return (
    <button
      type="button"
      className={`f10-lb-row ${isTopThree ? `f10-lb-row--top${rank}` : ""} ${isYou ? "f10-lb-row--you" : ""}`}
      onClick={() => onInspect?.(player)}
    >
      <div className="f10-lb-rank">
        <span className="f10-lb-rank-num">{rank}</span>
        {isTopThree ? <span className="f10-lb-rank-glow" aria-hidden /> : null}
      </div>

      <div className="f10-lb-main">
        <div className="f10-lb-identity">
          <div
            className="f10-lb-emblem"
            style={{ background: emblem.accent }}
            title={emblem.name}
          >
            {emblem.glyph}
          </div>
          <div className="f10-lb-names">
            <span className="f10-lb-username">
              {player.displayName || player.username}
              {isYou ? <span className="f10-lb-you-pill">You</span> : null}
            </span>
            <span className="f10-lb-handle">@{player.username}</span>
          </div>
        </div>

        <div className="f10-lb-stats" aria-label="Player progression stats">
          <span className="f10-lb-stat">🏆 {rankBadge}</span>
          <span className="f10-lb-stat">⭐ Prestige {prestige}</span>
          <span className="f10-lb-stat">🔥 {streakDays}-Day Streak</span>
          <span className="f10-lb-stat">💰 {savvy.toLocaleString()} Savvy</span>
          <span className="f10-lb-stat">🥇 Rank #{rank}</span>
        </div>
      </div>

      <div className="f10-lb-card-wrap" aria-hidden>
        <CallingCard
          title={card.displayTitle || card.name}
          subtitle={card.displaySubtitle || card.tagline}
          rarity={card.rarity || "common"}
          isEquipped={Boolean(isYou)}
          isUnlocked
          stripe={card.stripe}
          flare={card.flare}
          animationPreset={card.animationPreset}
          symbol={card.animationPreset === "first_responder" ? "S★" : ""}
          collection={card.collection}
          className="f10-lb-row-card"
          showEquippedBadge={false}
        />
      </div>
    </button>
  );
}

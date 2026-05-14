import CallingCard from "./CallingCard";
import "../styles/CallingCard.css";
import { findEmblem, findCallingCard } from "../lib/customizationCatalog";
import { VIP_LABELS } from "../data/leaderboardMock";

export default function LeaderboardRow({
  player,
  rank,
  isTopThree,
  isYou,
  onInspect,
}) {
  const emblem = findEmblem(player.emblemId);
  const card = findCallingCard(player.callingCardId);
  const vipLabel = VIP_LABELS[Math.min(VIP_LABELS.length - 1, Math.max(0, player.vipTier || 0))];

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

      <div className="f10-lb-card-wrap" aria-hidden>
        <CallingCard
          title={card.displayTitle || card.name}
          subtitle={card.displaySubtitle || card.tagline}
          rarity={card.rarity || "common"}
          isEquipped={false}
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

      <div className="f10-lb-score-block">
        <span className="f10-lb-score">{player.score.toLocaleString()}</span>
        <span className="f10-lb-score-label">score</span>
      </div>

      <div className="f10-lb-badges">
        <span className={`f10-lb-rank-badge f10-lb-rank-badge--${String(player.rankBadge || "rank").toLowerCase().replace(/\s+/g, "-")}`}>
          {player.rankBadge}
        </span>
        {player.vipTier > 0 && vipLabel ? (
          <span className="f10-lb-vip">{vipLabel}</span>
        ) : null}
      </div>
    </button>
  );
}

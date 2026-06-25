import { useCallback, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  BATTLE_PASS_CUMULATIVE_XP,
  BATTLE_PASS_TIERS,
} from "../../lib/battlePassConfig";
import {
  RARITY_COLORS,
  RARITY_LABELS,
  rewardKindLabel,
  isMilestoneTier,
  isTierClaimed,
  claimSuccessMessage,
  type BPReward,
  type BPTier,
  type BPRarity,
  type BPClaimGrant,
} from "../../lib/battlePassRewards";
import { claimBattlePassTier } from "../../lib/api";

const TIERS = BATTLE_PASS_TIERS as unknown as BPTier[];

type Track = "free" | "premium";

type RewardState = "claimed" | "claimable" | "tier-locked" | "premium-locked";

type PopupState =
  | { kind: "success"; reward: BPReward; grant?: BPClaimGrant; level: number; track: Track }
  | { kind: "premium"; reward: BPReward; level: number }
  | null;

function rarityStyle(rarity: BPRarity) {
  const c = RARITY_COLORS[rarity] || RARITY_COLORS.common;
  return {
    "--bp-r-base": c.base,
    "--bp-r-glow": c.glow,
    "--bp-r-text": c.text,
  } as React.CSSProperties;
}

export type BattlePassRewardTracksProps = {
  unlockedTier: number;
  premiumUnlocked: boolean;
  claimedIds: string[];
  canClaim: boolean;
  onClaimed?: (state: unknown) => void;
};

function RewardCell({
  reward,
  track,
  level,
  state,
  busy,
  canClaim,
  onClaim,
}: {
  reward: BPReward;
  track: Track;
  level: number;
  state: RewardState;
  busy: boolean;
  canClaim: boolean;
  onClaim: (level: number, track: Track) => void;
}) {
  const rarity = (reward.rarity || "common") as BPRarity;
  return (
    <div
      className={`f10-bp2-cell f10-bp2-cell--${track} f10-bp2-rarity--${rarity} ${
        state === "claimed" ? "is-claimed" : ""
      } ${state === "premium-locked" ? "is-prem-locked" : ""} ${
        state === "tier-locked" ? "is-tier-locked" : ""
      } ${state === "claimable" ? "is-claimable" : ""}`}
      style={rarityStyle(rarity)}
    >
      <div className="f10-bp2-cell-top">
        <span className="f10-bp2-cell-track">{track === "free" ? "Free" : "Premium"}</span>
        <span className="f10-bp2-rarity-badge">{RARITY_LABELS[rarity]}</span>
      </div>
      <div className="f10-bp2-cell-art" aria-hidden>
        <span className="f10-bp2-cell-icon">{reward.icon}</span>
      </div>
      <div className="f10-bp2-cell-kind">{rewardKindLabel(reward)}</div>
      <div className="f10-bp2-cell-label">{reward.label}</div>

      <div className="f10-bp2-cell-action">
        {state === "claimed" ? (
          <span className="f10-bp2-claimed">✓ Claimed</span>
        ) : state === "premium-locked" ? (
          <button
            type="button"
            className="f10-bp2-btn f10-bp2-btn--locked"
            onClick={() => onClaim(level, track)}
          >
            🔒 Premium
          </button>
        ) : state === "tier-locked" ? (
          <span className="f10-bp2-locked-note">Reach Tier {level}</span>
        ) : (
          <button
            type="button"
            className="f10-bp2-btn f10-bp2-btn--claim"
            disabled={busy || !canClaim}
            onClick={() => onClaim(level, track)}
            title={canClaim ? "Claim reward" : "Sign in to claim"}
          >
            {busy ? "Claiming…" : "Claim"}
          </button>
        )}
      </div>
    </div>
  );
}

export default function BattlePassRewardTracks({
  unlockedTier,
  premiumUnlocked,
  claimedIds,
  canClaim,
  onClaimed,
}: BattlePassRewardTracksProps) {
  const [popup, setPopup] = useState<PopupState>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const claimedSet = useMemo(() => new Set(claimedIds || []), [claimedIds]);

  const rewardState = useCallback(
    (track: Track, level: number): RewardState => {
      if (isTierClaimed(claimedSet, track, level)) return "claimed";
      if (track === "premium" && !premiumUnlocked) return "premium-locked";
      if (unlockedTier < level) return "tier-locked";
      return "claimable";
    },
    [claimedSet, premiumUnlocked, unlockedTier]
  );

  const handleClaim = useCallback(
    async (level: number, track: Track) => {
      setError(null);
      const tier = TIERS.find((t) => t.level === level);
      if (!tier) return;
      const reward = tier[track];

      const state = rewardState(track, level);
      if (state === "premium-locked") {
        setPopup({ kind: "premium", reward, level });
        return;
      }
      if (state !== "claimable") return;
      if (!canClaim) return;

      const key = `${track}:${level}`;
      setBusyKey(key);
      try {
        const res = await claimBattlePassTier(level, track);
        setPopup({ kind: "success", reward, grant: res?.grant as BPClaimGrant, level, track });
        // Refresh the canonical Savvy balance so the HUD updates immediately.
        try {
          window.dispatchEvent(new CustomEvent("f10:savvy-auth-refresh-request"));
        } catch {
          /* ignore */
        }
        if (onClaimed) onClaimed(res?.state);
      } catch (e: unknown) {
        const ax = e as { response?: { status?: number; data?: { code?: string; message?: string } } };
        const code = ax.response?.data?.code;
        if (code === "PREMIUM_LOCKED") {
          setPopup({ kind: "premium", reward, level });
        } else if (code === "ALREADY_CLAIMED") {
          if (onClaimed) onClaimed(undefined);
          setError("That reward was already claimed.");
        } else if (code === "TIER_LOCKED") {
          setError(`Reach Tier ${level} to claim this reward.`);
        } else {
          setError(ax.response?.data?.message || "Could not claim reward. Try again.");
        }
      } finally {
        setBusyKey(null);
      }
    },
    [canClaim, onClaimed, rewardState]
  );

  return (
    <section className="f10-bp2-wrap" aria-label="Battle pass rewards">
      <div className="f10-bp2-legend">
        {(["common", "uncommon", "rare", "epic", "legendary", "mythic"] as BPRarity[]).map((r) => (
          <span key={r} className={`f10-bp2-legend-chip f10-bp2-rarity--${r}`} style={rarityStyle(r)}>
            <i className="f10-bp2-legend-dot" /> {RARITY_LABELS[r]}
          </span>
        ))}
      </div>

      {error ? (
        <div className="f10-bp2-error" role="alert">
          {error}
        </div>
      ) : null}

      <div className="f10-bp2-grid">
        {TIERS.map((tier, idx) => {
          const need = BATTLE_PASS_CUMULATIVE_XP[idx];
          const milestone = isMilestoneTier(tier.level);
          const reached = unlockedTier >= tier.level;
          return (
            <div
              key={`bp2-${tier.level}`}
              className={`f10-bp2-row ${milestone ? "is-milestone" : ""} ${reached ? "is-reached" : ""}`}
            >
              <div className="f10-bp2-rail" aria-hidden>
                <div className={`f10-bp2-node ${reached ? "is-on" : ""} ${milestone ? "is-milestone" : ""}`}>
                  <span className="f10-bp2-node-lv">{tier.level}</span>
                </div>
                <div className="f10-bp2-xp">{need.toLocaleString()} XP</div>
                {milestone ? <div className="f10-bp2-milestone-tag">Milestone</div> : null}
              </div>
              <div className="f10-bp2-cells">
                <RewardCell
                  reward={tier.free}
                  track="free"
                  level={tier.level}
                  state={rewardState("free", tier.level)}
                  busy={busyKey === `free:${tier.level}`}
                  canClaim={canClaim}
                  onClaim={handleClaim}
                />
                <RewardCell
                  reward={tier.premium}
                  track="premium"
                  level={tier.level}
                  state={rewardState("premium", tier.level)}
                  busy={busyKey === `premium:${tier.level}`}
                  canClaim={canClaim}
                  onClaim={handleClaim}
                />
              </div>
            </div>
          );
        })}
      </div>

      <AnimatePresence>
        {popup ? (
          <motion.div
            className="f10-bp2-modal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setPopup(null)}
            role="dialog"
            aria-modal="true"
          >
            <motion.div
              className={`f10-bp2-modal-card f10-bp2-rarity--${popup.reward.rarity}`}
              style={rarityStyle(popup.reward.rarity as BPRarity)}
              initial={{ scale: 0.86, y: 22 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: "spring", damping: 22, stiffness: 320 }}
              onClick={(e) => e.stopPropagation()}
            >
              {popup.kind === "success" ? (
                <>
                  <div className="f10-bp2-modal-kicker">Tier {popup.level} reward claimed</div>
                  <motion.div
                    className="f10-bp2-modal-art"
                    initial={{ scale: 0.6, rotate: -8 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: "spring", damping: 12, stiffness: 220 }}
                    aria-hidden
                  >
                    <span>{popup.reward.icon}</span>
                  </motion.div>
                  <div className="f10-bp2-modal-rarity">{RARITY_LABELS[popup.reward.rarity as BPRarity]}</div>
                  <h3 className="f10-bp2-modal-title">{popup.reward.label}</h3>
                  <p className="f10-bp2-modal-msg">{claimSuccessMessage(popup.reward, popup.grant)}</p>
                  <button type="button" className="f10-bp2-btn f10-bp2-btn--claim w-full" onClick={() => setPopup(null)}>
                    Nice!
                  </button>
                </>
              ) : (
                <>
                  <div className="f10-bp2-modal-kicker">Premium reward</div>
                  <div className="f10-bp2-modal-art is-locked" aria-hidden>
                    <span>🔒</span>
                  </div>
                  <h3 className="f10-bp2-modal-title">{popup.reward.label}</h3>
                  <p className="f10-bp2-modal-msg">Unlock Premium to claim this reward.</p>
                  <Link to="/premium" className="f10-bp2-btn f10-bp2-btn--premium w-full">
                    Unlock Premium
                  </Link>
                  <button type="button" className="f10-bp2-btn f10-bp2-btn--ghost w-full" onClick={() => setPopup(null)}>
                    Maybe later
                  </button>
                </>
              )}
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </section>
  );
}

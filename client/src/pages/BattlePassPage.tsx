import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  BATTLE_PASS_CUMULATIVE_XP,
  BATTLE_PASS_SEASON,
  BATTLE_PASS_TIERS,
  BP_TIER_COMPLETE_EVENT,
  BP_UPDATE_EVENT,
} from "../lib/battlePassConfig";
import {
  getBattlePassProgress,
  isBattlePassPremiumUnlocked,
  unlockBattlePassPremium,
} from "../lib/battlePassEngine";
import BattlePassRewardTracks from "../components/battlePass/BattlePassRewardTracks";
import BattlePassAdminPanel from "../components/battlePass/BattlePassAdminPanel";
import { notifyUniversalProgressRefresh } from "../lib/universalBoostProgress";
import { useAuth } from "../context/AuthContext";
import { getSeasonTaskDefinition } from "../data/battlePassTaskSeasons";
import { BattlePassTaskList } from "../components/battlePassTasks/BattlePassTaskList";
import { BattlePassDevPanel } from "../components/battlePassTasks/BattlePassDevPanel";
import { useBattlePassProgress } from "../hooks/useBattlePassProgress";
import { useProgression } from "../hooks/useProgression";
import { useEntitlement } from "../hooks/useEntitlement";
import type { ActiveBattlePassTaskState } from "../types/battlePassProgress";
import type { TaskResolverContext } from "../types/battlePassTasks";
import { BATTLE_PASS_ACTION_EVENT } from "../lib/battlePassActionBus";
import { createBattlePassActionEvent } from "../lib/battlePassActionEventFactory";
import SavvyMark from "../components/SavvyMark";
import Final10Slogan from "../components/branding/Final10Slogan";
import { SavvyPointsIcon } from "../components/rewards/SavvyPointsIcon";
import { useSavvyPoints } from "../store/savvyStore";
import "../styles/BattlePassPage.css";

type BattlePassRewardType = "points" | "emblem" | "card" | "boost" | "bp_xp" | "title" | "power";

type BattlePassReward = {
  type: BattlePassRewardType;
  value?: number;
  id?: string;
  label: string;
};

type RewardPreviewAsset = {
  icon: string;
  previewKicker: string;
  previewHint: string;
};

type TierRewardSummary = {
  title: string;
  rewardType: string;
  previewAsset: RewardPreviewAsset;
  reward: BattlePassReward;
};

type PremiumMissedReward = {
  reward: TierRewardSummary;
  badgeLabel: string;
  locked: boolean;
};

type NextTierProgress = {
  nextTier: number | null;
  currentXpInTier: number;
  requiredXpInTier: number;
  progressLabel: string;
  progressPct: number;
};

type TierUpModalPayload = {
  level: number;
  track: string;
  pointsGainedLabel: string;
  freeReward: TierRewardSummary;
  premiumMissedReward: PremiumMissedReward | null;
  nextTierProgress: NextTierProgress;
};

type TierCompleteEventDetail = { level?: number; track?: string; reward?: BattlePassReward };

const PREMIUM_UPSELL_COPY = {
  headline: "Upgrade to claim this premium cosmetic",
  valueLine: "Premium track holders claim every missed reward instantly.",
  microLine: "Premium members instantly unlock missed premium rewards.",
};

const REWARD_TYPE_LABELS: Record<BattlePassRewardType, string> = {
  emblem: "Emblem",
  card: "Calling Card",
  title: "Title",
  points: "Points",
  bp_xp: "XP Boost",
  boost: "Power Boost",
  power: "Power Boost",
};

const IDENTITY_RANKS = ["Sniper", "Hunter", "Operator", "Elite", "Legend"] as const;

function toRewardPreviewAsset(reward: BattlePassReward): RewardPreviewAsset {
  switch (reward.type) {
    case "emblem":
      return { icon: "◈", previewKicker: "EMBLEM", previewHint: "Avatar emblem preview" };
    case "card":
      return { icon: "▭", previewKicker: "CALLING CARD", previewHint: "Profile calling card" };
    case "title":
      return { icon: "✦", previewKicker: "TITLE", previewHint: "Player title style" };
    case "boost":
    case "power":
      return { icon: "⚡", previewKicker: "POWER BOOST", previewHint: "Seasonal power multiplier" };
    case "bp_xp":
      return { icon: "⬆", previewKicker: "XP BOOST", previewHint: "Battle pass XP bonus" };
    case "points":
    default:
      return { icon: "◎", previewKicker: "POINTS", previewHint: "Savvy points reward" };
  }
}

function toTierRewardSummary(reward: BattlePassReward): TierRewardSummary {
  return {
    title: reward.label,
    rewardType: REWARD_TYPE_LABELS[reward.type] ?? "Reward",
    previewAsset: toRewardPreviewAsset(reward),
    reward,
  };
}

function buildNextTierProgress(level: number, totalXp: number): NextTierProgress {
  const nextLevel = level + 1;
  const nextIdx = BATTLE_PASS_TIERS.findIndex((t) => t.level === nextLevel);
  if (nextIdx === -1) {
    return {
      nextTier: null,
      currentXpInTier: 0,
      requiredXpInTier: 0,
      progressLabel: "Max tier reached",
      progressPct: 100,
    };
  }
  const prevNeed = BATTLE_PASS_CUMULATIVE_XP[nextIdx - 1] ?? 0;
  const nextNeed = BATTLE_PASS_CUMULATIVE_XP[nextIdx];
  const required = Math.max(nextNeed - prevNeed, 1);
  const current = Math.min(Math.max(totalXp - prevNeed, 0), required);
  return {
    nextTier: nextLevel,
    currentXpInTier: current,
    requiredXpInTier: required,
    progressLabel: `${current} / ${required} XP`,
    progressPct: Math.min(100, (current / required) * 100),
  };
}

function RewardPreviewCard({ reward, premium = false }: { reward: TierRewardSummary; premium?: boolean }) {
  return (
    <motion.article
      className={`f10-bp-reward-preview-card ${premium ? "is-premium" : "is-free"}`}
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: "easeOut" }}
    >
      <div className="f10-bp-reward-preview-kicker">{reward.previewAsset.previewKicker}</div>
      <div className="f10-bp-reward-preview-art" aria-hidden>
        <span className="f10-bp-reward-preview-icon">{reward.previewAsset.icon}</span>
      </div>
      <div className="f10-bp-reward-preview-type">{reward.rewardType}</div>
      <div className="f10-bp-reward-preview-title">{reward.title}</div>
      <div className="f10-bp-reward-preview-hint">{reward.previewAsset.previewHint}</div>
    </motion.article>
  );
}

function PremiumMissedCard({ premiumReward }: { premiumReward: PremiumMissedReward }) {
  return (
    <div className="f10-bp-premium-missed-wrap">
      <div className="f10-bp-premium-missed-badge">{premiumReward.badgeLabel}</div>
      <RewardPreviewCard reward={premiumReward.reward} premium />
      {premiumReward.locked ? <div className="f10-bp-premium-lock-overlay">Locked · Upgrade to claim</div> : null}
    </div>
  );
}

function TierRewardSummaryCards({
  freeReward,
  premiumMissedReward,
}: {
  freeReward: TierRewardSummary;
  premiumMissedReward: PremiumMissedReward | null;
}) {
  return (
    <section className={`f10-bp-tier-reward-summary ${premiumMissedReward ? "has-premium" : "free-only"}`}>
      <RewardPreviewCard reward={freeReward} />
      {premiumMissedReward ? <PremiumMissedCard premiumReward={premiumMissedReward} /> : null}
    </section>
  );
}

function NextTierProgressPanel({ progress }: { progress: NextTierProgress }) {
  return (
    <section className="f10-bp-next-tier-progress" aria-label="Next tier progress">
      <div className="f10-bp-next-tier-row">
        <span>Next tier: {progress.nextTier ? `Tier ${progress.nextTier}` : "Complete"}</span>
        <span>{progress.progressLabel}</span>
      </div>
      <div className="f10-bp-next-tier-bar" aria-hidden>
        <div className="f10-bp-next-tier-fill" style={{ width: `${progress.progressPct}%` }} />
      </div>
    </section>
  );
}

function TierUpCTAGroup({
  premiumMissedReward,
  onUnlockPremium,
  onClose,
  premiumBusy,
}: {
  premiumMissedReward: PremiumMissedReward | null;
  onUnlockPremium: () => void;
  onClose: () => void;
  premiumBusy: boolean;
}) {
  if (!premiumMissedReward) {
    return (
      <button type="button" className="f10-bp-btn f10-bp-btn-premium w-full" onClick={onClose}>
        Keep Climbing
      </button>
    );
  }
  return (
    <div className="f10-bp-tierup-cta-group">
      <p className="f10-bp-tierup-upsell-headline">{PREMIUM_UPSELL_COPY.headline}</p>
      <p className="f10-bp-tierup-upsell-value">{PREMIUM_UPSELL_COPY.valueLine}</p>
      <button type="button" className="f10-bp-btn f10-bp-btn-premium w-full" disabled={premiumBusy} onClick={onUnlockPremium}>
        {premiumBusy ? "Unlocking…" : "Unlock Premium Rewards"}
      </button>
      <div className="f10-bp-tierup-upsell-micro">{PREMIUM_UPSELL_COPY.microLine}</div>
      <button type="button" className="f10-bp-btn f10-bp-btn-ghost w-full" onClick={onClose}>
        Nice
      </button>
    </div>
  );
}

export default function BattlePassPage() {
  /** AuthContext is JS; narrow so TS can compile (runtime unchanged). */
  const authBundle = useAuth() as { user: TaskResolverContext["authUser"]; token?: string | null } | null;
  const user = authBundle?.user ?? null;
  const authToken = authBundle?.token ?? null;
  const savvyLive = useSavvyPoints();
  const progression = useProgression(Boolean(authToken));
  const entitlement = useEntitlement(Boolean(authToken));
  const hasFoundingTesterAccess = Boolean(
    entitlement?.foundingTesterAccess ||
    (user as Record<string, unknown> | null)?.foundingTesterAccess ||
    (user as Record<string, unknown> | null)?.betaTester ||
    (user as Record<string, unknown> | null)?.foundingAccess
  );
  const [tick, setTick] = useState(0);
  const [celebrate, setCelebrate] = useState<TierUpModalPayload | null>(null);
  const [premiumBusy, setPremiumBusy] = useState(false);
  const [premiumJustUnlocked, setPremiumJustUnlocked] = useState(false);

  const bump = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    const onUpd = () => bump();
    const onTier = (e: Event) => {
      const d = (e as CustomEvent<TierCompleteEventDetail>).detail;
      if (d?.level != null) {
        const premUnlockedNow = isBattlePassPremiumUnlocked();
        const tier = BATTLE_PASS_TIERS.find((t) => t.level === d.level);
        const earnedReward = (d.reward ?? tier?.free) as unknown as BattlePassReward | undefined;
        if (!earnedReward || !tier?.free) return;
        const missedPremium = !hasFoundingTesterAccess && d.track === "free" && !premUnlockedNow && Boolean(tier?.premium);
        const latestProgress = getBattlePassProgress();
        setCelebrate({
          level: d.level,
          track: d.track || "",
          pointsGainedLabel: earnedReward.label || "Reward unlocked",
          freeReward: toTierRewardSummary(tier.free as unknown as BattlePassReward),
          premiumMissedReward:
            missedPremium && tier.premium
              ? {
                  reward: toTierRewardSummary(tier.premium as unknown as BattlePassReward),
                  badgeLabel: "Premium",
                  locked: true,
                }
              : null,
          nextTierProgress: buildNextTierProgress(d.level, latestProgress.xp),
        });
      }
    };
    window.addEventListener(BP_UPDATE_EVENT, onUpd);
    window.addEventListener(BP_TIER_COMPLETE_EVENT, onTier);
    return () => {
      window.removeEventListener(BP_UPDATE_EVENT, onUpd);
      window.removeEventListener(BP_TIER_COMPLETE_EVENT, onTier);
    };
  }, [bump, hasFoundingTesterAccess]);

  const progress = useMemo(() => {
    void tick;
    return getBattlePassProgress();
  }, [tick]);

  const themeStyle = useMemo((): CSSProperties => {
    const t = BATTLE_PASS_SEASON.theme || {};
    const out: CSSProperties = {};
    Object.entries(t).forEach(([k, v]) => {
      (out as Record<string, string>)[k] = String(v);
    });
    return out;
  }, []);

  const taskSeason = useMemo(() => getSeasonTaskDefinition(BATTLE_PASS_SEASON.id), []);

  const [autoSeedDemoProgress] = useState(() => {
    if (typeof window === "undefined" || process.env.NODE_ENV !== "development") return false;
    try {
      return localStorage.getItem("f10_bp_auto_seed_demo") === "1";
    } catch {
      return false;
    }
  });

  const bpUserId = useMemo(() => {
    const u = user as Record<string, unknown> | null | undefined;
    if (u?.id != null && String(u.id).length) return String(u.id);
    if (u?.email != null && String(u.email).length) return String(u.email);
    return "guest";
  }, [user]);

  const bp = useBattlePassProgress({
    season: taskSeason,
    userId: bpUserId,
    onAfterProcess: bump,
    autoSeedDemoProgress,
    deferInitialization: Boolean(authToken) && progression.loading,
    serverTaskStates: (progression.state?.battlePass?.taskStates ?? null) as ActiveBattlePassTaskState[] | null,
    submitBattlePassEventRemote: authToken ? progression.submitBattlePassEvent : undefined,
  });
  const identityRank = IDENTITY_RANKS[Math.min(IDENTITY_RANKS.length - 1, Math.floor((progress.completedCount / Math.max(1, BATTLE_PASS_TIERS.length)) * IDENTITY_RANKS.length))];

  const missionThemeStyle = useMemo((): CSSProperties | undefined => {
    if (!taskSeason) return undefined;
    return {
      "--bp-task-accent": taskSeason.themeUi.accent,
      "--bp-task-accent-2": taskSeason.themeUi.accent2,
      "--bp-task-glow": taskSeason.themeUi.glow,
      "--bp-task-surface": taskSeason.themeUi.surface,
    } as CSSProperties;
  }, [taskSeason]);

  const allowGuestLocalPremiumPreview = process.env.NODE_ENV !== "production";

  useEffect(() => {
    if (!hasFoundingTesterAccess) return;
    if (!isBattlePassPremiumUnlocked()) {
      unlockBattlePassPremium();
      bump();
    }
  }, [bump, hasFoundingTesterAccess]);

  useEffect(() => {
    const onAction = (evt: Event) => {
      const detail = (evt as CustomEvent<{ type?: string; payload?: Record<string, unknown> }>).detail;
      if (!detail?.type || !detail.payload) return;
      const supported = [
        "auction_scanned",
        "bid_placed",
        "auction_won",
        "buy_now_scanned",
        "recommended_deal_viewed",
      ];
      if (!supported.includes(detail.type)) return;
      try {
        const event = createBattlePassActionEvent(
          detail.type as never,
          { userId: bpUserId },
          detail.payload as never
        );
        bp.processEvent(event);
      } catch {
        // ignore malformed event payloads
      }
    };
    window.addEventListener(BATTLE_PASS_ACTION_EVENT, onAction);
    return () => window.removeEventListener(BATTLE_PASS_ACTION_EVENT, onAction);
  }, [bp, bpUserId]);

  const unlockPremiumLocalDemo = () => {
    setPremiumBusy(true);
    window.setTimeout(() => {
      unlockBattlePassPremium();
      notifyUniversalProgressRefresh();
      setPremiumBusy(false);
      setPremiumJustUnlocked(true);
      window.setTimeout(() => setPremiumJustUnlocked(false), 1800);
      bump();
    }, 180);
  };

  const onUnlockPremiumCta = () => {
    if (authToken) {
      window.location.assign("/premium");
      return;
    }
    if (!allowGuestLocalPremiumPreview) {
      window.location.assign("/login");
      return;
    }
    unlockPremiumLocalDemo();
  };

  const premiumUnlocked = useMemo(() => {
    if (!authToken) return progress.premium;
    if (entitlement.raw != null) return Boolean(entitlement.isPremium);
    return Boolean(progression.state?.battlePass?.premiumUnlocked);
  }, [
    authToken,
    entitlement.isPremium,
    entitlement.raw,
    progression.state?.battlePass?.premiumUnlocked,
    progress.premium,
  ]);

  /** Server-authoritative unlocked tier + claimed reward keys drive the claim UI. */
  const unlockedTier = useMemo(
    () => Number(progression.state?.battlePass?.tier ?? progress.completedCount ?? 0),
    [progression.state?.battlePass?.tier, progress.completedCount]
  );
  const claimedIds = useMemo(
    () => (progression.state?.battlePass?.claimedRewardIds ?? []) as string[],
    [progression.state?.battlePass?.claimedRewardIds]
  );
  const refreshAfterClaim = useCallback(() => {
    void progression.reload();
    bump();
  }, [bump, progression]);

  return (
    <div className="f10-bp-page" style={themeStyle}>
      {authToken && progression.loading ? (
        <div
          className="f10-bp-hero"
          style={{
            marginBottom: 8,
            padding: "10px 14px",
            borderRadius: 10,
            background: "rgba(15,23,42,0.65)",
            border: "1px solid rgba(148,163,184,0.25)",
            fontSize: "0.9rem",
            color: "#cbd5e1",
          }}
          role="status"
        >
          Syncing battle pass from server…
        </div>
      ) : null}
      {authToken && progression.error ? (
        <div
          style={{
            marginBottom: 12,
            padding: "12px 14px",
            borderRadius: 10,
            background: "rgba(127,29,29,0.35)",
            border: "1px solid rgba(248,113,113,0.45)",
            color: "#fecaca",
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: 10,
          }}
          role="alert"
        >
          <span style={{ flex: "1 1 200px" }}>{progression.error}</span>
          <button
            type="button"
            className="f10-bp-btn f10-bp-btn-ghost"
            style={{ borderColor: "rgba(254,202,202,0.5)", color: "#fff7ed" }}
            onClick={() => void progression.reload()}
          >
            Retry sync
          </button>
        </div>
      ) : null}
      <header className="f10-bp-hero">
        <div className="f10-bp-hero-inner">
          <h1 style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <SavvyMark variant="icon" size={22} glow />
            {BATTLE_PASS_SEASON.name}
          </h1>
          <p className="sub">{BATTLE_PASS_SEASON.subtitle}</p>
          <Final10Slogan variant="hero" as="p" />
          <p className="sub" style={{ fontSize: "0.82rem", opacity: 0.85 }}>
            Build your position from saves, scans, runs, streaks, and wins - the same actions that feed your Power bar.
          </p>
          <p className="sub" style={{ fontSize: "0.78rem", opacity: 0.82 }}>
            Final10 is part of the Savvy Universe. Your Savvy balance is persistent across the ecosystem.
          </p>
          {authToken ? (
            <div
              className="sub"
              style={{
                marginTop: 6,
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontSize: "0.88rem",
                color: "#e9d5ff",
              }}
              aria-live="polite"
            >
              <SavvyPointsIcon size={20} glow animated />
              <span>
                Live Savvy: <strong>{Math.max(0, Math.round(savvyLive.savvyPoints)).toLocaleString()}</strong>
              </span>
            </div>
          ) : null}

          <div className="f10-bp-progress-block">
            <div className="f10-bp-progress-meta">
              <span>
                BP XP: <strong>{progress.xp}</strong> / {progress.maxXp}
              </span>
              <span>
                Tiers cleared:{" "}
                <strong>
                  {progress.completedCount}/{BATTLE_PASS_TIERS.length}
                </strong>
              </span>
              <span>
                Current run rank: <strong>{identityRank}</strong>
              </span>
            </div>
            <div className="f10-bp-bar-outer" aria-hidden>
              <div
                className="f10-bp-bar-fill"
                style={{
                  width: `${progress.completedCount >= BATTLE_PASS_TIERS.length ? 100 : progress.barPct}%`,
                }}
              />
            </div>
          </div>

          <div className="f10-bp-upgrade-row">
            {premiumUnlocked ? (
              <span className={`f10-bp-premium-pill ${premiumJustUnlocked ? "is-unlock-anim" : ""}`}>
                Premium Active
              </span>
            ) : authToken ? (
              <>
                <Link to="/premium" className="f10-bp-btn f10-bp-btn-premium">
                  Subscribe — unlock premium track
                </Link>
                <button
                  type="button"
                  className="f10-bp-btn f10-bp-btn-ghost"
                  disabled={premiumBusy || entitlement.loading}
                  onClick={() => {
                    setPremiumBusy(true);
                    void Promise.all([progression.syncPremiumFromServer(), entitlement.reload()])
                      .then(() => {
                        notifyUniversalProgressRefresh();
                        bump();
                      })
                      .finally(() => setPremiumBusy(false));
                  }}
                >
                  {premiumBusy ? "Refreshing…" : "Refresh subscription status"}
                </button>
                <span className="text-xs text-slate-400 max-w-xs">
                  Premium unlocks from an active Stripe subscription (server webhooks).
                </span>
              </>
            ) : (
              <>
                {allowGuestLocalPremiumPreview ? (
                  <button
                    type="button"
                    className="f10-bp-btn f10-bp-btn-premium"
                    disabled={premiumBusy}
                    onClick={unlockPremiumLocalDemo}
                  >
                    {premiumBusy ? "Unlocking…" : "Demo: unlock premium locally"}
                  </button>
                ) : (
                  <Link to="/login" className="f10-bp-btn f10-bp-btn-premium">
                    Sign in to unlock premium
                  </Link>
                )}
                <Link to="/premium" className="f10-bp-btn f10-bp-btn-ghost">
                  View Premium hub
                </Link>
                <span className="text-xs text-slate-400 max-w-xs">
                  {allowGuestLocalPremiumPreview
                    ? "Signed-out preview only — real accounts use checkout."
                    : "Create an account and subscribe to unlock the premium track."}
                </span>
              </>
            )}
          </div>
        </div>
      </header>

      <section className="f10-bp-rewards-intro">
        <p className="f10-bp-rewards-copy">
          Earn XP by checking deals, claiming streaks, spinning the Perk Machine, completing Scout Goals, and staying
          active.
        </p>
      </section>

      <BattlePassRewardTracks
        unlockedTier={unlockedTier}
        premiumUnlocked={premiumUnlocked || hasFoundingTesterAccess}
        claimedIds={claimedIds}
        canClaim={Boolean(authToken)}
        onClaimed={refreshAfterClaim}
      />

      <BattlePassAdminPanel onAfterAction={refreshAfterClaim} />

      {taskSeason && bp.isActive ? (
        <div className="f10-bp-missions-cluster" style={missionThemeStyle}>
          <BattlePassTaskList
            season={taskSeason}
            tasks={bp.tasks}
            activityCompletions={bp.recentCompletions}
            activityRewards={bp.recentRewards}
          />
          {process.env.NODE_ENV === "development" ? (
            <BattlePassDevPanel
              simulateAuctionScan={bp.simulateAuctionScan}
              simulateBidPlaced={bp.simulateBidPlaced}
              simulateAuctionWin={bp.simulateAuctionWin}
              simulateDailyLogin={bp.simulateDailyLogin}
              simulatePowerBoostClaim={bp.simulatePowerBoostClaim}
              simulateSavvyPointsEarned={bp.simulateSavvyPointsEarned}
              simulateRankImproved={bp.simulateRankImproved}
              simulatePowerMultiplierChange={bp.simulatePowerMultiplierChange}
              resetDailyTasks={bp.resetDailyTasks}
              resetWeeklyTasks={bp.resetWeeklyTasks}
              resetSeasonProgress={bp.resetSeasonProgress}
              debugLog={bp.debugLog}
              tasks={bp.tasks}
            />
          ) : null}
        </div>
      ) : null}

      <AnimatePresence>
        {celebrate ? (
          <motion.div
            className="f10-bp-celebrate"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setCelebrate(null)}
            role="dialog"
            aria-modal="true"
            aria-labelledby="f10-bp-celebrate-title"
          >
            <motion.div
              className="f10-bp-celebrate-card"
              initial={{ scale: 0.88, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.92, opacity: 0 }}
              transition={{ type: "spring", damping: 22, stiffness: 320 }}
              onClick={(e) => e.stopPropagation()}
            >
              <motion.h3 id="f10-bp-celebrate-title" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                Tier up!
              </motion.h3>
              <motion.div className="f10-bp-tierup-meta" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
                <div className="f10-bp-tierup-unlocked">Tier {celebrate.level} unlocked</div>
                <div className="f10-bp-tierup-points" style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "center" }}>
                  <SavvyPointsIcon size={18} glow animated />
                  {celebrate.pointsGainedLabel}
                </div>
              </motion.div>

              <TierRewardSummaryCards
                freeReward={celebrate.freeReward}
                premiumMissedReward={celebrate.premiumMissedReward}
              />

              <NextTierProgressPanel progress={celebrate.nextTierProgress} />
              <p className="f10-bp-tierup-customize-hint">Cosmetics live in Customize.</p>

              <TierUpCTAGroup
                premiumMissedReward={celebrate.premiumMissedReward}
                premiumBusy={premiumBusy}
                onUnlockPremium={() => {
                  onUnlockPremiumCta();
                  setCelebrate(null);
                }}
                onClose={() => setCelebrate(null)}
              />
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <footer className="f10-bp-footer">
        <Final10Slogan variant="footer" as="p" />
      </footer>
    </div>
  );
}

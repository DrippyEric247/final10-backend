import React, { useMemo } from "react";
import RedeemCodeSection from "../components/RedeemCodeSection";
import Final10SocialLinks from "../components/Final10SocialLinks";
import { ProfileNextGoal } from "../components/profileActivity/ProfileNextGoal.jsx";
import { ProfileRecentActivity } from "../components/profileActivity/ProfileRecentActivity.jsx";
import { RivalryComparisonCard } from "../components/rivalry/RivalryComparisonCard.jsx";
import { useFinal10Power } from "../context/Final10PowerContext";
import { getUniversalBoostState } from "../lib/universalBoostProgress";
import CallingCard from "../components/CallingCard";
import { findCallingCard, findEmblem } from "../lib/customizationCatalog";
import "../styles/ProfilePageLayout.css";

/**
 * Mobile-first, scan-friendly profile dashboard.
 */
export default function ProfilePageLayout({
  savvyBalanceSlot = null,
  entitlementSlot = null,
  programBadgeSlot = null,
  user,
  basePoints,
  tasksData,
  pointsUpdating,
  showSuccessMessage,
  advantageLevel = "Explorer",
  advantageMultiplier = "1.0x",
  bestMovePowerLine = "3 / 3",
  savvyNextUnlock,
  leaderboardScore,
  permanentRank,
  nextPermanentRank,
  rankProgressToNext,
  taskProgress,
  taskBonusMessage,
  taskDailyBonusMin,
  taskDailyBonusMax,
  boostSystemRows,
  vipRankName,
  vipStatusMode,
  weeklyActivityScore,
  vipPromoteThreshold,
  vipMaintainThreshold,
  hasSilverRank,
  silverMinPoints,
  levelInfo,
  streakWeeks,
  displayTaskStreak,
  onRefreshPoints,
  onClaimDailyLogin,
  claimLoginPending,
  dailyLoginDone,
  ebayStatus,
  ebayStatusLoading,
  onConnectEbay,
  onPointsEarned,
  rivalryRivalDisplayNameUpper = "RIVAL",
  rivalryThemShortName = "Rival",
  rivalryComparison = null,
  rivalryChaseReward = null,
  rivalryLoading = false,
  onRivalryStartChase = () => {},
  onRivalryViewLoadout = () => {},
  profileActivityItems = [],
  profileNextGoal = null,
  onProfileGoalCta = () => {},
  equippedCallingCardId = "card_default",
  equippedEmblemId = "sigil_starter",
}) {
  const { snapshot } = useFinal10Power();
  const powerBar = useMemo(() => {
    void snapshot;
    return getUniversalBoostState();
  }, [snapshot]);

  const nextBoostLine = savvyNextUnlock?.maxed
    ? "Max sync"
    : `${savvyNextUnlock?.nextBoost} · ${savvyNextUnlock?.systemsNeeded} more system${
        savvyNextUnlock?.systemsNeeded === 1 ? "" : "s"
      }`;

  const rankPct = Math.round(Number(rankProgressToNext?.pct) || 0);
  const xpRange = levelInfo?.xpInfo?.xpRange > 0 ? levelInfo.xpInfo.xpRange : 1;
  const xpPct = Math.min(
    100,
    Math.round(((levelInfo?.xpInfo?.xpProgress || 0) / xpRange) * 100)
  );

  const vipBarPct = hasSilverRank
    ? Math.min(100, Math.round((weeklyActivityScore / vipPromoteThreshold) * 100))
    : Math.min(100, Math.round((basePoints / silverMinPoints) * 100));

  const vipHeadline =
    vipStatusMode === "locked"
      ? `Reach Silver (${silverMinPoints.toLocaleString()} pts)`
      : vipStatusMode === "atRisk"
      ? `Stay above ${vipMaintainThreshold} activity`
      : vipStatusMode === "unlocking"
      ? `Hit ${vipPromoteThreshold} for full VIP`
      : "VIP active this week";

  const vipSub =
    vipStatusMode === "locked"
      ? `${Math.max(0, silverMinPoints - basePoints).toLocaleString()} pts to go`
      : hasSilverRank
      ? `${weeklyActivityScore}/${vipPromoteThreshold} activity`
      : `${basePoints}/${silverMinPoints} pts`;
  const headerCard = findCallingCard(equippedCallingCardId);
  const headerEmblem = findEmblem(equippedEmblemId);

  const taskList = Array.isArray(taskProgress?.tasks) ? taskProgress.tasks : [];
  const tasksToShow = taskList.slice(0, 5);

  return (
    <div className="min-h-screen bg-gray-950 f10-profile-page f10-profile-with-power">
      <div className="f10-profile-wrap f10-profile-fade-in">
        <header className="f10-profile-header">
          <div>
            <h1>Profile</h1>
            <p className="sub">{user?.firstName || user?.username || "Player"}</p>
            <div className="f10-profile-loadout-strip" aria-label="Equipped calling card">
              <span
                className="f10-profile-loadout-emblem"
                style={{ background: headerEmblem.accent }}
                title={headerEmblem.name}
              >
                {headerEmblem.glyph}
              </span>
              <CallingCard
                title={headerCard.displayTitle || headerCard.name}
                subtitle={headerCard.displaySubtitle || headerCard.tagline}
                rarity={headerCard.rarity || "common"}
                isUnlocked
                isEquipped
                stripe={headerCard.stripe}
                flare={headerCard.flare}
                animationPreset={headerCard.animationPreset}
                symbol={headerCard.animationPreset === "first_responder" ? "S★" : ""}
                collection={headerCard.collection}
                className="f10-profile-header-card"
              />
            </div>
            {programBadgeSlot ? (
              <div style={{ marginTop: 8 }}>{programBadgeSlot}</div>
            ) : null}
            {showSuccessMessage ? (
              <p className="f10-profile-success">{showSuccessMessage}</p>
            ) : null}
          </div>
          <button
            type="button"
            className="f10-profile-refresh"
            onClick={onRefreshPoints}
            disabled={pointsUpdating}
          >
            {pointsUpdating ? "…" : "Refresh"}
          </button>
        </header>

        {entitlementSlot}
        <div id="savvy-balance" className="f10-profile-savvy-balance-anchor">
          {savvyBalanceSlot}
        </div>

        <section className="f10-profile-card" aria-label="Advantage system status">
          <h2 className="f10-profile-card-hd">Advantage System</h2>
          <div className="f10-profile-row" style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "0.6rem", alignItems: "center" }}>
            <span className="text-gray-200">Advantage level</span>
            <strong className="text-cyan-300">{advantageLevel}</strong>
          </div>
          <div className="f10-profile-row" style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "0.6rem", alignItems: "center" }}>
            <span className="text-gray-200">Best Move Power</span>
            <strong className="text-amber-300">{bestMovePowerLine}</strong>
          </div>
          <div className="f10-profile-row" style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "0.6rem", alignItems: "center" }}>
            <span className="text-gray-200">Savvy multiplier</span>
            <strong className="text-emerald-300">{advantageMultiplier}</strong>
          </div>
        </section>

        {/* 2 — Summary */}
        <section className="f10-profile-card" aria-labelledby="f10-sum-hd">
          <h2 id="f10-sum-hd" className="f10-profile-card-hd">
            Summary
          </h2>
          <div className="f10-profile-stat-grid">
            <div>
              <p className="f10-profile-stat-label">Power</p>
              <p
                className="f10-profile-stat-value"
                style={{ fontSize: "0.95rem", lineHeight: 1.25 }}
                title={powerBar.barTooltip}
              >
                {powerBar.oneLinePowerLabel}
              </p>
            </div>
            <div>
              <p className="f10-profile-stat-label">Score sync</p>
              <p className="f10-profile-stat-value" style={{ fontSize: "0.95rem" }}>
                {nextBoostLine}
              </p>
            </div>
            <div>
              <p className="f10-profile-stat-label">Rank</p>
              <p className="f10-profile-stat-value">{permanentRank.name}</p>
            </div>
            <div>
              <p className="f10-profile-stat-label">Points</p>
              <p className="f10-profile-stat-value tabular-nums">
                {basePoints.toLocaleString()}
              </p>
            </div>
          </div>
          <p className="f10-profile-stat-label" style={{ marginTop: "0.5rem" }}>
            Leaderboard score{" "}
            <strong className="text-cyan-300 tabular-nums">
              {leaderboardScore.toLocaleString()}
            </strong>
            {tasksData?.userTier ? (
              <span className="text-gray-500"> · {tasksData.userTier}</span>
            ) : null}
          </p>
          {!dailyLoginDone ? (
            <button
              type="button"
              onClick={onClaimDailyLogin}
              disabled={claimLoginPending}
              className="f10-profile-refresh"
              style={{ marginTop: "0.5rem", width: "100%" }}
            >
              {claimLoginPending ? "Claiming…" : "Claim daily login (+20 base)"}
            </button>
          ) : null}
        </section>

        <ProfileRecentActivity items={profileActivityItems} limit={6} />
        {profileNextGoal ? <ProfileNextGoal goal={profileNextGoal} onCta={onProfileGoalCta} /> : null}

        <RivalryComparisonCard
          rivalDisplayNameUpper={rivalryRivalDisplayNameUpper}
          themShortName={rivalryThemShortName}
          comparison={rivalryComparison}
          chaseReward={rivalryChaseReward}
          loading={rivalryLoading}
          onStartChase={onRivalryStartChase}
          onViewLoadout={onRivalryViewLoadout}
        />

        {/* 3 — Daily tasks */}
        <section className="f10-profile-card" aria-labelledby="f10-daily-hd">
          <h2 id="f10-daily-hd" className="f10-profile-card-hd">
            Daily tasks · {taskProgress.completed}/{taskProgress.total}
          </h2>
          <div className="f10-profile-bar" aria-hidden>
            <div
              className="f10-profile-bar-fill"
              style={{
                width: `${taskProgress.total ? (taskProgress.completed / taskProgress.total) * 100 : 0}%`,
              }}
            />
          </div>
          <ul style={{ listStyle: "none", margin: "0.5rem 0 0", padding: 0 }}>
            {tasksToShow.map((t) => (
              <li key={t.id} className="f10-profile-task-line">
                <span aria-hidden>{t.done ? "✓" : "○"}</span>
                <span>{t.label}</span>
              </li>
            ))}
          </ul>
          <p
            className="f10-profile-stat-label"
            style={{ marginTop: "0.5rem", fontSize: "0.75rem", lineHeight: 1.4 }}
          >
            All done: +{taskDailyBonusMin}–{taskDailyBonusMax} bonus pts
          </p>
          {taskBonusMessage ? (
            <p className="f10-profile-success" style={{ marginTop: "0.35rem" }}>
              {taskBonusMessage}
            </p>
          ) : null}
        </section>

        {/* 4 — Systems that affect leaderboard score (Power = top bar) */}
        <section className="f10-profile-card" aria-labelledby="f10-sys-hd">
          <h2 id="f10-sys-hd" className="f10-profile-card-hd">
            Score systems
          </h2>
          {boostSystemRows.map((row) => (
            <div
              key={row.key}
              className="f10-profile-row"
              style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: "0.5rem", alignItems: "center" }}
            >
              <span className="text-gray-200 truncate">{row.label}</span>
              <span
                className={`f10-profile-pill ${
                  row.on ? "f10-profile-pill-ok" : row.progress ? "f10-profile-pill-warn" : "f10-profile-pill-muted"
                }`}
              >
                {row.on ? "On" : row.progress ? "In progress" : "Off"}
              </span>
              <span className="text-amber-300/90 font-bold tabular-nums shrink-0">
                {row.reward}
              </span>
            </div>
          ))}
        </section>

        {/* 5 — VIP */}
        <section className="f10-profile-card" aria-labelledby="f10-vip-hd">
          <h2 id="f10-vip-hd" className="f10-profile-card-hd">
            VIP · {vipRankName}
          </h2>
          <p className="text-sm font-bold text-white m-0">{vipHeadline}</p>
          <p className="f10-profile-stat-label" style={{ marginTop: "0.25rem" }}>
            {vipSub}
          </p>
          <div className="f10-profile-bar" aria-hidden>
            <div
              className="f10-profile-bar-fill"
              style={{
                width: `${vipBarPct}%`,
                background:
                  vipStatusMode === "atRisk"
                    ? "linear-gradient(90deg,#fb7185,#f43f5e)"
                    : undefined,
              }}
            />
          </div>
        </section>

        {/* 6 — Level / XP */}
        <section className="f10-profile-card" aria-labelledby="f10-lv-hd">
          <h2 id="f10-lv-hd" className="f10-profile-card-hd">
            Level {levelInfo?.currentLevel || 1}
          </h2>
          <p className="text-sm text-gray-300 m-0 tabular-nums">
            {levelInfo?.totalXP ?? 0} XP · +{levelInfo?.xpToNextLevel ?? 100} to next
          </p>
          <div className="f10-profile-bar" aria-hidden>
            <div
              className="f10-profile-bar-fill"
              style={{
                width: `${xpPct}%`,
                background: "linear-gradient(90deg,#c084fc,#e879f9)",
              }}
            />
          </div>
          <p className="f10-profile-stat-label" style={{ marginTop: "0.35rem" }}>
            Next: level rewards + milestones
          </p>
        </section>

        {/* 7 — Streak / wins */}
        <section className="f10-profile-card" aria-labelledby="f10-st-hd">
          <h2 id="f10-st-hd" className="f10-profile-card-hd">
            Streaks
          </h2>
          <p className="text-sm text-gray-200 m-0">
            Bundle streak: <strong>{streakWeeks}w</strong>
            <span className="text-gray-500"> · </span>
            Task streak: <strong>{displayTaskStreak}w</strong>
          </p>
        </section>

        {/* Rank progress (compact, under streak or merge — user asked rank in summary; add thin bar for next rank) */}
        {nextPermanentRank ? (
          <section className="f10-profile-card" aria-labelledby="f10-rank-hd">
            <h2 id="f10-rank-hd" className="f10-profile-card-hd">
              Next rank · {nextPermanentRank.name}
            </h2>
            <p className="text-sm text-gray-300 m-0 tabular-nums">
              {rankProgressToNext.ptsRemaining.toLocaleString()} pts left
            </p>
            <div className="f10-profile-bar" aria-hidden>
              <div
                className="f10-profile-bar-fill"
                style={{
                  width: `${rankPct}%`,
                  background: "linear-gradient(90deg,#fbbf24,#f59e0b)",
                }}
              />
            </div>
          </section>
        ) : null}

        <section className="f10-profile-card" style={{ marginBottom: "0.5rem" }}>
          <RedeemCodeSection onPointsEarned={onPointsEarned} />
        </section>

        <section className="f10-profile-card" aria-label="Official Final10 socials">
          <Final10SocialLinks
            variant="full"
            className="profile-social-links"
            title="Official Final10 Socials"
            subtitle="Follow for hidden codes, trailer teasers, product wins, and social-only drops."
          />
        </section>

        <section className="f10-profile-card">
          <h2 className="f10-profile-card-hd">eBay</h2>
          {ebayStatusLoading ? (
            <p className="f10-profile-stat-label m-0">Checking…</p>
          ) : (
            <div className="f10-profile-ebay-compact">
              <span className="text-sm text-gray-200">
                {ebayStatus?.connected ? "Connected" : "Not connected"}
              </span>
              {!ebayStatus?.connected ? (
                <button type="button" onClick={onConnectEbay}>
                  Connect
                </button>
              ) : (
                <span className="f10-profile-pill f10-profile-pill-ok">Active</span>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

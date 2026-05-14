import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useSavvyPoints } from "../store/savvyStore";
import { FINAL10_DEV_OVERRIDE_EVENT } from "../lib/devOverride";
import { buildRankedLeaderboard } from "../data/leaderboardMock";
import LeaderboardRow from "../components/LeaderboardRow";
import PlayerShowcase from "../components/PlayerShowcase";
import { getBattlePassProgress } from "../lib/battlePassEngine";
import { BP_UPDATE_EVENT } from "../lib/battlePassConfig";
import { getUniversalBoostState } from "../lib/universalBoostProgress";
import { getTopFlippersWeek } from "../lib/api";
import "../styles/LeaderboardPage.css";

const BRACKETS = [
  { id: "bronze", label: "Bronze", min: 0, max: 4999 },
  { id: "silver", label: "Silver", min: 5000, max: 9999 },
  { id: "gold", label: "Gold", min: 10000, max: 14999 },
  { id: "elite", label: "Elite", min: 15000, max: Number.POSITIVE_INFINITY },
];

const SEASON_REWARDS = [
  { id: "savvy", label: "Savvy Bonuses", detail: "+250 to +2500 Savvy" },
  { id: "discount", label: "Discount Drops", detail: "5% to 25% seasonal discounts" },
  { id: "unlocks", label: "Feature Unlocks", detail: "UI perks + priority surfaces" },
  { id: "beta", label: "Beta Access", detail: "Early access to upcoming tools" },
  { id: "perks", label: "High-tier Perks", detail: "Vacation / rental partner perks" },
];

function getBracket(score) {
  const safe = Number(score || 0);
  return BRACKETS.find((b) => safe >= b.min && safe <= b.max) || BRACKETS[0];
}

function getBracketProgress(score, bracket) {
  if (!Number.isFinite(bracket.max)) return 100;
  const span = Math.max(1, bracket.max - bracket.min + 1);
  const raw = ((Number(score || 0) - bracket.min) / span) * 100;
  return Math.max(0, Math.min(100, Math.round(raw)));
}

function seededPick(ids, pct) {
  const source = ids.slice().sort().join("|");
  let hash = 0;
  for (let i = 0; i < source.length; i += 1) {
    hash = ((hash << 5) - hash + source.charCodeAt(i)) | 0;
  }
  const count = Math.max(1, Math.ceil(ids.length * pct));
  return ids
    .map((id, idx) => ({ id, score: Math.abs((hash + (idx + 1) * 7919 + id.length * 131) % 100000) }))
    .sort((a, b) => a.score - b.score)
    .slice(0, count)
    .map((x) => x.id);
}

function getSeasonWindow() {
  const now = new Date();
  const seasonStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const seasonEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const msLeft = Math.max(0, seasonEnd.getTime() - now.getTime());
  const days = Math.floor(msLeft / (24 * 60 * 60 * 1000));
  const hours = Math.floor((msLeft % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
  return {
    seasonLabel: `${seasonStart.toLocaleString("en-US", { month: "short" })} Season`,
    days,
    hours,
    shortLabel: msLeft <= 0 ? "Season ending" : `${days}d ${hours}h left in season`,
  };
}

export default function LeaderboardPage() {
  const { user } = useAuth();
  const savvyLive = useSavvyPoints();
  const [sync, setSync] = useState(0);
  const [selected, setSelected] = useState(null);
  const [topFlippers, setTopFlippers] = useState(null);
  const [topFlippersErr, setTopFlippersErr] = useState(null);

  const bump = useCallback(() => setSync((s) => s + 1), []);

  useEffect(() => {
    const onStorage = (e) => {
      if (e.key == null || String(e.key).startsWith("f10_")) bump();
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener("f10-universal-progress-refresh", bump);
    window.addEventListener(BP_UPDATE_EVENT, bump);
    window.addEventListener(FINAL10_DEV_OVERRIDE_EVENT, bump);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("f10-universal-progress-refresh", bump);
      window.removeEventListener(BP_UPDATE_EVENT, bump);
      window.removeEventListener(FINAL10_DEV_OVERRIDE_EVENT, bump);
    };
  }, [bump]);

  useEffect(() => {
    let cancelled = false;
    setTopFlippersErr(null);
    getTopFlippersWeek(20)
      .then((data) => {
        if (!cancelled) setTopFlippers(data);
      })
      .catch((err) => {
        if (!cancelled) {
          setTopFlippersErr(err?.message || "Could not load flip leaderboard.");
          setTopFlippers(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [sync]);

  const ranked = useMemo(() => {
    void sync;
    const base = buildRankedLeaderboard(user) || [];
    const seen = new Set();
    return base.map((row) => {
      if (!row.isCurrentUser) return row;
      try {
        const bp = getBattlePassProgress();
        const ub = getUniversalBoostState();
        return {
          ...row,
          bpTierCleared: bp.completedCount,
          bpXp: bp.xp,
          powerTierLabel: ub.currentTier || "Active",
        };
      } catch {
        return row;
      }
    }).filter((row) => {
      const id = String(row.userId ?? row.username ?? "");
      if (!id || seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  }, [user, sync]);

  const currentUserId = user ? String(user.id ?? user.username ?? "") : "";

  const seasonModel = useMemo(() => {
    const byBracket = BRACKETS.reduce((acc, b) => {
      acc[b.id] = ranked.filter((r) => getBracket(r.score).id === b.id);
      return acc;
    }, {});

    const seasonLeaders = ranked.slice(0, 8);

    const topPerformerIds = new Set();
    BRACKETS.forEach((b) => {
      const members = byBracket[b.id] || [];
      const topN = Math.max(1, Math.ceil(members.length * 0.1));
      members
        .slice()
        .sort((a, b2) => b2.score - a.score)
        .slice(0, topN)
        .forEach((row) => topPerformerIds.add(String(row.userId)));
    });

    const activePool = ranked.filter((r) => (Number(r.streakWeeks || 0) + Number(r.taskStreakWeeks || 0)) > 0);
    const activeWinnerIds = new Set(seededPick(activePool.map((r) => String(r.userId)), 0.1));

    const me =
      ranked.find((r) => String(r.userId) === currentUserId || (user?.username && r.username === user.username)) || null;
    const myBracket = me ? getBracket(me.score) : BRACKETS[0];
    const myBracketRows = byBracket[myBracket.id] || [];
    const myBracketSorted = myBracketRows.slice().sort((a, b) => b.score - a.score);
    const topNInBracket = Math.max(1, Math.ceil(myBracketSorted.length * 0.1));
    const cutoffScore = myBracketSorted[topNInBracket - 1]?.score || 0;
    const myBracketRank = me
      ? myBracketRows
          .slice()
          .sort((a, b) => b.score - a.score)
          .findIndex((r) => String(r.userId) === String(me.userId)) + 1
      : null;

    const seasonWindow = getSeasonWindow();

    let projectedHint = "Play consistently this week to improve your season odds.";
    if (me) {
      const alreadyTop = topPerformerIds.has(String(me.userId));
      if (alreadyTop) {
        projectedHint = `You're in the top 10% of ${myBracket.label}. Maintain your lead through ${seasonWindow.shortLabel}.`;
      } else {
        const delta = Math.max(1, Number(cutoffScore) - Number(me.score || 0) + 1);
        projectedHint = `+${delta.toLocaleString()} Savvy to reach ${myBracket.label} top 10%.`;
      }
    }

    return {
      byBracket,
      seasonLeaders,
      topPerformerIds,
      activeWinnerIds,
      me,
      myBracket,
      myBracketRank,
      myBracketProgress: getBracketProgress(me?.score || 0, myBracket),
      topNInBracket,
      cutoffScore,
      projectedHint,
      seasonWindow,
    };
  }, [ranked, currentUserId, user?.username]);

  return (
    <div className="f10-lb-page">
      <header className="f10-lb-hero">
        <h1>Leaderboard</h1>
        <p>Seasonal brackets with dual win paths: top performers and active users can both win.</p>
        {user ? (
          <p className="f10-lb-savvy-sync" style={{ marginTop: 10, fontSize: "0.95rem", color: "#e9d5ff" }}>
            Your Savvy balance: <strong>{Math.max(0, Math.round(savvyLive.savvyPoints)).toLocaleString()}</strong>
          </p>
        ) : null}
      </header>

      <section className="f10-season-strip" aria-label="Season timeline">
        <div className="f10-season-strip-main">
          <strong>{seasonModel.seasonWindow.seasonLabel}</strong>
          <span>{seasonModel.seasonWindow.shortLabel}</span>
        </div>
        <p>
          Finish strong: top 10% in your bracket and 10% of active users both earn season rewards.
        </p>
      </section>

      <article className="f10-season-card f10-flippers-card" aria-label="Top flippers this week">
        <h2>Top flippers this week</h2>
        <p className="f10-flippers-note">
          Ranked by Savvy Points earned from verified flip sales (UTC week). Ties favor more completed
          flips.
        </p>
        {topFlippersErr ? (
          <p className="f10-season-note" style={{ color: "#fca5a5" }}>
            {topFlippersErr}
          </p>
        ) : null}
        {!topFlippersErr && topFlippers?.rows?.length ? (
          <ol className="f10-flippers-list">
            {topFlippers.rows.map((r) => {
              const isYou =
                user &&
                (String(r.userId) === String(user.id) ||
                  (user.username && r.username === user.username));
              return (
                <li key={String(r.userId)}>
                  <div className={`f10-flippers-row ${isYou ? "is-you" : ""}`}>
                    <div>
                      <strong>#{r.rank}</strong> {r.username || "Player"}
                      {isYou ? <span> · You</span> : null}
                    </div>
                    <div>
                      <strong>+{Number(r.flipSavvy || 0).toLocaleString()}</strong> Savvy
                      <span> · {Number(r.flipsCompleted || 0)} flip{r.flipsCompleted === 1 ? "" : "s"}</span>
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        ) : null}
        {!topFlippersErr && topFlippers && (!topFlippers.rows || topFlippers.rows.length === 0) ? (
          <p className="f10-season-note">No verified flip payouts this week yet — ship a deal and bank Savvy.</p>
        ) : null}
      </article>

      <section className="f10-season-grid">
        <article className="f10-season-card">
          <h2>Season Leaders</h2>
          <div className="f10-season-chip-row">
            {seasonModel.seasonLeaders.map((row) => (
              <button
                key={`leader-${row.userId}`}
                className="f10-season-chip"
                type="button"
                onClick={() => setSelected(row)}
              >
                <span>#{row.rank}</span>
                <strong>{row.displayName || row.username}</strong>
                <em>{getBracket(row.score).label}</em>
              </button>
            ))}
          </div>
        </article>

        <article className="f10-season-card">
          <h2>Your Bracket</h2>
          <p className="f10-season-note">
            {seasonModel.me
              ? `${seasonModel.myBracket.label} bracket • Rank ${seasonModel.myBracketRank || "-"} in bracket`
              : "Sign in to track your bracket progress."}
          </p>
          <div className="f10-season-progress">
            <div className="f10-season-progress-bar" style={{ width: `${seasonModel.myBracketProgress}%` }} />
          </div>
          <div className="f10-season-meta">
            <span>{seasonModel.myBracket.min.toLocaleString()} Savvy</span>
            <span>
              {Number.isFinite(seasonModel.myBracket.max)
                ? `${seasonModel.myBracket.max.toLocaleString()} Savvy`
                : "Top tier"}
            </span>
          </div>
          <div className="f10-brackets-row">
            {BRACKETS.map((b) => (
              <span
                key={b.id}
                className={`f10-bracket-pill ${seasonModel.myBracket.id === b.id ? "is-active" : ""}`}
              >
                {b.label}
              </span>
            ))}
          </div>
          <div className="f10-projection-hint">
            <strong>Projected eligibility</strong>
            <span>{seasonModel.projectedHint}</span>
          </div>
        </article>

        <article className="f10-season-card">
          <h2>Season Rewards</h2>
          <ul className="f10-reward-list">
            {SEASON_REWARDS.map((r) => (
              <li key={r.id}>
                <strong>{r.label}</strong>
                <span>{r.detail}</span>
              </li>
            ))}
          </ul>
        </article>

        <article className="f10-season-card">
          <h2>Eligibility</h2>
          <p className="f10-season-note">You are eligible for:</p>
          <ul className="f10-eligibility-list">
            <li>
              <strong>Top bracket rewards</strong>
              <span>
                {seasonModel.me && seasonModel.topPerformerIds.has(String(seasonModel.me.userId))
                  ? "Eligible now (top 10% in bracket)"
                  : "Keep climbing to reach top 10% in your bracket"}
              </span>
            </li>
            <li>
              <strong>Random active rewards</strong>
              <span>
                {seasonModel.me && seasonModel.activeWinnerIds.has(String(seasonModel.me.userId))
                  ? "Selected this season from active users"
                  : "Active users are randomly selected each season (10%)"}
              </span>
            </li>
          </ul>
        </article>
      </section>

      {ranked.length === 0 ? (
        <p style={{ padding: "24px 12px", color: "#9ca3af", textAlign: "center", margin: 0 }}>
          No leaderboard rows yet. Play a few rounds or check back after the next sync.
        </p>
      ) : null}
      <div className="f10-lb-list" role="list">
        {ranked.map((player, idx) => {
          const isYou =
            player.isCurrentUser ||
            (currentUserId && String(player.userId) === currentUserId) ||
            (user?.username && player.username === user.username);
          return (
            <LeaderboardRow
              key={`${String(player.userId || player.username || "row")}-${player.rank}-${idx}`}
              player={player}
              rank={player.rank}
              isTopThree={player.rank <= 3}
              isYou={Boolean(isYou)}
              onInspect={setSelected}
            />
          );
        })}
      </div>

      <PlayerShowcase
        open={Boolean(selected)}
        player={selected}
        onClose={() => setSelected(null)}
      />
    </div>
  );
}

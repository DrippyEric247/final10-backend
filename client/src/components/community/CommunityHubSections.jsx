import React, { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import {
  Gift,
  Heart,
  Share2,
  Target,
  TrendingUp,
  UserPlus,
  Users,
  Sparkles,
  Megaphone,
  HelpCircle,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { applyServerSavvyBalance } from "../../lib/applyServerSavvyBalance";
import { SAVVY_SCOUT } from "../../config/savvyScoutBranding";
import {
  claimCommunityReward,
  getCommunityGoals,
  getCommunityMilestones,
  getCommunityProgress,
} from "../../lib/api";
import {
  claimCommunityMission,
  completeCommunityMission,
  listCommunityMissions,
  subscribeCommunityMissions,
} from "../../lib/communityMissions";
import { buildCommunityFeed } from "../../lib/communityFeed";
import "../../styles/CommunityHub.css";

function formatCompact(n) {
  const num = Number(n) || 0;
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return String(Math.round(num));
}

function progressPct(current, target) {
  const t = Number(target) || 1;
  const c = Number(current) || 0;
  return Math.min(100, Math.round((c / t) * 100));
}

const GOAL_META = {
  savvyPoints: { label: "Savvy Points earned", icon: Sparkles, tone: "violet" },
  followers: { label: "Community followers", icon: Users, tone: "gold" },
  shares: { label: "Content shares", icon: Share2, tone: "cyan" },
  betaSignups: { label: "Beta signups", icon: UserPlus, tone: "pink" },
  activeAlerts: { label: "Active alerts", icon: Megaphone, tone: "blue" },
  auctionsWon: { label: "Auctions won", icon: TrendingUp, tone: "green" },
};

const FALLBACK_GOALS = {
  savvyPoints: { target: 1_000_000, reward: { points: 10_000, subscription: 1 } },
  followers: { target: 10_000, reward: { points: 10_000, subscription: 1 } },
  shares: { target: 5_000, reward: { points: 10_000, subscription: 1 } },
  betaSignups: { target: 2_500, reward: { points: 10_000, subscription: 1 } },
};

const FALLBACK_PROGRESS = {
  savvyPoints: 742_000,
  followers: 4_820,
  shares: 1_940,
  betaSignups: 1_120,
  canClaimReward: false,
};

export default function CommunityHubSections({ onPostWin }) {
  const { user, patchUser } = useAuth();
  const [goals, setGoals] = useState(null);
  const [progress, setProgress] = useState(null);
  const [milestones, setMilestones] = useState([]);
  const [missions, setMissions] = useState(() => listCommunityMissions(user));
  const [loadingGoals, setLoadingGoals] = useState(true);
  const [claimingGoal, setClaimingGoal] = useState(false);
  const [claimingMissionId, setClaimingMissionId] = useState(null);
  const [copiedReferral, setCopiedReferral] = useState(false);

  const refreshMissions = useCallback(() => {
    setMissions(listCommunityMissions(user));
  }, [user]);

  const loadHubData = useCallback(async () => {
    setLoadingGoals(true);
    try {
      const [goalsData, progressData, milestoneData] = await Promise.all([
        getCommunityGoals(),
        getCommunityProgress(),
        getCommunityMilestones().catch(() => []),
      ]);
      setGoals(goalsData);
      setProgress(progressData);
      setMilestones(milestoneData);
    } catch {
      setGoals(FALLBACK_GOALS);
      setProgress(FALLBACK_PROGRESS);
      setMilestones([]);
    } finally {
      setLoadingGoals(false);
    }
  }, []);

  useEffect(() => {
    loadHubData();
  }, [loadHubData]);

  useEffect(() => subscribeCommunityMissions(refreshMissions), [refreshMissions]);

  const feed = useMemo(() => buildCommunityFeed(milestones), [milestones]);

  const goalRows = useMemo(() => {
    const g = goals || FALLBACK_GOALS;
    const p = progress || FALLBACK_PROGRESS;
    const keys = ["followers", "shares", "betaSignups", "savvyPoints"];
    return keys
      .filter((key) => g[key])
      .map((key) => {
        const meta = GOAL_META[key] || { label: key, icon: Target, tone: "violet" };
        return {
          key,
          ...meta,
          current: p[key] ?? 0,
          target: g[key]?.target ?? 1,
        };
      });
  }, [goals, progress]);

  const completedGoals = goalRows.filter((g) => progressPct(g.current, g.target) >= 100).length;

  const handleClaimGoal = async () => {
    if (!user) {
      toast.error("Sign in to claim community rewards.");
      return;
    }
    setClaimingGoal(true);
    try {
      const result = await claimCommunityReward();
      toast.success(`+${result.points} Savvy and ${result.subscription} month subscription!`);
      loadHubData();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Could not claim reward yet.");
    } finally {
      setClaimingGoal(false);
    }
  };

  const handleMissionAction = async (mission) => {
    if (mission.actionType === "referral") {
      if (!mission.referralLink) {
        toast.error("Sign in to get your referral link.");
        return;
      }
      try {
        await navigator.clipboard.writeText(mission.referralLink);
        setCopiedReferral(true);
        window.setTimeout(() => setCopiedReferral(false), 2000);
        toast.success("Referral link copied!");
      } catch {
        toast.error("Could not copy link — try again.");
        return;
      }
    } else if (mission.externalUrl) {
      window.open(mission.externalUrl, "_blank", "noopener,noreferrer");
    }

    const fresh = completeCommunityMission(mission.id);
    if (fresh) {
      refreshMissions();
      toast.success("Mission complete — claim your Savvy!");
    }
  };

  const handleClaimMission = async (missionId) => {
    setClaimingMissionId(missionId);
    try {
      const result = await claimCommunityMission(missionId);
      refreshMissions();
      if (result.duplicate) {
        toast.success("Already claimed for this period.");
      } else if (result.amount > 0) {
        toast.success(`+${result.amount} Savvy claimed!`);
      } else {
        toast.success("Mission claimed.");
      }
    } catch (err) {
      toast.error(err?.message || "Could not claim mission.");
    } finally {
      setClaimingMissionId(null);
    }
  };

  const claimableMissions = missions.filter((m) => m.claimable);

  return (
    <div id="community-hub" className="ch-hub">
      <section className="ch-scout-banner" aria-label="Savvy Scout community guide">
        <div className="ch-scout-avatar" aria-hidden>
          {SAVVY_SCOUT.emoji}
        </div>
        <div className="ch-scout-copy">
          <p className="ch-scout-eyebrow">{SAVVY_SCOUT.shortTitle} · Community Guide</p>
          <h2>Grow the Savvy Universe — earn while you help.</h2>
          <p>
            Complete optional social missions, push community goals forward, and celebrate wins
            together. Every action pulls more retailers, deals, and rewards into Final10.
          </p>
        </div>
        <div className="ch-scout-stats">
          <div>
            <span className="ch-scout-stat-val">{claimableMissions.length}</span>
            <span className="ch-scout-stat-label">ready to claim</span>
          </div>
          <div>
            <span className="ch-scout-stat-val">{completedGoals}/{goalRows.length}</span>
            <span className="ch-scout-stat-label">goals hit</span>
          </div>
        </div>
      </section>

      <div className="ch-top-grid">
        <section className="ch-panel ch-missions" aria-labelledby="ch-missions-title">
          <header className="ch-panel-hd">
            <div>
              <p className="ch-panel-eyebrow">Optional · earn Savvy</p>
              <h3 id="ch-missions-title">Community Missions</h3>
              <p className="ch-panel-sub">Social missions reset daily or weekly. All optional.</p>
            </div>
          </header>
          <ul className="ch-mission-list">
            {missions.map((mission) => (
              <li
                key={mission.id}
                className={`ch-mission-card ${mission.claimable ? "is-claimable" : ""} ${
                  mission.claimed ? "is-claimed" : ""
                }`}
              >
                <div className="ch-mission-icon" aria-hidden>
                  {mission.icon}
                </div>
                <div className="ch-mission-main">
                  <div className="ch-mission-title">{mission.title}</div>
                  <p className="ch-mission-scout">{mission.scoutLine}</p>
                  <div className="ch-mission-meta">
                    <span className="ch-mission-reward">+{mission.rewardSavvy} Savvy</span>
                    <span className="ch-mission-cadence">{mission.cadence}</span>
                  </div>
                </div>
                <div className="ch-mission-actions">
                  {mission.claimable ? (
                    <button
                      type="button"
                      className="ch-btn ch-btn--gold"
                      disabled={claimingMissionId === mission.id}
                      onClick={() => handleClaimMission(mission.id)}
                    >
                      {claimingMissionId === mission.id ? "…" : "Claim"}
                    </button>
                  ) : mission.claimed ? (
                    <span className="ch-mission-done">Claimed ✓</span>
                  ) : (
                    <button
                      type="button"
                      className="ch-btn ch-btn--ghost"
                      onClick={() => handleMissionAction(mission)}
                    >
                      {mission.actionType === "referral"
                        ? copiedReferral
                          ? "Copied!"
                          : mission.actionLabel
                        : mission.actionLabel || "Start"}
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>

        <aside className="ch-panel ch-why-help" aria-labelledby="ch-why-title">
          <header className="ch-panel-hd">
            <HelpCircle className="ch-why-icon" size={22} aria-hidden />
            <div>
              <p className="ch-panel-eyebrow">The bigger picture</p>
              <h3 id="ch-why-title">Why Help?</h3>
            </div>
          </header>
          <ul className="ch-why-list">
            <li>
              <Heart size={16} aria-hidden />
              <span>
                <strong>More retailers join</strong> when they see an active, engaged community
                hunting deals.
              </span>
            </li>
            <li>
              <TrendingUp size={16} aria-hidden />
              <span>
                <strong>Better deals surface</strong> as inventory and competition grow across the
                Savvy Universe.
              </span>
            </li>
            <li>
              <Gift size={16} aria-hidden />
              <span>
                <strong>Everyone earns more</strong> — community goals unlock Savvy bonuses and
                subscription rewards for participants.
              </span>
            </li>
            <li>
              <Users size={16} aria-hidden />
              <span>
                <strong>Your wins inspire others</strong> — post savings, share proof, and pull new
                scouts into the hunt.
              </span>
            </li>
          </ul>
          <button type="button" className="ch-btn ch-btn--primary ch-why-cta" onClick={onPostWin}>
            Post your win
          </button>
        </aside>
      </div>

      <section className="ch-panel ch-goals" aria-labelledby="ch-goals-title">
        <header className="ch-panel-hd ch-panel-hd--row">
          <div>
            <p className="ch-panel-eyebrow">Live · community-wide</p>
            <h3 id="ch-goals-title">Community Goal Progress</h3>
            <p className="ch-panel-sub">
              Followers, shares, beta signups, and Savvy earned — updated as the universe grows.
            </p>
          </div>
          {progress?.canClaimReward ? (
            <button
              type="button"
              className="ch-btn ch-btn--gold"
              disabled={claimingGoal}
              onClick={handleClaimGoal}
            >
              <Gift size={16} aria-hidden />
              {claimingGoal ? "Claiming…" : "Claim community reward"}
            </button>
          ) : null}
        </header>

        {loadingGoals ? (
          <div className="ch-goals-skeleton" aria-hidden>
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="ch-goal-skel" />
            ))}
          </div>
        ) : (
          <div className="ch-goals-grid">
            {goalRows.map((goal) => {
              const pct = progressPct(goal.current, goal.target);
              const Icon = goal.icon;
              return (
                <article key={goal.key} className={`ch-goal-card ch-goal-card--${goal.tone}`}>
                  <div className="ch-goal-top">
                    <Icon size={18} aria-hidden />
                    <span>{goal.label}</span>
                  </div>
                  <div className="ch-goal-value">
                    {formatCompact(goal.current)}
                    <span className="ch-goal-target">/ {formatCompact(goal.target)}</span>
                  </div>
                  <div className="ch-goal-bar" aria-hidden>
                    <span style={{ width: `${pct}%` }} />
                  </div>
                  <div className="ch-goal-pct">{pct}% toward goal</div>
                </article>
              );
            })}
          </div>
        )}

        <div className="ch-goals-reward">
          <Target size={18} aria-hidden />
          <p>
            When any goal completes, participants can claim{" "}
            <strong>10,000 Savvy Points</strong> plus a <strong>1-month subscription</strong>.
          </p>
        </div>
      </section>

      <section className="ch-panel ch-feed" aria-labelledby="ch-feed-title">
        <header className="ch-panel-hd">
          <p className="ch-panel-eyebrow">Recent momentum</p>
          <h3 id="ch-feed-title">Community Feed</h3>
          <p className="ch-panel-sub">Milestones, wins, and progress from across Final10.</p>
        </header>
        <ul className="ch-feed-list">
          {feed.map((item) => (
            <li key={item.id} className="ch-feed-item">
              <span className="ch-feed-icon" aria-hidden>
                {item.icon}
              </span>
              <div className="ch-feed-copy">
                <div className="ch-feed-headline">{item.headline}</div>
                <div className="ch-feed-detail">{item.detail}</div>
              </div>
              <time className="ch-feed-time">{item.relative}</time>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

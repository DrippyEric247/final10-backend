import React, { useState, useEffect, useMemo, useRef, useCallback, useReducer } from 'react';
import { motion } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  getDailyTasks,
  claimDailyLogin,
  getLevelInfo,
  getMilestones,
} from '../lib/api';
import api from '../services/authService';
import ProfilePageLayout from './ProfilePageLayout';
import PremiumEntitlementCard from '../components/PremiumEntitlementCard';
import { useEntitlement } from '../hooks/useEntitlement';
import { calculateRewardMultiplier } from '../lib/rewardMultiplier';
import '../styles/ProfileTasks.css';
import { buildRankedLeaderboard } from '../data/leaderboardMock';
import { buildThemStatsFromRanked, resolveRivalUserId } from '../data/rivalryMock.js';
import { BP_UPDATE_EVENT } from '../lib/battlePassConfig';
import {
  BATTLE_PASS_TIERS,
  MOCK_PROFILE_ACTIVITIES,
  pickNextBestGoal,
  sortActivitiesByRecency,
} from '../lib/profilePageEngagement.js';
import {
  getUniversalBoostState,
  notifyUniversalProgressRefresh,
  UNIVERSAL_BAR_TASK_PULSE_EVENT,
} from '../lib/universalBoostProgress';
import { emitPowerToast } from '../lib/final10PowerFeedback';
import { POWER_UX } from '../lib/final10PowerConfig';
import { getBattlePassProgress, recordBattlePassXp } from '../lib/battlePassEngine';
import { buildRivalryComparison, defaultChaseReward } from '../lib/rivalryComparison.js';
import { triggerActionReward, triggerDailyLoginReward } from '../lib/rewardEngine';
import SavvyBalanceCard from '../components/profile/SavvyBalanceCard';
import LoadingState from '../components/ui/states/LoadingState';
import ErrorState from '../components/ui/states/ErrorState';
import { trackPointsEarned } from '../lib/analytics';
import { getApiBaseUrl } from '../lib/runtimeApi';
import { useSavvyPoints } from '../store/savvyStore';
import ProgramBadge from '../components/programs/ProgramBadge';
import { getEquippedCallingCardId, getEquippedEmblemId } from '../lib/customizationCatalog';
import {
  applyTierMultiplier,
  DEV_SUBSCRIPTION_TOOLS_EVENT,
  formatTierMultiplierLabel,
  getAdvantageTier,
  getBestMoveBoostedCap,
  getEffectiveSubscriptionTier,
} from '../lib/tierMultiplier';
import '../styles/SavvyPrograms.css';
import { resetOnboardingPreferences } from '../lib/onboardingPreferences';

const getSavvySyncBonus = (completedCount, totalSystems) => {
  if (completedCount >= totalSystems) return 3;
  if (completedCount >= 3) return 2;
  if (completedCount >= 2) return 1.5;
  return 1;
};

const getWeekKeyUTC = (timestampMs) => {
  const d = new Date(timestampMs);
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
};

const PERMANENT_RANKS = [
  { name: "Bronze", minPoints: 0, color: "text-amber-500" },
  { name: "Silver", minPoints: 1000, color: "text-slate-300" },
  { name: "Gold", minPoints: 5000, color: "text-yellow-400" },
  { name: "Platinum", minPoints: 12000, color: "text-cyan-300" },
  { name: "Legend", minPoints: 25000, color: "text-fuchsia-400" },
];

const VIP_RANKS = ["VIP Bronze", "VIP Silver", "VIP Gold", "VIP Platinum", "VIP Legend"];
const VIP_MAINTAIN_THRESHOLD = 100;
const VIP_PROMOTE_THRESHOLD = 180;

const TASK_DAILY_BONUS_MIN = 100;
const TASK_DAILY_BONUS_MAX = 130;

const getDayKey = (timestampMs) => {
  const d = new Date(timestampMs);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const getBestMovePowerUsedToday = () => {
  try {
    const raw = JSON.parse(localStorage.getItem("f10_best_move_power_daily_v1") || "{}");
    const today = getDayKey(Date.now());
    if (raw.date !== today) return 0;
    return Math.max(0, Number(raw.used) || 0);
  } catch {
    return 0;
  }
};

const Profile = () => {
  const { user, refreshProfile } = useAuth();
  const savvyLive = useSavvyPoints();
  const navigate = useNavigate();
  const location = useLocation();
  const entitlement = useEntitlement(Boolean(user));
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const [pointsUpdating, setPointsUpdating] = useState(false);
  const [showSuccessMessage, setShowSuccessMessage] = useState('');
  const [advTierTick, bumpAdvTier] = useReducer((n) => n + 1, 0);
  void advTierTick;

  useEffect(() => {
    const bump = () => bumpAdvTier();
    window.addEventListener('f10:subscription-tier-updated', bump);
    window.addEventListener(DEV_SUBSCRIPTION_TOOLS_EVENT, bump);
    return () => {
      window.removeEventListener('f10:subscription-tier-updated', bump);
      window.removeEventListener(DEV_SUBSCRIPTION_TOOLS_EVENT, bump);
    };
  }, []);

  // Handle points earned from redeem codes
  const handlePointsEarned = (points) => {
    setPointsUpdating(true);
    void refreshProfile();
    // Refresh points data
    queryClient.invalidateQueries(['dailyTasks']);
    queryClient.invalidateQueries(['levelInfo']);
    queryClient.invalidateQueries(['levelStats']);
    queryClient.invalidateQueries(['milestones']);
    
    // Show success message
    setShowSuccessMessage(`+${points} points earned!`);
    setTimeout(() => {
      setShowSuccessMessage('');
      setPointsUpdating(false);
    }, 3000);
  };

  // Fetch daily tasks
  const {
    data: tasksData,
    isLoading,
    isError: tasksIsError,
    refetch: refetchTasks,
  } = useQuery({
    queryKey: ['dailyTasks'],
    queryFn: getDailyTasks,
    enabled: !!user,
    refetchInterval: false, // Disable automatic refetching to prevent rate limiting
    refetchOnWindowFocus: false, // Disable refetch on window focus
    onSuccess: (data) => {
      console.log('Daily tasks data received:', data);
    },
    onError: (error) => {
      console.error('Daily tasks fetch error:', error);
      if (error.status === 429) {
        console.warn('Rate limited - will retry later');
      }
    },
  });

  // Fetch level information
  const {
    data: levelData,
    isLoading: levelLoading,
    isError: levelIsError,
    refetch: refetchLevel,
  } = useQuery({
    queryKey: ['levelInfo'],
    queryFn: getLevelInfo,
    enabled: !!user,
    refetchInterval: false, // Disable automatic refetching to prevent rate limiting
    refetchOnWindowFocus: false, // Disable refetch on window focus
    onError: (error) => {
      console.error('Level info fetch error:', error);
      if (error.status === 429) {
        console.warn('Rate limited - will retry later');
      }
    },
  });

  useQuery({
    queryKey: ['milestones'],
    queryFn: getMilestones,
    enabled: !!user,
  });

  /** Deep-link from Home “Savvy Balance” — scroll to the same card as the profile Savvy balance. */
  useEffect(() => {
    if (!user || isLoading || levelLoading) return;
    if (location.hash !== '#savvy-balance') return;
    const id = window.requestAnimationFrame(() => {
      document.getElementById('savvy-balance')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    return () => window.cancelAnimationFrame(id);
  }, [user, isLoading, levelLoading, location.hash]);

  const basePoints = Number(tasksData?.totalPoints || 0);
  const streakMetaRaw = (() => {
    try {
      return JSON.parse(localStorage.getItem("f10_bundle_streak_data") || "{}");
    } catch {
      return {};
    }
  })();
  const streakWeeks = Number(streakMetaRaw?.streak) || 0;
  const nowMs = Date.now();
  const currentWeekKey = getWeekKeyUTC(nowMs);
  const currentDayKey = getDayKey(nowMs);
  const completedTasksCount = Object.values(tasksData?.dailyTasks?.tasks || {}).filter(task => task?.completed).length;
  const weeklyActivityScore = Math.max(
    0,
    (completedTasksCount * 25) + (streakWeeks * 10) + Math.min(100, Math.floor(basePoints / 1000) * 5)
  );
  const permanentRank =
    [...PERMANENT_RANKS].reverse().find((rank) => basePoints >= rank.minPoints) || PERMANENT_RANKS[0];
  const permanentRankIndex = PERMANENT_RANKS.findIndex((r) => r.name === permanentRank.name);
  const nextPermanentRank = PERMANENT_RANKS[permanentRankIndex + 1] || null;
  const rankProgressToNext = (() => {
    if (!nextPermanentRank) {
      return {
        pct: 100,
        blocksFilled: 9,
        ptsRemaining: 0,
      };
    }
    const lo = permanentRank.minPoints;
    const hi = nextPermanentRank.minPoints;
    const span = Math.max(1, hi - lo);
    const t = (basePoints - lo) / span;
    const pct = Math.max(0, Math.min(100, t * 100));
    const blocksFilled = Math.min(9, Math.round((pct / 100) * 9));
    return {
      pct,
      blocksFilled,
      ptsRemaining: Math.max(0, nextPermanentRank.minPoints - basePoints),
    };
  })();
  const silverMinPoints = PERMANENT_RANKS.find((r) => r.name === "Silver")?.minPoints ?? 1000;
  const hasSilverRank = basePoints >= silverMinPoints;
  const vipStatusMode = !hasSilverRank
    ? "locked"
    : weeklyActivityScore < VIP_MAINTAIN_THRESHOLD
    ? "atRisk"
    : weeklyActivityScore < VIP_PROMOTE_THRESHOLD
    ? "unlocking"
    : "active";
  const vipRankDataRaw = (() => {
    try {
      const raw = JSON.parse(localStorage.getItem("f10_vip_rank_data") || "{}");
      return {
        tier: Number.isFinite(Number(raw.tier)) ? Number(raw.tier) : 0,
        lastEvaluatedWeek: raw.lastEvaluatedWeek || currentWeekKey,
        lastScore: Number(raw.lastScore) || 0,
      };
    } catch {
      return { tier: 0, lastEvaluatedWeek: currentWeekKey, lastScore: 0 };
    }
  })();
  const [vipRankData, setVipRankData] = useState(vipRankDataRaw);
  const [taskBonusMessage, setTaskBonusMessage] = useState("");
  const [unlockToasts, setUnlockToasts] = useState([]);
  const prevTaskDoneSetRef = useRef(null);
  const [dailyClearedShow, setDailyClearedShow] = useState(false);
  const [dailyClearedNonce, setDailyClearedNonce] = useState(0);
  const prevAllTasksCompleteRef = useRef(null);
  const [taskProgressState, setTaskProgressState] = useState(() => {
    try {
      const raw = JSON.parse(localStorage.getItem("f10_task_progress_state") || "{}");
      return {
        lastCompletedPeriod: raw.lastCompletedPeriod || "",
        lastBonusPoints: Number(raw.lastBonusPoints) || 0,
      };
    } catch {
      return { lastCompletedPeriod: "", lastBonusPoints: 0 };
    }
  });
  const [taskStreakData, setTaskStreakData] = useState(() => {
    try {
      const raw = JSON.parse(localStorage.getItem("f10_task_streak_data") || "{}");
      return {
        streak: Number(raw.streak) || 0,
        lastEvaluatedWeek: raw.lastEvaluatedWeek || currentWeekKey,
        completedWeeks: raw.completedWeeks && typeof raw.completedWeeks === "object" ? raw.completedWeeks : {},
      };
    } catch {
      return { streak: 0, lastEvaluatedWeek: currentWeekKey, completedWeeks: {} };
    }
  });

  const getTaskProgress = () => {
    const safeReadArray = (key) => {
      try {
        const raw = JSON.parse(localStorage.getItem(key) || "[]");
        return Array.isArray(raw) ? raw : [];
      } catch {
        return [];
      }
    };
    const safeReadObject = (key) => {
      try {
        const raw = JSON.parse(localStorage.getItem(key) || "{}");
        return raw && typeof raw === "object" ? raw : {};
      } catch {
        return {};
      }
    };

    const watchlist = safeReadArray("f10_watchlist_ids");
    const bundles = safeReadArray("f10_saved_bundles");
    const streakRaw = safeReadObject("f10_bundle_streak_data");
    const completedWeeks = streakRaw.completedWeeks && typeof streakRaw.completedWeeks === "object"
      ? streakRaw.completedWeeks
      : {};
    const anyWeekCompleted = Object.values(completedWeeks).some(Boolean);
    const dealClicks = Number(localStorage.getItem("f10_deal_click_count") || 0);
    const profileVisits = Number(localStorage.getItem("f10_profile_visits") || 0);

    const tasks = [
      { id: "save_item", label: "Save at least 1 item", done: watchlist.length > 0 },
      { id: "bundle_action", label: "Create or complete a bundle", done: bundles.length > 0 || anyWeekCompleted },
      { id: "visit_app", label: "Visit app today", done: profileVisits > 0 },
      { id: "click_deal", label: "Click at least 1 deal", done: dealClicks > 0 },
      { id: "keep_streak", label: "Maintain an active streak", done: streakWeeks > 0 },
    ];

    const completed = tasks.filter((t) => t.done).length;
    const total = tasks.length;
    const remaining = Math.max(0, total - completed);
    const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { tasks, completed, total, remaining, percent };
  };

  const taskProgress = getTaskProgress();

  const taskDoneSig = taskProgress.tasks
    .map((t) => `${t.id}:${t.done ? 1 : 0}`)
    .join('|');

  useEffect(() => {
    const nowDone = new Set(
      taskProgress.tasks.filter((t) => t.done).map((t) => t.id)
    );
    if (prevTaskDoneSetRef.current === null) {
      prevTaskDoneSetRef.current = nowDone;
      return;
    }
    const prev = prevTaskDoneSetRef.current;
    nowDone.forEach((id) => {
      if (!prev.has(id)) {
        recordBattlePassXp('task_step');
        triggerActionReward("task_complete");
        notifyUniversalProgressRefresh();
        window.dispatchEvent(new CustomEvent(UNIVERSAL_BAR_TASK_PULSE_EVENT));
        emitPowerToast(POWER_UX.TASK_STEP_POWER_POP);
      }
    });
    prevTaskDoneSetRef.current = nowDone;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- taskDoneSig fingerprints task done state
  }, [taskDoneSig]);

  useEffect(() => {
    const full =
      taskProgress.total > 0 && taskProgress.completed === taskProgress.total;
    if (prevAllTasksCompleteRef.current === null) {
      prevAllTasksCompleteRef.current = full;
      return;
    }
    if (full && !prevAllTasksCompleteRef.current) {
      setDailyClearedNonce((n) => n + 1);
      setDailyClearedShow(true);
      notifyUniversalProgressRefresh();
      window.setTimeout(() => setDailyClearedShow(false), 2200);
    }
    prevAllTasksCompleteRef.current = full;
  }, [taskProgress.completed, taskProgress.total]);

  const prevTaskStreakRef = useRef(null);
  useEffect(() => {
    const s = Number(taskStreakData.streak) || 0;
    if (prevTaskStreakRef.current != null && s > prevTaskStreakRef.current) {
      recordBattlePassXp('streak_week');
    }
    prevTaskStreakRef.current = s;
  }, [taskStreakData.streak]);

  const currentWeekTaskCompleted = Boolean(taskStreakData.completedWeeks?.[currentWeekKey]);
  const displayTaskStreak = taskStreakData.streak + (currentWeekTaskCompleted ? 1 : 0);
  const watchlistCount = (() => {
    try {
      const raw = JSON.parse(localStorage.getItem("f10_watchlist_ids") || "[]");
      return Array.isArray(raw) ? raw.length : 0;
    } catch {
      return 0;
    }
  })();
  const bundleCount = (() => {
    try {
      const raw = JSON.parse(localStorage.getItem("f10_selected_bundle_ids") || "[]");
      return Array.isArray(raw) ? raw.length : 0;
    } catch {
      return 0;
    }
  })();
  const localMissionComplete = (() => {
    try {
      const m = JSON.parse(localStorage.getItem("f10_local_mission_data") || "{}");
      return Boolean(m.rewardReady) || (Number(m.purchases) || 0) >= 2;
    } catch {
      return false;
    }
  })();
  const promotedItems = (() => {
    try {
      const p = JSON.parse(localStorage.getItem("f10_promoted_item_ids") || "[]");
      return Array.isArray(p) ? p.length : 0;
    } catch {
      return 0;
    }
  })();
  const localPurchasesCount = (() => {
    try {
      return Number(JSON.parse(localStorage.getItem("f10_local_mission_data") || "{}").purchases) || 0;
    } catch {
      return 0;
    }
  })();
  const scanVideosCount = (() => {
    try {
      return Number(JSON.parse(localStorage.getItem("f10_scan_earn_state") || "{}").scannedVideos) || 0;
    } catch {
      return 0;
    }
  })();
  const rewardSystem = calculateRewardMultiplier({
    bundleCount,
    watchlistCount,
    streakWeeks,
    localMissionComplete,
    promotedItems,
  });
  const scanComplete = (() => {
    try {
      return localStorage.getItem("f10_scan_complete") === "true" || localStorage.getItem("f10_video_scanner_used") === "true";
    } catch {
      return false;
    }
  })();
  const systems = useMemo(
    () => ({
      bundleComplete: bundleCount >= 2,
      watchlistComplete: watchlistCount >= 3,
      localComplete: localMissionComplete,
      scanComplete,
      promotionComplete: promotedItems >= 3,
      taskComplete: taskProgress.completed === taskProgress.total && taskProgress.total > 0,
    }),
    [
      bundleCount,
      watchlistCount,
      localMissionComplete,
      scanComplete,
      promotedItems,
      taskProgress.completed,
      taskProgress.total,
    ]
  );
  const completedSystemsCount = Object.values(systems).filter(Boolean).length;
  const totalSystems = Object.keys(systems).length;
  const savvySyncBonus = getSavvySyncBonus(completedSystemsCount, totalSystems);
  const baseBoost = rewardSystem.totalBoost;
  const tabExplorerBoost = (() => {
    try {
      const raw = JSON.parse(localStorage.getItem("f10_localdeals_explorer") || "{}");
      if (raw.weekKey === currentWeekKey && raw.complete) return 1.05;
    } catch {
      /* ignore */
    }
    return 1;
  })();
  const totalBoost = Math.min(5, baseBoost * savvySyncBonus * tabExplorerBoost);

  const breakdown = rewardSystem.breakdown;
  const leaderboardScore = Math.floor(basePoints * totalBoost);
  const savvyGameRows = [
    {
      systemKey: "watchlistComplete",
      icon: "⭐",
      label: "Watchlist",
      doThis: "Save 3 items you’re watching",
      actionShort: "Save 3 items",
      rewardLine: "+0.1x",
    },
    {
      systemKey: "taskComplete",
      icon: "🔥",
      label: "Tasks",
      doThis: "Finish today’s daily checklist",
      actionShort: "Clear daily list",
      rewardLine: "+0.2x",
    },
    {
      systemKey: "bundleComplete",
      icon: "📦",
      label: "Bundle",
      doThis: "Lock in a 2-item bundle",
      actionShort: "2-item bundle",
      rewardLine: "+0.2x",
    },
    {
      systemKey: "localComplete",
      icon: "📍",
      label: "Local",
      doThis: "Complete 2 Quick Snipes",
      actionShort: "2 Quick Snipes",
      rewardLine: "+0.2x",
    },
    {
      systemKey: "scanComplete",
      icon: "📷",
      label: "Scan",
      doThis: "Scan a video or deal once",
      actionShort: "Scan once",
      rewardLine: "+0.2x",
    },
    {
      systemKey: "promotionComplete",
      icon: "📣",
      label: "Promote",
      doThis: "Promote 3 listings",
      actionShort: "3 listings",
      rewardLine: "+0.2x",
    },
  ];
  const getSavvyRowStatus = (systemKey) => {
    if (systems[systemKey]) return "complete";
    if (systemKey === "watchlistComplete") return watchlistCount > 0 ? "inProgress" : "start";
    if (systemKey === "taskComplete") {
      if (taskProgress.total <= 0) return "start";
      return taskProgress.completed > 0 && taskProgress.completed < taskProgress.total
        ? "inProgress"
        : "start";
    }
    if (systemKey === "bundleComplete") return bundleCount > 0 ? "inProgress" : "start";
    if (systemKey === "localComplete") return localPurchasesCount > 0 ? "inProgress" : "start";
    if (systemKey === "scanComplete") return scanVideosCount > 0 ? "inProgress" : "start";
    if (systemKey === "promotionComplete") return promotedItems > 0 ? "inProgress" : "start";
    return "start";
  };
  const savvyNextUnlock = (() => {
    const c = completedSystemsCount;
    if (c >= totalSystems) {
      return { nextBoost: null, systemsNeeded: 0, maxed: true };
    }
    if (c < 2) return { nextBoost: "1.5x", systemsNeeded: 2 - c, maxed: false };
    if (c < 3) return { nextBoost: "2.0x", systemsNeeded: 3 - c, maxed: false };
    return { nextBoost: "3.0x", systemsNeeded: totalSystems - c, maxed: false };
  })();
  useEffect(() => {
    localStorage.setItem(
      "f10_leaderboard_meta",
      JSON.stringify({
        streakWeeks,
        taskStreakWeeks: displayTaskStreak,
        breakdown,
        savvySyncBonus,
        tabExplorerBoost,
        totalBoost,
        multiplier: totalBoost,
        leaderboardScore,
        updatedAt: Date.now(),
      })
    );
  }, [basePoints, streakWeeks, displayTaskStreak, breakdown, savvySyncBonus, tabExplorerBoost, totalBoost, leaderboardScore]);

  useEffect(() => {
    try {
      const raw = JSON.parse(localStorage.getItem("f10_weekly_activity_scores") || "{}");
      raw[currentWeekKey] = weeklyActivityScore;
      localStorage.setItem("f10_weekly_activity_scores", JSON.stringify(raw));
    } catch {
      localStorage.setItem(
        "f10_weekly_activity_scores",
        JSON.stringify({ [currentWeekKey]: weeklyActivityScore })
      );
    }
  }, [currentWeekKey, weeklyActivityScore]);

  useEffect(() => {
    setVipRankData((prev) => {
      if (!prev || prev.lastEvaluatedWeek === currentWeekKey) {
        return prev;
      }

      let nextTier = Number(prev.tier) || 0;
      const priorScore = Number(prev.lastScore) || 0;

      if (priorScore >= VIP_PROMOTE_THRESHOLD) {
        nextTier = Math.min(VIP_RANKS.length - 1, nextTier + 1);
      } else if (priorScore < VIP_MAINTAIN_THRESHOLD) {
        nextTier = Math.max(0, nextTier - 1);
      }

      return {
        tier: nextTier,
        lastEvaluatedWeek: currentWeekKey,
        lastScore: weeklyActivityScore,
      };
    });
  }, [currentWeekKey, weeklyActivityScore]);

  useEffect(() => {
    setVipRankData((prev) => ({
      ...prev,
      lastScore: weeklyActivityScore,
    }));
  }, [weeklyActivityScore]);

  useEffect(() => {
    localStorage.setItem("f10_vip_rank_data", JSON.stringify(vipRankData));
  }, [vipRankData]);

  useEffect(() => {
    localStorage.setItem("f10_profile_visits", String((Number(localStorage.getItem("f10_profile_visits") || 0) + 1)));
  }, []);

  useEffect(() => {
    localStorage.setItem("f10_task_progress_state", JSON.stringify(taskProgressState));
  }, [taskProgressState]);

  useEffect(() => {
    if (taskProgress.completed !== taskProgress.total || taskProgress.total === 0) return;
    setTaskStreakData((prev) => ({
      ...prev,
      completedWeeks: {
        ...(prev.completedWeeks || {}),
        [currentWeekKey]: true,
      },
    }));
  }, [taskProgress.completed, taskProgress.total, currentWeekKey]);

  useEffect(() => {
    setTaskStreakData((prev) => {
      if (!prev || prev.lastEvaluatedWeek === currentWeekKey) return prev;
      const completedLastWeek = Boolean(prev.completedWeeks?.[prev.lastEvaluatedWeek]);
      const nextStreak = completedLastWeek ? prev.streak + 1 : Math.max(0, prev.streak - 1);
      return {
        ...prev,
        streak: nextStreak,
        lastEvaluatedWeek: currentWeekKey,
      };
    });
  }, [currentWeekKey]);

  useEffect(() => {
    localStorage.setItem("f10_task_streak_data", JSON.stringify(taskStreakData));
  }, [taskStreakData]);

  useEffect(() => {
    const key = "f10_savvy_sync_state";
    let previous = [];
    try {
      const raw = JSON.parse(localStorage.getItem(key) || "{}");
      previous = Array.isArray(raw.completedSystems) ? raw.completedSystems : [];
    } catch {
      previous = [];
    }

    const current = Object.entries(systems)
      .filter(([, done]) => done)
      .map(([id]) => id);
    const justCompleted = current.filter((id) => !previous.includes(id));
    if (justCompleted.length) {
      justCompleted.forEach(() => triggerActionReward("system_complete"));
      const nowStamp = Date.now();
      const toasts = justCompleted.map((id) => ({
        id: `system-${id}-${nowStamp}`,
        title: "Boost unlocked",
        body: `${id.replace("Complete", "").replace(/([A-Z])/g, " $1").trim()} — your rewards just got stronger`,
      }));
      setUnlockToasts((prev) => [...prev, ...toasts].slice(-4));
      toasts.forEach((toast) => {
        setTimeout(() => {
          setUnlockToasts((prev) => prev.filter((t) => t.id !== toast.id));
        }, 2600);
      });
    }

    localStorage.setItem(
      key,
      JSON.stringify({
        completedSystems: current,
        completedSystemsCount,
        savvySyncBonus,
        updatedAt: Date.now(),
      })
    );
  }, [systems, completedSystemsCount, savvySyncBonus, totalSystems]);

  useEffect(() => {
    const key = "f10_last_boost_tier";
    const currentTier =
      totalBoost >= 5 ? 5 : totalBoost >= 3 ? 3 : totalBoost >= 2 ? 2 : totalBoost >= 1.5 ? 1.5 : 1;
    const raw = localStorage.getItem(key);
    if (raw == null) {
      localStorage.setItem(key, String(currentTier));
      return;
    }
    const previousTier = Number(raw);
    if (Number.isFinite(previousTier) && currentTier > previousTier) {
      const toastId = `boost-${Date.now()}`;
      setUnlockToasts((prev) => [
        ...prev,
        {
          id: toastId,
          title: "Boost tier up!",
          body: `Your boost is now ${currentTier.toFixed(1)}×`,
        },
      ].slice(-4));
      setTimeout(() => {
        setUnlockToasts((prev) => prev.filter((t) => t.id !== toastId));
      }, 3000);
    }
    localStorage.setItem(key, String(currentTier));
  }, [totalBoost]);

  useEffect(() => {
    if (taskProgress.completed !== taskProgress.total) return;
    if (taskProgress.total === 0) return;
    if (taskProgressState.lastCompletedPeriod === currentDayKey) return;

    const rawBonus = 100 + Math.floor(Math.random() * 31);
    const randomBonus = applyTierMultiplier(rawBonus);
    recordBattlePassXp('tasks_complete_bonus');
    triggerActionReward("daily_login", {
      title: `🎁 +${randomBonus} POINTS`,
      subtitle: `Daily task bonus claimed (${formatTierMultiplierLabel()} boost)`,
      accent: "points",
    });
    setTaskBonusMessage(`Daily task bonus unlocked! +${randomBonus} points`);
    setTaskProgressState({
      lastCompletedPeriod: currentDayKey,
      lastBonusPoints: randomBonus,
    });

    try {
      const progressRaw = JSON.parse(localStorage.getItem("f10_task_progress_log") || "[]");
      const progressLog = Array.isArray(progressRaw) ? progressRaw : [];
      progressLog.unshift({
        period: currentDayKey,
        bonusPoints: randomBonus,
        completedAt: Date.now(),
      });
      localStorage.setItem("f10_task_progress_log", JSON.stringify(progressLog.slice(0, 30)));
    } catch {
      localStorage.setItem(
        "f10_task_progress_log",
        JSON.stringify([{ period: currentDayKey, bonusPoints: randomBonus, completedAt: Date.now() }])
      );
    }

    if ((window?.location?.pathname || "").includes("/profile")) {
      setTimeout(() => {
        queryClient.invalidateQueries(['dailyTasks']);
        queryClient.invalidateQueries(['levelInfo']);
        void refreshProfile();
      }, 300);
    }
  }, [taskProgress, taskProgressState.lastCompletedPeriod, currentDayKey, queryClient, refreshProfile]);

  // Fetch eBay connection status
  const { data: ebayStatus, isLoading: ebayStatusLoading } = useQuery({
    queryKey: ['ebayStatus', user?.id],
    queryFn: async () => {
      const response = await api.get(`/users/${user.id}/ebay-status`);
      return response.data;
    },
    enabled: !!user?.id,
    refetchInterval: 30000, // Refetch every 30 seconds to check token status
  });

  // Mutations for task actions
  const claimLoginMutation = useMutation({
    mutationFn: claimDailyLogin,
    onSuccess: (data) => {
      console.log('Daily login claimed successfully:', data);
      const added = Number(data?.added);
      if (Number.isFinite(added) && added > 0) {
        trackPointsEarned(added, 'daily_login_claim');
      }
      recordBattlePassXp('daily_login');
      const reward = triggerDailyLoginReward(20);
      setPointsUpdating(true);
      setShowSuccessMessage(`${reward.title} earned!`);
      // Invalidate all related queries to refresh the UI
      queryClient.invalidateQueries(['dailyTasks']);
      queryClient.invalidateQueries(['levelInfo']);
      queryClient.invalidateQueries(['levelStats']);
      queryClient.invalidateQueries(['milestones']);
      // Force refetch of daily tasks to get updated points
      queryClient.refetchQueries(['dailyTasks']).finally(() => {
        void refreshProfile();
        setPointsUpdating(false);
        setTimeout(() => setShowSuccessMessage(''), 3000);
      });
    },
    onError: (error) => {
      console.error('Daily login claim failed:', error);
      setPointsUpdating(false);
      const errorMessage = error.status === 429 
        ? 'Too many requests. Please wait a moment and try again.'
        : (error.message || 'Unknown error');
      alert('Failed to claim daily login: ' + errorMessage);
    },
  });

  // Handle eBay OAuth connection
  const handleConnectEbay = () => {
    // Real browser navigation so redirects/CORS work properly
    window.location.href = `${getApiBaseUrl()}/ebay-auth/start`;
  };

  const [rivalryTick, setRivalryTick] = useState(0);
  useEffect(() => {
    const bump = () => setRivalryTick((t) => t + 1);
    window.addEventListener('f10-universal-progress-refresh', bump);
    window.addEventListener('f10-power-core-updated', bump);
    window.addEventListener(BP_UPDATE_EVENT, bump);
    return () => {
      window.removeEventListener('f10-universal-progress-refresh', bump);
      window.removeEventListener('f10-power-core-updated', bump);
      window.removeEventListener(BP_UPDATE_EVENT, bump);
    };
  }, []);

  const rankedForRivalry = useMemo(() => {
    if (!user) return [];
    const rows = buildRankedLeaderboard(user).map((r) =>
      r.isCurrentUser
        ? {
            ...r,
            score: leaderboardScore,
            streakWeeks,
            taskStreakWeeks: displayTaskStreak,
          }
        : r
    );
    rows.sort((a, b) => b.score - a.score);
    return rows.map((r, i) => ({ ...r, rank: i + 1 }));
  }, [user, leaderboardScore, streakWeeks, displayTaskStreak]);

  const rivalUserId = resolveRivalUserId(searchParams.get('versus'));

  const rivalryUi = useMemo(() => {
    void rivalryTick;
    const skeleton = searchParams.get('rivalLoading') === '1';
    if (!user) {
      return {
        comparison: null,
        chaseReward: null,
        titleUpper: 'RIVAL',
        short: 'Rival',
        loading: false,
      };
    }
    const themStats = buildThemStatsFromRanked(rivalUserId, rankedForRivalry);
    const ub = getUniversalBoostState();
    const bp = getBattlePassProgress();
    let auctionsWon = 0;
    try {
      auctionsWon = Number(localStorage.getItem('f10_auction_wins') || '0') || 0;
    } catch {
      /* ignore */
    }
    const youRow = rankedForRivalry.find((r) => r.isCurrentUser);
    const displayName = user.firstName || user.username || 'You';
    const youStats = {
      userId: String(user.id ?? ''),
      displayName,
      leaderboardScore,
      leaderboardRank: youRow?.rank ?? (rankedForRivalry.length || 99),
      powerMultiplier: Number(ub.currentBoost) || 1,
      bundleStreakWeeks: streakWeeks,
      taskStreakWeeks: displayTaskStreak,
      vipTier: Math.min(5, Math.max(0, Number(vipRankData?.tier) || 0)),
      seasonTiersCleared: bp.completedCount,
      auctionsWon,
      savvyPointsThisWeek: weeklyActivityScore,
    };
    if (!themStats) {
      return {
        comparison: null,
        chaseReward: null,
        titleUpper: 'RIVAL',
        short: 'Rival',
        loading: skeleton,
      };
    }
    if (themStats.userId && String(user.id) === String(themStats.userId)) {
      return {
        comparison: null,
        chaseReward: null,
        titleUpper: 'YOU',
        short: displayName,
        loading: false,
      };
    }
    return {
      comparison: buildRivalryComparison(youStats, themStats),
      chaseReward: defaultChaseReward(themStats),
      titleUpper: themStats.displayName.replace(/\s+/g, '').toUpperCase(),
      short: themStats.displayName,
      loading: skeleton,
    };
  }, [
    user,
    rivalUserId,
    rankedForRivalry,
    rivalryTick,
    leaderboardScore,
    streakWeeks,
    displayTaskStreak,
    weeklyActivityScore,
    vipRankData?.tier,
    searchParams,
  ]);

  const handleRivalryStartChase = useCallback(() => {
    console.info('[Rivalry] Start the Chase');
  }, []);
  const handleRivalryViewLoadout = useCallback(() => {
    console.info('[Rivalry] View My Full Loadout');
  }, []);

  const profileEngagement = useMemo(() => {
    if (!user) {
      return { activityItems: [], nextGoal: null };
    }
    void rivalryTick;
    const themStats = buildThemStatsFromRanked(rivalUserId, rankedForRivalry);
    const youRow = rankedForRivalry.find((r) => r.isCurrentUser);
    const bp = getBattlePassProgress();
    let auctionsWon = 0;
    try {
      auctionsWon = Number(localStorage.getItem('f10_auction_wins') || '0') || 0;
    } catch {
      /* ignore */
    }
    const rank = youRow?.rank ?? 99;
    const pointsBehindRival =
      themStats && leaderboardScore < themStats.leaderboardScore
        ? themStats.leaderboardScore - leaderboardScore
        : null;

    const activityItems = sortActivitiesByRecency(MOCK_PROFILE_ACTIVITIES).slice(0, 6);
    const nextGoal = pickNextBestGoal({
      rivalDisplayName: themStats?.displayName ?? null,
      pointsBehindRival,
      leaderboardRank: rank,
      leaderboardScore,
      tasksCompleted: taskProgress.completed,
      tasksTotal: taskProgress.total,
      streakWeeks,
      taskStreakWeeks: displayTaskStreak,
      bpXp: bp.xp,
      bpMaxXp: bp.maxXp,
      bpCompletedTiers: bp.completedCount,
      bpTotalTiers: BATTLE_PASS_TIERS.length,
      auctionsWon,
      auctionNextMilestoneAt: 5,
      weeklyActivityScore,
      vipMaintainThreshold: VIP_MAINTAIN_THRESHOLD,
      vipPromoteThreshold: VIP_PROMOTE_THRESHOLD,
      hasSilverRank,
      vipStatusMode,
    });
    return { activityItems, nextGoal };
  }, [
    user,
    rivalryTick,
    rivalUserId,
    rankedForRivalry,
    leaderboardScore,
    taskProgress.completed,
    taskProgress.total,
    streakWeeks,
    displayTaskStreak,
    weeklyActivityScore,
    hasSilverRank,
    vipStatusMode,
  ]);

  const handleProfileGoalCta = useCallback((actionId) => {
    console.info('[ProfileGoal]', actionId);
  }, []);

  const handleRetakeSetup = useCallback(() => {
    resetOnboardingPreferences();
    navigate('/onboarding/preferences');
  }, [navigate]);

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-900 pt-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center">
            <h1 className="text-3xl font-bold text-white mb-4">Profile</h1>
            <p className="text-gray-400">Please login to view your profile and daily tasks</p>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading || levelLoading) {
    return (
      <div className="min-h-screen bg-gray-900 pt-20 flex justify-center px-4">
        <LoadingState label="Loading your profile…" className="max-w-md w-full" />
      </div>
    );
  }

  const profileBannerError = tasksIsError || levelIsError;

  const dailyTasks = tasksData?.dailyTasks || {};
  const tasks = dailyTasks.tasks || {};
  const advantageTierId = getEffectiveSubscriptionTier();
  const advantageTier = getAdvantageTier(advantageTierId);
  const boostedCap = getBestMoveBoostedCap(advantageTierId);
  const boostedRemaining = Number.isFinite(boostedCap)
    ? Math.max(0, boostedCap - getBestMovePowerUsedToday())
    : Number.POSITIVE_INFINITY;

  const levelInfo = levelData?.level || {};

  const boostSystemRowsLayout = savvyGameRows.map((row) => ({
    key: row.systemKey,
    label: row.label,
    reward: row.rewardLine,
    on: Boolean(systems[row.systemKey]),
    progress: getSavvyRowStatus(row.systemKey) === "inProgress",
  }));
  const vipRankName = VIP_RANKS[Math.min(VIP_RANKS.length - 1, Math.max(0, Number(vipRankData?.tier) || 0))];

  return (
    <>
      {profileBannerError ? (
        <div className="max-w-6xl mx-auto px-4 pt-6">
          <ErrorState
            title="Some profile data didn’t load"
            description="Daily tasks or level info may be missing. Retry to refresh."
            onRetry={() => {
              void refetchTasks();
              void refetchLevel();
            }}
            retryLabel="Retry"
            className="text-left items-stretch"
          />
        </div>
      ) : null}
      <ProfilePageLayout
        savvyBalanceSlot={
          <SavvyBalanceCard
            balance={savvyLive.savvyPoints}
            lifetimeEarned={Math.max(savvyLive.lifetimeEarned, savvyLive.savvyPoints)}
            streakLabel={displayTaskStreak > 0 ? `On a ${displayTaskStreak}-week streak` : "Active earner"}
          />
        }
        entitlementSlot={
          <PremiumEntitlementCard entitlement={entitlement} onRefreshSubscription={() => void entitlement.reload()} />
        }
        programBadgeSlot={<ProgramBadge />}
        user={user}
        basePoints={basePoints}
        tasksData={tasksData}
        pointsUpdating={pointsUpdating}
        showSuccessMessage={showSuccessMessage}
        advantageLevel={advantageTier.label}
        advantageMultiplier={formatTierMultiplierLabel(advantageTierId)}
        bestMovePowerLine={Number.isFinite(boostedCap) ? `${boostedRemaining} / ${boostedCap}` : "Unlimited"}
        savvyNextUnlock={savvyNextUnlock}
        leaderboardScore={leaderboardScore}
        permanentRank={permanentRank}
        nextPermanentRank={nextPermanentRank}
        rankProgressToNext={rankProgressToNext}
        taskProgress={taskProgress}
        taskBonusMessage={taskBonusMessage}
        taskDailyBonusMin={TASK_DAILY_BONUS_MIN}
        taskDailyBonusMax={TASK_DAILY_BONUS_MAX}
        boostSystemRows={boostSystemRowsLayout}
        vipRankName={vipRankName}
        vipStatusMode={vipStatusMode}
        weeklyActivityScore={weeklyActivityScore}
        vipPromoteThreshold={VIP_PROMOTE_THRESHOLD}
        vipMaintainThreshold={VIP_MAINTAIN_THRESHOLD}
        hasSilverRank={hasSilverRank}
        silverMinPoints={silverMinPoints}
        levelInfo={levelInfo}
        streakWeeks={streakWeeks}
        displayTaskStreak={displayTaskStreak}
        onRefreshPoints={() => {
          queryClient.refetchQueries(["dailyTasks"]);
          queryClient.refetchQueries(["levelInfo"]);
        }}
        onClaimDailyLogin={() => claimLoginMutation.mutate()}
        claimLoginPending={claimLoginMutation.isPending}
        dailyLoginDone={tasks.dailyLogin?.completed || false}
        ebayStatus={ebayStatus}
        ebayStatusLoading={ebayStatusLoading}
        onConnectEbay={handleConnectEbay}
        onPointsEarned={handlePointsEarned}
        rivalryRivalDisplayNameUpper={rivalryUi.titleUpper}
        rivalryThemShortName={rivalryUi.short}
        rivalryComparison={rivalryUi.loading ? null : rivalryUi.comparison}
        rivalryChaseReward={rivalryUi.loading ? null : rivalryUi.chaseReward}
        rivalryLoading={rivalryUi.loading}
        onRivalryStartChase={handleRivalryStartChase}
        onRivalryViewLoadout={handleRivalryViewLoadout}
        profileActivityItems={profileEngagement.activityItems}
        profileNextGoal={profileEngagement.nextGoal}
        onProfileGoalCta={handleProfileGoalCta}
        equippedCallingCardId={user?.equippedCallingCardId || getEquippedCallingCardId()}
        equippedEmblemId={user?.equippedEmblemId || getEquippedEmblemId()}
      />
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 mb-6">
          <div className="rounded-lg border border-gray-700 bg-gray-900/40 p-4 flex flex-wrap gap-4 text-sm">
            <Link to="/settings" className="text-purple-300 hover:text-purple-200">Settings</Link>
            <Link to="/privacy" className="text-gray-300 hover:text-white">Privacy</Link>
            <Link to="/terms" className="text-gray-300 hover:text-white">Terms</Link>
            <Link to="/support" className="text-gray-300 hover:text-white">Support</Link>
            <Link to="/delete-account" className="text-red-300 hover:text-red-200">Delete Account</Link>
            <button type="button" onClick={handleRetakeSetup} className="text-purple-300 hover:text-purple-200">Retake setup</button>
          </div>
        </div>
        {unlockToasts.length > 0 && (
          <div className="fixed top-24 right-4 z-50 flex flex-col gap-3 w-[min(92vw,340px)] pointer-events-none">
            {unlockToasts.map((toast) => (
              <motion.div
                key={toast.id}
                initial={{ opacity: 0, x: 20, y: -8, scale: 0.98 }}
                animate={{ opacity: 1, x: 0, y: 0, scale: 1 }}
                exit={{ opacity: 0, x: 16, y: -8 }}
                transition={{ duration: 0.25 }}
                className="rounded-xl border border-purple-400/40 bg-gray-900/95 shadow-[0_0_20px_rgba(124,58,237,0.35)] px-4 py-3"
              >
                <div className="text-xs uppercase tracking-wide text-cyan-300 font-semibold">⚡ Unlock</div>
                <div className="text-sm font-bold text-white">{toast.title}</div>
                <div className="text-xs text-gray-300 mt-1">{toast.body}</div>
              </motion.div>
            ))}
          </div>
        )}
      {dailyClearedShow ? (
        <div
          key={dailyClearedNonce}
          className="f10-daily-cleared-root"
          aria-live="polite"
        >
          <div className="f10-daily-cleared-vignette" aria-hidden />
          <div className="f10-daily-cleared-burst" aria-hidden>
            <span />
            <span />
            <span />
            <span />
            <span />
          </div>
          <div className="f10-daily-cleared-label">✅ Daily cleared</div>
        </div>
      ) : null}
    </>
  );
};

export default Profile;



































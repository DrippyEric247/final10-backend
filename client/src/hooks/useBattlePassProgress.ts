import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { BattlePassActionEvent } from "../types/battlePassActionEvents";
import type { SeasonDefinition } from "../types/battlePassTasks";
import type { BattlePassTaskViewModel } from "../types/battlePassTasks";
import type { ActiveBattlePassTaskState, TaskProgressRule } from "../types/battlePassProgress";
import { buildActiveBattlePassTasks } from "../types/battlePassProgress";
import { processBattlePassActionEvent } from "../lib/battlePassProgressEngine";
import { mergeSeasonProgressRules } from "../data/battlePassProgressRulesRegistry";
import {
  createAuctionScannedEvent,
  createAuctionWonEvent,
  createBidPlacedEvent,
  createDailyLoginClaimedEvent,
  createPowerBoostClaimedEvent,
  createPowerMultiplierChangedEvent,
  createRankChangedEvent,
  createSavvyPointsEarnedEvent,
  createStreakUpdatedEvent,
} from "../lib/battlePassActionEventFactory";
import type {
  BattlePassDemoSeed,
  BattlePassProgressDebugEntry,
  BattlePassRecentCompletion,
  BattlePassRecentReward,
} from "../types/battlePassState";
import type { ProgressionApiState } from "../lib/progressionHydration";
import { SAVVY_AUTH_REFRESH_REQUEST } from "../store/savvyStore";

export function activeTaskToViewModel(t: ActiveBattlePassTaskState): BattlePassTaskViewModel {
  return {
    id: t.id,
    title: t.title,
    description: t.description,
    type: t.type,
    themeTag: t.themeTag,
    requirement: t.requirement,
    metricKey: t.metricKey,
    reward: t.reward,
    progress: t.progress,
    completed: t.completed,
  };
}

function appendCompletions(
  prev: BattlePassRecentCompletion[],
  completed: ActiveBattlePassTaskState[],
  now: number
): BattlePassRecentCompletion[] {
  const next = [...prev];
  for (const c of completed) {
    if (next.some((x) => x.taskId === c.id)) continue;
    next.unshift({
      taskId: c.id,
      title: c.title,
      taskType: c.type,
      at: now,
    });
  }
  return next.slice(0, 24);
}

function appendRewards(
  prev: BattlePassRecentReward[],
  granted: { taskId: string; payload: BattlePassRecentReward["payload"] }[],
  tasksById: Map<string, ActiveBattlePassTaskState>,
  now: number
): BattlePassRecentReward[] {
  const next = [...prev];
  for (const g of granted) {
    if (next.some((x) => x.taskId === g.taskId)) continue;
    const t = tasksById.get(g.taskId);
    next.unshift({
      taskId: g.taskId,
      title: t?.title ?? g.taskId,
      payload: g.payload,
      at: now,
    });
  }
  return next.slice(0, 24);
}

const DEFAULT_DEMO_SEED: BattlePassDemoSeed = {
  nh_daily_scan_grid: { progress: 1 },
  nh_weekly_momentum: { progress: 400 },
  nh_season_climb: { progress: 3 },
};

export interface UseBattlePassProgressOptions {
  season: SeasonDefinition | null;
  userId: string;
  serverRules?: Record<string, TaskProgressRule> | null;
  autoSeedDemoProgress?: boolean;
  demoSeed?: BattlePassDemoSeed;
  onAfterProcess?: () => void;
  /** When true (e.g. loading server snapshot), skip building local demo tasks. */
  deferInitialization?: boolean;
  /** Hydrate task rows from backend `taskStates` (authoritative when present). */
  serverTaskStates?: ActiveBattlePassTaskState[] | null;
  /** If set, mission events are persisted remotely; client does not apply localStorage grants. */
  submitBattlePassEventRemote?: (event: BattlePassActionEvent) => Promise<ProgressionApiState>;
}

export interface UseBattlePassProgressResult {
  tasks: BattlePassTaskViewModel[];
  /** Recent completion feed (deduped by task id). */
  recentCompletions: BattlePassRecentCompletion[];
  /** Alias of `recentCompletions` for API clarity. */
  completedTasks: BattlePassRecentCompletion[];
  recentRewards: BattlePassRecentReward[];
  debugLog: BattlePassProgressDebugEntry[];
  isActive: boolean;
  processEvent: (event: BattlePassActionEvent) => void | Promise<void>;
  resetDailyTasks: () => void;
  resetWeeklyTasks: () => void;
  resetSeasonProgress: () => void;
  simulateAuctionScan: () => void;
  simulateBidPlaced: () => void;
  simulateAuctionWin: () => void;
  simulateDailyLogin: () => void;
  simulatePowerBoostClaim: () => void;
  simulateSavvyPointsEarned: (amount?: number) => void;
  simulateStreakUpdated: (days?: number) => void;
  simulateRankImproved: () => void;
  simulatePowerMultiplierChange: (newMultiplier?: number) => void;
}

export function useBattlePassProgress(options: UseBattlePassProgressOptions): UseBattlePassProgressResult {
  const {
    season,
    userId,
    serverRules,
    autoSeedDemoProgress,
    demoSeed,
    onAfterProcess,
    deferInitialization,
    serverTaskStates,
    submitBattlePassEventRemote,
  } = options;
  const isDev = process.env.NODE_ENV === "development";
  const remote = Boolean(submitBattlePassEventRemote);

  const rulesByTaskId = useMemo(() => {
    if (!season) return null;
    return mergeSeasonProgressRules(season, serverRules);
  }, [season, serverRules]);

  const isActive = Boolean(season && rulesByTaskId);

  const [tasks, setTasks] = useState<ActiveBattlePassTaskState[]>([]);
  const [recentCompletions, setRecentCompletions] = useState<BattlePassRecentCompletion[]>([]);
  const [recentRewards, setRecentRewards] = useState<BattlePassRecentReward[]>([]);
  const [debugLog, setDebugLog] = useState<BattlePassProgressDebugEntry[]>([]);

  const tasksRef = useRef(tasks);
  tasksRef.current = tasks;

  const rankSimRef = useRef(48);
  const traceGroupRef = useRef(0);

  useEffect(() => {
    if (!season || !rulesByTaskId) {
      setTasks([]);
      return;
    }
    if (deferInitialization) {
      return;
    }
    if (serverTaskStates && serverTaskStates.length > 0) {
      setTasks(serverTaskStates);
      rankSimRef.current = 48;
      return;
    }
    const seed =
      isDev && autoSeedDemoProgress && !remote ? { ...DEFAULT_DEMO_SEED, ...demoSeed } : undefined;
    setTasks(buildActiveBattlePassTasks(season.tasks, rulesByTaskId, seed));
    rankSimRef.current = 48;
  }, [
    season,
    rulesByTaskId,
    isDev,
    autoSeedDemoProgress,
    demoSeed,
    deferInitialization,
    serverTaskStates,
    remote,
  ]);

  const taskMap = useCallback((list: ActiveBattlePassTaskState[]) => {
    const m = new Map<string, ActiveBattlePassTaskState>();
    for (const t of list) m.set(t.id, t);
    return m;
  }, []);

  const processEvent = useCallback(
    (event: BattlePassActionEvent) => {
      if (!rulesByTaskId) return undefined;
      if (submitBattlePassEventRemote) {
        return submitBattlePassEventRemote(event)
          .then((payload) => {
            const rows = payload?.battlePass?.taskStates as ActiveBattlePassTaskState[] | undefined;
            if (rows?.length) setTasks(rows);
            const now = Date.now();
            const completed = rows?.filter((t) => t.completed) ?? [];
            setRecentCompletions((rc) => appendCompletions(rc, completed, now));
            if (isDev) {
              const traceGroupId = (traceGroupRef.current += 1);
              setDebugLog((dl) =>
                [
                  ...dl,
                  {
                    at: now,
                    message: `remote:event:${event.type} id=${event.id}`,
                    event,
                    traceGroupId,
                  },
                ].slice(-60)
              );
            }
            queueMicrotask(() => {
              onAfterProcess?.();
              try {
                window.dispatchEvent(new CustomEvent(SAVVY_AUTH_REFRESH_REQUEST));
              } catch {
                /* ignore */
              }
            });
          })
          .catch(() => {
            /* caller may toast; do not mutate tasks */
          });
      }
      const now = Date.now();
      const debug = isDev;
      setTasks((prev) => {
        if (prev.length === 0) return prev;
        const result = processBattlePassActionEvent(event, prev, {
          debug,
          maxCascadeSteps: 32,
        });
        const map = taskMap(result.updatedTasks);

        setRecentCompletions((rc) => appendCompletions(rc, result.completedTasks, now));
        setRecentRewards((rr) => appendRewards(rr, result.grantedRewards, map, now));

        if (debug) {
          const traceGroupId = (traceGroupRef.current += 1);
          const entries: BattlePassProgressDebugEntry[] = [
            {
              at: now,
              message: `event:${event.type} id=${event.id} → completed:${result.completedTasks.map((c) => c.id).join(",") || "—"}`,
              event,
              traceGroupId,
            },
            ...result.debugLog.map((line) => ({ at: now, message: line, traceGroupId })),
          ];
          setDebugLog((dl) => [...dl, ...entries].slice(-60));
        }

        queueMicrotask(() => onAfterProcess?.());
        return result.updatedTasks;
      });
      return undefined;
    },
    [isDev, onAfterProcess, rulesByTaskId, taskMap, submitBattlePassEventRemote]
  );

  const resetDailyTasks = useCallback(() => {
    if (!isDev) return;
    if (submitBattlePassEventRemote) return;
    setTasks((prev) =>
      prev.map((t) =>
        t.type === "daily"
          ? { ...t, progress: 0, completed: false, rewardGranted: false }
          : t
      )
    );
    const dailyIds = new Set(tasksRef.current.filter((x) => x.type === "daily").map((x) => x.id));
    setRecentCompletions((rc) => rc.filter((c) => c.taskType !== "daily"));
    setRecentRewards((rr) => rr.filter((r) => !dailyIds.has(r.taskId)));
  }, [isDev, submitBattlePassEventRemote]);

  const resetWeeklyTasks = useCallback(() => {
    if (!isDev) return;
    if (submitBattlePassEventRemote) return;
    setTasks((prev) =>
      prev.map((t) =>
        t.type === "weekly"
          ? { ...t, progress: 0, completed: false, rewardGranted: false }
          : t
      )
    );
    const weeklyIds = new Set(tasksRef.current.filter((x) => x.type === "weekly").map((x) => x.id));
    setRecentCompletions((rc) => rc.filter((c) => c.taskType !== "weekly"));
    setRecentRewards((rr) => rr.filter((r) => !weeklyIds.has(r.taskId)));
  }, [isDev, submitBattlePassEventRemote]);

  const resetSeasonProgress = useCallback(() => {
    if (!isDev) return;
    if (submitBattlePassEventRemote) return;
    if (!season || !rulesByTaskId) return;
    setTasks(buildActiveBattlePassTasks(season.tasks, rulesByTaskId));
    setRecentCompletions([]);
    setRecentRewards([]);
    setDebugLog([]);
    rankSimRef.current = 48;
  }, [season, rulesByTaskId, isDev, submitBattlePassEventRemote]);

  const eventOpts = useMemo(() => ({ userId }), [userId]);

  const simulateAuctionScan = useCallback(() => {
    if (!isDev) return;
    processEvent(
      createAuctionScannedEvent(eventOpts, {
        auctionId: `sim_auc_${Date.now().toString(36)}`,
        secondsRemaining: 180,
        marketplace: "final10",
        category: "general",
      })
    );
  }, [isDev, eventOpts, processEvent]);

  const simulateBidPlaced = useCallback(() => {
    if (!isDev) return;
    processEvent(
      createBidPlacedEvent(eventOpts, {
        auctionId: `sim_auc_${Date.now().toString(36)}`,
        bidAmount: 55,
        secondsRemaining: 480,
        marketplace: "final10",
      })
    );
  }, [isDev, eventOpts, processEvent]);

  const simulateAuctionWin = useCallback(() => {
    if (!isDev) return;
    processEvent(
      createAuctionWonEvent(eventOpts, {
        auctionId: `sim_auc_${Date.now().toString(36)}`,
        winAmount: 72,
        secondsRemaining: 300,
        marketplace: "final10",
      })
    );
  }, [isDev, eventOpts, processEvent]);

  const simulateDailyLogin = useCallback(() => {
    if (!isDev) return;
    processEvent(
      createDailyLoginClaimedEvent(eventOpts, {
        streakDay: 1,
        rewardClaimed: true,
      })
    );
  }, [isDev, eventOpts, processEvent]);

  const simulatePowerBoostClaim = useCallback(() => {
    if (!isDev) return;
    processEvent(
      createPowerBoostClaimedEvent(eventOpts, {
        source: "daily_claim",
        multiplierDelta: 0.02,
      })
    );
  }, [isDev, eventOpts, processEvent]);

  const simulateSavvyPointsEarned = useCallback(
    (amount = 500) => {
      if (!isDev) return;
      processEvent(
        createSavvyPointsEarnedEvent(eventOpts, {
          amount,
          source: "dev_simulate",
        })
      );
    },
    [isDev, eventOpts, processEvent]
  );

  const simulateStreakUpdated = useCallback(
    (days = 3) => {
      if (!isDev) return;
      processEvent(
        createStreakUpdatedEvent(eventOpts, {
          streakType: "bundle",
          days,
        })
      );
    },
    [isDev, eventOpts, processEvent]
  );

  const simulateRankImproved = useCallback(() => {
    if (!isDev) return;
    const prev = rankSimRef.current;
    const next = Math.max(1, prev - 4);
    rankSimRef.current = next;
    processEvent(
      createRankChangedEvent(eventOpts, {
        previousRank: prev,
        newRank: next,
      })
    );
  }, [isDev, eventOpts, processEvent]);

  const simulatePowerMultiplierChange = useCallback(
    (newMultiplier = 1.5) => {
      if (!isDev) return;
      processEvent(
        createPowerMultiplierChangedEvent(eventOpts, {
          previousMultiplier: 1.1,
          newMultiplier,
        })
      );
    },
    [isDev, eventOpts, processEvent]
  );

  const viewTasks = useMemo(() => tasks.map(activeTaskToViewModel), [tasks]);

  return {
    tasks: viewTasks,
    recentCompletions,
    completedTasks: recentCompletions,
    recentRewards,
    debugLog,
    isActive,
    processEvent,
    resetDailyTasks,
    resetWeeklyTasks,
    resetSeasonProgress,
    simulateAuctionScan,
    simulateBidPlaced,
    simulateAuctionWin,
    simulateDailyLogin,
    simulatePowerBoostClaim,
    simulateSavvyPointsEarned,
    simulateStreakUpdated,
    simulateRankImproved,
    simulatePowerMultiplierChange,
  };
}

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef } from "react";
import { BATTLE_PASS_ACTION_EVENT } from "../lib/battlePassActionBus";
import { BP_TIER_COMPLETE_EVENT } from "../lib/battlePassConfig";
import { POWER_TOAST_EVENT } from "../lib/final10PowerFeedback";
import { REWARD_EVENT } from "../lib/rewardEngine";
import { notifyWalletFromLegacyReward } from "../lib/pointsEngine";
import { recordScoutMissionAction } from "../lib/savvyScoutMissions";

type PointsRewardSource =
  | "task_complete"
  | "daily_login"
  | "tier_up"
  | "reward_claim"
  | "power_event"
  | "battle_pass"
  | "unknown";

type PointsRewardPayload = {
  amount: number;
  source?: PointsRewardSource | string;
};

type PointsRewardContextValue = {
  showPointsReward: (payload: PointsRewardPayload) => void;
};

const PointsRewardContext = createContext<PointsRewardContextValue | null>(null);

function parsePointsFromTitle(title: string): number {
  const m = String(title || "").match(/\+?\s*([\d,]+)\s*(?:points|savvy)/i);
  if (!m) return 0;
  const n = Number(String(m[1]).replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function safeRoundedAmount(n: unknown): number {
  const x = Number(n);
  if (!Number.isFinite(x) || x <= 0) return 0;
  return Math.max(1, Math.round(x));
}

export function PointsRewardProvider({ children }: { children: React.ReactNode }) {
  const lastShownAtRef = useRef<number>(0);

  const showPointsReward = useCallback(({ amount, source = "unknown" }: PointsRewardPayload) => {
    const pts = safeRoundedAmount(amount);
    if (!pts) return;
    const now = Date.now();
    const since = now - lastShownAtRef.current;
    if (since < 250) return;
    lastShownAtRef.current = now;
    notifyWalletFromLegacyReward({ amount: pts, source: String(source || "unknown"), origin: null });
    recordScoutMissionAction("savvy_earned", { amount: pts, silent: true });
  }, []);

  useEffect(() => {
    const onPower = (e: Event) => {
      const d = (e as CustomEvent<{ points?: number }>).detail;
      const pts = safeRoundedAmount(d?.points);
      if (!pts) return;
      showPointsReward({ amount: pts, source: "power_event" });
    };

    const onReward = (e: Event) => {
      const d = (e as CustomEvent<{ type?: string; title?: string; accent?: string; points?: number }>).detail;
      if (!d) return;
      let pts = safeRoundedAmount(d.points);
      if (!pts && d.accent === "points") pts = parsePointsFromTitle(String(d.title || ""));
      if (!pts) return;
      const source = d.type === "daily_login" ? "daily_login" : "reward_claim";
      showPointsReward({ amount: pts, source });
    };

    const onBattlePassAction = (e: Event) => {
      const d = (e as CustomEvent<{ type?: string; payload?: Record<string, unknown> }>).detail;
      if (!d || !d.type) return;
      if (d.type === "savvy_points_earned") {
        const pts = safeRoundedAmount(d.payload?.points ?? d.payload?.amount);
        if (pts) showPointsReward({ amount: pts, source: "battle_pass" });
      }
      if (d.type === "task_completed") {
        const pts = safeRoundedAmount(d.payload?.pointsAwarded);
        if (pts) showPointsReward({ amount: pts, source: "task_complete" });
      }
    };

    const onTierComplete = (e: Event) => {
      const d = (e as CustomEvent<{ reward?: { type?: string; value?: number } }>).detail;
      if (d?.reward?.type !== "points") return;
      const pts = safeRoundedAmount(d.reward.value);
      if (pts) showPointsReward({ amount: pts, source: "tier_up" });
      recordScoutMissionAction("battle_pass_tier_up", { pathname: "/battle-pass" });
    };

    window.addEventListener(POWER_TOAST_EVENT, onPower);
    window.addEventListener(REWARD_EVENT, onReward);
    window.addEventListener(BATTLE_PASS_ACTION_EVENT, onBattlePassAction);
    window.addEventListener(BP_TIER_COMPLETE_EVENT, onTierComplete);
    return () => {
      window.removeEventListener(POWER_TOAST_EVENT, onPower);
      window.removeEventListener(REWARD_EVENT, onReward);
      window.removeEventListener(BATTLE_PASS_ACTION_EVENT, onBattlePassAction);
      window.removeEventListener(BP_TIER_COMPLETE_EVENT, onTierComplete);
    };
  }, [showPointsReward]);

  const ctx = useMemo(() => ({ showPointsReward }), [showPointsReward]);

  return <PointsRewardContext.Provider value={ctx}>{children}</PointsRewardContext.Provider>;
}

export function usePointsRewardContext() {
  const ctx = useContext(PointsRewardContext);
  if (!ctx) {
    throw new Error("usePointsRewardContext must be used within PointsRewardProvider");
  }
  return ctx;
}

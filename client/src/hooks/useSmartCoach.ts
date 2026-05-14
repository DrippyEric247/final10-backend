import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { BATTLE_PASS_ACTION_EVENT } from "../lib/battlePassActionBus";
import { BP_UPDATE_EVENT, BATTLE_PASS_SEASON } from "../lib/battlePassConfig";
import { getBattlePassProgress } from "../lib/battlePassEngine";
import { POWER_TOAST_EVENT } from "../lib/final10PowerFeedback";
import {
  SMART_COACH_MESSAGE_CONFIG,
  type SmartCoachBehaviorState,
  type SmartCoachMessageConfig,
} from "../data/smartCoachMessages";

const STORAGE_KEY = "f10_smart_coach_delivery_v1";
const SESSION_LIMIT = 4;
const GLOBAL_COOLDOWN_MS = 3 * 60 * 1000;
const SIGNAL_EVENT = "f10:smart-coach-signal";

type DeliveryStats = {
  lastAnyShownAt: number;
  messages: Record<string, { shownCount: number; lastShownAt: number; sessionShown: number }>;
  sessionShownTotal: number;
  impressions: Array<{ messageId: string; ts: number; variant: string }>;
  clicks: Array<{ messageId: string; ts: number; variant: string; action?: string }>;
};

type SmartCoachSignal = {
  type:
    | "listing_viewed"
    | "scan_performed"
    | "task_completed"
    | "points_earned"
    | "premium_view"
    | "premium_click";
  value?: number;
};

export function trackSmartCoachSignal(signal: SmartCoachSignal) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(SIGNAL_EVENT, { detail: signal }));
}

function safeDeliveryState(): DeliveryStats {
  if (typeof window === "undefined") {
    return { lastAnyShownAt: 0, messages: {}, sessionShownTotal: 0, impressions: [], clicks: [] };
  }
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    return {
      lastAnyShownAt: Number(raw.lastAnyShownAt || 0),
      messages: raw.messages && typeof raw.messages === "object" ? raw.messages : {},
      sessionShownTotal: Number(sessionStorage.getItem(`${STORAGE_KEY}_session_total`) || 0),
      impressions: Array.isArray(raw.impressions) ? raw.impressions.slice(-200) : [],
      clicks: Array.isArray(raw.clicks) ? raw.clicks.slice(-200) : [],
    };
  } catch {
    return { lastAnyShownAt: 0, messages: {}, sessionShownTotal: 0, impressions: [], clicks: [] };
  }
}

function saveDeliveryState(state: DeliveryStats) {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        lastAnyShownAt: state.lastAnyShownAt,
        messages: state.messages,
        impressions: state.impressions.slice(-200),
        clicks: state.clicks.slice(-200),
      })
    );
    sessionStorage.setItem(`${STORAGE_KEY}_session_total`, String(state.sessionShownTotal));
  } catch {
    /* ignore persistence failures */
  }
}

function initialBehaviorState(): SmartCoachBehaviorState {
  return {
    activeMs: 0,
    listingsViewed: 0,
    scansPerformed: 0,
    tasksCompleted: 0,
    pointsEarned: 0,
    tierProgressPct: 0,
    premiumViews: 0,
    premiumClicks: 0,
    lastActivityAt: Date.now(),
  };
}

function isActiveInteractionInProgress() {
  if (typeof document === "undefined") return false;
  const el = document.activeElement as HTMLElement | null;
  if (!el) return false;
  const tag = (el.tagName || "").toLowerCase();
  if (tag === "input" || tag === "textarea" || tag === "select" || tag === "button") return true;
  return Boolean(el.isContentEditable);
}

function priorityRank(p: SmartCoachMessageConfig["priority"]) {
  if (p === "high") return 0;
  if (p === "medium") return 1;
  return 2;
}

function computeEligibleTriggers(state: SmartCoachBehaviorState): Set<string> {
  const now = Date.now();
  const idleMs = now - state.lastActivityAt;
  const hits = new Set<string>();
  if (state.activeMs >= 5 * 60 * 1000 && state.scansPerformed === 0 && state.listingsViewed > 0) {
    hits.add("no_scanning");
  }
  if (state.activeMs >= 5 * 60 * 1000 && state.listingsViewed >= 3 && state.tasksCompleted === 0) {
    hits.add("no_task_completion");
  }
  if (state.pointsEarned >= 40 && idleMs >= 2 * 60 * 1000) {
    hits.add("points_no_engagement");
  }
  if (state.tierProgressPct >= 80 && state.tierProgressPct < 100) {
    hits.add("near_tier_up");
  }
  if (state.premiumViews >= 1 && state.premiumClicks === 0 && state.activeMs >= 2 * 60 * 1000) {
    hits.add("premium_exposure");
  }
  return hits;
}

function readTierProgressPct() {
  try {
    const p = getBattlePassProgress();
    const pct = p.maxXp > 0 ? (Number(p.xp || 0) / Number(p.maxXp || 1)) * 100 : 0;
    return Math.max(0, Math.min(100, pct));
  } catch {
    return 0;
  }
}

export function useSmartCoach(enabled: boolean) {
  const [behavior, setBehavior] = useState<SmartCoachBehaviorState>(initialBehaviorState);
  const [activeMessage, setActiveMessage] = useState<SmartCoachMessageConfig | null>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const deliveryRef = useRef<DeliveryStats>(safeDeliveryState());
  const pathStartRef = useRef<number>(Date.now());
  const viewedListingIdsRef = useRef<Set<string>>(new Set());
  const premiumViewLoggedRef = useRef<boolean>(false);

  const updateBehavior = useCallback((
    next:
      | Partial<SmartCoachBehaviorState>
      | ((prev: SmartCoachBehaviorState) => Partial<SmartCoachBehaviorState>)
  ) => {
    setBehavior((prev) => {
      const patch = typeof next === "function" ? next(prev) : next;
      return { ...prev, ...patch, lastActivityAt: Date.now() };
    });
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const timer = window.setInterval(() => {
      setBehavior((prev) => ({ ...prev, activeMs: prev.activeMs + 15000 }));
    }, 15000);
    return () => window.clearInterval(timer);
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    pathStartRef.current = Date.now();
    if (location.pathname.startsWith("/auction/")) {
      const listingId = location.pathname.split("/").pop() || "";
      if (listingId && !viewedListingIdsRef.current.has(listingId)) {
        viewedListingIdsRef.current.add(listingId);
        updateBehavior((prev) => ({ listingsViewed: prev.listingsViewed + 1 }));
      }
    }
    if (location.pathname.startsWith("/premium")) {
      if (!premiumViewLoggedRef.current) {
        premiumViewLoggedRef.current = true;
        updateBehavior((prev) => ({ premiumViews: prev.premiumViews + 1 }));
      }
    } else {
      premiumViewLoggedRef.current = false;
    }
  }, [enabled, location.pathname]);

  useEffect(() => {
    if (!enabled) return;
    const onSignal = (evt: Event) => {
      const signal = (evt as CustomEvent<SmartCoachSignal>).detail;
      if (!signal || !signal.type) return;
      if (signal.type === "listing_viewed") updateBehavior((prev) => ({ listingsViewed: prev.listingsViewed + (signal.value || 1) }));
      if (signal.type === "scan_performed") updateBehavior((prev) => ({ scansPerformed: prev.scansPerformed + (signal.value || 1) }));
      if (signal.type === "task_completed") updateBehavior((prev) => ({ tasksCompleted: prev.tasksCompleted + (signal.value || 1) }));
      if (signal.type === "points_earned") updateBehavior((prev) => ({ pointsEarned: prev.pointsEarned + (signal.value || 0) }));
      if (signal.type === "premium_view") updateBehavior((prev) => ({ premiumViews: prev.premiumViews + (signal.value || 1) }));
      if (signal.type === "premium_click") updateBehavior((prev) => ({ premiumClicks: prev.premiumClicks + (signal.value || 1) }));
    };

    const onBattlePassAction = (evt: Event) => {
      const action = (evt as CustomEvent<{ type?: string; payload?: Record<string, unknown> }>).detail;
      const type = String(action?.type || "");
      if (type === "auction_scanned" || type === "scan") updateBehavior((prev) => ({ scansPerformed: prev.scansPerformed + 1 }));
      if (type === "task_completed") updateBehavior((prev) => ({ tasksCompleted: prev.tasksCompleted + 1 }));
      if (type === "savvy_points_earned") {
        const pts = Number(action?.payload?.points || action?.payload?.amount || 0);
        if (Number.isFinite(pts) && pts > 0) updateBehavior((prev) => ({ pointsEarned: prev.pointsEarned + pts }));
      }
    };

    const onPowerToast = (evt: Event) => {
      const d = (evt as CustomEvent<{ points?: number }>).detail;
      const pts = Number(d?.points || 0);
      if (Number.isFinite(pts) && pts > 0) updateBehavior((prev) => ({ pointsEarned: prev.pointsEarned + pts }));
    };

    const onBpUpdate = () => {
      setBehavior((prev) => ({ ...prev, tierProgressPct: readTierProgressPct() }));
    };

    window.addEventListener(SIGNAL_EVENT, onSignal as EventListener);
    window.addEventListener(BATTLE_PASS_ACTION_EVENT, onBattlePassAction as EventListener);
    window.addEventListener(POWER_TOAST_EVENT, onPowerToast as EventListener);
    window.addEventListener(BP_UPDATE_EVENT, onBpUpdate);
    onBpUpdate();
    return () => {
      window.removeEventListener(SIGNAL_EVENT, onSignal as EventListener);
      window.removeEventListener(BATTLE_PASS_ACTION_EVENT, onBattlePassAction as EventListener);
      window.removeEventListener(POWER_TOAST_EVENT, onPowerToast as EventListener);
      window.removeEventListener(BP_UPDATE_EVENT, onBpUpdate);
    };
  }, [enabled, updateBehavior]);

  const deliveryCandidate = useMemo(() => {
    if (!enabled || activeMessage) return null;
    if (isActiveInteractionInProgress()) return null;

    const now = Date.now();
    const delivery = deliveryRef.current;
    if (delivery.sessionShownTotal >= SESSION_LIMIT) return null;
    if (now - delivery.lastAnyShownAt < GLOBAL_COOLDOWN_MS) return null;

    const eligibleTriggerIds = computeEligibleTriggers(behavior);
    const eligible = SMART_COACH_MESSAGE_CONFIG.filter((m) => eligibleTriggerIds.has(m.triggerId))
      .filter((m) => {
        const stats = delivery.messages[m.id] || { shownCount: 0, lastShownAt: 0, sessionShown: 0 };
        if (stats.shownCount >= m.maxFrequency) return false;
        if (now - stats.lastShownAt < m.cooldownMs) return false;
        return true;
      })
      .sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority));

    return eligible[0] || null;
  }, [enabled, activeMessage, behavior]);

  useEffect(() => {
    if (!deliveryCandidate) return;
    setActiveMessage(deliveryCandidate);

    const delivery = deliveryRef.current;
    const row = delivery.messages[deliveryCandidate.id] || { shownCount: 0, lastShownAt: 0, sessionShown: 0 };
    delivery.messages[deliveryCandidate.id] = {
      shownCount: row.shownCount + 1,
      sessionShown: row.sessionShown + 1,
      lastShownAt: Date.now(),
    };
    delivery.lastAnyShownAt = Date.now();
    delivery.sessionShownTotal += 1;
    delivery.impressions.push({ messageId: deliveryCandidate.id, ts: Date.now(), variant: "A" });
    delivery.impressions = delivery.impressions.slice(-200);
    saveDeliveryState(delivery);
  }, [deliveryCandidate]);

  const dismissActiveMessage = useCallback(() => {
    setActiveMessage(null);
  }, []);

  const onMessageAction = useCallback(() => {
    if (!activeMessage) return;
    const action = activeMessage.ctaAction;
    if (action === "scanner") navigate("/scanner");
    if (action === "tasks") navigate("/battle-pass");
    if (action === "premium") {
      updateBehavior((prev) => ({ premiumClicks: prev.premiumClicks + 1 }));
      navigate("/premium");
    }
    const delivery = deliveryRef.current;
    delivery.clicks.push({ messageId: activeMessage.id, ts: Date.now(), variant: "A", action });
    delivery.clicks = delivery.clicks.slice(-200);
    saveDeliveryState(delivery);
    setActiveMessage(null);
  }, [activeMessage, navigate, updateBehavior]);

  return {
    activeMessage,
    dismissActiveMessage,
    onMessageAction,
    behavior,
  };
}


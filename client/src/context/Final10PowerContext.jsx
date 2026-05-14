import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { POWER } from "../lib/final10PowerConfig";
import {
  getPowerCoreEventName,
  getPowerSnapshot,
} from "../lib/final10PowerEngine";
import { pushAssistantSignal } from "../lib/assistantSignals";

const Final10PowerContext = createContext(null);

function powerIntensity(snapshot) {
  if (!snapshot) return 0;
  return Math.max(
    0,
    Math.min(
      1,
      (snapshot.currentMultiplier - 1) / (POWER.MAX_MULTIPLIER - 1 || 1)
    )
  );
}

function applyPowerVisuals(snapshot) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const body = document.body;
  if (!root || !body) return;

  const int = powerIntensity(snapshot);
  root.style.setProperty("--f10-power-intensity", String(int));
  root.style.setProperty(
    "--f10-power-glow",
    String(0.25 + int * 0.75)
  );
  root.dataset.f10PowerTier = snapshot?.currentTierKey || "base";

  body.classList.remove(
    "f10-power-tier-base",
    "f10-power-tier-active",
    "f10-power-tier-locked_in",
    "f10-power-tier-heating_up",
    "f10-power-tier-elite",
    "f10-power-tier-savvy_god"
  );
  const k = snapshot?.currentTierKey || "base";
  body.classList.add(`f10-power-tier-${k}`);
}

/**
 * Reacts to power snapshot: tier upgrades, near-tier alerts (Guide / Optimize / Alert).
 */
function usePowerAssistantBridge(snapshot) {
  const prevTierKey = useRef(null);
  const nearSentAt = useRef(0);

  useEffect(() => {
    if (!snapshot) return;

    if (
      prevTierKey.current &&
      snapshot.currentTierKey !== prevTierKey.current
    ) {
      pushAssistantSignal({
        id: `power-tier-milestone-${snapshot.currentTierKey}`,
        tone: "info",
        title: "Alert",
        body: `Tier up — ${snapshot.currentMultiplier.toFixed(1)}x (${snapshot.currentTier}).`,
        priority: 2,
      });
    }
    prevTierKey.current = snapshot.currentTierKey;

    const gap = snapshot.nextTierTarget - snapshot.currentMultiplier;
    const now = Date.now();
    if (
      gap > 0 &&
      gap < POWER.NEAR_TIER_DELTA &&
      now - nearSentAt.current > POWER.ASSISTANT_NEAR_TIER_COOLDOWN_MS
    ) {
      nearSentAt.current = now;
      pushAssistantSignal({
        id: "power-near-next-tier",
        tone: "gem",
        title: "Optimize",
        body: `You're close to ${snapshot.nextTierTarget.toFixed(1)}x — save or promote.`,
        priority: 1,
      });
    }
  }, [snapshot]);
}

export function Final10PowerProvider({ children }) {
  const [snapshot, setSnapshot] = useState(() =>
    typeof window !== "undefined" ? getPowerSnapshot() : null
  );

  const refresh = useCallback(() => {
    setSnapshot(getPowerSnapshot());
  }, []);

  useEffect(() => {
    refresh();
    const ev = getPowerCoreEventName();
    const onRefresh = () => refresh();
    window.addEventListener(ev, onRefresh);
    window.addEventListener("f10-universal-progress-refresh", onRefresh);
    window.addEventListener("storage", onRefresh);
    return () => {
      window.removeEventListener(ev, onRefresh);
      window.removeEventListener("f10-universal-progress-refresh", onRefresh);
      window.removeEventListener("storage", onRefresh);
    };
  }, [refresh]);

  useEffect(() => {
    if (snapshot) applyPowerVisuals(snapshot);
  }, [snapshot]);

  usePowerAssistantBridge(snapshot);

  const value = useMemo(
    () => ({
      snapshot,
      refresh,
      intensity: snapshot ? powerIntensity(snapshot) : 0,
    }),
    [snapshot, refresh]
  );

  return (
    <Final10PowerContext.Provider value={value}>
      {children}
    </Final10PowerContext.Provider>
  );
}

export function useFinal10Power() {
  const ctx = useContext(Final10PowerContext);
  if (!ctx) {
    return {
      snapshot: typeof window !== "undefined" ? getPowerSnapshot() : null,
      refresh: () => {},
      intensity: 0,
    };
  }
  return ctx;
}

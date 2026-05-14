import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { useFinal10Power } from "../context/Final10PowerContext";
import {
  getUniversalBoostState,
  UNIVERSAL_BAR_TASK_PULSE_EVENT,
} from "../lib/universalBoostProgress";
import { POWER_TIERS } from "../lib/final10PowerConfig";
import { POWER_UX } from "../lib/final10PowerConfig";
import PowerBar from "./PowerBar";
import "../styles/UniversalBoostProgressBar.css";

const ROUTE_VARIANTS = [
  { match: (p) => p.startsWith("/feed"), className: "f10-ubp--violet" },
  { match: (p) => p.startsWith("/auctions"), className: "f10-ubp--green" },
  { match: (p) => p.startsWith("/scanner"), className: "f10-ubp--cyan" },
  { match: (p) => p.startsWith("/profile"), className: "f10-ubp--amber" },
  { match: (p) => p.startsWith("/local-deals"), className: "f10-ubp--emerald" },
  { match: (p) => p.startsWith("/promote"), className: "f10-ubp--rose" },
  { match: (p) => p.startsWith("/promotion"), className: "f10-ubp--rose" },
  { match: (p) => p.startsWith("/promote-listing"), className: "f10-ubp--rose" },
];

/**
 * Universal Power bar — clarity-first: one-line tier readout, hint, tier-up moment.
 */
export default function UniversalBoostProgressBar() {
  const location = useLocation();
  const { snapshot } = useFinal10Power();
  const [tick, setTick] = useState(0);
  const [taskPulse, setTaskPulse] = useState(false);
  const [gainPulse, setGainPulse] = useState(false);
  const [tierUpFlash, setTierUpFlash] = useState(false);
  const [displayBoost, setDisplayBoost] = useState(1);
  const [boostBump, setBoostBump] = useState(false);
  const [gainText, setGainText] = useState("");
  const [levelUpText, setLevelUpText] = useState("");
  const prevTierKey = useRef(null);
  const prevMult = useRef(null);
  const tierUpTimer = useRef(null);
  const gainTimer = useRef(null);
  const levelTimer = useRef(null);

  const variant = useMemo(() => {
    const p = location.pathname;
    const found = ROUTE_VARIANTS.find((r) => r.match(p));
    return found?.className || "f10-ubp--neutral";
  }, [location.pathname]);

  useEffect(() => {
    const bump = () => setTick((t) => t + 1);
    window.addEventListener("storage", bump);
    window.addEventListener("f10-universal-progress-refresh", bump);
    window.addEventListener("f10-power-core-updated", bump);
    return () => {
      window.removeEventListener("storage", bump);
      window.removeEventListener("f10-universal-progress-refresh", bump);
      window.removeEventListener("f10-power-core-updated", bump);
    };
  }, []);

  useEffect(() => {
    const onTaskPulse = () => {
      setTick((t) => t + 1);
      setTaskPulse(true);
      window.setTimeout(() => setTaskPulse(false), 520);
    };
    window.addEventListener(UNIVERSAL_BAR_TASK_PULSE_EVENT, onTaskPulse);
    return () =>
      window.removeEventListener(UNIVERSAL_BAR_TASK_PULSE_EVENT, onTaskPulse);
  }, []);

  const state = useMemo(() => {
    void tick;
    void snapshot;
    return getUniversalBoostState();
  }, [tick, snapshot]);

  useEffect(() => {
    const m = state.currentBoost;
    const tk = state.currentTierKey;
    if (prevMult.current != null && m > prevMult.current + 0.0001) {
      setGainPulse(true);
      window.setTimeout(() => setGainPulse(false), 640);
      const diff = m - prevMult.current;
      if (gainTimer.current) window.clearTimeout(gainTimer.current);
      setGainText(`+${diff.toFixed(2)} power`);
      gainTimer.current = window.setTimeout(() => {
        setGainText("");
        gainTimer.current = null;
      }, 1300);
    }
    prevMult.current = m;

    if (prevTierKey.current && tk && tk !== prevTierKey.current) {
      if (tierUpTimer.current) window.clearTimeout(tierUpTimer.current);
      setTierUpFlash(true);
      if (levelTimer.current) window.clearTimeout(levelTimer.current);
      setLevelUpText(`LEVEL UP -> ${Number(m).toFixed(2)}x`);
      levelTimer.current = window.setTimeout(() => {
        setLevelUpText("");
        levelTimer.current = null;
      }, 1200);
      tierUpTimer.current = window.setTimeout(() => {
        setTierUpFlash(false);
        tierUpTimer.current = null;
      }, 900);
    }
    prevTierKey.current = tk;
  }, [state.currentBoost, state.currentTierKey]);

  useEffect(() => {
    const target = Number(state.currentBoost) || 1;
    const start = Number(displayBoost) || target;
    if (Math.abs(target - start) < 0.001) {
      setDisplayBoost(target);
      return;
    }
    const from = start;
    const to = target;
    const startedAt = performance.now();
    let raf = 0;
    const step = (now) => {
      const t = Math.min(1, (now - startedAt) / 340);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplayBoost(from + (to - from) * eased);
      if (t < 1) {
        raf = requestAnimationFrame(step);
      } else {
        setBoostBump(true);
        window.setTimeout(() => setBoostBump(false), 440);
      }
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.currentBoost]);

  useEffect(
    () => () => {
      if (tierUpTimer.current) window.clearTimeout(tierUpTimer.current);
      if (gainTimer.current) window.clearTimeout(gainTimer.current);
      if (levelTimer.current) window.clearTimeout(levelTimer.current);
    },
    []
  );

  const tooltip = state.barTooltip || POWER_UX.BAR_TOOLTIP;
  const sortedTiers = [...POWER_TIERS].sort((a, b) => a.min - b.min);
  let currentTierValue = sortedTiers[0]?.min ?? 1;
  let nextTierValue = sortedTiers[sortedTiers.length - 1]?.min ?? currentTierValue;
  for (let i = 0; i < sortedTiers.length; i++) {
    const cur = sortedTiers[i];
    const next = sortedTiers[i + 1];
    if (displayBoost >= cur.min) {
      currentTierValue = cur.min;
      nextTierValue = next ? next.min : cur.min;
    }
  }
  const span = Math.max(0.01, nextTierValue - currentTierValue);
  const progressWithinTier = Math.max(0, Math.min(1, (displayBoost - currentTierValue) / span));
  const gainedInTier = Math.max(0, displayBoost - currentTierValue);
  const progressLabel = `+${gainedInTier.toFixed(2)} / +${span.toFixed(2)}`;
  const motivationalLabel =
    progressWithinTier >= 0.8 ? "Almost there" : progressWithinTier >= 0.45 ? "Keep going" : "Build your power";

  return (
    <div
      className={`f10-universal-boost-bar ${variant}${
        taskPulse ? " f10-ubp--task-pulse" : ""
      }${gainPulse ? " f10-ubp--gain-pulse" : ""}${
        tierUpFlash ? " f10-ubp--tier-up" : ""
      }`}
      role="region"
      aria-label="Final10 Power level and boost multiplier"
    >
      {tierUpFlash ? (
        <div className="f10-ubp-tier-burst" aria-hidden />
      ) : null}
      {tierUpFlash ? (
        <div className="f10-ubp-tier-words" aria-live="polite">
          {levelUpText || "LEVEL UP"}
        </div>
      ) : null}
      <div className="f10-ubp-stack">
        <div className="f10-ubp-inner container" title={tooltip}>
          <PowerBar
            currentTier={currentTierValue}
            nextTier={nextTierValue}
            progress={progressWithinTier}
            progressLabel={progressLabel}
            motivationalLabel={motivationalLabel}
            showNearCompleteGlow={progressWithinTier >= 0.8}
            gainText={gainText}
            levelUpText={levelUpText}
            className={boostBump ? "f10-powerbar--bump" : ""}
          />
        </div>
        <p className="f10-ubp-hint">{POWER_UX.BAR_HINT_LINE}</p>
      </div>
    </div>
  );
}

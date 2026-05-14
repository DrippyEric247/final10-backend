import { useEffect, useMemo, useRef, useState } from "react";
import { POWER_TOAST_EVENT } from "../lib/final10PowerFeedback";
import { REWARD_EVENT, triggerFirstActionBonusOnce } from "../lib/rewardEngine";
import SavvyMark from "./SavvyMark";
import { SavvyPointsIcon } from "./rewards/SavvyPointsIcon";
import "../styles/Final10RewardHost.css";

const DEFAULT_MS = 1500;

function playSoftTick(accent = "power", intensity = 1) {
  if (typeof window === "undefined") return;
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return;
  try {
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "triangle";
    const base = accent === "points" ? 520 : accent === "system" ? 470 : accent === "streak" ? 420 : 500;
    osc.frequency.value = base + Math.min(120, Math.max(0, intensity * 18));
    gain.gain.value = 0.0001;
    osc.connect(gain);
    gain.connect(ctx.destination);
    const now = ctx.currentTime;
    gain.gain.exponentialRampToValueAtTime(0.02, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
    osc.start(now);
    osc.stop(now + 0.13);
    window.setTimeout(() => ctx.close(), 160);
  } catch {
    /* ignore */
  }
}

export default function Final10RewardHost() {
  const queueRef = useRef([]);
  const timerRef = useRef(null);
  const activeRef = useRef(null);
  const [active, setActive] = useState(null);

  useEffect(() => {
    activeRef.current = active;
  }, [active]);

  const pump = () => {
    if (timerRef.current || activeRef.current) return;
    const next = queueRef.current.shift();
    if (!next) return;
    setActive({ ...next, key: `${Date.now()}-${Math.random()}` });
  };

  useEffect(() => {
    if (!active) {
      timerRef.current = null;
      window.setTimeout(() => pump(), 20);
      return;
    }
    playSoftTick(active.accent, active.intensity || 1);
    const ms = Number(active.durationMs) || DEFAULT_MS;
    timerRef.current = window.setTimeout(() => {
      setActive(null);
      timerRef.current = null;
      window.setTimeout(() => pump(), 70);
    }, ms);
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
      timerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  useEffect(() => {
    const onRawReward = (e) => {
      const d = e.detail;
      if (!d || !d.title) return;
      queueRef.current.push({
        ...d,
        icon:
          d.accent === "points"
            ? <SavvyPointsIcon size={16} glow animated />
            : d.icon,
      });
      if (d.type === "save_item") triggerFirstActionBonusOnce();
      pump();
    };

    // Bridge existing +Power calls into centralized reward queue.
    const onPowerToast = (e) => {
      const d = e.detail;
      if (!d || typeof d.points !== "number") return;
      queueRef.current.push({
        icon: <SavvyMark variant="icon" size={16} glow animated className="savvy-mark--pulse" />,
        title: `+${Math.max(0, Math.round(Number(d.points) || 0))} POWER`,
        subtitle: d.praise || "You're getting stronger",
        accent: "power",
        durationMs: 1300,
      });
      pump();
    };

    window.addEventListener(REWARD_EVENT, onRawReward);
    window.addEventListener(POWER_TOAST_EVENT, onPowerToast);
    return () => {
      window.removeEventListener(REWARD_EVENT, onRawReward);
      window.removeEventListener(POWER_TOAST_EVENT, onPowerToast);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cls = useMemo(() => {
    if (!active) return "f10-reward-toast";
    return `f10-reward-toast f10-reward--${active.accent || "power"} ${active.big ? "f10-reward--big" : ""}`;
  }, [active]);

  if (!active) return null;

  return (
    <div className="f10-reward-host" aria-live="polite" aria-atomic="true">
      <div key={active.key} className={cls}>
        <div className="f10-reward-main">
          <span className="f10-reward-icon" aria-hidden>
            {active.icon || <SavvyMark variant="icon" size={15} glow />}
          </span>
          <span className="f10-reward-title">{active.title}</span>
        </div>
        {active.subtitle ? <div className="f10-reward-sub">{active.subtitle}</div> : null}
        {active.foot ? <div className="f10-reward-foot">{active.foot}</div> : null}
        {active.goalHint ? <div className="f10-reward-goal">{active.goalHint}</div> : null}
      </div>
    </div>
  );
}

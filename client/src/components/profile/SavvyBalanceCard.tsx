import { useEffect, useMemo, useRef, useState } from "react";
import { SavvyPointsIcon } from "../rewards/SavvyPointsIcon";
import { formatDollarValue } from "../../lib/savvyValue";

const LAST_SEEN_BALANCE_KEY = "f10_savvy_balance_last_seen_v1";

function formatNum(n: number) {
  return Math.max(0, Math.round(Number(n) || 0)).toLocaleString();
}

export default function SavvyBalanceCard({
  balance,
  lifetimeEarned,
  streakLabel,
}: {
  balance: number;
  lifetimeEarned: number;
  streakLabel?: string | null;
}) {
  const [displayBalance, setDisplayBalance] = useState<number>(Math.max(0, Math.round(balance || 0)));
  const [showInfo, setShowInfo] = useState(false);
  const [recentGain, setRecentGain] = useState(0);
  const [isHotGlow, setIsHotGlow] = useState(false);
  const prevBalanceRef = useRef<number>(Math.max(0, Math.round(balance || 0)));
  const animFromRef = useRef<number>(Math.max(0, Math.round(balance || 0)));

  useEffect(() => {
    const target = Math.max(0, Math.round(balance || 0));
    const start = animFromRef.current;
    if (start === target) {
      setDisplayBalance(target);
      return;
    }
    const delta = target - start;
    const dur = 520;
    const t0 = performance.now();
    let raf = 0;
    const tick = (ts: number) => {
      const p = Math.min(1, (ts - t0) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      const next = Math.round(start + delta * eased);
      setDisplayBalance(next);
      animFromRef.current = next;
      if (p < 1) raf = window.requestAnimationFrame(tick);
      else animFromRef.current = target;
    };
    raf = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(raf);
  }, [balance]);

  useEffect(() => {
    const current = Math.max(0, Math.round(balance || 0));
    const prev = prevBalanceRef.current;
    if (current > prev) {
      setIsHotGlow(true);
      window.setTimeout(() => setIsHotGlow(false), 1700);
    }
    prevBalanceRef.current = current;
  }, [balance]);

  useEffect(() => {
    const current = Math.max(0, Math.round(balance || 0));
    try {
      const last = Number(localStorage.getItem(LAST_SEEN_BALANCE_KEY) || 0);
      const gain = Number.isFinite(last) ? Math.max(0, current - last) : 0;
      setRecentGain(gain);
      localStorage.setItem(LAST_SEEN_BALANCE_KEY, String(current));
    } catch {
      /* ignore */
    }
  }, [balance]);

  const statusText = useMemo(() => {
    if (streakLabel) return streakLabel;
    return "Active earner";
  }, [streakLabel]);

  return (
    <>
      <section
        className={`f10-profile-card savvy-balance-card ${isHotGlow ? "is-hot" : ""}`}
        role="button"
        tabIndex={0}
        onClick={() => setShowInfo(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setShowInfo(true);
          }
        }}
        aria-label="Open Savvy balance details"
      >
        <div className="savvy-balance-top">
          <div className="savvy-balance-coin-wrap">
            <SavvyPointsIcon size={58} glow animated className={isHotGlow ? "savvy-balance-coin-hot" : ""} />
          </div>
          <div className="savvy-balance-main">
            <div className="savvy-balance-number">{formatNum(displayBalance)}</div>
            <div className="savvy-balance-unit">Savvy</div>
            <div
              className="savvy-balance-line subtle"
              title="Savvy value can be used for rewards and discounts across supported experiences."
            >
              ≈ ${formatDollarValue(displayBalance)} value
            </div>
          </div>
        </div>

        <p className="savvy-balance-line">Your balance across the Savvy Universe</p>
        <p className="savvy-balance-line subtle">Earn here. Use everywhere.</p>

        <div className="savvy-balance-meta">
          <span>Lifetime Earned: {formatNum(Math.max(lifetimeEarned, balance))} Savvy</span>
          <span className="savvy-balance-status">{statusText}</span>
        </div>

        {recentGain > 0 ? (
          <div className="savvy-balance-growth">+{formatNum(recentGain)} since last visit</div>
        ) : null}
      </section>

      {showInfo ? (
        <div className="savvy-balance-modal-backdrop" onClick={() => setShowInfo(false)} role="dialog" aria-modal="true">
          <div className="savvy-balance-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Savvy Balance</h3>
            <p>Your Savvy points carry across the ecosystem, so your progress stays with you.</p>
            <ul>
              <li>Use one persistent balance across current and future Savvy apps.</li>
              <li>Actions in Final10 build long-term value, not one-off rewards.</li>
              <li>Keep stacking your run to unlock stronger reward opportunities.</li>
            </ul>
            <button type="button" className="f10-profile-refresh" onClick={() => setShowInfo(false)}>
              Got it
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}


import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useAuth } from "../../context/AuthContext";
import { useSavvyPoints } from "../../store/savvyStore";
import {
  WALLET_AWARD_EVENT,
  getWalletSnapshot,
  setSoundMuted,
  isSoundMuted,
} from "../../lib/pointsEngine";
import { playSavvyWalletSound, playUiClick } from "../../lib/savvyWalletSound";
import "../../styles/SavvyWalletBubble.css";

const TIER_BANDS = [
  { id: "rookie", label: "Rookie Saver", min: 0, max: 500 },
  { id: "hunter", label: "Deal Hunter", min: 500, max: 2500 },
  { id: "sniper", label: "Savvy Sniper", min: 2500, max: 8000 },
  { id: "elite", label: "Elite Earner", min: 8000, max: 25000 },
  { id: "legend", label: "Market Legend", min: 25000, max: 1e12 },
];

function tierProgress(savvyPoints) {
  const pts = Math.max(0, Number(savvyPoints) || 0);
  const last = TIER_BANDS[TIER_BANDS.length - 1];
  if (pts >= last.min) {
    return { band: last, pct: 100 };
  }
  const band = TIER_BANDS.find((b) => pts >= b.min && pts < b.max) || TIER_BANDS[0];
  const span = band.max - band.min;
  const pct = span > 0 ? Math.round(((pts - band.min) / span) * 100) : 100;
  return { band, pct: Math.min(100, Math.max(0, pct)) };
}

function formatSavvy(n) {
  const x = Math.round(Number(n) || 0);
  return x.toLocaleString();
}

function defaultOrigin() {
  if (typeof window === "undefined") return { x: 120, y: 120 };
  return { x: window.innerWidth - 100, y: window.innerHeight * 0.35 };
}

function FlyingCoin({ coin, targetRect, reduceMotion, onDone }) {
  const from = coin.origin || defaultOrigin();
  const w = typeof window !== "undefined" ? window.innerWidth : 800;
  const h = typeof window !== "undefined" ? window.innerHeight : 600;
  const tx = targetRect ? targetRect.left + targetRect.width / 2 : w - 72;
  const ty = targetRect ? targetRect.top + targetRect.height / 2 : h - 120;
  const midX = (from.x + tx) / 2;
  const midY = Math.min(from.y, ty) - 120;

  return (
    <motion.div
      className={`savvy-fly-coin savvy-fly-coin--${coin.rarity}`}
      initial={{ left: from.x, top: from.y, scale: 0.45, opacity: 0 }}
      animate={
        reduceMotion
          ? { left: tx, top: ty, scale: 1, opacity: 0.9 }
          : { left: [from.x, midX, tx], top: [from.y, midY, ty], scale: [0.5, 1.05, 1], opacity: [0, 1, 0.92] }
      }
      transition={
        reduceMotion
          ? { duration: 0.2, ease: "easeOut" }
          : { duration: 0.88, ease: [0.22, 0.82, 0.22, 1], times: [0, 0.42, 1] }
      }
      onAnimationComplete={onDone}
      style={{
        position: "fixed",
        width: 44,
        height: 44,
        marginLeft: -22,
        marginTop: -22,
        zIndex: 2147483600,
        pointerEvents: "none",
      }}
    >
      <span className="savvy-fly-coin-inner">✦</span>
      <motion.span
        className="savvy-fly-coin-tag"
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0 }}
      >
        +{coin.amount}
      </motion.span>
    </motion.div>
  );
}

export default function SavvyWalletBubble() {
  const { user } = useAuth();
  const {
    displaySavvy,
    multiplier,
    streak,
    recentFeed,
    savvyPoints: canonicalSavvy,
  } = useSavvyPoints();
  const rootRef = useRef(null);
  const reduceMotion = useReducedMotion();
  const [wallet, setWallet] = useState(() => getWalletSnapshot());
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [muted, setMuted] = useState(() => isSoundMuted());
  const [pulse, setPulse] = useState(false);
  const [multFlash, setMultFlash] = useState(false);
  const [floatLabel, setFloatLabel] = useState(null);
  const [coins, setCoins] = useState([]);
  const [legendGlow, setLegendGlow] = useState(false);
  const [ephemeralRecent, setEphemeralRecent] = useState([]);

  const multLabel = `${multiplier.toFixed(1)}x`;

  const { band, pct } = useMemo(() => tierProgress(canonicalSavvy), [canonicalSavvy]);

  const refreshWallet = useCallback(() => setWallet(getWalletSnapshot()), []);

  useEffect(() => {
    const onAward = (e) => {
      const d = e.detail || {};
      const mirror = Boolean(d.mirrorOnly);
      const amt = Math.max(1, Math.round(Number(d.amount) || 0));
      const rarity = d.rarity || "NORMAL";
      const origin = d.origin || null;

      playSavvyWalletSound(rarity);
      if (rarity === "LEGENDARY") {
        setLegendGlow(true);
        window.setTimeout(() => setLegendGlow(false), 1400);
      }

      const id = `fly-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;
      void rootRef.current?.getBoundingClientRect?.();
      setCoins((c) => [...c.slice(-3), { id, amount: amt, rarity, origin }]);

      setPulse(true);
      window.setTimeout(() => setPulse(false), 520);
      setMultFlash(true);
      window.setTimeout(() => setMultFlash(false), 380);

      setFloatLabel({ text: `+${amt} Savvy`, rarity });
      window.setTimeout(() => setFloatLabel(null), 1600);

      if (mirror) {
        setEphemeralRecent((r) =>
          [{ id: `m-${Date.now()}`, type: d.type || "reward", amount: amt, rarity, ts: Date.now() }, ...r].slice(0, 5)
        );
      }
      refreshWallet();
    };
    window.addEventListener(WALLET_AWARD_EVENT, onAward);
    return () => window.removeEventListener(WALLET_AWARD_EVENT, onAward);
  }, [refreshWallet]);

  const removeCoin = useCallback((id) => {
    setCoins((c) => c.filter((x) => x.id !== id));
  }, []);

  const toggleMute = () => {
    const next = !isSoundMuted();
    setSoundMuted(next);
    setMuted(next);
    if (!next) playUiClick();
  };

  const toggleDrawer = () => {
    setDrawerOpen((v) => !v);
    playUiClick();
  };

  const mergedRecent = useMemo(() => {
    const a = (ephemeralRecent || []).map((r) => ({
      id: r.id,
      amount: r.amount,
      sign: 1,
      headline: String(r.type || "reward").replace(/_/g, " "),
      rarity: r.rarity,
      ts: r.ts || Date.now(),
      _m: 1,
    }));
    const b = (recentFeed || []).map((r) => ({ ...r, _m: 0 }));
    const seen = new Set();
    const out = [];
    for (const x of [...a, ...b]) {
      const k = x.id || `${x.ts}-${x.amount}`;
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(x);
      if (out.length >= 6) break;
    }
    return out.slice(0, 3);
  }, [ephemeralRecent, recentFeed]);

  if (!user) return null;

  const targetRect = rootRef.current?.getBoundingClientRect?.() || null;

  const flyPortal =
    typeof document !== "undefined"
      ? createPortal(
          <AnimatePresence>
            {coins.map((c) => (
              <FlyingCoin
                key={c.id}
                coin={c}
                targetRect={targetRect}
                reduceMotion={Boolean(reduceMotion)}
                onDone={() => removeCoin(c.id)}
              />
            ))}
          </AnimatePresence>,
          document.body
        )
      : null;

  return (
    <>
      {legendGlow ? <div className="savvy-wallet-legend-glow" aria-hidden /> : null}
      {flyPortal}
      <div
        id="savvy-wallet-root"
        ref={rootRef}
        className={`savvy-wallet-bubble ${pulse ? "is-pulse" : ""} ${multFlash ? "is-mult-flash" : ""}`}
      >
        <div className="savvy-wallet-bubble-border" aria-hidden />
        <div className="savvy-wallet-bubble-shimmer" aria-hidden />

        <div className="savvy-wallet-hd">
          <div className="savvy-wallet-title-row">
            <span className="savvy-wallet-ico" aria-hidden>
              💰
            </span>
            <span className="savvy-wallet-title">Savvy Wallet</span>
          </div>
          <div className="savvy-wallet-badge-tier" title="Rank">
            {band.label}
          </div>
        </div>

        <div className="savvy-wallet-balance">
          <motion.span
            key={displaySavvy}
            initial={reduceMotion ? undefined : { opacity: 0.65, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className="savvy-wallet-balance-num"
          >
            {formatSavvy(displaySavvy)}
          </motion.span>
          <span className="savvy-wallet-balance-sub">Savvy</span>
        </div>

        <AnimatePresence>
          {floatLabel ? (
            <motion.div
              key={floatLabel.text}
              className={`savvy-wallet-float-lbl savvy-wallet-float-lbl--${floatLabel.rarity}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: -6 }}
              exit={{ opacity: 0, y: -22 }}
            >
              {floatLabel.text}
              {floatLabel.rarity === "LEGENDARY" ? <span className="savvy-wallet-float-epic"> — LEGENDARY FIND</span> : null}
            </motion.div>
          ) : null}
        </AnimatePresence>

        <div className="savvy-wallet-meta">
          <div className="savvy-wallet-meta-row">
            <span className="savvy-wallet-meta-k">Multiplier</span>
            <span className={`savvy-wallet-meta-v ${multFlash ? "is-hot" : ""}`}>{multLabel}</span>
          </div>
          <div className="savvy-wallet-meta-row">
            <span className="savvy-wallet-meta-k">Streak</span>
            <span className="savvy-wallet-meta-v">
              🔥 {streak} day{streak === 1 ? "" : "s"}
            </span>
          </div>
        </div>

        <div className="savvy-wallet-progress">
          <div className="savvy-wallet-progress-label">
            <span>Next tier</span>
            <span>{pct}%</span>
          </div>
          <div className="savvy-wallet-progress-track">
            <motion.div
              className="savvy-wallet-progress-fill"
              initial={false}
              animate={{ width: `${pct}%` }}
              transition={{ type: "spring", stiffness: 120, damping: 18 }}
            />
          </div>
        </div>

        <div className="savvy-wallet-mini-feed">
          <div className="savvy-wallet-feed-hd">Recent</div>
          <ul className="savvy-wallet-feed-list">
            {mergedRecent.map((r) => (
              <li key={r.id} className={`savvy-wallet-feed-item savvy-wallet-feed-item--${String(r.rarity || "NORMAL").toLowerCase()}`}>
                <span className="savvy-wallet-feed-amt">
                  {(r.sign ?? 1) < 0 ? "-" : "+"}
                  {r.amount}
                </span>
                <span className="savvy-wallet-feed-type">{r.headline || String(r.type || "").replace(/_/g, " ")}</span>
              </li>
            ))}
            {mergedRecent.length === 0 ? <li className="savvy-wallet-feed-empty">Complete moves to fill this lane.</li> : null}
          </ul>
        </div>

        <div className="savvy-wallet-actions">
          <button type="button" className="savvy-wallet-btn" onClick={toggleDrawer} aria-expanded={drawerOpen}>
            {drawerOpen ? "Hide stats" : "Earnings detail"}
          </button>
          <button type="button" className="savvy-wallet-btn savvy-wallet-btn--ghost" onClick={toggleMute} aria-pressed={muted}>
            {muted ? "Unmute" : "Mute"}
          </button>
        </div>

        {drawerOpen ? (
          <div className="savvy-wallet-drawer">
            <div className="savvy-wallet-stat">
              <span className="savvy-wallet-stat-k">Biggest win today</span>
              <span className="savvy-wallet-stat-v">{formatSavvy(wallet.biggestTodayAmount || 0)}</span>
            </div>
            <div className="savvy-wallet-stat">
              <span className="savvy-wallet-stat-k">Session wallet awards</span>
              <span className="savvy-wallet-stat-v">{formatSavvy(wallet.lifetimeClientAwarded || 0)}</span>
            </div>
            <div className="savvy-wallet-stat">
              <span className="savvy-wallet-stat-k">Total saved (est.)</span>
              <span className="savvy-wallet-stat-v">${formatSavvy(wallet.totalSavedEstimate || 0)}</span>
            </div>
            <div className="savvy-wallet-stat">
              <span className="savvy-wallet-stat-k">Projected monthly savings</span>
              <span className="savvy-wallet-stat-v">${formatSavvy(wallet.projectedMonthlySavings || 0)}</span>
            </div>
            <p className="savvy-wallet-drawer-note">Estimates blend Savvy you earn here with typical deal deltas — not financial advice.</p>
          </div>
        ) : null}

        <div className="savvy-wallet-particles" aria-hidden>
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className={`savvy-wallet-particle savvy-wallet-particle--${i}`} />
          ))}
        </div>
      </div>
    </>
  );
}

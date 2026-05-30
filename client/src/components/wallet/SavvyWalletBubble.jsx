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
import { useMediaQuery } from "../../hooks/useMediaQuery";
import { SCOUT_COPY } from "../../config/savvyScoutBranding";
import "../../styles/SavvyWalletBubble.css";

const MOBILE_MQ = "(max-width: 767px)";
const MOBILE_IDLE_MS = 8000;

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

function WalletBody({
  band,
  pct,
  displaySavvy,
  multLabel,
  multFlash,
  streak,
  floatLabel,
  reduceMotion,
  mergedRecent,
  drawerOpen,
  toggleDrawer,
  muted,
  toggleMute,
  wallet,
}) {
  return (
    <>
      <motion.div
        className="savvy-wallet-sheet-handle"
        drag="y"
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={0.12}
        onDragEnd={(_, info) => {
          if (info.offset.y > 48 || info.velocity.y > 320) {
            window.dispatchEvent(new CustomEvent("f10:savvy-wallet-collapse"));
          }
        }}
        aria-hidden
      />

      <motion.div
        className="savvy-wallet-sheet-inner"
        initial={reduceMotion ? false : { opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 380, damping: 32 }}
      >
        <motion.div
          className="savvy-wallet-sheet-scroll"
          initial={reduceMotion ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 340, damping: 28, delay: 0.02 }}
        >
          <motion.div
            className="savvy-wallet-sheet-body"
            initial={reduceMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.2, delay: 0.04 }}
          >
            <motion.div
              className="savvy-wallet-hd"
              initial={reduceMotion ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.18, delay: 0.05 }}
            >
              <motion.div
                className="savvy-wallet-title-row"
                initial={reduceMotion ? false : { opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.2, delay: 0.06 }}
              >
                <span className="savvy-wallet-ico" aria-hidden>
                  💰
                </span>
                <span className="savvy-wallet-title">Savvy Wallet</span>
              </motion.div>
              <motion.div
                className="savvy-wallet-badge-tier"
                title="Rank"
                initial={reduceMotion ? false : { scale: 0.92, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 400, damping: 24, delay: 0.08 }}
              >
                {band.label}
              </motion.div>
            </motion.div>

            <motion.div
              className="savvy-wallet-balance"
              initial={reduceMotion ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 320, damping: 26, delay: 0.07 }}
            >
              <motion.span
                key={displaySavvy}
                initial={reduceMotion ? undefined : { opacity: 0.65, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className="savvy-wallet-balance-num"
              >
                {formatSavvy(displaySavvy)}
              </motion.span>
              <span className="savvy-wallet-balance-sub">Savvy</span>
            </motion.div>

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
                  {floatLabel.rarity === "LEGENDARY" ? (
                    <span className="savvy-wallet-float-epic"> — LEGENDARY FIND</span>
                  ) : null}
                </motion.div>
              ) : null}
            </AnimatePresence>

            <motion.div
              className="savvy-wallet-meta"
              initial={reduceMotion ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: 0.09 }}
            >
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
            </motion.div>

            <motion.div
              className="savvy-wallet-progress"
              initial={reduceMotion ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: 0.1 }}
            >
              <motion.div
                className="savvy-wallet-progress-label"
                initial={reduceMotion ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.11 }}
              >
                <span>Next tier</span>
                <span>{pct}%</span>
              </motion.div>
              <div className="savvy-wallet-progress-track">
                <motion.div
                  className="savvy-wallet-progress-fill"
                  initial={false}
                  animate={{ width: `${pct}%` }}
                  transition={{ type: "spring", stiffness: 120, damping: 18 }}
                />
              </div>
            </motion.div>

            <motion.div
              className="savvy-wallet-mini-feed"
              initial={reduceMotion ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.22, delay: 0.12 }}
            >
              <div className="savvy-wallet-feed-hd">Recent</div>
              <ul className="savvy-wallet-feed-list">
                {mergedRecent.map((r, i) => (
                  <motion.li
                    key={r.id}
                    className={`savvy-wallet-feed-item savvy-wallet-feed-item--${String(r.rarity || "NORMAL").toLowerCase()}`}
                    initial={reduceMotion ? false : { opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.18, delay: 0.13 + i * 0.04 }}
                  >
                    <span className="savvy-wallet-feed-amt">
                      {(r.sign ?? 1) < 0 ? "-" : "+"}
                      {r.amount}
                    </span>
                    <span className="savvy-wallet-feed-type">
                      {r.headline || String(r.type || "").replace(/_/g, " ")}
                    </span>
                  </motion.li>
                ))}
                {mergedRecent.length === 0 ? (
                  <li className="savvy-wallet-feed-empty">{SCOUT_COPY.wallet.feedEmpty}</li>
                ) : null}
              </ul>
            </motion.div>

            <motion.div
              className="savvy-wallet-actions"
              initial={reduceMotion ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: 0.14 }}
            >
              <button type="button" className="savvy-wallet-btn" onClick={toggleDrawer} aria-expanded={drawerOpen}>
                {drawerOpen ? "Hide stats" : "Earnings detail"}
              </button>
              <button
                type="button"
                className="savvy-wallet-btn savvy-wallet-btn--ghost"
                onClick={toggleMute}
                aria-pressed={muted}
              >
                {muted ? "Unmute" : "Mute"}
              </button>
            </motion.div>

            {drawerOpen ? (
              <motion.div
                className="savvy-wallet-drawer"
                initial={reduceMotion ? false : { opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                transition={{ duration: 0.22 }}
              >
                <motion.div
                  className="savvy-wallet-stat"
                  initial={reduceMotion ? false : { opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.05 }}
                >
                  <span className="savvy-wallet-stat-k">Biggest win today</span>
                  <span className="savvy-wallet-stat-v">{formatSavvy(wallet.biggestTodayAmount || 0)}</span>
                </motion.div>
                <motion.div
                  className="savvy-wallet-stat"
                  initial={reduceMotion ? false : { opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.08 }}
                >
                  <span className="savvy-wallet-stat-k">Session wallet awards</span>
                  <span className="savvy-wallet-stat-v">{formatSavvy(wallet.lifetimeClientAwarded || 0)}</span>
                </motion.div>
                <motion.div
                  className="savvy-wallet-stat"
                  initial={reduceMotion ? false : { opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.11 }}
                >
                  <span className="savvy-wallet-stat-k">Total saved (est.)</span>
                  <span className="savvy-wallet-stat-v">${formatSavvy(wallet.totalSavedEstimate || 0)}</span>
                </motion.div>
                <motion.div
                  className="savvy-wallet-stat"
                  initial={reduceMotion ? false : { opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.14 }}
                >
                  <span className="savvy-wallet-stat-k">Projected monthly savings</span>
                  <span className="savvy-wallet-stat-v">${formatSavvy(wallet.projectedMonthlySavings || 0)}</span>
                </motion.div>
                <p className="savvy-wallet-drawer-note">
                  Estimates blend Savvy you earn here with typical deal deltas — not financial advice.
                </p>
              </motion.div>
            ) : null}
          </motion.div>
        </motion.div>
      </motion.div>
    </>
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
  const isMobile = useMediaQuery(MOBILE_MQ);
  const rootRef = useRef(null);
  const touchStartY = useRef(0);
  const idleTimerRef = useRef(null);
  const reduceMotion = useReducedMotion();
  const [wallet, setWallet] = useState(() => getWalletSnapshot());
  const [mobileExpanded, setMobileExpanded] = useState(false);
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

  const collapseMobile = useCallback(() => {
    setMobileExpanded(false);
    setDrawerOpen(false);
  }, []);

  const bumpIdleTimer = useCallback(() => {
    if (!isMobile || !mobileExpanded) return;
    if (idleTimerRef.current) window.clearTimeout(idleTimerRef.current);
    idleTimerRef.current = window.setTimeout(() => {
      setMobileExpanded(false);
      setDrawerOpen(false);
    }, MOBILE_IDLE_MS);
  }, [isMobile, mobileExpanded]);

  useEffect(() => {
    if (!isMobile) {
      setMobileExpanded(false);
      return undefined;
    }
    setMobileExpanded(false);
    setDrawerOpen(false);
    return undefined;
  }, [isMobile]);

  useEffect(() => {
    bumpIdleTimer();
    return () => {
      if (idleTimerRef.current) window.clearTimeout(idleTimerRef.current);
    };
  }, [bumpIdleTimer, mobileExpanded]);

  useEffect(() => {
    const onCollapse = () => collapseMobile();
    window.addEventListener("f10:savvy-wallet-collapse", onCollapse);
    return () => window.removeEventListener("f10:savvy-wallet-collapse", onCollapse);
  }, [collapseMobile]);

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

  const toggleMute = (e) => {
    e?.stopPropagation?.();
    const next = !isSoundMuted();
    setSoundMuted(next);
    setMuted(next);
    if (!next) playUiClick();
    bumpIdleTimer();
  };

  const toggleDrawer = (e) => {
    e?.stopPropagation?.();
    setDrawerOpen((v) => !v);
    playUiClick();
    bumpIdleTimer();
  };

  const expandMobile = (e) => {
    e?.stopPropagation?.();
    setMobileExpanded(true);
    playUiClick();
    bumpIdleTimer();
  };

  const onTouchStart = (e) => {
    touchStartY.current = e.touches[0]?.clientY ?? 0;
  };

  const onTouchEnd = (e) => {
    const y = e.changedTouches[0]?.clientY ?? 0;
    if (y - touchStartY.current > 56) collapseMobile();
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
  const showCollapsed = isMobile && !mobileExpanded;
  const showExpanded = isMobile && mobileExpanded;

  const walletBodyProps = {
    band,
    pct,
    displaySavvy,
    multLabel,
    multFlash,
    streak,
    floatLabel,
    reduceMotion,
    mergedRecent,
    drawerOpen,
    toggleDrawer,
    muted,
    toggleMute,
    wallet,
  };

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

  const mobileBackdrop =
    showExpanded && typeof document !== "undefined"
      ? createPortal(
          <motion.button
            type="button"
            className="savvy-wallet-mobile-backdrop"
            aria-label="Close Savvy Wallet"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={collapseMobile}
          />,
          document.body
        )
      : null;

  const bubbleClass = [
    "savvy-wallet-bubble",
    pulse ? "is-pulse" : "",
    multFlash ? "is-mult-flash" : "",
    isMobile ? "savvy-wallet-bubble--mobile" : "",
    showCollapsed ? "is-collapsed" : "",
    showExpanded ? "is-expanded" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <>
      {legendGlow ? <motion.div className="savvy-wallet-legend-glow" aria-hidden /> : null}
      {flyPortal}
      <AnimatePresence>{mobileBackdrop}</AnimatePresence>

      <div
        id="savvy-wallet-root"
        ref={rootRef}
        className={bubbleClass}
        onPointerDown={showExpanded ? bumpIdleTimer : undefined}
        onTouchStart={showExpanded ? onTouchStart : undefined}
        onTouchEnd={showExpanded ? onTouchEnd : undefined}
      >
        <div className="savvy-wallet-bubble-border" aria-hidden />
        <motion.div
          className="savvy-wallet-bubble-shimmer"
          aria-hidden
          animate={showExpanded ? { opacity: 0.35 } : { opacity: 1 }}
        />

        {showCollapsed ? (
          <motion.button
            type="button"
            className="savvy-wallet-pill"
            onClick={expandMobile}
            aria-expanded={false}
            aria-controls="savvy-wallet-sheet"
            aria-label={`Savvy Wallet: ${formatSavvy(displaySavvy)} points, ${multLabel} multiplier, ${streak} day streak`}
            initial={reduceMotion ? false : { scale: 0.94, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            whileTap={reduceMotion ? undefined : { scale: 0.97 }}
            transition={{ type: "spring", stiffness: 420, damping: 28 }}
          >
            <span className="savvy-wallet-pill-orb" aria-hidden>
              ✦
            </span>
            <span className="savvy-wallet-pill-main">
              <span className="savvy-wallet-pill-amt">{formatSavvy(displaySavvy)}</span>
              <span className="savvy-wallet-pill-label">Savvy</span>
            </span>
            <span className="savvy-wallet-pill-chips">
              <span className={`savvy-wallet-pill-chip ${multFlash ? "is-hot" : ""}`}>{multLabel}</span>
              <span className="savvy-wallet-pill-chip savvy-wallet-pill-chip--streak" title="Login streak">
                🔥{streak}
              </span>
            </span>
            <AnimatePresence>
              {floatLabel ? (
                <motion.span
                  key={floatLabel.text}
                  className="savvy-wallet-pill-float"
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: -10 }}
                  exit={{ opacity: 0, y: -18 }}
                >
                  {floatLabel.text}
                </motion.span>
              ) : null}
            </AnimatePresence>
          </motion.button>
        ) : null}

        {showExpanded ? (
          <div id="savvy-wallet-sheet" className="savvy-wallet-sheet" role="dialog" aria-label="Savvy Wallet">
            <WalletBody {...walletBodyProps} />
            <button
              type="button"
              className="savvy-wallet-sheet-close"
              onClick={collapseMobile}
              aria-label="Minimize wallet"
            >
              ↓
            </button>
          </div>
        ) : null}

        {!isMobile ? (
          <div className="savvy-wallet-desktop">
            <div className="savvy-wallet-hd">
              <motion.div
                className="savvy-wallet-title-row"
                initial={reduceMotion ? false : { opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.2 }}
              >
                <span className="savvy-wallet-ico" aria-hidden>
                  💰
                </span>
                <span className="savvy-wallet-title">Savvy Wallet</span>
              </motion.div>
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
                  {floatLabel.rarity === "LEGENDARY" ? (
                    <span className="savvy-wallet-float-epic"> — LEGENDARY FIND</span>
                  ) : null}
                </motion.div>
              ) : null}
            </AnimatePresence>

            <div className="savvy-wallet-meta">
              <div className="savvy-wallet-meta-row">
                <span className="savvy-wallet-meta-k">Multiplier</span>
                <span className={`savvy-wallet-meta-v ${multFlash ? "is-hot" : ""}`}>{multLabel}</span>
              </div>
              <motion.div
                className="savvy-wallet-meta-row"
                initial={reduceMotion ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.05 }}
              >
                <span className="savvy-wallet-meta-k">Streak</span>
                <span className="savvy-wallet-meta-v">
                  🔥 {streak} day{streak === 1 ? "" : "s"}
                </span>
              </motion.div>
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
                  <li
                    key={r.id}
                    className={`savvy-wallet-feed-item savvy-wallet-feed-item--${String(r.rarity || "NORMAL").toLowerCase()}`}
                  >
                    <span className="savvy-wallet-feed-amt">
                      {(r.sign ?? 1) < 0 ? "-" : "+"}
                      {r.amount}
                    </span>
                    <span className="savvy-wallet-feed-type">
                      {r.headline || String(r.type || "").replace(/_/g, " ")}
                    </span>
                  </li>
                ))}
                {mergedRecent.length === 0 ? (
                  <li className="savvy-wallet-feed-empty">{SCOUT_COPY.wallet.feedEmpty}</li>
                ) : null}
              </ul>
            </div>

            <motion.div
              className="savvy-wallet-actions"
              initial={reduceMotion ? false : { opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.18, delay: 0.06 }}
            >
              <button type="button" className="savvy-wallet-btn" onClick={toggleDrawer} aria-expanded={drawerOpen}>
                {drawerOpen ? "Hide stats" : "Earnings detail"}
              </button>
              <button
                type="button"
                className="savvy-wallet-btn savvy-wallet-btn--ghost"
                onClick={toggleMute}
                aria-pressed={muted}
              >
                {muted ? "Unmute" : "Mute"}
              </button>
            </motion.div>

            {drawerOpen ? (
              <motion.div
                className="savvy-wallet-drawer"
                initial={reduceMotion ? false : { opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                transition={{ duration: 0.22 }}
              >
                <div className="savvy-wallet-stat">
                  <span className="savvy-wallet-stat-k">Biggest win today</span>
                  <span className="savvy-wallet-stat-v">{formatSavvy(wallet.biggestTodayAmount || 0)}</span>
                </div>
                <motion.div
                  className="savvy-wallet-stat"
                  initial={reduceMotion ? false : { opacity: 0, x: -4 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.04 }}
                >
                  <span className="savvy-wallet-stat-k">Session wallet awards</span>
                  <span className="savvy-wallet-stat-v">{formatSavvy(wallet.lifetimeClientAwarded || 0)}</span>
                </motion.div>
                <div className="savvy-wallet-stat">
                  <span className="savvy-wallet-stat-k">Total saved (est.)</span>
                  <span className="savvy-wallet-stat-v">${formatSavvy(wallet.totalSavedEstimate || 0)}</span>
                </div>
                <div className="savvy-wallet-stat">
                  <span className="savvy-wallet-stat-k">Projected monthly savings</span>
                  <span className="savvy-wallet-stat-v">${formatSavvy(wallet.projectedMonthlySavings || 0)}</span>
                </div>
                <p className="savvy-wallet-drawer-note">
                  Estimates blend Savvy you earn here with typical deal deltas — not financial advice.
                </p>
              </motion.div>
            ) : null}
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

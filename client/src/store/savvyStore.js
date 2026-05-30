/**
 * Central Savvy balance + wallet UX state.
 * Canonical balance: `user.savvyPoints` from AuthContext (`GET /auth/me`). Display uses no parallel balance ledger.
 */
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useAuth } from "../context/AuthContext";
import {
  awardPoints as persistWalletAward,
  WALLET_AWARD_EVENT,
  getWalletSnapshot,
} from "../lib/pointsEngine";
import { registerSavvyBalanceGetter } from "../lib/customizationCatalog";

export const SAVVY_AUTH_REFRESH_REQUEST = "f10:savvy-auth-refresh-request";
export const SAVVY_STORE_UPDATED = "f10:savvy-store-updated";

const MAX_TX = 40;
const POLL_MS = 90_000;
const AUTH_REFRESH_DEBOUNCE_MS = 550;
/** Human-readable labels for wallet / reward source keys */
const TX_LABELS = {
  save_item: "Save Item",
  create_alert: "Create Alert",
  successful_alert: "Alert Reward",
  build_completion: "Build Complete",
  seller_upload: "Seller Upload",
  referral_signup: "Referral",
  streak_bonus: "Streak Bonus",
  battlepass_progress: "Battle Pass",
  buildwars_entry: "Build Wars",
  savvywins_post: "Savvy Wins",
  trusted_purchase: "Trusted Purchase",
  watch_item: "Watch Item",
  daily_login: "Daily Login",
  generic: "Reward",
};

const SavvyPointsContext = createContext(null);

function labelForType(type) {
  const t = String(type || "").trim();
  if (!t) return "Reward";
  return TX_LABELS[t] || t.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function mergeRecentFeed(walletRecent, txRows) {
  const a = (walletRecent || []).map((r) => ({
    id: String(r.id || `w-${r.ts}-${r.amount}`),
    amount: Math.max(0, Math.round(Number(r.amount) || 0)),
    sign: 1,
    headline: labelForType(r.type),
    rarity: r.rarity || "NORMAL",
    ts: Number(r.ts) || 0,
    _src: 0,
  }));
  const b = (txRows || []).map((r) => ({
    id: String(r.id),
    amount: Math.abs(Math.round(Number(r.delta) || 0)),
    sign: Number(r.delta) >= 0 ? 1 : -1,
    headline: r.label || labelForType(r.sourceType),
    rarity: "NORMAL",
    ts: Number(r.ts) || 0,
    _src: 1,
  }));
  const seen = new Set();
  const out = [];
  for (const x of [...a, ...b].sort((p, q) => q.ts - p.ts)) {
    if (seen.has(x.id)) continue;
    seen.add(x.id);
    out.push(x);
    if (out.length >= 12) break;
  }
  return out;
}

export function SavvyPointsProvider({ children }) {
  const { user, loading, refreshProfile } = useAuth();
  const [walletTick, setWalletTick] = useState(0);
  const [recentTransactions, setRecentTransactions] = useState([]);
  const refreshTimerRef = useRef(null);
  const initialSyncUserRef = useRef(null);

  const bumpWallet = useCallback(() => setWalletTick((t) => t + 1), []);

  const scheduleAuthRefresh = useCallback(() => {
    if (typeof refreshProfile !== "function") return;
    if (refreshTimerRef.current) window.clearTimeout(refreshTimerRef.current);
    refreshTimerRef.current = window.setTimeout(() => {
      refreshTimerRef.current = null;
      void refreshProfile().finally(() => {
        try {
          window.dispatchEvent(new CustomEvent(SAVVY_STORE_UPDATED));
        } catch {
          /* ignore */
        }
        bumpWallet();
      });
    }, AUTH_REFRESH_DEBOUNCE_MS);
  }, [refreshProfile, bumpWallet]);

  useEffect(() => {
    const onRequest = () => scheduleAuthRefresh();
    window.addEventListener(SAVVY_AUTH_REFRESH_REQUEST, onRequest);
    return () => window.removeEventListener(SAVVY_AUTH_REFRESH_REQUEST, onRequest);
  }, [scheduleAuthRefresh]);

  useEffect(() => {
    registerSavvyBalanceGetter(() =>
      user ? Math.max(0, Math.round(Number(user.savvyPoints) || 0)) : 0
    );
    return () => registerSavvyBalanceGetter(null);
  }, [user]);

  useEffect(() => {
    const onAward = (e) => {
      const d = e.detail || {};
      const amt = Math.max(1, Math.round(Number(d.amount) || 0));

      scheduleAuthRefresh();

      if (!d.mirrorOnly && amt) {
        const type = String(d.type || "generic");
        setRecentTransactions((prev) =>
          [
            {
              id: `tx-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              delta: amt,
              label: labelForType(type),
              sourceType: type,
              ts: Date.now(),
              kind: "earn",
            },
            ...prev,
          ].slice(0, MAX_TX)
        );
      }
      bumpWallet();
    };
    window.addEventListener(WALLET_AWARD_EVENT, onAward);
    return () => {
      window.removeEventListener(WALLET_AWARD_EVENT, onAward);
    };
  }, [bumpWallet, scheduleAuthRefresh]);

  void walletTick;
  const wallet = getWalletSnapshot();

  const multiplier = useMemo(() => {
    const streak = wallet.streak || 0;
    return 1 + Math.min(1.45, streak * 0.06);
  }, [wallet.streak]);

  const savvyPoints = useMemo(() => {
    if (!user) return 0;
    return Math.max(0, Math.round(Number(user.savvyPoints) || 0));
  }, [user]);

  const lifetimeEarned = useMemo(() => {
    if (!user) return 0;
    const sp = Math.max(0, Math.round(Number(user.savvyPoints) || 0));
    const life = Math.max(0, Math.round(Number(user.lifetimePointsEarned) || 0));
    return Math.max(sp, life);
  }, [user]);

  const displaySavvy = savvyPoints;

  const recentFeed = useMemo(
    () => mergeRecentFeed(wallet.recent, recentTransactions),
    [wallet.recent, recentTransactions]
  );

  const awardPoints = useCallback((type, amount, rarity, origin) => {
    persistWalletAward(type, amount, rarity, origin);
  }, []);

  const spendPoints = useCallback(
    (amount, label = "Spend") => {
      const n = Math.abs(Math.round(Number(amount) || 0));
      if (!n) return;
      scheduleAuthRefresh();
      setRecentTransactions((prev) =>
        [
          {
            id: `tx-sp-${Date.now()}`,
            delta: -n,
            label,
            ts: Date.now(),
            kind: "spend",
          },
          ...prev,
        ].slice(0, MAX_TX)
      );
      try {
        window.dispatchEvent(new CustomEvent(SAVVY_STORE_UPDATED));
      } catch {
        /* ignore */
      }
    },
    [scheduleAuthRefresh]
  );

  const syncPoints = useCallback(async () => {
    if (typeof refreshProfile !== "function") return null;
    const u = await refreshProfile();
    bumpWallet();
    try {
      window.dispatchEvent(new CustomEvent(SAVVY_STORE_UPDATED));
    } catch {
      /* ignore */
    }
    return u;
  }, [refreshProfile, bumpWallet]);

  const animatePointGain = useCallback((amount, opts = {}) => {
    const amt = Math.max(1, Math.round(Number(amount) || 0));
    try {
      window.dispatchEvent(
        new CustomEvent(WALLET_AWARD_EVENT, {
          detail: {
            type: opts.type || "generic",
            amount: amt,
            rarity: opts.rarity || "NORMAL",
            origin: opts.origin || null,
            mirrorOnly: Boolean(opts.mirrorOnly),
          },
        })
      );
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (!user) {
      setRecentTransactions([]);
      initialSyncUserRef.current = null;
      return undefined;
    }
    const uid = String(user.id || user._id || "");
    if (uid && initialSyncUserRef.current !== uid) {
      initialSyncUserRef.current = uid;
      if (!loading) scheduleAuthRefresh();
    }
    return undefined;
  }, [user, loading, scheduleAuthRefresh]);

  useEffect(() => {
    if (!user || loading) return undefined;
    const onVis = () => {
      if (document.visibilityState === "visible") scheduleAuthRefresh();
    };
    document.addEventListener("visibilitychange", onVis);
    const poll = window.setInterval(() => scheduleAuthRefresh(), POLL_MS);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.clearInterval(poll);
    };
  }, [user, loading, scheduleAuthRefresh]);

  useEffect(
    () => () => {
      if (refreshTimerRef.current) window.clearTimeout(refreshTimerRef.current);
    },
    []
  );

  const value = useMemo(
    () => ({
      savvyPoints,
      displaySavvy,
      multiplier,
      streak: wallet.streak || 0,
      lifetimeEarned,
      recentTransactions,
      recentFeed,
      awardPoints,
      spendPoints,
      syncPoints,
      animatePointGain,
      isAuthenticated: Boolean(user),
    }),
    [
      savvyPoints,
      displaySavvy,
      multiplier,
      wallet.streak,
      lifetimeEarned,
      recentTransactions,
      recentFeed,
      awardPoints,
      spendPoints,
      syncPoints,
      animatePointGain,
      user,
    ]
  );

  return <SavvyPointsContext.Provider value={value}>{children}</SavvyPointsContext.Provider>;
}

export function useSavvyPoints() {
  const ctx = useContext(SavvyPointsContext);
  if (!ctx) {
    throw new Error("useSavvyPoints must be used within SavvyPointsProvider");
  }
  return ctx;
}

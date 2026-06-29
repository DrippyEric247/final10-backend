/**
 * Central Savvy Wallet / points reward hub.
 * Dispatches visual wallet awards + persists session stats (client-side).
 * Server-authoritative Savvy still comes from auth profile; this layer is UX + telemetry.
 */

import { DAILY_LOGIN_BASE_SAVVY } from "../config/savvyRewards";
import { WALLET_AWARD_EVENT } from "@savvy/core/events/universeEvents";

export { WALLET_AWARD_EVENT };

const STORAGE_KEY = "f10_savvy_wallet_v1";

/** @typedef {'NORMAL'|'GOOD'|'RARE'|'EPIC'|'LEGENDARY'} SavvyRarity */

/** Default amounts when `amount` omitted */
export const POINT_ACTION_DEFAULTS = {
  save_item: { amount: 12, rarity: "NORMAL" },
  create_alert: { amount: 18, rarity: "GOOD" },
  successful_alert: { amount: 45, rarity: "RARE" },
  build_completion: { amount: 35, rarity: "GOOD" },
  seller_upload: { amount: 28, rarity: "GOOD" },
  referral_signup: { amount: 120, rarity: "EPIC" },
  streak_bonus: { amount: 25, rarity: "GOOD" },
  battlepass_progress: { amount: 20, rarity: "NORMAL" },
  buildwars_entry: { amount: 22, rarity: "GOOD" },
  savvywins_post: { amount: 30, rarity: "GOOD" },
  trusted_purchase: { amount: 40, rarity: "RARE" },
  watch_item: { amount: 10, rarity: "NORMAL" },
  daily_login: { amount: DAILY_LOGIN_BASE_SAVVY, rarity: "GOOD" },
  scout_mission: { amount: 10, rarity: "GOOD" },
  generic: { amount: 10, rarity: "NORMAL" },
};

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function loadWallet() {
  if (typeof window === "undefined") return defaultWallet();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultWallet();
    const p = JSON.parse(raw);
    return {
      streak: Math.max(0, Number(p.streak) || 0),
      lastStreakDate: typeof p.lastStreakDate === "string" ? p.lastStreakDate : "",
      lifetimeClientAwarded: Math.max(0, Number(p.lifetimeClientAwarded) || 0),
      recent: Array.isArray(p.recent) ? p.recent.slice(0, 24) : [],
      biggestTodayAmount: Math.max(0, Number(p.biggestTodayAmount) || 0),
      biggestTodayKey: typeof p.biggestTodayKey === "string" ? p.biggestTodayKey : "",
      totalSavedEstimate: Math.max(0, Number(p.totalSavedEstimate) || 0),
      projectedMonthlySavings: Math.max(0, Number(p.projectedMonthlySavings) || 0),
    };
  } catch {
    return defaultWallet();
  }
}

function defaultWallet() {
  return {
    streak: 0,
    lastStreakDate: "",
    lifetimeClientAwarded: 0,
    recent: [],
    biggestTodayAmount: 0,
    biggestTodayKey: "",
    totalSavedEstimate: 0,
    projectedMonthlySavings: 0,
  };
}

function saveWallet(data) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    /* ignore */
  }
}

function bumpStreak(wallet, type) {
  const day = todayKey();
  let streak = wallet.streak || 0;
  if (type === "daily_login" || type === "streak_bonus") {
    if (wallet.lastStreakDate === day) return { ...wallet, streak };
    const y = new Date(wallet.lastStreakDate || day);
    const t = new Date(day);
    const diff = (t - y) / 86400000;
    if (!wallet.lastStreakDate || diff > 2) streak = 1;
    else if (diff === 1) streak += 1;
    else streak = 1;
    return { ...wallet, streak, lastStreakDate: day };
  }
  return wallet;
}

function rarityFromAmount(amount) {
  if (amount >= 400) return "LEGENDARY";
  if (amount >= 200) return "EPIC";
  if (amount >= 90) return "RARE";
  if (amount >= 35) return "GOOD";
  return "NORMAL";
}

/**
 * Award Savvy (client UX). Does not replace server grants — call after API success when applicable.
 * @param {keyof typeof POINT_ACTION_DEFAULTS|string} type
 * @param {number} [amount]
 * @param {SavvyRarity} [rarity]
 * @param {{ x: number, y: number, el?: Element|null }} [origin] — start of flight path
 */
export function awardPoints(type, amount, rarity, origin) {
  const def = POINT_ACTION_DEFAULTS[type] || POINT_ACTION_DEFAULTS.generic;
  const amt = amount != null && Number.isFinite(Number(amount)) ? Math.round(Number(amount)) : def.amount;
  let rar = rarity || def.rarity;
  if (!rarity && amt !== def.amount) {
    rar = rarityFromAmount(amt);
  }

  let wallet = loadWallet();
  wallet = bumpStreak(wallet, type);
  wallet.lifetimeClientAwarded += amt;

  const dk = todayKey();
  if (wallet.biggestTodayKey !== dk) {
    wallet.biggestTodayKey = dk;
    wallet.biggestTodayAmount = amt;
  } else if (amt > wallet.biggestTodayAmount) {
    wallet.biggestTodayAmount = amt;
  }

  wallet.totalSavedEstimate += Math.round(amt * 1.8);
  wallet.projectedMonthlySavings = Math.round(wallet.totalSavedEstimate * 0.12 + wallet.lifetimeClientAwarded * 0.04);

  const entry = {
    id: `w-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    type: String(type),
    amount: amt,
    rarity: rar,
    ts: Date.now(),
  };
  wallet.recent = [entry, ...(wallet.recent || [])].slice(0, 20);

  saveWallet(wallet);

  const ox = origin?.x;
  const oy = origin?.y;
  try {
    window.dispatchEvent(
      new CustomEvent(WALLET_AWARD_EVENT, {
        detail: {
          type: String(type),
          amount: amt,
          rarity: rar,
          origin:
            ox != null && oy != null && Number.isFinite(ox) && Number.isFinite(oy)
              ? { x: ox, y: oy }
              : null,
          walletSnapshot: wallet,
          mirrorOnly: false,
        },
      })
    );
  } catch {
    /* ignore */
  }
}

/** Bridge legacy PointsRewardProvider → wallet visuals (no extra persistence). */
export function notifyWalletFromLegacyReward({ amount, source, origin }) {
  const amt = Math.max(1, Math.round(Number(amount) || 0));
  if (!amt) return;
  const rar = rarityFromAmount(amt);
  if (String(source) === "daily_login") {
    let w = loadWallet();
    w = bumpStreak(w, "daily_login");
    saveWallet(w);
  }
  try {
    window.dispatchEvent(
      new CustomEvent(WALLET_AWARD_EVENT, {
        detail: {
          type: String(source || "generic"),
          amount: amt,
          rarity: rar,
          origin:
            origin?.x != null && origin?.y != null ? { x: Number(origin.x), y: Number(origin.y) } : null,
          mirrorOnly: true,
        },
      })
    );
  } catch {
    /* ignore */
  }
}

export function getWalletSnapshot() {
  return loadWallet();
}

export { setSoundMuted, isSoundMuted } from "./savvyWalletSound";

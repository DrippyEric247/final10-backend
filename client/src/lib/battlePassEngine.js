import {
  BATTLE_PASS_CUMULATIVE_XP,
  BATTLE_PASS_SEASON,
  BATTLE_PASS_TIERS,
  BATTLE_PASS_XP,
  BP_COSMETIC_KEY,
  BP_POWER_LINT_KEY,
  BP_PREMIUM_KEY_PREFIX,
  BP_STORAGE_KEY,
  BP_TIER_COMPLETE_EVENT,
  BP_UPDATE_EVENT,
} from "./battlePassConfig";
import { notifyUniversalProgressRefresh } from "./universalBoostProgress";
import { trackPointsEarned } from "./analytics";

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}

function localYmd(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const BP_DAILY_LOGIN_XP_KEY = "f10_bp_last_daily_login_xp_day";

/** One battle-pass daily_login XP grant per local calendar day. */
function tryConsumeDailyLoginBpSlot() {
  const today = localYmd();
  try {
    if (localStorage.getItem(BP_DAILY_LOGIN_XP_KEY) === today) return false;
    localStorage.setItem(BP_DAILY_LOGIN_XP_KEY, today);
    return true;
  } catch {
    return true;
  }
}

function safeJson(key, fallback) {
  try {
    const v = JSON.parse(localStorage.getItem(key) || "null");
    return v ?? fallback;
  } catch {
    return fallback;
  }
}

function defaultState() {
  return {
    seasonId: BATTLE_PASS_SEASON.id,
    xp: 0,
    appliedFree: [],
    appliedPremium: [],
  };
}

function loadState() {
  const raw = safeJson(BP_STORAGE_KEY, null);
  if (!raw || raw.seasonId !== BATTLE_PASS_SEASON.id) {
    return defaultState();
  }
  return {
    ...defaultState(),
    ...raw,
    appliedFree: Array.isArray(raw.appliedFree) ? raw.appliedFree : [],
    appliedPremium: Array.isArray(raw.appliedPremium) ? raw.appliedPremium : [],
  };
}

function saveState(s) {
  try {
    localStorage.setItem(BP_STORAGE_KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

export function isBattlePassPremiumUnlocked() {
  try {
    if (typeof process !== "undefined" && process.env.NODE_ENV === "production") {
      // Guest "demo premium" is dev-only; never treat localStorage as premium without a session.
      if (!localStorage.getItem("f10_token")) return false;
    }
    return localStorage.getItem(`${BP_PREMIUM_KEY_PREFIX}${BATTLE_PASS_SEASON.id}`) === "1";
  } catch {
    return false;
  }
}

function bump() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(BP_UPDATE_EVENT));
  }
}

function addCosmeticUnlock(id) {
  const cur = safeJson(BP_COSMETIC_KEY, []);
  const arr = Array.isArray(cur) ? [...cur] : [];
  if (!arr.includes(id)) arr.push(id);
  try {
    localStorage.setItem(BP_COSMETIC_KEY, JSON.stringify(arr));
  } catch {
    /* ignore */
  }
}

function addPowerLint(delta) {
  const cur = Number(localStorage.getItem(BP_POWER_LINT_KEY)) || 0;
  const next = clamp(cur + delta, 0, 0.12);
  try {
    localStorage.setItem(BP_POWER_LINT_KEY, String(next));
  } catch {
    /* ignore */
  }
}

function applyReward(reward) {
  if (!reward) return;
  switch (reward.type) {
    case "points":
      try {
        window.dispatchEvent(new CustomEvent("f10:savvy-auth-refresh-request"));
      } catch {
        /* ignore */
      }
      break;
    case "emblem":
    case "card":
      if (reward.id) addCosmeticUnlock(reward.id);
      break;
    case "boost":
      addPowerLint(Number(reward.value) || 0);
      break;
    case "bp_xp":
      break;
    default:
      break;
  }
}

/**
 * Apply all tiers eligible at current XP; chain bp_xp rewards. Emits one event for last grant this pass.
 */
function applyPendingTiers(state) {
  const premium = isBattlePassPremiumUnlocked();
  let lastEvent = null;
  let guard = 0;
  while (guard < 32) {
    guard += 1;
    let progressed = false;
    const xp = state.xp;

    for (let i = 0; i < BATTLE_PASS_TIERS.length; i++) {
      const need = BATTLE_PASS_CUMULATIVE_XP[i];
      if (xp < need) continue;
      const tier = BATTLE_PASS_TIERS[i];
      const lv = tier.level;

      if (!state.appliedFree.includes(lv)) {
        const r = tier.free;
        if (r?.type === "bp_xp") {
          state.xp += Number(r.value) || 0;
        } else {
          applyReward(r);
        }
        state.appliedFree.push(lv);
        state.appliedFree.sort((a, b) => a - b);
        lastEvent = { level: lv, track: "free", reward: r };
        progressed = true;
        break;
      }
    }
    if (progressed) continue;

    for (let i = 0; i < BATTLE_PASS_TIERS.length; i++) {
      const need = BATTLE_PASS_CUMULATIVE_XP[i];
      if (state.xp < need) continue;
      const tier = BATTLE_PASS_TIERS[i];
      const lv = tier.level;
      if (premium && !state.appliedPremium.includes(lv)) {
        const r = tier.premium;
        if (r?.type === "bp_xp") {
          state.xp += Number(r.value) || 0;
        } else {
          applyReward(r);
        }
        state.appliedPremium.push(lv);
        state.appliedPremium.sort((a, b) => a - b);
        lastEvent = { level: lv, track: "premium", reward: r };
        progressed = true;
        break;
      }
    }

    if (!progressed) break;
  }

  if (lastEvent && typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent(BP_TIER_COMPLETE_EVENT, { detail: lastEvent })
    );
  }
  return lastEvent;
}

export function unlockBattlePassPremium() {
  if (typeof process !== "undefined" && process.env.NODE_ENV === "production") {
    return;
  }
  try {
    localStorage.setItem(`${BP_PREMIUM_KEY_PREFIX}${BATTLE_PASS_SEASON.id}`, "1");
  } catch {
    /* ignore */
  }
  const state = loadState();
  applyPendingTiers(state);
  saveState(state);
  notifyUniversalProgressRefresh();
  bump();
}

/**
 * @param {keyof typeof BATTLE_PASS_XP} source
 * @param {number} [overrideAmount]
 */
export function recordBattlePassXp(source, overrideAmount) {
  if (typeof window === "undefined") return null;
  if (source === "daily_login" && !tryConsumeDailyLoginBpSlot()) return null;
  const amt =
    overrideAmount != null && Number.isFinite(overrideAmount)
      ? overrideAmount
      : BATTLE_PASS_XP[source];
  if (!Number.isFinite(amt) || amt <= 0) return null;

  const state = loadState();
  state.xp = (state.xp || 0) + amt;

  applyPendingTiers(state);

  saveState(state);
  notifyUniversalProgressRefresh();
  bump();
  return state;
}

const BP_MISSION_SAVVY_KEY = "f10_bp_mission_savvy_lifetime";

/**
 * Grant rewards from themed battle pass missions (XP, savvy bank, power lint, cosmetics).
 * @param {{ xp?: number, savvyPoints?: number, powerLintDelta?: number, cosmeticId?: string }} payload
 */
export function grantBpMissionRewards(payload) {
  if (typeof window === "undefined") return;
  const xp = Math.max(0, Number(payload?.xp) || 0);
  const savvy = Math.max(0, Number(payload?.savvyPoints) || 0);
  const lint = Math.max(0, Number(payload?.powerLintDelta) || 0);
  const cosmeticId = payload?.cosmeticId;

  if (xp > 0) {
    recordBattlePassXp("bp_season_task", xp);
  }
  if (savvy > 0) {
    try {
      const cur = Number(localStorage.getItem(BP_MISSION_SAVVY_KEY)) || 0;
      localStorage.setItem(BP_MISSION_SAVVY_KEY, String(cur + savvy));
    } catch {
      /* ignore */
    }
    trackPointsEarned(savvy, "battle_pass_mission", {
      xpGranted: xp > 0 ? xp : undefined,
      cosmeticId: cosmeticId || undefined,
    });
  }
  if (lint > 0) {
    addPowerLint(lint);
  }
  if (cosmeticId) {
    addCosmeticUnlock(cosmeticId);
  }

  if (savvy > 0 || lint > 0 || cosmeticId) {
    notifyUniversalProgressRefresh();
    bump();
  }
}

export function getBattlePassMaxXp() {
  const last = BATTLE_PASS_CUMULATIVE_XP[BATTLE_PASS_CUMULATIVE_XP.length - 1];
  return last || 1;
}

/** Tier index 0..n-1 currently working on (not yet completed next threshold) */
export function getBattlePassProgress() {
  const state = loadState();
  const xp = state.xp;
  const maxXp = getBattlePassMaxXp();
  let completedCount = 0;
  for (let i = 0; i < BATTLE_PASS_CUMULATIVE_XP.length; i++) {
    if (xp >= BATTLE_PASS_CUMULATIVE_XP[i]) completedCount = i + 1;
  }
  completedCount = Math.min(completedCount, BATTLE_PASS_TIERS.length);

  const prevThreshold =
    completedCount === 0 ? 0 : BATTLE_PASS_CUMULATIVE_XP[completedCount - 1];
  const nextThreshold =
    completedCount >= BATTLE_PASS_CUMULATIVE_XP.length
      ? maxXp
      : BATTLE_PASS_CUMULATIVE_XP[completedCount];

  const span = Math.max(1, nextThreshold - prevThreshold);
  const inSpan = clamp(xp - prevThreshold, 0, span);
  const barPct =
    completedCount >= BATTLE_PASS_TIERS.length
      ? 100
      : Math.round((inSpan / span) * 100);

  return {
    xp,
    maxXp,
    completedCount,
    prevThreshold,
    nextThreshold,
    barPct,
    premium: isBattlePassPremiumUnlocked(),
    appliedFree: new Set(state.appliedFree),
    appliedPremium: new Set(state.appliedPremium),
  };
}

export function getTierStatus(level) {
  const state = loadState();
  const xp = state.xp;
  const idx = BATTLE_PASS_TIERS.findIndex((t) => t.level === level);
  if (idx < 0) return "locked";
  const need = BATTLE_PASS_CUMULATIVE_XP[idx];
  const completed = xp >= need;
  const prevNeed = idx === 0 ? 0 : BATTLE_PASS_CUMULATIVE_XP[idx - 1];
  const active = !completed && xp >= prevNeed;
  if (completed) return "completed";
  if (active) return "active";
  return "locked";
}

/**
 * Writes battle pass track state from server (source of truth) into localStorage
 * so existing UI helpers (`getBattlePassProgress`, tier strip) stay in sync after refresh.
 * @param {{ seasonId?: string, xp?: number, claimedRewardIds?: string[], premiumUnlocked?: boolean }} bpSlice
 */
export function hydrateBattlePassFromServer(bpSlice) {
  if (typeof window === "undefined") return;
  const appliedFree = [];
  const appliedPremium = [];
  for (const id of bpSlice?.claimedRewardIds || []) {
    const m = typeof id === "string" && id.match(/^tier:(free|premium):(\d+)$/);
    if (m) {
      const lv = Number(m[2]);
      if (m[1] === "free") appliedFree.push(lv);
      else appliedPremium.push(lv);
    }
  }
  appliedFree.sort((a, b) => a - b);
  appliedPremium.sort((a, b) => a - b);
  const raw = {
    seasonId: bpSlice?.seasonId || BATTLE_PASS_SEASON.id,
    xp: bpSlice?.xp ?? 0,
    appliedFree,
    appliedPremium,
  };
  saveState(raw);
  try {
    if (bpSlice?.premiumUnlocked) {
      localStorage.setItem(`${BP_PREMIUM_KEY_PREFIX}${BATTLE_PASS_SEASON.id}`, "1");
    }
  } catch {
    /* ignore */
  }
  bump();
}

/** Mirror server cosmetic inventory into the key used by `bpCosmeticUnlocked` / Customize. */
export function hydrateCosmeticUnlocksFromServer(unlockedItemIds) {
  if (typeof window === "undefined") return;
  const arr = Array.isArray(unlockedItemIds) ? unlockedItemIds : [];
  try {
    localStorage.setItem(BP_COSMETIC_KEY, JSON.stringify(arr));
  } catch {
    /* ignore */
  }
}

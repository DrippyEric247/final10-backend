/**
 * Savvy Scout Missions — contextual earning opportunities discovered while using the app.
 * Tagline: Savvy Scout discovers Savvy Point earning opportunities while you use the Savvy Universe.
 */

import { claimScoutMissionReward as apiClaimScoutMissionReward, getScoutMissionProgress, recordScoutMissionAction as apiRecordScoutMissionAction } from "./api";
import { notifyWalletFromLegacyReward } from "./pointsEngine";
import {
  SCOUT_MISSION_ACTION_EVENT,
  SCOUT_MISSION_POPUP_EVENT,
  SCOUT_MISSION_SYNC_EVENT,
} from "@savvy/core/events/universeEvents";

export {
  SCOUT_MISSION_SYNC_EVENT,
  SCOUT_MISSION_POPUP_EVENT,
  SCOUT_MISSION_ACTION_EVENT,
};

const STORAGE_KEY = "f10_scout_missions_v1";
const POPUP_COOLDOWN_MS = 45_000;
let claimInFlight = false;

/** @typedef {'daily'|'weekly'|'seasonal'|'one_time'} MissionCadence */

/**
 * @typedef {object} ScoutMissionDef
 * @property {string} id
 * @property {string} title
 * @property {string} description
 * @property {number} rewardSavvy
 * @property {MissionCadence} cadence
 * @property {string[]} contexts Route/surface keys
 * @property {string} trigger Action id that advances progress
 * @property {number} [target]
 * @property {string} [popup] Contextual popup copy
 * @property {string} [scoutLine] Scout personality line
 * @property {string} [ctaPath] In-app deep link
 * @property {boolean} [once] Only completable once ever
 */

/** @type {ReadonlyArray<ScoutMissionDef>} */
export const SCOUT_MISSION_CATALOG = Object.freeze([
  {
    id: "save_deal",
    title: "Save this deal",
    description: "Add a listing to your watchlist while hunting.",
    rewardSavvy: 10,
    cadence: "daily",
    contexts: ["best_move", "quick_snipes", "auctions"],
    trigger: "save_deal",
    target: 1,
    popup: "🎯 Nice find! Save this deal and earn +10 Savvy.",
    scoutLine: "I found an opportunity for extra Savvy.",
    ctaPath: "/auctions",
  },
  {
    id: "add_watchlist",
    title: "Watch a deal",
    description: "Track a listing so Savvy Scout can monitor it.",
    rewardSavvy: 5,
    cadence: "daily",
    contexts: ["best_move", "quick_snipes", "auctions"],
    trigger: "add_watchlist",
    target: 1,
    popup: "👀 Add to watchlist for +5 Savvy.",
    scoutLine: "Want bonus Savvy? I found a mission for you.",
  },
  {
    id: "share_deal",
    title: "Share a deal",
    description: "Share a strong find with the community.",
    rewardSavvy: 15,
    cadence: "weekly",
    contexts: ["best_move", "quick_snipes", "community"],
    trigger: "share_deal",
    target: 1,
    popup: "📣 Share this deal for +15 Savvy.",
    scoutLine: "Nice move. Here's another way to earn.",
  },
  {
    id: "first_alert",
    title: "Create your first alert",
    description: "Let Savvy Scout watch the market for you.",
    rewardSavvy: 25,
    cadence: "one_time",
    contexts: ["quick_snipes", "alerts"],
    trigger: "create_alert",
    target: 1,
    once: true,
    popup: "⚡ Create your first Quick Snipe alert for +25 Savvy.",
    scoutLine: "You're close to a reward.",
    ctaPath: "/alerts",
  },
  {
    id: "three_alerts",
    title: "Create 3 alerts",
    description: "Build a small alert stack for your hunts.",
    rewardSavvy: 50,
    cadence: "weekly",
    contexts: ["quick_snipes", "alerts"],
    trigger: "create_alert",
    target: 3,
    popup: "🔔 Stack 3 alerts this week for +50 Savvy.",
    scoutLine: "I found an opportunity for extra Savvy.",
    ctaPath: "/alerts",
  },
  {
    id: "travel_profile",
    title: "Complete travel profile",
    description: "Set up SavvyTrip so Scout can personalize travel wins.",
    rewardSavvy: 50,
    cadence: "one_time",
    contexts: ["savvy_trip"],
    trigger: "travel_profile_complete",
    target: 1,
    once: true,
    scoutLine: "Want bonus Savvy? Complete your travel profile.",
    ctaPath: "/business-offers",
  },
  {
    id: "save_destination",
    title: "Save a destination",
    description: "Bookmark a destination in SavvyTrip.",
    rewardSavvy: 15,
    cadence: "weekly",
    contexts: ["savvy_trip"],
    trigger: "save_destination",
    target: 1,
    scoutLine: "Nice move. Save a destination for bonus Savvy.",
  },
  {
    id: "first_listing",
    title: "Create first listing",
    description: "Publish your first seller listing.",
    rewardSavvy: 100,
    cadence: "one_time",
    contexts: ["seller"],
    trigger: "create_listing",
    target: 1,
    once: true,
    popup: "🏷️ List your first item for +100 Savvy.",
    scoutLine: "Seller mission unlocked — big Savvy ahead.",
    ctaPath: "/create-auction",
  },
  {
    id: "seller_profile",
    title: "Complete seller profile",
    description: "Finish seller setup so buyers trust your lane.",
    rewardSavvy: 50,
    cadence: "one_time",
    contexts: ["seller"],
    trigger: "seller_profile_complete",
    target: 1,
    once: true,
    ctaPath: "/seller-dashboard",
  },
  {
    id: "earn_100_today",
    title: "Earn 100 Savvy today",
    description: "Hit 100 Savvy earned in one day.",
    rewardSavvy: 25,
    cadence: "daily",
    contexts: ["battle_pass", "profile"],
    trigger: "savvy_earned_today",
    target: 100,
    popup: "🏆 Earn 100 Savvy today for a +25 bonus.",
    scoutLine: "You're close to a reward.",
    ctaPath: "/battle-pass",
  },
  {
    id: "battle_pass_tier",
    title: "Reach next Battle Pass tier",
    description: "Level up your Battle Pass tier.",
    rewardSavvy: 50,
    cadence: "seasonal",
    contexts: ["battle_pass"],
    trigger: "battle_pass_tier_up",
    target: 1,
    popup: "🏆 You're only steps away from your next Battle Pass tier.",
    scoutLine: "You're close to a reward.",
    ctaPath: "/battle-pass",
  },
  {
    id: "post_savvy_win",
    title: "Post a Savvy Win",
    description: "Share a win with the community.",
    rewardSavvy: 100,
    cadence: "weekly",
    contexts: ["community"],
    trigger: "post_win",
    target: 1,
    popup: "🏆 Post a Savvy Win for +100 Savvy.",
    scoutLine: "Community missions pay big — I found one for you.",
    ctaPath: "/win-feed",
  },
  {
    id: "share_savvywin_proof",
    title: "Share #SavvyWin proof",
    description: "Share purchase proof with #SavvyWin.",
    rewardSavvy: 250,
    cadence: "seasonal",
    contexts: ["community"],
    trigger: "share_win_proof",
    target: 1,
    popup: "💰 Share this win with #SavvyWin and earn bonus Savvy.",
    scoutLine: "Legendary community mission — worth the share.",
    ctaPath: "/win-feed",
  },
  {
    id: "scan_deal",
    title: "Run the scanner",
    description: "Scan a video or listing once.",
    rewardSavvy: 15,
    cadence: "daily",
    contexts: ["scanner"],
    trigger: "scan_complete",
    target: 1,
    ctaPath: "/scanner",
  },
]);

const ROUTE_CONTEXT_MAP = [
  { prefix: "/local-deals", context: "quick_snipes" },
  { prefix: "/auctions", context: "auctions" },
  { prefix: "/auction/", context: "auctions" },
  { prefix: "/feed", context: "trending" },
  { prefix: "/trending", context: "trending" },
  { prefix: "/alerts", context: "alerts" },
  { prefix: "/seller-dashboard", context: "seller" },
  { prefix: "/create-auction", context: "seller" },
  { prefix: "/battle-pass", context: "battle_pass" },
  { prefix: "/win-feed", context: "community" },
  { prefix: "/scanner", context: "scanner" },
  { prefix: "/profile", context: "profile" },
  { prefix: "/onboarding/best-move", context: "best_move" },
];

function utcDayKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function todayKey() {
  return utcDayKey();
}

function weekKey() {
  const d = new Date();
  const onejan = new Date(d.getFullYear(), 0, 1);
  const week = Math.ceil(((d - onejan) / 86400000 + onejan.getDay() + 1) / 7);
  return `${d.getFullYear()}-W${week}`;
}

function defaultState() {
  return {
    v: 1,
    progress: {},
    completed: {},
    claimed: {},
    onceDone: {},
    serverRows: {},
    savvyEarnedToday: 0,
    savvyEarnedDay: todayKey(),
    lastPopupAt: 0,
    alertCountWeek: 0,
    alertWeekKey: weekKey(),
  };
}

function loadState() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if (!raw || typeof raw !== "object") return defaultState();
    return { ...defaultState(), ...raw };
  } catch {
    return defaultState();
  }
}

function saveState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
}

export function dispatchScoutMissionSync() {
  try {
    window.dispatchEvent(new Event(SCOUT_MISSION_SYNC_EVENT));
  } catch {
    /* ignore */
  }
}

function missionDef(id) {
  return SCOUT_MISSION_CATALOG.find((m) => m.id === id) || null;
}

function cadenceKey(cadence) {
  if (cadence === "daily") return todayKey();
  if (cadence === "weekly") return weekKey();
  if (cadence === "seasonal") return `season-${new Date().getFullYear()}`;
  return "once";
}

function progressKey(mission) {
  return `${mission.id}:${cadenceKey(mission.cadence)}`;
}

function isClaimed(state, mission) {
  if (mission.once && state.onceDone[mission.id]) return true;
  const key = progressKey(mission);
  return Boolean(state.claimed[key]);
}

function getProgress(state, mission) {
  if (mission.once && state.onceDone[mission.id]) return mission.target || 1;
  const key = progressKey(mission);
  return Number(state.progress[key]) || 0;
}

function isComplete(state, mission) {
  const target = mission.target || 1;
  return getProgress(state, mission) >= target;
}

function getServerRow(state, mission) {
  const periodKey = cadenceKey(mission.cadence);
  return state.serverRows?.[`${mission.id}:${periodKey}`] || null;
}

function isServerComplete(state, mission) {
  const row = getServerRow(state, mission);
  if (!row) return false;
  return Boolean(row.complete || row.claimed);
}

function isServerClaimable(state, mission) {
  const row = getServerRow(state, mission);
  if (!row) return false;
  return Boolean(row.complete && !row.claimed);
}

export function resolveContextFromPath(pathname = "") {
  const path = String(pathname || "");
  for (const row of ROUTE_CONTEXT_MAP) {
    if (path.startsWith(row.prefix)) return row.context;
  }
  return "general";
}

export function getScoutMissionSnapshot(pathname = "") {
  const state = loadState();
  const context = resolveContextFromPath(pathname);
  const today = todayKey();

  if (state.savvyEarnedDay !== today) {
    state.savvyEarnedToday = 0;
    state.savvyEarnedDay = today;
    saveState(state);
  }

  const missions = SCOUT_MISSION_CATALOG.map((def) => {
    const progress = getProgress(state, def);
    const target = def.target || 1;
    const complete = isComplete(state, def);
    const claimed = isClaimed(state, def);
    const serverRow = getServerRow(state, def);
    const serverComplete = isServerComplete(state, def);
    const contextual = def.contexts.includes(context) || def.contexts.includes("general");
    return {
      ...def,
      progress,
      target,
      complete: complete || serverComplete,
      claimed: claimed || Boolean(serverRow?.claimed),
      claimable: isServerClaimable(state, def) && !isClaimed(state, def),
      serverComplete,
      serverPending: complete && !serverComplete && !claimed,
      contextual,
      progressPct: Math.min(100, Math.round((progress / target) * 100)),
    };
  });

  const active = missions.filter((m) => !m.claimed && (!m.complete || m.claimable));
  const contextualActive = active.filter((m) => m.contextual);
  const claimable = missions.filter((m) => m.claimable);

  return {
    context,
    tagline: "Savvy Scout discovers Savvy Point earning opportunities while you use the Savvy Universe.",
    missions,
    active,
    contextualActive,
    claimable,
    claimableCount: claimable.length,
    shouldGlow: claimable.length > 0 || contextualActive.some((m) => !m.complete),
  };
}

function maybeEmitPopup(mission, meta = {}) {
  const state = loadState();
  const now = Date.now();
  if (!mission.popup) return;
  if (now - (state.lastPopupAt || 0) < POPUP_COOLDOWN_MS) return;
  state.lastPopupAt = now;
  saveState(state);
  try {
    window.dispatchEvent(
      new CustomEvent(SCOUT_MISSION_POPUP_EVENT, {
        detail: {
          missionId: mission.id,
          title: mission.title,
          message: mission.popup,
          scoutLine: mission.scoutLine || "I found an opportunity for extra Savvy.",
          rewardSavvy: mission.rewardSavvy,
          ctaPath: mission.ctaPath || null,
          ...meta,
        },
      })
    );
  } catch {
    /* ignore */
  }
}

/**
 * Record a user action and advance matching missions.
 * @param {string} trigger
 * @param {{ amount?: number, pathname?: string, silent?: boolean }} [meta]
 */
export function recordScoutMissionAction(trigger, meta = {}) {
  const state = loadState();
  const pathname = meta.pathname || (typeof window !== "undefined" ? window.location.pathname : "");
  const context = resolveContextFromPath(pathname);
  const increment = Math.max(1, Number(meta.amount) || 1);
  let changed = false;
  let popupMission = null;

  const today = todayKey();
  if (state.savvyEarnedDay !== today) {
    state.savvyEarnedToday = 0;
    state.savvyEarnedDay = today;
  }
  if (trigger === "savvy_earned") {
    state.savvyEarnedToday += increment;
    changed = true;
  }

  const week = weekKey();
  if (state.alertWeekKey !== week) {
    state.alertCountWeek = 0;
    state.alertWeekKey = week;
  }
  if (trigger === "create_alert") {
    state.alertCountWeek += 1;
  }

  for (const def of SCOUT_MISSION_CATALOG) {
    if (def.trigger !== trigger && !(trigger === "savvy_earned" && def.trigger === "savvy_earned_today")) {
      continue;
    }
    if (!def.contexts.includes(context) && !def.contexts.includes("general")) {
      continue;
    }
    if (def.once && state.onceDone[def.id]) continue;
    if (isClaimed(state, def)) continue;

    const key = progressKey(def);
    const target = def.target || 1;
    let next = getProgress(state, def);

    if (def.trigger === "savvy_earned_today") {
      next = state.savvyEarnedToday;
    } else if (def.trigger === "create_alert" && def.id === "three_alerts") {
      next = state.alertCountWeek;
    } else {
      next = Math.min(target, next + increment);
    }

    if (next !== getProgress(state, def)) {
      state.progress[key] = next;
      changed = true;
      if (next >= target && !popupMission) {
        popupMission = def;
      }
    }
  }

  if (changed) {
    saveState(state);
    dispatchScoutMissionSync();
    if (popupMission && !meta.silent) {
      maybeEmitPopup(popupMission, { context });
    }
    if (process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.info("[ScoutMissions] action", { trigger, context, increment });
    }
    void syncMissionActionToServer(trigger, increment);
  }

  try {
    window.dispatchEvent(
      new CustomEvent(SCOUT_MISSION_ACTION_EVENT, { detail: { trigger, context, meta } })
    );
  } catch {
    /* ignore */
  }
}

function markMissionClaimedLocally(state, def) {
  const key = progressKey(def);
  state.claimed[key] = Date.now();
  if (def.once) state.onceDone[def.id] = Date.now();
  const periodKey = cadenceKey(def.cadence);
  const serverKey = `${def.id}:${periodKey}`;
  state.serverRows = state.serverRows || {};
  state.serverRows[serverKey] = {
    ...(state.serverRows[serverKey] || {}),
    complete: true,
    claimed: true,
    periodKey,
  };
  saveState(state);
  dispatchScoutMissionSync();
}

async function syncMissionActionToServer(trigger, increment = 1) {
  const serverOnly = new Set([
    'create_alert',
    'add_watchlist',
    'save_deal',
    'savvy_earned_today',
    'battle_pass_tier_up',
    'scan_complete',
  ]);
  if (serverOnly.has(String(trigger || '').trim())) return;
  try {
    await apiRecordScoutMissionAction({ trigger, increment });
    await syncScoutMissionProgressFromServer();
  } catch {
    /* offline or unauthenticated */
  }
}

function applyServerProgressRows(state, rows) {
  let changed = false;
  state.serverRows = state.serverRows || {};

  for (const row of rows) {
    const def = missionDef(row.missionId);
    if (!def) continue;

    const serverKey = `${row.missionId}:${row.periodKey}`;
    state.serverRows[serverKey] = {
      progress: Math.max(0, Number(row.progress) || 0),
      complete: Boolean(row.complete),
      claimed: Boolean(row.claimed || row.claimedAt),
      periodKey: row.periodKey,
    };

    const currentPeriod = cadenceKey(def.cadence);
    if (row.periodKey !== currentPeriod) continue;

    const key = progressKey(def);
    const target = def.target || 1;
    const serverProgress = Math.max(0, Number(row.progress) || 0);

    if (row.complete || serverProgress >= target) {
      const local = getProgress(state, def);
      const next = Math.min(target, serverProgress);
      if (next !== local) {
        state.progress[key] = next;
        changed = true;
      }
    } else {
      const local = getProgress(state, def);
      if (local !== serverProgress) {
        state.progress[key] = serverProgress;
        changed = true;
      }
    }

    if (row.claimed || row.claimedAt) {
      if (!state.claimed[key]) {
        state.claimed[key] = Date.now();
        changed = true;
      }
      if (def.once && !state.onceDone[def.id]) {
        state.onceDone[def.id] = Date.now();
        changed = true;
      }
    }
  }

  return changed;
}

export async function reconcileMissionAfterFailedClaim(missionId) {
  await syncScoutMissionProgressFromServer();
  const def = missionDef(missionId);
  if (!def) return;
  const state = loadState();
  if (!isServerComplete(state, def)) {
    const key = progressKey(def);
    const row = getServerRow(state, def);
    const target = def.target || 1;
    const serverProgress = Math.min(target, Math.max(0, Number(row?.progress) || 0));
    if (serverProgress !== getProgress(state, def)) {
      state.progress[key] = serverProgress;
      saveState(state);
      dispatchScoutMissionSync();
    }
  }
}

/**
 * Merge server-authoritative progress + claim state (survives logout/refresh).
 */
export async function syncScoutMissionProgressFromServer() {
  try {
    const data = await getScoutMissionProgress();
    const rows = Array.isArray(data?.progress) ? data.progress : [];
    const state = loadState();
    const changed = applyServerProgressRows(state, rows);

    if (changed || rows.length) {
      saveState(state);
      dispatchScoutMissionSync();
    }
  } catch {
    /* offline or unauthenticated */
  }
}

/** @returns {Promise<{ ok: boolean, rewardSavvy?: number, newBalance?: number, message?: string }>} */
export async function claimScoutMission(missionId) {
  if (claimInFlight) {
    return { ok: false, message: "Claim already in progress." };
  }

  const def = missionDef(missionId);
  if (!def) return { ok: false, message: "Mission not found." };

  const state = loadState();
  if (isClaimed(state, def) || getServerRow(state, def)?.claimed) {
    markMissionClaimedLocally(state, def);
    return { ok: false, message: "Already claimed." };
  }

  if (!isServerClaimable(state, def)) {
    await reconcileMissionAfterFailedClaim(def.id);
    return {
      ok: false,
      message: "Complete this mission before claiming.",
      code: "mission_not_complete",
    };
  }

  const periodKey = progressKey(def);
  claimInFlight = true;

  try {
    const data = await apiClaimScoutMissionReward({ missionId: def.id, periodKey });

    if (data?.alreadyClaimed || data?.duplicate) {
      markMissionClaimedLocally(state, def);
      return { ok: false, message: "Already claimed." };
    }

    if (!data?.granted && !data?.added) {
      return { ok: false, message: data?.message || "Could not claim reward." };
    }

    markMissionClaimedLocally(state, def);

    const reward = Math.max(1, Number(data.added ?? data.rewardSavvy ?? def.rewardSavvy) || 0);
    const newBalance = data.newBalance != null ? Math.round(Number(data.newBalance)) : undefined;

    notifyWalletFromLegacyReward({
      amount: reward,
      source: `scout_mission_${def.id}`,
    });

    if (process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.info("[ScoutMissions] claimed", { missionId, reward, newBalance });
    }

    return {
      ok: true,
      rewardSavvy: reward,
      newBalance,
      message: `+${reward} Savvy added to your wallet`,
    };
  } catch (err) {
    const status = err?.response?.status;
    const body = err?.response?.data;
    if (status === 409 || body?.alreadyClaimed) {
      markMissionClaimedLocally(loadState(), def);
      return { ok: false, message: "Already claimed." };
    }
    if (status === 403 || body?.error === "mission_not_complete") {
      await reconcileMissionAfterFailedClaim(def.id);
      return {
        ok: false,
        message: body?.message || "Complete this mission before claiming.",
        code: "mission_not_complete",
      };
    }
    if (status === 401) {
      return { ok: false, message: "Log in to claim Savvy rewards." };
    }
    return {
      ok: false,
      message: body?.message || err?.message || "Could not claim reward. Try again.",
    };
  } finally {
    claimInFlight = false;
  }
}

/** Proactively surface a contextual mission popup on route change (respects cooldown). */
export function surfaceContextualMissionPopup(pathname = "") {
  const snapshot = getScoutMissionSnapshot(pathname);
  const pick = snapshot.contextualActive.find((m) => !m.complete && (m.popup || m.scoutLine));
  if (!pick) return;

  const state = loadState();
  const now = Date.now();
  if (now - (state.lastPopupAt || 0) < POPUP_COOLDOWN_MS) return;
  state.lastPopupAt = now;
  saveState(state);

  try {
    window.dispatchEvent(
      new CustomEvent(SCOUT_MISSION_POPUP_EVENT, {
        detail: {
          missionId: pick.id,
          title: pick.title,
          message: pick.popup || `Want bonus Savvy? ${pick.title}`,
          scoutLine: pick.scoutLine || "I found an opportunity for extra Savvy.",
          rewardSavvy: pick.rewardSavvy,
          ctaPath: pick.ctaPath || null,
          context: snapshot.context,
        },
      })
    );
  } catch {
    /* ignore */
  }
}

export function resetScoutMissionsForDev() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
  dispatchScoutMissionSync();
}

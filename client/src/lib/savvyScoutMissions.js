/**
 * Savvy Scout Missions — contextual earning opportunities discovered while using the app.
 * Tagline: Savvy Scout discovers Savvy Point earning opportunities while you use the Savvy Universe.
 */

import { notifyWalletFromLegacyReward } from "./pointsEngine";

export const SCOUT_MISSION_SYNC_EVENT = "f10:scout-mission-sync";
export const SCOUT_MISSION_POPUP_EVENT = "f10:scout-mission-popup";
export const SCOUT_MISSION_ACTION_EVENT = "f10:scout-mission-action";

const STORAGE_KEY = "f10_scout_missions_v1";
const POPUP_COOLDOWN_MS = 45_000;

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

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
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
    const contextual = def.contexts.includes(context) || def.contexts.includes("general");
    return {
      ...def,
      progress,
      target,
      complete,
      claimed,
      claimable: complete && !claimed,
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
  }

  try {
    window.dispatchEvent(
      new CustomEvent(SCOUT_MISSION_ACTION_EVENT, { detail: { trigger, context, meta } })
    );
  } catch {
    /* ignore */
  }
}

/** @returns {{ ok: boolean, rewardSavvy?: number, message?: string }} */
export function claimScoutMission(missionId) {
  const def = missionDef(missionId);
  if (!def) return { ok: false, message: "Mission not found." };

  const state = loadState();
  if (!isComplete(state, def)) return { ok: false, message: "Mission not complete yet." };
  if (isClaimed(state, def)) return { ok: false, message: "Already claimed." };

  const key = progressKey(def);
  state.claimed[key] = Date.now();
  if (def.once) state.onceDone[def.id] = Date.now();
  saveState(state);
  dispatchScoutMissionSync();

  const reward = Math.max(1, Number(def.rewardSavvy) || 0);
  notifyWalletFromLegacyReward({ amount: reward, source: `scout_mission_${def.id}` });

  if (process.env.NODE_ENV !== "production") {
    // eslint-disable-next-line no-console
    console.info("[ScoutMissions] claimed", { missionId, reward });
  }

  return { ok: true, rewardSavvy: reward, message: `+${reward} Savvy claimed!` };
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

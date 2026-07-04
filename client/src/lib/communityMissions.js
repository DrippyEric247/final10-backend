/**
 * Optional social missions for the Savvy Wins Community Hub.
 * Progress is stored client-side (daily/weekly cadence) with Savvy awarded on claim.
 */

import { awardPoints } from "./pointsEngine";
import { FINAL10_SOCIALS } from "../config/final10Socials";
import { makeReferralLink, getReferralUserId } from "./referrals";

const STORAGE_KEY = "f10_community_missions_v1";
const SYNC_EVENT = "f10-community-missions-updated";

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function weekKey() {
  const d = new Date();
  const jan1 = new Date(d.getFullYear(), 0, 1);
  const week = Math.ceil(((d - jan1) / 86400000 + jan1.getDay() + 1) / 7);
  return `${d.getFullYear()}-W${week}`;
}

function loadState() {
  if (typeof window === "undefined") return { completions: {}, claims: {} };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { completions: {}, claims: {} };
    const p = JSON.parse(raw);
    return {
      completions: typeof p.completions === "object" && p.completions ? p.completions : {},
      claims: typeof p.claims === "object" && p.claims ? p.claims : {},
    };
  } catch {
    return { completions: {}, claims: {} };
  }
}

function saveState(state) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    window.dispatchEvent(new CustomEvent(SYNC_EVENT));
  } catch {
    /* ignore */
  }
}

function periodKey(cadence) {
  return cadence === "weekly" ? weekKey() : todayKey();
}

/** @typedef {'daily'|'weekly'|'one_time'} MissionCadence */

/**
 * @typedef {object} CommunityMissionDef
 * @property {string} id
 * @property {string} title
 * @property {string} description
 * @property {string} scoutLine
 * @property {number} rewardSavvy
 * @property {MissionCadence} cadence
 * @property {string} [externalUrl]
 * @property {string} [actionLabel]
 * @property {'external'|'referral'|'in_app'} actionType
 * @property {string} [icon]
 */

/** @type {ReadonlyArray<CommunityMissionDef>} */
export const COMMUNITY_MISSION_CATALOG = Object.freeze([
  {
    id: "view_todays_story",
    title: "View today's story",
    description: "Open Final10's latest Instagram story.",
    scoutLine: "Quick win — peek today's story for bonus Savvy.",
    rewardSavvy: 15,
    cadence: "daily",
    externalUrl: FINAL10_SOCIALS.instagram.url,
    actionLabel: "Open Instagram",
    actionType: "external",
    icon: "📸",
  },
  {
    id: "like_todays_post",
    title: "Like today's post",
    description: "Show love on our latest social post.",
    scoutLine: "A like goes far — retailers notice engaged communities.",
    rewardSavvy: 10,
    cadence: "daily",
    externalUrl: FINAL10_SOCIALS.instagram.url,
    actionLabel: "Like on Instagram",
    actionType: "external",
    icon: "❤️",
  },
  {
    id: "watch_todays_video",
    title: "Watch today's video",
    description: "Catch the newest Final10 clip on TikTok.",
    scoutLine: "Today's video has a drop hint — worth a watch.",
    rewardSavvy: 20,
    cadence: "daily",
    externalUrl: FINAL10_SOCIALS.tiktok.url,
    actionLabel: "Watch on TikTok",
    actionType: "external",
    icon: "🎬",
  },
  {
    id: "share_final10_content",
    title: "Share Final10 content",
    description: "Repost or share a Final10 win, deal, or clip.",
    scoutLine: "Share the Savvy Universe — every share pulls in more deals.",
    rewardSavvy: 25,
    cadence: "weekly",
    externalUrl: FINAL10_SOCIALS.x.url,
    actionLabel: "Share on X",
    actionType: "external",
    icon: "📣",
  },
  {
    id: "refer_a_friend",
    title: "Refer a friend",
    description: "Invite someone to join Final10 with your link.",
    scoutLine: "Biggest community mission — referrals unlock retailer attention.",
    rewardSavvy: 100,
    cadence: "weekly",
    actionType: "referral",
    actionLabel: "Copy referral link",
    icon: "🤝",
  },
]);

function missionState(mission, state) {
  const period = periodKey(mission.cadence);
  const completed = Boolean(state.completions[`${mission.id}:${period}`]);
  const claimed = Boolean(state.claims[`${mission.id}:${period}`]);
  return { completed, claimed, period, claimable: completed && !claimed };
}

export function listCommunityMissions(user) {
  const state = loadState();
  const referralLink = user ? makeReferralLink(getReferralUserId(user)) : null;

  return COMMUNITY_MISSION_CATALOG.map((mission) => {
    const ms = missionState(mission, state);
    return {
      ...mission,
      ...ms,
      referralLink: mission.actionType === "referral" ? referralLink : undefined,
    };
  });
}

export function getCommunityMissionStats() {
  const missions = listCommunityMissions(null);
  const claimable = missions.filter((m) => m.claimable).length;
  const completedToday = missions.filter((m) => m.cadence === "daily" && m.completed).length;
  const totalDaily = missions.filter((m) => m.cadence === "daily").length;
  return { claimable, completedToday, totalDaily, total: missions.length };
}

/**
 * Mark a mission complete after the user performs the action (opens link, copies referral).
 */
export function completeCommunityMission(missionId) {
  const mission = COMMUNITY_MISSION_CATALOG.find((m) => m.id === missionId);
  if (!mission) return false;

  const state = loadState();
  const key = `${missionId}:${periodKey(mission.cadence)}`;
  if (state.completions[key]) return false;

  state.completions[key] = Date.now();
  saveState(state);
  return true;
}

/**
 * Claim Savvy for a completed mission in the current period.
 */
export function claimCommunityMission(missionId) {
  const mission = COMMUNITY_MISSION_CATALOG.find((m) => m.id === missionId);
  if (!mission) throw new Error("Unknown mission");

  const state = loadState();
  const key = `${missionId}:${periodKey(mission.cadence)}`;

  if (!state.completions[key]) throw new Error("Mission not completed yet");
  if (state.claims[key]) throw new Error("Already claimed");

  state.claims[key] = Date.now();
  saveState(state);

  awardPoints({
    action: "scout_mission",
    amount: mission.rewardSavvy,
    label: mission.title,
    rarity: mission.rewardSavvy >= 75 ? "EPIC" : mission.rewardSavvy >= 25 ? "GOOD" : "NORMAL",
  });

  return { missionId, amount: mission.rewardSavvy };
}

export function subscribeCommunityMissions(cb) {
  if (typeof window === "undefined") return () => {};
  const handler = () => cb();
  window.addEventListener(SYNC_EVENT, handler);
  return () => window.removeEventListener(SYNC_EVENT, handler);
}

export const COMMUNITY_MISSIONS_SYNC_EVENT = SYNC_EVENT;

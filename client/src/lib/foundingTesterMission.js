/** Founding Tester Program — mission checklist, ranks, and persistence (client). */

export const FOUNDING_TESTER_SYNC_EVENT = "f10:founding-tester-sync";

export const FOUNDING_TESTER_TASKS = [
  {
    id: "mission_onboarding",
    label: "Complete onboarding",
    description: "Finish the welcome flow so Savvy can personalize your hunt.",
    path: "/onboarding/preferences",
    auto: true,
  },
  {
    id: "mission_first_alert",
    label: "Create first alert",
    description: "Spin up one alert so Final10 can watch listings for you.",
    path: "/alerts",
    auto: true,
  },
  {
    id: "mission_scanner",
    label: "Run scanner",
    description: "Run the video scanner at least once on a clip or URL.",
    path: "/scanner",
    auto: true,
  },
  {
    id: "mission_save_item",
    label: "Save an item",
    description: "Watchlist an auction, stash an offer, or save a bundle.",
    path: "/auctions",
    auto: true,
  },
  {
    id: "mission_share_feedback",
    label: "Share feedback",
    description: "Tell us what feels great — and what needs polish.",
    path: null,
    auto: false,
  },
  {
    id: "mission_invite_friend",
    label: "Invite a friend",
    description: "Bring someone into the early crew with your invite link.",
    path: "/profile",
    auto: true,
  },
  {
    id: "mission_real_deal",
    label: "Win / find a real deal",
    description: "When you land something legit with Final10, check this off.",
    path: "/auctions",
    auto: false,
  },
];

export const FOUNDING_TESTER_TASK_COUNT = FOUNDING_TESTER_TASKS.length;

/** Milestone at 4/7 — +500 Savvy */
export const FOUNDING_TESTER_MILESTONE_HALF = 4;
/** Full program — +1000 Savvy, badge, title */
export const FOUNDING_TESTER_MILESTONE_FULL = FOUNDING_TESTER_TASK_COUNT;

export const FOUNDING_TESTER_REWARD_HALF_SAVVY = 500;
export const FOUNDING_TESTER_REWARD_FULL_SAVVY = 1000;

const KEYS = {
  STATE: "f10_founding_tester_mission_state_v2",
  BADGE: "f10_founding_tester_badge_v1",
  REFERRAL: "f10_founding_tester_referral_placeholder_v1",
  ALERT_CREATED: "f10_founding_tester_alert_created_v1",
};

export function dispatchFoundingTesterSync() {
  try {
    window.dispatchEvent(new Event(FOUNDING_TESTER_SYNC_EVENT));
  } catch {
    /* ignore */
  }
}

function readLsJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function safeArr(raw) {
  return Array.isArray(raw) ? raw : [];
}

/** Scanner used: any recorded scan session counts for the mission. */
export function hasScannerMissionSignal() {
  if (typeof window === "undefined") return false;
  try {
    if (localStorage.getItem("f10_video_scanner_used") === "true") return true;
    if (localStorage.getItem("f10_scan_complete") === "true") return true;
    const earn = readLsJson("f10_scan_earn_state", {});
    return Number(earn.scannedVideos) >= 1;
  } catch {
    return false;
  }
}

/** Saved item: watchlist, saved bundles, or saved Savvy offers */
export function hasSaveItemMissionSignal() {
  if (typeof window === "undefined") return false;
  try {
    const wl = safeArr(JSON.parse(localStorage.getItem("f10_watchlist_ids") || "[]"));
    const bundles = safeArr(JSON.parse(localStorage.getItem("f10_saved_bundles") || "[]"));
    const offers = safeArr(JSON.parse(localStorage.getItem("f10_savvy_offers_saved") || "[]"));
    return wl.length > 0 || bundles.length > 0 || offers.length > 0;
  } catch {
    return false;
  }
}

export function getExternalCompletedTaskIds() {
  const out = [];
  if (typeof window === "undefined") return out;
  try {
    if (localStorage.getItem("f10_onboarding_completed_v1") === "1") {
      out.push("mission_onboarding");
    }
    if (localStorage.getItem(KEYS.ALERT_CREATED) === "1") {
      out.push("mission_first_alert");
    }
    if (hasScannerMissionSignal()) {
      out.push("mission_scanner");
    }
    if (hasSaveItemMissionSignal()) {
      out.push("mission_save_item");
    }
    const ref = getReferralPlaceholder();
    if (ref.invitesSent >= 1 || ref.referralsJoined >= 1) {
      out.push("mission_invite_friend");
    }
  } catch {
    /* ignore */
  }
  return out;
}

export function getFoundingTesterRank(completedCount) {
  const n = Math.max(0, Math.min(FOUNDING_TESTER_TASK_COUNT, Number(completedCount) || 0));
  if (n >= 7) {
    return {
      tier: 4,
      id: "og",
      label: "OG Savvy Member",
      accent: "from-amber-500/30 to-orange-600/20",
      ring: "ring-amber-400/50",
    };
  }
  if (n >= 5) {
    return {
      tier: 3,
      id: "sniper",
      label: "Founding Sniper",
      accent: "from-violet-600/35 to-fuchsia-600/25",
      ring: "ring-violet-400/45",
    };
  }
  if (n >= 3) {
    return {
      tier: 2,
      id: "elite",
      label: "Elite Tester",
      accent: "from-cyan-600/30 to-blue-700/25",
      ring: "ring-cyan-400/45",
    };
  }
  return {
    tier: 1,
    id: "bronze",
    label: "Bronze Tester",
    accent: "from-amber-800/40 to-stone-700/30",
    ring: "ring-amber-700/40",
  };
}

export function getFoundingTesterState() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEYS.STATE) || "{}");
    return {
      completedTaskIds: safeArr(raw.completedTaskIds),
      rewardedMilestones: safeArr(raw.rewardedMilestones),
      feedbackSubmitted: Boolean(raw.feedbackSubmitted),
      feedbackDraft: String(raw.feedbackDraft || ""),
      bugReportsSubmitted: Math.max(0, Number(raw.bugReportsSubmitted) || 0),
      updatedAt: Number(raw.updatedAt) || 0,
    };
  } catch {
    return {
      completedTaskIds: [],
      rewardedMilestones: [],
      feedbackSubmitted: false,
      feedbackDraft: "",
      bugReportsSubmitted: 0,
      updatedAt: 0,
    };
  }
}

export function saveFoundingTesterState(next) {
  const merged = {
    ...getFoundingTesterState(),
    ...(next || {}),
    updatedAt: Date.now(),
  };
  try {
    localStorage.setItem(KEYS.STATE, JSON.stringify(merged));
  } catch {
    /* ignore */
  }
  return merged;
}

/**
 * Merge auto-detected completions into state (idempotent).
 * Returns { state, effectiveCompletedIds, effectiveCount }.
 */
export function refreshFoundingTesterProgress(prevState) {
  const base = prevState || getFoundingTesterState();
  const external = getExternalCompletedTaskIds();
  const effective = new Set(external);
  if (base.completedTaskIds.includes("mission_real_deal")) {
    effective.add("mission_real_deal");
  }
  if (base.feedbackSubmitted) {
    effective.add("mission_share_feedback");
  }
  const mergedCompleted = Array.from(effective);
  const nextState = saveFoundingTesterState({
    ...base,
    completedTaskIds: mergedCompleted,
  });

  return {
    state: nextState,
    effectiveCompletedIds: mergedCompleted,
    effectiveCount: effective.size,
  };
}

export function isFoundingTesterBadgeUnlocked() {
  return localStorage.getItem(KEYS.BADGE) === "1";
}

export function unlockFoundingTesterBadge() {
  try {
    localStorage.setItem(KEYS.BADGE, "1");
  } catch {
    /* ignore */
  }
}

export function getReferralPlaceholder() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEYS.REFERRAL) || "{}");
    return {
      invitesSent: Math.max(0, Number(raw.invitesSent) || 0),
      referralsJoined: Math.max(0, Number(raw.referralsJoined) || 0),
      notes: String(raw.notes || ""),
    };
  } catch {
    return { invitesSent: 0, referralsJoined: 0, notes: "" };
  }
}

export function saveReferralPlaceholder(next) {
  const merged = { ...getReferralPlaceholder(), ...(next || {}) };
  try {
    localStorage.setItem(KEYS.REFERRAL, JSON.stringify(merged));
  } catch {
    /* ignore */
  }
  dispatchFoundingTesterSync();
  return merged;
}

/** Call when first alert is successfully created (persist + sync). */
export function markFoundingTesterAlertCreated() {
  try {
    localStorage.setItem(KEYS.ALERT_CREATED, "1");
  } catch {
    /* ignore */
  }
  dispatchFoundingTesterSync();
}

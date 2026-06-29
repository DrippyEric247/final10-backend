import { DAILY_LOGIN_BASE_SAVVY } from "../config/savvyRewards";
import { getUniversalBoostState } from "./universalBoostProgress";
import { buildDailyLoginReward } from "./tierMultiplier";
import { REWARD_EVENT } from "@savvy/core/events/universeEvents";

export { REWARD_EVENT };
export const REWARD_FIRST_ACTION_KEY = "final10_first_action_reward_seen";

/**
 * Tweak reward copy/values here.
 */
export const REWARD_PRESETS = {
  save_item: {
    icon: "🔥",
    title: "+0.10x POWER",
    subtitle: "You're getting stronger",
    accent: "power",
    durationMs: 1450,
  },
  task_complete: {
    icon: "✅",
    title: "TASK COMPLETE",
    subtitle: "+0.05x boost",
    accent: "system",
    durationMs: 1500,
  },
  bundle_add: {
    icon: "📦",
    title: "BUNDLE BUILT",
    subtitle: "Closer to bigger boosts",
    accent: "system",
    durationMs: 1400,
  },
  daily_login: {
    icon: "🎁",
    title: `+${DAILY_LOGIN_BASE_SAVVY} Savvy`,
    subtitle: "Daily reward claimed",
    accent: "points",
    durationMs: 1600,
  },
  promote: {
    icon: "📣",
    title: "PROMOTED",
    subtitle: "Visibility boosted",
    accent: "power",
    durationMs: 1400,
  },
  system_complete: {
    icon: "⚡",
    title: "SYSTEM COMPLETE",
    subtitle: "+0.5x boost",
    accent: "system",
    durationMs: 1700,
  },
  streak_active: {
    icon: "🔥",
    title: "STREAK ACTIVE",
    subtitle: "Day 2 — +10% bonus",
    accent: "streak",
    durationMs: 1600,
  },
};

function safeLocalGet(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeLocalSet(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}

function dynamicGoalHint() {
  const power = getUniversalBoostState();
  let systemsMsg = "";
  try {
    const savvy = JSON.parse(localStorage.getItem("f10_savvy_sync_state") || "{}");
    const completed = Number(savvy.completedSystemsCount) || 0;
    const total = Array.isArray(savvy.completedSystems) ? Math.max(6, savvy.completedSystems.length) : 6;
    const left = Math.max(0, total - completed);
    if (left > 0) systemsMsg = `${left} system${left === 1 ? "" : "s"} left -> unlock 1.5x`;
  } catch {
    /* ignore */
  }
  return systemsMsg || power.goalHint || "2 more actions -> 1.5x boost";
}

export function triggerReward(payload) {
  if (typeof window === "undefined") return;
  const p = payload && typeof payload === "object" ? payload : null;
  if (!p || !p.title) return;
  window.dispatchEvent(new CustomEvent(REWARD_EVENT, { detail: p }));
}

export function triggerActionReward(type, overrides = {}) {
  const preset = REWARD_PRESETS[type];
  if (!preset) return;
  const detail = {
    ...preset,
    ...overrides,
    type,
    goalHint: overrides.goalHint || dynamicGoalHint(),
  };
  triggerReward(detail);
}

/** Visual toast only — pass `serverReward` from claim API when available. */
export function triggerDailyLoginReward(baseReward = DAILY_LOGIN_BASE_SAVVY, serverReward = null) {
  const amount = Number(serverReward?.amount);
  if (Number.isFinite(amount) && amount > 0) {
    triggerActionReward("daily_login", {
      title: `+${amount} Savvy`,
      subtitle: serverReward.streakBonus
        ? `Includes +${serverReward.streakBonus} streak bonus`
        : "Daily reward claimed",
      foot: serverReward.multiplier ? `${serverReward.multiplier}x tier multiplier` : undefined,
    });
    return { amount, ...serverReward };
  }
  const reward = buildDailyLoginReward(baseReward);
  triggerActionReward("daily_login", {
    title: reward.title,
    subtitle: reward.subtitle,
    foot: `${reward.multiplierLabel} tier multiplier`,
  });
  return reward;
}

export function triggerFirstActionBonusOnce() {
  if (typeof window === "undefined") return;
  if (safeLocalGet(REWARD_FIRST_ACTION_KEY) === "1") return;
  safeLocalSet(REWARD_FIRST_ACTION_KEY, "1");
  triggerReward({
    icon: "🔥",
    title: "FIRST BOOST UNLOCKED",
    subtitle: "+0.1x power",
    foot: "Keep going to reach 1.5x",
    accent: "power",
    big: true,
    durationMs: 1800,
    goalHint: dynamicGoalHint(),
  });
}

export function triggerStreakReward(streakDays) {
  const d = Math.max(1, Number(streakDays) || 1);
  const bonusPct = Math.min(50, d * 5);
  triggerActionReward("streak_active", {
    subtitle: `Day ${d} — +${bonusPct}% bonus`,
    intensity: Math.min(4, d),
  });
}

export function installRewardDevTools() {
  if (typeof window === "undefined") return;
  if (typeof process !== "undefined" && process.env.NODE_ENV === "production") return;
  if (window.final10RewardTest) return;
  window.final10RewardTest = {
    trigger: (type = "save_item", overrides = {}) => triggerActionReward(type, overrides),
    first: () => triggerFirstActionBonusOnce(),
    streak: (day = 2) => triggerStreakReward(day),
    raw: (payload) => triggerReward(payload),
  };
}

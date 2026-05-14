import { POWER, POWER_TIERS } from "./final10PowerConfig";

const STORAGE_KEY = "final10_power_v1";
const BP_POWER_LINT_KEY = "f10_bp_power_lint";

function battlePassPowerLint() {
  try {
    const n = Number(localStorage.getItem(BP_POWER_LINT_KEY));
    if (!Number.isFinite(n) || n <= 0) return 0;
    return Math.min(0.12, n);
  } catch {
    return 0;
  }
}
const EVENT = "f10-power-core-updated";

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}

function localYmd(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addDaysYmd(ymd, deltaDays) {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(y, m - 1, d + deltaDays);
  return localYmd(dt);
}

function defaultRaw() {
  return {
    v: 1,
    activityAcc: 0,
    skillAcc: 0,
    loginStreakDays: 0,
    lastLoginDay: "",
    momentumTimestamps: [],
    /** Dedupe keys: dealView:${id}, save:${id} same session */
    sessionDedupe: {},
  };
}

function loadRaw() {
  try {
    const s = localStorage.getItem(STORAGE_KEY);
    if (!s) return defaultRaw();
    const parsed = JSON.parse(s);
    if (!parsed || typeof parsed !== "object") return defaultRaw();
    return { ...defaultRaw(), ...parsed, momentumTimestamps: parsed.momentumTimestamps || [] };
  } catch {
    return defaultRaw();
  }
}

function saveRaw(raw) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(raw));
  } catch {
    /* ignore */
  }
}

function countPromotedItems() {
  try {
    const raw = JSON.parse(localStorage.getItem("f10_promoted_item_ids") || "[]");
    return Array.isArray(raw) ? raw.length : 0;
  } catch {
    return 0;
  }
}

function safeJsonObj(key) {
  try {
    const raw = JSON.parse(localStorage.getItem(key) || "{}");
    return raw && typeof raw === "object" ? raw : {};
  } catch {
    return {};
  }
}

function syncSystemCount() {
  let c = 0;
  try {
    const wl = JSON.parse(localStorage.getItem("f10_watchlist_ids") || "[]");
    if (Array.isArray(wl) && wl.length >= 3) c += 1;
  } catch {
    /* ignore */
  }
  try {
    const b = JSON.parse(localStorage.getItem("f10_saved_bundles") || "[]");
    if (Array.isArray(b) && b.length > 0) c += 1;
  } catch {
    /* ignore */
  }
  try {
    const scanState = safeJsonObj("f10_scan_earn_state");
    const scannedVideos = Number(scanState.scannedVideos) || 0;
    if (
      scannedVideos > 0 ||
      localStorage.getItem("f10_scan_complete") === "true" ||
      localStorage.getItem("f10_video_scanner_used") === "true"
    ) {
      c += 1;
    }
  } catch {
    /* ignore */
  }
  if (countPromotedItems() > 0) c += 1;
  try {
    const tasks = JSON.parse(localStorage.getItem("f10_tasks") || "[]");
    if (Array.isArray(tasks) && tasks.some((t) => t && t.completed)) c += 1;
  } catch {
    /* ignore */
  }
  try {
    const mission = safeJsonObj("f10_local_mission_data");
    if (Number(mission.purchases) > 0) c += 1;
  } catch {
    /* ignore */
  }
  return c;
}

function computeSyncBoost() {
  const n = syncSystemCount();
  if (n >= 6) return clamp(POWER.CAPS.sync, 0, POWER.CAPS.sync);
  if (n >= 2) return 0.2;
  return 0;
}

function computeLoginStreakBoost(days) {
  for (const row of POWER.LOGIN_STREAK_BOOST) {
    if (days >= row.minDays) return row.boost;
  }
  return 0;
}

function resolveTier(total) {
  for (const t of POWER_TIERS) {
    if (total >= t.min) return t;
  }
  return POWER_TIERS[POWER_TIERS.length - 1];
}

/** Next multiplier threshold above `total`, or MAX when already at top band */
function nextTierThreshold(total) {
  const ascending = [...POWER_TIERS].sort((a, b) => a.min - b.min);
  for (const t of ascending) {
    if (total < t.min - 1e-6) return t.min;
  }
  return POWER.MAX_MULTIPLIER;
}

function formatBoost(x) {
  const n = Math.round(x * 100) / 100;
  return `${Number.isInteger(n) ? n : n.toFixed(1)}x`;
}

function pushMomentum(raw) {
  const now = Date.now();
  const win = POWER.MOMENTUM_WINDOW_MS;
  raw.momentumTimestamps = (raw.momentumTimestamps || []).filter((t) => now - t < win);
  raw.momentumTimestamps.push(now);
}

function momentumMessage(raw) {
  const now = Date.now();
  const win = POWER.MOMENTUM_WINDOW_MS;
  const n = (raw.momentumTimestamps || []).filter((t) => now - t < win).length;
  for (const row of POWER.MOMENTUM_MESSAGES) {
    if (n >= row.min) return row.text;
  }
  return null;
}

function bumpSkill(raw, amount) {
  raw.skillAcc = clamp((raw.skillAcc || 0) + amount, 0, POWER.CAPS.skill);
}

function emit() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(EVENT));
  }
}

export function getPowerCoreEventName() {
  return EVENT;
}

/**
 * Full snapshot for context / debugging.
 */
export function getPowerSnapshot() {
  const raw = loadRaw();
  const activityBoost = clamp(raw.activityAcc || 0, 0, POWER.CAPS.activity);
  const streakBoost = computeLoginStreakBoost(raw.loginStreakDays || 0);
  const skillBoost = clamp(raw.skillAcc || 0, 0, POWER.CAPS.skill);
  const promoBoost = clamp(countPromotedItems() * POWER.INCREMENTS.promoPerItem, 0, POWER.CAPS.promo);
  const syncBoost = computeSyncBoost();

  const base = 1;
  const bpLint = battlePassPowerLint();
  const totalUncapped =
    base +
    activityBoost +
    streakBoost +
    skillBoost +
    promoBoost +
    syncBoost +
    bpLint;
  const currentMultiplier = clamp(totalUncapped, base, POWER.MAX_MULTIPLIER);

  const tier = resolveTier(currentMultiplier);
  const nextAt = nextTierThreshold(currentMultiplier);
  const progressSpan = Math.max(0.001, nextAt - tier.min);
  const progressValue = clamp((currentMultiplier - tier.min) / progressSpan, 0, 1);
  const nextTierTarget = nextAt;

  const powerPoints = Math.round(currentMultiplier * 100);

  return {
    currentMultiplier,
    currentTier: tier.label,
    currentTierKey: tier.key,
    currentPowerPoints: powerPoints,
    nextTierTarget,
    progressToNextTier: progressValue,
    activityBoost,
    streakBoost,
    skillBoost,
    promoBoost,
    syncBoost,
    loginStreakDays: raw.loginStreakDays || 0,
    momentumHint: momentumMessage(raw),
  };
}

function tierLabelForThreshold(mult) {
  if (mult >= POWER.MAX_MULTIPLIER - 0.01) return "Peak";
  const ascending = [...POWER_TIERS].sort((a, b) => a.min - b.min);
  for (const t of ascending) {
    if (Math.abs(t.min - mult) < 1e-6) return t.label;
  }
  return formatBoost(mult);
}

/** Bar + legacy universalBoostProgress compatibility */
export function getPowerBarView() {
  const s = getPowerSnapshot();
  const multStr = formatBoost(s.currentMultiplier);
  const gap = s.nextTierTarget - s.currentMultiplier;
  const atCap = s.currentMultiplier >= POWER.MAX_MULTIPLIER - 0.01;
  const goalHint = atCap
    ? "Max power"
    : `${gap >= 0.01 ? gap.toFixed(2) : "—"}x to ${tierLabelForThreshold(s.nextTierTarget)}`;

  return {
    ...s,
    multiplierDisplay: multStr,
    currentLabel: `${multStr} · ${s.currentTier}`,
    progressPercent: Math.round(s.progressToNextTier * 100),
    goalHint,
  };
}

export function recordPowerSave(itemId) {
  const raw = loadRaw();
  const key = itemId != null ? `save:${itemId}` : "save:anon";
  if (raw.sessionDedupe[key]) {
    return { powerPop: 0, momentumMessage: momentumMessage(raw), changed: false };
  }
  raw.sessionDedupe[key] = 1;
  raw.activityAcc = clamp((raw.activityAcc || 0) + POWER.INCREMENTS.save, 0, POWER.CAPS.activity);
  pushMomentum(raw);
  saveRaw(raw);
  emit();
  return {
    powerPop: POWER.DISPLAY.savePowerPop,
    momentumMessage: momentumMessage(raw),
    changed: true,
  };
}

export function recordDealView(dealId) {
  const raw = loadRaw();
  const key = `deal:${dealId || "unknown"}`;
  if (raw.sessionDedupe[key]) {
    return { powerPop: 0, changed: false };
  }
  raw.sessionDedupe[key] = 1;
  raw.activityAcc = clamp((raw.activityAcc || 0) + POWER.INCREMENTS.dealView, 0, POWER.CAPS.activity);
  pushMomentum(raw);
  saveRaw(raw);
  emit();
  return { powerPop: POWER.DISPLAY.dealViewPowerPop, changed: true };
}

export function recordDailyLogin() {
  const raw = loadRaw();
  const today = localYmd();
  const yesterday = addDaysYmd(today, -1);

  if (raw.lastLoginDay === today) {
    return { powerPop: 0, streakDays: raw.loginStreakDays, changed: false };
  }

  if (raw.lastLoginDay === yesterday) {
    raw.loginStreakDays = (raw.loginStreakDays || 0) + 1;
  } else if (raw.lastLoginDay) {
    raw.loginStreakDays = 1;
  } else {
    raw.loginStreakDays = 1;
  }
  raw.lastLoginDay = today;
  raw.activityAcc = clamp((raw.activityAcc || 0) + POWER.INCREMENTS.dailyLogin, 0, POWER.CAPS.activity);
  pushMomentum(raw);
  saveRaw(raw);
  emit();
  return {
    powerPop: POWER.DISPLAY.dailyLoginPowerPop,
    streakDays: raw.loginStreakDays,
    changed: true,
  };
}

export function recordSkillLowCompetition() {
  const raw = loadRaw();
  bumpSkill(raw, POWER.INCREMENTS.skillLowCompetition);
  pushMomentum(raw);
  saveRaw(raw);
  emit();
}

export function recordSkillGem() {
  const raw = loadRaw();
  bumpSkill(raw, POWER.INCREMENTS.skillAiGem);
  pushMomentum(raw);
  saveRaw(raw);
  emit();
  return { powerPop: POWER.DISPLAY.skillGemPowerPop };
}

export function recordSkillSnipe() {
  const raw = loadRaw();
  bumpSkill(raw, POWER.INCREMENTS.skillSnipeOrCloser);
  pushMomentum(raw);
  saveRaw(raw);
  emit();
  return { powerPop: POWER.DISPLAY.snipePowerPop };
}

/** After a successful video scan (scanner already updates f10_scan_earn_state). */
export function recordPowerAfterScan() {
  const raw = loadRaw();
  pushMomentum(raw);
  saveRaw(raw);
  emit();
}

/**
 * Low-competition gem (once per item per session).
 */
export function recordSkillLowCompetitionOnce(itemId) {
  const raw = loadRaw();
  const key = `lowcomp:${itemId || "x"}`;
  if (raw.sessionDedupe[key]) return { changed: false };
  raw.sessionDedupe[key] = 1;
  bumpSkill(raw, POWER.INCREMENTS.skillLowCompetition);
  pushMomentum(raw);
  saveRaw(raw);
  emit();
  return { changed: true };
}

/** Recompute sync from storage; call after promote toggle etc. */
export function refreshPowerFromStorage() {
  emit();
}

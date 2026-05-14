/**
 * Smart deal alerts — only fire notifications on genuinely high-value listings.
 *
 * Pipeline:
 *   1. Pages call reportDealsForAlerts(items) whenever fresh listings arrive.
 *   2. Each item is scored against the qualification tiers below.
 *   3. If a candidate survives the frequency guard (max 3/day, 30-min cool-down,
 *      6-hour per-item dedupe), we fire a browser Notification AND a passive
 *      assistant signal so the Win Lane dock carries the same nudge.
 *   4. Clicking the notification focuses the tab and routes to the deal.
 *
 * All state lives in localStorage so caps survive reloads:
 *   f10_push_alerts_enabled   "1" | "0"
 *   f10_push_alerts_log       JSON array of { ts, itemId }
 */

import { ASSISTANT_FEED_EVENT } from "./assistantSignals";
import { matchWatchIntent } from "./watchIntent";

const ENABLED_KEY = "f10_push_alerts_enabled";
const LOG_KEY = "f10_push_alerts_log";

const DAY_MS = 24 * 60 * 60 * 1000;
const SIX_HOURS_MS = 6 * 60 * 60 * 1000;
const COOLDOWN_MS = 30 * 60 * 1000;
const DAILY_CAP = 3;
const ENDING_SOON_SEC = 2 * 60 * 60; // 2 hours
const LOW_COMPETITION_BIDS = 4;

// ----- utils ----------------------------------------------------------------

function toNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function hasWindow() {
  return typeof window !== "undefined";
}

function safeLocalStorage() {
  try {
    if (typeof localStorage === "undefined") return null;
    return localStorage;
  } catch {
    return null;
  }
}

function readLog() {
  const ls = safeLocalStorage();
  if (!ls) return [];
  try {
    const raw = JSON.parse(ls.getItem(LOG_KEY) || "[]");
    if (!Array.isArray(raw)) return [];
    const cutoff = Date.now() - DAY_MS;
    return raw.filter(
      (row) => row && typeof row === "object" && toNum(row.ts) >= cutoff
    );
  } catch {
    return [];
  }
}

function writeLog(log) {
  const ls = safeLocalStorage();
  if (!ls) return;
  try {
    ls.setItem(LOG_KEY, JSON.stringify(log.slice(-24)));
  } catch {
    /* ignore */
  }
}

// ----- public settings ------------------------------------------------------

export function getAlertsEnabled() {
  const ls = safeLocalStorage();
  if (!ls) return false;
  return ls.getItem(ENABLED_KEY) === "1";
}

export function setAlertsEnabled(on) {
  const ls = safeLocalStorage();
  if (!ls) return;
  try {
    ls.setItem(ENABLED_KEY, on ? "1" : "0");
  } catch {
    /* ignore */
  }
}

export function getNotificationPermission() {
  if (!hasWindow() || typeof Notification === "undefined") return "unsupported";
  return Notification.permission; // "granted" | "denied" | "default"
}

/**
 * Prompt the user for notification permission. Must be called from a user
 * gesture (click) for most browsers. Returns the resulting permission string.
 */
export async function requestAlertPermission() {
  if (!hasWindow() || typeof Notification === "undefined") return "unsupported";
  if (Notification.permission === "granted") return "granted";
  if (Notification.permission === "denied") return "denied";
  try {
    const result = await Notification.requestPermission();
    return result;
  } catch {
    return "default";
  }
}

// ----- scoring --------------------------------------------------------------

function extractDealSignals(raw) {
  if (!raw || typeof raw !== "object") return null;
  const itemId = String(raw.itemId || raw.id || raw._id || "");
  if (!itemId) return null;
  const title = String(raw.title || "eBay listing");
  const category = String(raw.category || raw.categoryName || "").toLowerCase();
  const dealScore = toNum(
    raw.dealScore ?? raw.trendingScore ?? raw.score ?? raw.aiScore?.trendingScore
  );
  const savingsPct = toNum(raw.savingsPercentage ?? raw.savingsPct);
  const bids = toNum(raw.bids ?? raw.bidCount);
  const secondsRemaining = toNum(
    raw.secondsRemaining ?? raw.timeRemaining ?? raw.timeLeftSeconds
  );
  const endingSoon = secondsRemaining > 0 && secondsRemaining <= ENDING_SOON_SEC;
  const lowCompetition = raw.isAuction === false ? false : bids < LOW_COMPETITION_BIDS;
  const url = raw.itemWebUrl || raw.url || raw.viewItemURL || null;
  return {
    itemId,
    title,
    category,
    dealScore,
    savingsPct,
    bids,
    secondsRemaining,
    endingSoon,
    lowCompetition,
    url,
    isAuction: Boolean(raw.isAuction),
  };
}

/**
 * Grade a listing and return alert metadata if it qualifies, else null.
 *
 * Tiers (most strict first):
 *  - S: dealScore>=80, low competition, ending soon → urgent, top priority
 *  - A: dealScore>=85 AND ending soon → strong heads-up
 *  - B: savingsPct>=35 AND bids<3 AND ending soon → hidden gem
 */
export function evaluateDealForAlert(raw) {
  const d = extractDealSignals(raw);
  if (!d) return null;

  const qualifies =
    (d.dealScore >= 80 && d.lowCompetition && d.endingSoon) ||
    (d.dealScore >= 85 && d.endingSoon) ||
    (d.savingsPct >= 35 && d.bids < 3 && d.endingSoon);

  // Watch-intent match: softer floor (something the user actively asked for).
  // Only fires when the item passes a minimum quality bar so we never ping
  // users on trash just because they tapped "Notify Me".
  const watchIntent = !qualifies ? matchWatchIntent(raw) : null;
  const watchQualifies =
    watchIntent && (d.dealScore >= 72 || d.savingsPct >= 20 || (d.endingSoon && d.lowCompetition));

  if (!qualifies && !watchQualifies) return null;

  let tier = "B";
  if (d.dealScore >= 80 && d.lowCompetition && d.endingSoon) tier = "S";
  else if (d.dealScore >= 85) tier = "A";
  else if (watchQualifies) tier = "W"; // watch-intent match

  return {
    itemId: d.itemId,
    tier,
    priority: tier === "S" ? 3 : tier === "A" ? 2 : tier === "W" ? 2 : 1,
    url: d.url,
    signals: d,
    headline: buildHeadline(d, tier, watchIntent),
    body: buildBody(d, watchIntent),
    watchIntent: watchIntent || null,
  };
}

function shortTitle(title) {
  const t = String(title || "").trim();
  if (!t) return "Deal";
  if (t.length <= 42) return t;
  return t.slice(0, 40).replace(/\s+\S*$/, "") + "…";
}

function formatTimeLeft(secs) {
  const s = Math.max(0, toNum(secs));
  if (s <= 0) return "ending now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${Math.max(m, 1)}m left`;
  const h = Math.floor(m / 60);
  return `${h}h left`;
}

function buildHeadline(d, tier, watchIntent) {
  if (tier === "W" && watchIntent) {
    const subject = watchIntent.query || watchIntent.category || "your watch";
    return `🔥 ${subject} deal just dropped — check now`;
  }
  const tail = d.lowCompetition ? "low bids" : "move fast";
  const prefix = tier === "S" ? "🔥" : tier === "A" ? "⚡" : "💎";
  return `${prefix} ${shortTitle(d.title)} — ${tail}`;
}

function buildBody(d, watchIntent) {
  const bits = [];
  if (d.savingsPct >= 15) bits.push(`${Math.round(d.savingsPct)}% off`);
  if (d.endingSoon) bits.push(formatTimeLeft(d.secondsRemaining));
  if (d.isAuction) {
    bits.push(d.bids === 0 ? "no bids yet" : `${d.bids} bid${d.bids === 1 ? "" : "s"}`);
  }
  if (watchIntent) bits.push("matches your watch");
  return bits.join(" · ") || "High-value deal live.";
}

// ----- frequency guard ------------------------------------------------------

/**
 * Returns true if we can fire an alert for this itemId right now.
 * Enforces: 3/day cap, 30-min cool-down between any alerts, 6-hour per-item dedupe.
 */
function canFire(itemId, now = Date.now()) {
  const log = readLog();
  if (log.length >= DAILY_CAP) return false;
  const lastAny = log.length ? log[log.length - 1].ts : 0;
  if (now - lastAny < COOLDOWN_MS) return false;
  const lastSame = log
    .filter((row) => String(row.itemId) === String(itemId))
    .reduce((acc, row) => Math.max(acc, row.ts), 0);
  if (lastSame && now - lastSame < SIX_HOURS_MS) return false;
  return true;
}

function recordFire(itemId, now = Date.now()) {
  const log = readLog();
  log.push({ ts: now, itemId: String(itemId) });
  writeLog(log);
}

export function getAlertsFiredToday() {
  return readLog().length;
}

// ----- firing ---------------------------------------------------------------

function mirrorToAssistantDock(alert) {
  if (!hasWindow()) return;
  try {
    window.dispatchEvent(
      new CustomEvent(ASSISTANT_FEED_EVENT, {
        detail: {
          id: `alert-${alert.itemId}`,
          tone: "urgent",
          title: alert.headline,
          body: alert.body,
          priority: alert.priority + 1,
          ts: Date.now(),
        },
      })
    );
  } catch {
    /* ignore */
  }
}

function openDealFromAlert(alert) {
  if (!hasWindow()) return;
  try {
    window.focus();
  } catch {
    /* ignore */
  }
  const url = alert.url;
  if (!url) {
    window.location.href = "/auctions";
    return;
  }
  if (/^https?:\/\//i.test(url)) {
    window.open(url, "_blank", "noopener,noreferrer");
  } else {
    window.location.href = url;
  }
}

function fireBrowserNotification(alert) {
  if (typeof Notification === "undefined") return false;
  if (Notification.permission !== "granted") return false;
  try {
    const n = new Notification(alert.headline, {
      body: alert.body,
      tag: `f10-deal-${alert.itemId}`,
      renotify: false,
      silent: false,
    });
    n.onclick = () => {
      openDealFromAlert(alert);
      try {
        n.close();
      } catch {
        /* ignore */
      }
    };
    return true;
  } catch {
    return false;
  }
}

/**
 * Scan a batch of raw listings, fire alerts for any that qualify and pass the
 * frequency guard. Returns an array of the alerts that were actually fired.
 *
 * Safe to call repeatedly — dedupe + cool-down guards keep the dock quiet.
 */
export function reportDealsForAlerts(items) {
  if (!Array.isArray(items) || items.length === 0) return [];
  if (!getAlertsEnabled()) return [];

  const candidates = items
    .map(evaluateDealForAlert)
    .filter(Boolean)
    .sort((a, b) => b.priority - a.priority);

  const fired = [];
  for (const alert of candidates) {
    if (!canFire(alert.itemId)) continue;
    const delivered = fireBrowserNotification(alert);
    // Always mirror to the in-app dock so the nudge survives even when the
    // OS-level permission was denied.
    mirrorToAssistantDock(alert);
    if (delivered || !hasWindow() || typeof Notification === "undefined") {
      recordFire(alert.itemId);
      fired.push(alert);
    } else {
      // Permission not granted → still log so we don't spam the dock either.
      recordFire(alert.itemId);
      fired.push(alert);
    }
    // Respect the daily cap within this same batch.
    if (readLog().length >= DAILY_CAP) break;
  }
  return fired;
}

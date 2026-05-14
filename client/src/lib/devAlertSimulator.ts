/**
 * Final10 Dev — Alert Testing & Simulation
 *
 * NEVER import from production-only code. Every public function no-ops in
 * production builds (`process.env.NODE_ENV === "production"`).
 *
 * Surfaces exercised:
 *   - In-app dock        → window event `ASSISTANT_FEED_EVENT`
 *   - Toast              → window event `POWER_TOAST_EVENT`
 *   - Push UI            → `Notification` API (when permission granted)
 *   - AI panel           → urgent feed signals auto-open Final10SideAssistant hints tab
 *   - Quick Snipes route → `window.location.href = "/local-deals?q=…"`
 */

import { pushAssistantSignal } from "./assistantSignals";
import { isDev } from "./devOverride";
import { emitPowerToast } from "./final10PowerFeedback";
import { getEffectiveSubscriptionTier } from "./tierMultiplier";

export type DevAlertPreset =
  | "cheap"
  | "high_trust"
  | "rare"
  | "ending_soon"
  | "huge_savings"
  | "quick_snipe";

export type DevAlertCategory =
  | "shoes"
  | "gaming"
  | "gpus"
  | "luxury"
  | "cars"
  | "project_builds";

export type DevAlertState =
  | "active"
  | "expired"
  | "won"
  | "missed"
  | "premium_locked"
  | "ai_boosted";

export type SimulatedAlert = {
  id: string;
  title: string;
  price: number;
  marketPrice: number;
  savingsPercent: number;
  trustScore: number;
  urgency: "LOW" | "MED" | "HIGH";
  source: string;
  endingSoon: boolean;
  premiumCandidate: boolean;
  category: DevAlertCategory;
  preset: DevAlertPreset;
  state: DevAlertState;
  query: string;
  url: string;
  ts: number;
};

export type DevAlertLogEntry = {
  ts: number;
  type:
    | "fired"
    | "premium_gate_shown"
    | "user_clicked_reveal"
    | "routed_quick_snipes"
    | "turbo_started"
    | "turbo_stopped"
    | "log_cleared";
  title?: string;
  detail?: string;
  alertId?: string;
  state?: DevAlertState;
  preset?: DevAlertPreset;
};

export const DEV_ALERT_LOG_EVENT = "f10:dev-alert-log-updated";
export const DEV_ALERT_FIRED_EVENT = "f10:dev-alert-fired";
export const DEV_ALERT_TURBO_EVENT = "f10:dev-alert-turbo-updated";

const LOG_KEY = "f10_dev_alert_log";
const SOUND_KEY = "f10_dev_alert_sound";
const PUSH_KEY = "f10_dev_alert_push_ui";
const TURBO_INTERVAL_MS = 5000;
const LOG_CAP = 80;

const PRESET_SEQUENCE: DevAlertPreset[] = [
  "cheap",
  "high_trust",
  "rare",
  "ending_soon",
  "huge_savings",
  "quick_snipe",
];

const CATEGORY_TEMPLATES: Record<
  DevAlertCategory,
  { titles: string[]; sources: string[]; basePrice: number; baseMarket: number }
> = {
  shoes: {
    titles: [
      "Air Jordan 1 Retro 'Bred'",
      "Yeezy Boost 350 V2",
      "New Balance 990v6",
      "Nike Dunk Low Panda",
    ],
    sources: ["eBay", "GOAT", "StockX"],
    basePrice: 110,
    baseMarket: 240,
  },
  gaming: {
    titles: [
      "PS5 Disc Edition",
      "Xbox Series X 1TB",
      "Nintendo Switch OLED",
      "Steam Deck OLED 1TB",
    ],
    sources: ["eBay", "Mercari"],
    basePrice: 179,
    baseMarket: 449,
  },
  gpus: {
    titles: [
      "RTX 4070 Ti Super Founders",
      "RTX 4080 Super 16GB",
      "Radeon RX 7900 XTX",
      "RTX 5080 16GB",
    ],
    sources: ["eBay", "Newegg Refurb"],
    basePrice: 519,
    baseMarket: 899,
  },
  luxury: {
    titles: [
      "Louis Vuitton Neverfull MM",
      "Rolex Submariner 116610",
      "Hermès Constance 18",
      "Cartier Love Bracelet",
    ],
    sources: ["eBay", "Fashionphile", "Chrono24"],
    basePrice: 2400,
    baseMarket: 4200,
  },
  cars: {
    titles: [
      "2018 Subaru WRX STI",
      "2020 Tesla Model 3 LR",
      "2014 BMW M3 Sedan",
      "2019 Toyota Tacoma TRD",
    ],
    sources: ["Cars.com", "eBay Motors"],
    basePrice: 22000,
    baseMarket: 31500,
  },
  project_builds: {
    titles: [
      "Carbon Frame Gravel Bike Build",
      "Mini-ITX SFF PC Project Lot",
      "JDM K20 Swap Engine Bundle",
      "Vintage Synth Restoration Lot",
    ],
    sources: ["eBay", "Mercari", "Reverb"],
    basePrice: 480,
    baseMarket: 1100,
  },
};

const PRESET_RULES: Record<
  DevAlertPreset,
  {
    label: string;
    savingsPercent: number;
    trustScore: number;
    urgency: SimulatedAlert["urgency"];
    endingSoon: boolean;
    premiumCandidate: boolean;
    headlineTone: "urgent" | "gem" | "watch" | "promo" | "info";
  }
> = {
  cheap: {
    label: "Cheap Deal",
    savingsPercent: 35,
    trustScore: 78,
    urgency: "MED",
    endingSoon: false,
    premiumCandidate: false,
    headlineTone: "info",
  },
  high_trust: {
    label: "High Trust Deal",
    savingsPercent: 22,
    trustScore: 94,
    urgency: "MED",
    endingSoon: false,
    premiumCandidate: false,
    headlineTone: "watch",
  },
  rare: {
    label: "Rare Deal",
    savingsPercent: 48,
    trustScore: 88,
    urgency: "HIGH",
    endingSoon: false,
    premiumCandidate: true,
    headlineTone: "gem",
  },
  ending_soon: {
    label: "Ending Soon",
    savingsPercent: 28,
    trustScore: 82,
    urgency: "HIGH",
    endingSoon: true,
    premiumCandidate: false,
    headlineTone: "urgent",
  },
  huge_savings: {
    label: "Huge Savings",
    savingsPercent: 60,
    trustScore: 86,
    urgency: "HIGH",
    endingSoon: true,
    premiumCandidate: true,
    headlineTone: "gem",
  },
  quick_snipe: {
    label: "Quick Snipe Candidate",
    savingsPercent: 42,
    trustScore: 90,
    urgency: "HIGH",
    endingSoon: true,
    premiumCandidate: true,
    headlineTone: "urgent",
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function nowMs(): number {
  return Date.now();
}

function safeLS(): Storage | null {
  try {
    if (typeof localStorage === "undefined") return null;
    return localStorage;
  } catch {
    return null;
  }
}

function rand<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function newId(prefix: string): string {
  return `${prefix}-${nowMs().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

function isFreeUser(): boolean {
  try {
    const t = String(getEffectiveSubscriptionTier() || "free").toLowerCase();
    return t === "free";
  } catch {
    return true;
  }
}

// ---------------------------------------------------------------------------
// Dev log
// ---------------------------------------------------------------------------

export function getDevAlertLog(): DevAlertLogEntry[] {
  if (!isDev) return [];
  const ls = safeLS();
  if (!ls) return [];
  try {
    const raw = JSON.parse(ls.getItem(LOG_KEY) || "[]");
    return Array.isArray(raw) ? raw.slice(-LOG_CAP) : [];
  } catch {
    return [];
  }
}

function appendLog(entry: DevAlertLogEntry): void {
  if (!isDev) return;
  const ls = safeLS();
  if (!ls) return;
  try {
    const prev = getDevAlertLog();
    const next = [...prev, entry].slice(-LOG_CAP);
    ls.setItem(LOG_KEY, JSON.stringify(next));
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent(DEV_ALERT_LOG_EVENT));
    }
  } catch {
    /* ignore quota */
  }
}

export function clearDevAlertLog(): void {
  if (!isDev) return;
  const ls = safeLS();
  if (!ls) return;
  try {
    ls.removeItem(LOG_KEY);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent(DEV_ALERT_LOG_EVENT));
    }
  } catch {
    /* ignore */
  }
  appendLog({ ts: nowMs(), type: "log_cleared" });
}

// ---------------------------------------------------------------------------
// Sound + push UI toggles
// ---------------------------------------------------------------------------

export function getDevAlertSoundEnabled(): boolean {
  if (!isDev) return false;
  const ls = safeLS();
  if (!ls) return false;
  return ls.getItem(SOUND_KEY) === "1";
}

export function setDevAlertSoundEnabled(on: boolean): void {
  if (!isDev) return;
  const ls = safeLS();
  if (!ls) return;
  ls.setItem(SOUND_KEY, on ? "1" : "0");
}

export function getDevAlertPushUiEnabled(): boolean {
  if (!isDev) return false;
  const ls = safeLS();
  if (!ls) return false;
  return ls.getItem(PUSH_KEY) === "1";
}

export function setDevAlertPushUiEnabled(on: boolean): void {
  if (!isDev) return;
  const ls = safeLS();
  if (!ls) return;
  ls.setItem(PUSH_KEY, on ? "1" : "0");
}

let cachedAudioCtx: AudioContext | null = null;

function playBeep(state: DevAlertState): void {
  if (!isDev || typeof window === "undefined" || !getDevAlertSoundEnabled()) return;
  try {
    const Ctor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    if (!cachedAudioCtx) cachedAudioCtx = new Ctor();
    const ctx = cachedAudioCtx;
    if (ctx.state === "suspended") void ctx.resume();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value =
      state === "won" ? 880 : state === "missed" || state === "expired" ? 220 : 660;
    gain.gain.value = 0.0001;
    osc.connect(gain).connect(ctx.destination);
    const now = ctx.currentTime;
    gain.gain.exponentialRampToValueAtTime(0.18, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.32);
    osc.start(now);
    osc.stop(now + 0.34);
  } catch {
    /* ignore */
  }
}

function tryFireBrowserNotification(alert: SimulatedAlert, headline: string): boolean {
  if (!isDev) return false;
  if (typeof window === "undefined" || typeof Notification === "undefined") return false;
  if (!getDevAlertPushUiEnabled()) return false;
  if (Notification.permission !== "granted") {
    if (Notification.permission === "default") {
      void Notification.requestPermission();
    }
    return false;
  }
  try {
    const n = new Notification(`(DEV) ${headline}`, {
      body: `${alert.savingsPercent}% off · trust ${alert.trustScore}`,
      tag: `dev-${alert.id}`,
      silent: false,
    });
    n.onclick = () => {
      window.focus();
      appendLog({
        ts: nowMs(),
        type: "user_clicked_reveal",
        title: alert.title,
        alertId: alert.id,
      });
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

// ---------------------------------------------------------------------------
// Build / fire
// ---------------------------------------------------------------------------

export function buildSimulatedAlert(
  preset: DevAlertPreset,
  opts: { category?: DevAlertCategory; state?: DevAlertState; titleHint?: string } = {}
): SimulatedAlert {
  const category = opts.category || "gaming";
  const state = opts.state || "active";
  const tpl = CATEGORY_TEMPLATES[category];
  const rule = PRESET_RULES[preset];
  const title = opts.titleHint || rand(tpl.titles);
  const savingsPercent = Math.max(0, Math.min(95, rule.savingsPercent));
  const marketPrice = Math.max(1, Math.round(tpl.baseMarket));
  const price = Math.max(
    1,
    Math.round(marketPrice * (1 - savingsPercent / 100))
  );
  const id = newId(`mock-${preset}`);
  const query = title.split(/\s+/).slice(0, 3).join(" ");
  return {
    id,
    title,
    price,
    marketPrice,
    savingsPercent,
    trustScore: rule.trustScore,
    urgency: rule.urgency,
    source: rand(tpl.sources),
    endingSoon: rule.endingSoon,
    premiumCandidate: rule.premiumCandidate,
    category,
    preset,
    state,
    query,
    url: `/local-deals?q=${encodeURIComponent(query)}`,
    ts: nowMs(),
  };
}

function effectiveHeadline(alert: SimulatedAlert): {
  headline: string;
  body: string;
  premiumGated: boolean;
} {
  const rule = PRESET_RULES[alert.preset];
  const free = isFreeUser();
  const premiumGate =
    alert.state === "premium_locked" || (alert.premiumCandidate && free);
  if (premiumGate) {
    return {
      headline: "🔒 Savvy found a stronger move",
      body: "Premium reveals the full deal — upgrade to see it.",
      premiumGated: true,
    };
  }
  switch (alert.state) {
    case "expired":
      return {
        headline: `⌛ Expired: ${alert.title}`,
        body: `${alert.savingsPercent}% off · ended just now`,
        premiumGated: false,
      };
    case "won":
      return {
        headline: `🏆 Won: ${alert.title}`,
        body: `Locked in at $${alert.price.toLocaleString()}`,
        premiumGated: false,
      };
    case "missed":
      return {
        headline: `😬 Missed: ${alert.title}`,
        body: `Sold for $${alert.price.toLocaleString()} (${alert.savingsPercent}% off)`,
        premiumGated: false,
      };
    case "ai_boosted": {
      const prefix =
        rule.headlineTone === "urgent"
          ? "🔥"
          : rule.headlineTone === "gem"
            ? "💎"
            : "⚡";
      return {
        headline: `${prefix} Savvy AI Boost · ${alert.title}`,
        body: `+${alert.savingsPercent}% off · trust ${alert.trustScore} · ${alert.source}`,
        premiumGated: false,
      };
    }
    default: {
      const prefix =
        rule.headlineTone === "urgent"
          ? "🔥"
          : rule.headlineTone === "gem"
            ? "💎"
            : rule.headlineTone === "watch"
              ? "👁"
              : "⚡";
      return {
        headline: `${prefix} ${alert.title} · ${alert.savingsPercent}% off`,
        body: `Buy $${alert.price.toLocaleString()} · Market $${alert.marketPrice.toLocaleString()} · trust ${alert.trustScore} · ${alert.source}`,
        premiumGated: false,
      };
    }
  }
}

function dispatchInApp(alert: SimulatedAlert, copy: { headline: string; body: string }): void {
  const tone =
    alert.state === "won"
      ? "promo"
      : alert.state === "expired" || alert.state === "missed"
        ? "info"
        : alert.state === "ai_boosted"
          ? "gem"
          : alert.urgency === "HIGH"
            ? "urgent"
            : "watch";
  pushAssistantSignal({
    id: `dev-alert-${alert.id}`,
    tone: tone as "urgent" | "gem" | "watch" | "promo" | "scan" | "info",
    title: copy.headline,
    body: copy.body,
    priority: alert.urgency === "HIGH" ? 3 : alert.urgency === "MED" ? 2 : 1,
  });
}

function dispatchToast(alert: SimulatedAlert, copy: { headline: string }): void {
  if (alert.state === "expired" || alert.state === "missed") return;
  const points = Math.max(5, Math.round(alert.savingsPercent));
  emitPowerToast(points, `Sim · ${alert.preset.replace(/_/g, " ")}`);
  void copy;
}

export function fireSimulatedAlert(
  preset: DevAlertPreset,
  opts: {
    category?: DevAlertCategory;
    state?: DevAlertState;
    routeToQuickSnipes?: boolean;
  } = {}
): SimulatedAlert | null {
  if (!isDev) return null;
  const alert = buildSimulatedAlert(preset, {
    category: opts.category,
    state: opts.state,
  });
  const copy = effectiveHeadline(alert);

  dispatchInApp(alert, copy);
  dispatchToast(alert, copy);
  tryFireBrowserNotification(alert, copy.headline);
  playBeep(alert.state);

  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent(DEV_ALERT_FIRED_EVENT, { detail: { alert, copy } })
    );
  }

  appendLog({
    ts: alert.ts,
    type: "fired",
    title: copy.headline,
    detail: `${alert.preset} · ${alert.category} · ${alert.state}`,
    alertId: alert.id,
    state: alert.state,
    preset: alert.preset,
  });

  if (copy.premiumGated) {
    appendLog({
      ts: nowMs(),
      type: "premium_gate_shown",
      title: alert.title,
      alertId: alert.id,
    });
  }

  if (opts.routeToQuickSnipes) {
    routeAlertToQuickSnipes(alert);
  }

  return alert;
}

export function routeAlertToQuickSnipes(alert: SimulatedAlert): void {
  if (!isDev) return;
  appendLog({
    ts: nowMs(),
    type: "routed_quick_snipes",
    title: alert.title,
    alertId: alert.id,
    detail: alert.url,
  });
  if (typeof window !== "undefined") {
    window.location.href = alert.url;
  }
}

export function recordRevealClickFromPanel(alert: SimulatedAlert): void {
  if (!isDev) return;
  appendLog({
    ts: nowMs(),
    type: "user_clicked_reveal",
    title: alert.title,
    alertId: alert.id,
  });
}

// ---------------------------------------------------------------------------
// Turbo Alert Mode
// ---------------------------------------------------------------------------

let turboTimer: ReturnType<typeof setInterval> | null = null;
let turboCursor = 0;

export function isTurboAlertModeActive(): boolean {
  return turboTimer != null;
}

export function startTurboAlertMode(opts?: {
  category?: DevAlertCategory;
  state?: DevAlertState;
}): void {
  if (!isDev) return;
  if (turboTimer) return;
  turboCursor = 0;
  const tick = () => {
    const preset = PRESET_SEQUENCE[turboCursor % PRESET_SEQUENCE.length];
    turboCursor += 1;
    fireSimulatedAlert(preset, {
      category: opts?.category,
      state: opts?.state,
    });
  };
  tick();
  turboTimer = setInterval(tick, TURBO_INTERVAL_MS);
  appendLog({
    ts: nowMs(),
    type: "turbo_started",
    detail: `every ${TURBO_INTERVAL_MS / 1000}s`,
  });
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(DEV_ALERT_TURBO_EVENT));
  }
}

export function stopTurboAlertMode(): void {
  if (!isDev) return;
  if (!turboTimer) return;
  clearInterval(turboTimer);
  turboTimer = null;
  turboCursor = 0;
  appendLog({ ts: nowMs(), type: "turbo_stopped" });
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(DEV_ALERT_TURBO_EVENT));
  }
}

export function fireBatchForFilters(opts?: { state?: DevAlertState }): SimulatedAlert[] {
  if (!isDev) return [];
  const cats: DevAlertCategory[] = [
    "shoes",
    "gaming",
    "gpus",
    "luxury",
    "cars",
    "project_builds",
  ];
  const out: SimulatedAlert[] = [];
  cats.forEach((category, i) => {
    const preset = PRESET_SEQUENCE[i % PRESET_SEQUENCE.length];
    const a = fireSimulatedAlert(preset, { category, state: opts?.state });
    if (a) out.push(a);
  });
  return out;
}

export const DEV_ALERT_PRESETS: { id: DevAlertPreset; label: string }[] = [
  { id: "cheap", label: "Cheap Deal" },
  { id: "high_trust", label: "High Trust Deal" },
  { id: "rare", label: "Rare Deal" },
  { id: "ending_soon", label: "Ending Soon" },
  { id: "huge_savings", label: "Huge Savings" },
  { id: "quick_snipe", label: "Quick Snipe Candidate" },
];

export const DEV_ALERT_CATEGORIES: { id: DevAlertCategory; label: string }[] = [
  { id: "shoes", label: "Shoes" },
  { id: "gaming", label: "Gaming" },
  { id: "gpus", label: "GPUs" },
  { id: "luxury", label: "Luxury" },
  { id: "cars", label: "Cars" },
  { id: "project_builds", label: "Project Builds" },
];

export const DEV_ALERT_STATES: { id: DevAlertState; label: string }[] = [
  { id: "active", label: "Active" },
  { id: "expired", label: "Expired" },
  { id: "won", label: "Won" },
  { id: "missed", label: "Missed" },
  { id: "premium_locked", label: "Premium Locked" },
  { id: "ai_boosted", label: "AI Boosted" },
];

export const DEV_ALERT_TURBO_INTERVAL_MS = TURBO_INTERVAL_MS;

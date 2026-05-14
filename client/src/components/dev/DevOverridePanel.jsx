import React, { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { unlockAllCallingCardsForDev } from "../../lib/customizationCatalog";
import {
  clearDevAlertLog,
  DEV_ALERT_CATEGORIES,
  DEV_ALERT_LOG_EVENT,
  DEV_ALERT_PRESETS,
  DEV_ALERT_STATES,
  DEV_ALERT_TURBO_EVENT,
  DEV_ALERT_TURBO_INTERVAL_MS,
  fireBatchForFilters,
  fireSimulatedAlert,
  getDevAlertLog,
  getDevAlertPushUiEnabled,
  getDevAlertSoundEnabled,
  isTurboAlertModeActive,
  setDevAlertPushUiEnabled,
  setDevAlertSoundEnabled,
  startTurboAlertMode,
  stopTurboAlertMode,
} from "../../lib/devAlertSimulator";
import {
  bumpDevSavvyPointsOffset,
  DEFAULT_DEV_OVERRIDE,
  FINAL10_DEV_OVERRIDE_EVENT,
  getDevMarketingSubscription,
  isDeveloper,
  loadFinal10DevOverride,
  marketingSubscriptionToInternalTier,
  resetDevSavvyPointsOffset,
  saveFinal10DevOverride,
} from "../../lib/devOverride";
import { resetOnboardingPreferences } from "../../lib/onboardingPreferences";
import { devUnlockAllProgramsVerified } from "../../lib/savvyPrograms";
import {
  DEV_BEST_MOVE_USAGE_RESET_EVENT,
  DEV_SUBSCRIPTION_TOOLS_EVENT,
  getCurrentSubscriptionTier,
  getEffectiveSubscriptionTier,
  setCurrentSubscriptionTier,
} from "../../lib/tierMultiplier";

export const DEV_ALERTS_CLIENT_RESET_EVENT = "f10:dev-alerts-client-reset";

const SUBSCRIPTION_PRESETS = [
  { id: "free", label: "Free" },
  { id: "premium", label: "Premium ($7)" },
  { id: "pro", label: "Pro ($14)" },
  { id: "lifetime", label: "Lifetime" },
  { id: "veteran_program", label: "Veteran Program" },
  { id: "first_responder_program", label: "First Responder Program" },
  { id: "legacy_program", label: "Legacy Program" },
];

function patchSubscription(sub) {
  saveFinal10DevOverride({ subscription: sub });
  const internal = marketingSubscriptionToInternalTier(sub);
  if (internal) setCurrentSubscriptionTier(internal);
}

function ToggleRow({ label, checked, onChange }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-2 rounded-md px-1 py-1 hover:bg-white/5">
      <span className="text-[11px] text-gray-300">{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-3.5 w-3.5 rounded border-gray-500 bg-gray-900 text-emerald-500"
      />
    </label>
  );
}

export default function DevOverridePanel() {
  const isProd = process.env.NODE_ENV === "production";
  const { user } = useAuth();
  const [, bump] = useState(0);
  const [open, setOpen] = useState(false);
  const [alertCategory, setAlertCategory] = useState("gaming");
  const [alertState, setAlertState] = useState("active");

  useEffect(() => {
    const on = () => bump((n) => n + 1);
    window.addEventListener(FINAL10_DEV_OVERRIDE_EVENT, on);
    window.addEventListener(DEV_ALERT_LOG_EVENT, on);
    window.addEventListener(DEV_ALERT_TURBO_EVENT, on);
    return () => {
      window.removeEventListener(FINAL10_DEV_OVERRIDE_EVENT, on);
      window.removeEventListener(DEV_ALERT_LOG_EVENT, on);
      window.removeEventListener(DEV_ALERT_TURBO_EVENT, on);
    };
  }, []);

  if (isProd) return null;

  const state = loadFinal10DevOverride();
  const devSub = getDevMarketingSubscription();
  const storedTier = getCurrentSubscriptionTier();
  const realMarketingFromStored =
    storedTier === "core"
      ? "premium"
      : storedTier === "pro"
        ? "pro"
        : storedTier === "elite"
          ? "lifetime"
          : "free";
  const effectiveMarketingLabel = devSub ?? realMarketingFromStored;
  const specHasPremium =
    !state.simulateExpiredSubscription &&
    (effectiveMarketingLabel === "premium" ||
      effectiveMarketingLabel === "pro" ||
      effectiveMarketingLabel === "lifetime");

  const ft = state.featureTests || {};

  const setFt = (key, value) => {
    const cur = loadFinal10DevOverride();
    saveFinal10DevOverride({
      featureTests: {
        ...DEFAULT_DEV_OVERRIDE.featureTests,
        ...cur.featureTests,
        [key]: value,
      },
    });
  };

  const resetDailyBestMoves = () => {
    try {
      localStorage.removeItem("f10_best_move_power_daily_v1");
    } catch {
      /* ignore */
    }
    window.dispatchEvent(new CustomEvent(DEV_BEST_MOVE_USAGE_RESET_EVENT));
  };

  const resetAlertsClient = () => {
    try {
      localStorage.removeItem("f10_push_alerts_log");
      localStorage.removeItem("f10_push_alerts_enabled");
    } catch {
      /* ignore */
    }
    window.dispatchEvent(new CustomEvent(DEV_ALERTS_CLIENT_RESET_EVENT));
  };

  const resetOnboarding = () => {
    resetOnboardingPreferences();
    window.dispatchEvent(new CustomEvent(DEV_SUBSCRIPTION_TOOLS_EVENT));
  };

  const devEmailActive = isDeveloper(user);

  return (
    <div
      className="fixed bottom-4 left-4 z-[220] w-[min(100vw-24px,340px)] rounded-2xl border border-white/10 bg-gray-950/65 text-left text-xs text-gray-200 shadow-2xl backdrop-blur-xl"
      data-testid="dev-override-panel"
    >
      <button
        type="button"
        className="flex w-full items-center justify-between gap-2 rounded-t-2xl border-b border-white/10 bg-black/30 px-3 py-2 text-left font-extrabold uppercase tracking-wide text-cyan-200/95 hover:bg-black/40"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <span>DEV OVERRIDE</span>
        <span className="text-[11px] font-semibold text-gray-400">{open ? "▼" : "▶"}</span>
      </button>

      {open ? (
        <div className="max-h-[70vh] space-y-3 overflow-y-auto p-3">
          <div className="text-[11px] leading-snug text-gray-400">
            <div>
              Effective (marketing):{" "}
              <span className="font-bold text-white">{String(effectiveMarketingLabel)}</span>
            </div>
            <div>
              Spec{" "}
              <code className="rounded bg-black/40 px-1 text-[10px] text-gray-200">
                hasPremium
              </code>
              :{" "}
              <span className={specHasPremium ? "font-bold text-emerald-300" : "font-bold text-gray-400"}>
                {specHasPremium ? "true" : "false"}
              </span>
            </div>
            <div className="text-[10px] text-gray-500">
              Effective internal tier:{" "}
              <span className="font-semibold text-gray-300">{getEffectiveSubscriptionTier()}</span>
              {state.simulateExpiredSubscription ? (
                <span className="ml-1 text-rose-300">· simulated expired</span>
              ) : null}
            </div>
            {devEmailActive ? (
              <div className="mt-1 text-[10px] text-emerald-400/90">Developer account match · overrides enabled</div>
            ) : null}
          </div>

          <div>
            <div className="mb-1 text-[10px] font-bold uppercase tracking-wide text-gray-500">Subscription</div>
            <div className="flex flex-wrap gap-1">
              {SUBSCRIPTION_PRESETS.map(({ id, label }) => (
                <button
                  key={id}
                  type="button"
                  className={`rounded-lg px-2 py-1 text-[10px] font-bold ${
                    devSub === id ? "bg-cyan-600 text-white" : "bg-gray-800/90 text-gray-200 hover:bg-gray-700"
                  }`}
                  onClick={() => patchSubscription(id)}
                >
                  {label}
                </button>
              ))}
            </div>
            <button
              type="button"
              className="mt-2 w-full rounded-lg border border-gray-600 py-1 text-[11px] text-gray-300 hover:bg-gray-800/80"
              onClick={() => {
                saveFinal10DevOverride({ subscription: null });
                window.dispatchEvent(new CustomEvent("f10:subscription-tier-updated"));
                window.dispatchEvent(new CustomEvent(DEV_SUBSCRIPTION_TOOLS_EVENT));
              }}
            >
              Clear subscription override (API / stored tier)
            </button>
          </div>

          <div className="rounded-xl border border-white/5 bg-black/25 p-2">
            <div className="mb-1 text-[10px] font-bold uppercase tracking-wide text-gray-500">Force flags</div>
            <ToggleRow
              label="Simulate expired subscription"
              checked={Boolean(state.simulateExpiredSubscription)}
              onChange={(v) => saveFinal10DevOverride({ simulateExpiredSubscription: v })}
            />
          </div>

          <div className="rounded-xl border border-white/5 bg-black/25 p-2">
            <div className="mb-1 text-[10px] font-bold uppercase tracking-wide text-gray-500">Test features</div>
            <div className="space-y-0.5">
              <ToggleRow
                label="Locked Quick Snipes (boost caps)"
                checked={Boolean(ft.lockQuickSnipes)}
                onChange={(v) => setFt("lockQuickSnipes", v)}
              />
              <ToggleRow
                label="Premium deal reveals"
                checked={Boolean(ft.premiumDealReveal)}
                onChange={(v) => setFt("premiumDealReveal", v)}
              />
              <ToggleRow
                label="Premium AI hints"
                checked={Boolean(ft.premiumAiHints)}
                onChange={(v) => setFt("premiumAiHints", v)}
              />
              <ToggleRow
                label="Faster Auctions refresh"
                checked={Boolean(ft.fasterRefresh)}
                onChange={(v) => setFt("fasterRefresh", v)}
              />
              <ToggleRow
                label="Premium Savvy badges"
                checked={Boolean(ft.premiumBadges)}
                onChange={(v) => setFt("premiumBadges", v)}
              />
              <ToggleRow
                label="Savvy Programs (dashboard preview)"
                checked={Boolean(ft.savvyPrograms)}
                onChange={(v) => setFt("savvyPrograms", v)}
              />
              <ToggleRow
                label="Leaderboard VIP effects"
                checked={Boolean(ft.leaderboardEffects)}
                onChange={(v) => setFt("leaderboardEffects", v)}
              />
            </div>
          </div>

          <div className="rounded-xl border border-amber-300/15 bg-amber-950/15 p-2">
            <div className="mb-1 flex items-center justify-between gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wide text-amber-200/85">
                Alert testing
              </span>
              {isTurboAlertModeActive() ? (
                <span className="rounded-full bg-rose-500/85 px-1.5 py-[1px] text-[9px] font-bold uppercase tracking-wider text-white">
                  Turbo · {DEV_ALERT_TURBO_INTERVAL_MS / 1000}s
                </span>
              ) : null}
            </div>

            <div className="mb-2 grid grid-cols-2 gap-1">
              <select
                aria-label="Alert category"
                className="rounded-md border border-white/10 bg-black/40 px-1 py-1 text-[10px] text-gray-200"
                value={alertCategory}
                onChange={(e) => setAlertCategory(e.target.value)}
              >
                {DEV_ALERT_CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
              <select
                aria-label="Alert state"
                className="rounded-md border border-white/10 bg-black/40 px-1 py-1 text-[10px] text-gray-200"
                value={alertState}
                onChange={(e) => setAlertState(e.target.value)}
              >
                {DEV_ALERT_STATES.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="mb-2 flex flex-wrap gap-1">
              {DEV_ALERT_PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className="rounded-lg bg-amber-700/35 px-2 py-1 text-[10px] font-bold text-amber-100 hover:bg-amber-700/55"
                  onClick={() =>
                    fireSimulatedAlert(p.id, {
                      category: alertCategory,
                      state: alertState,
                      routeToQuickSnipes: p.id === "quick_snipe",
                    })
                  }
                >
                  {p.label}
                </button>
              ))}
            </div>

            <div className="mb-2 grid grid-cols-2 gap-1">
              <button
                type="button"
                className="rounded-md bg-fuchsia-900/45 py-1 text-[10px] font-semibold text-fuchsia-100 hover:bg-fuchsia-900/65"
                onClick={() => fireBatchForFilters({ state: alertState })}
              >
                Fire all categories
              </button>
              <button
                type="button"
                className={`rounded-md py-1 text-[10px] font-semibold ${
                  isTurboAlertModeActive()
                    ? "bg-rose-700/70 text-white hover:bg-rose-700/85"
                    : "bg-rose-900/40 text-rose-100 hover:bg-rose-900/60"
                }`}
                onClick={() =>
                  isTurboAlertModeActive()
                    ? stopTurboAlertMode()
                    : startTurboAlertMode({ category: alertCategory, state: alertState })
                }
              >
                {isTurboAlertModeActive() ? "Stop Turbo" : "Turbo Alert Mode"}
              </button>
            </div>

            <div className="mb-2 grid grid-cols-1 gap-0.5">
              <ToggleRow
                label="Alert sound (WebAudio beep)"
                checked={getDevAlertSoundEnabled()}
                onChange={(v) => {
                  setDevAlertSoundEnabled(v);
                  bump((n) => n + 1);
                }}
              />
              <ToggleRow
                label="Push notification UI (browser API)"
                checked={getDevAlertPushUiEnabled()}
                onChange={(v) => {
                  setDevAlertPushUiEnabled(v);
                  if (
                    v &&
                    typeof Notification !== "undefined" &&
                    Notification.permission === "default"
                  ) {
                    void Notification.requestPermission();
                  }
                  bump((n) => n + 1);
                }}
              />
            </div>

            <div className="rounded-md border border-white/5 bg-black/30 p-1.5">
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="text-[9px] font-bold uppercase tracking-wider text-gray-500">
                  Dev log
                </span>
                <button
                  type="button"
                  className="rounded bg-gray-800 px-1.5 py-[1px] text-[9px] font-semibold text-gray-300 hover:bg-gray-700"
                  onClick={() => clearDevAlertLog()}
                >
                  Clear
                </button>
              </div>
              <DevAlertLogList />
            </div>

            <div className="mt-1 text-[9px] leading-snug text-gray-500">
              Mobile QA: panel pins bottom-left, log scrolls inside container — no layout shift on stacked cards.
            </div>
          </div>

          <div>
            <div className="mb-1 text-[10px] font-bold uppercase tracking-wide text-gray-500">Fake Savvy points</div>
            <div className="flex flex-wrap gap-1">
              <button
                type="button"
                className="rounded-lg bg-emerald-900/50 px-2 py-1 text-[11px] font-semibold text-emerald-100 hover:bg-emerald-900/70"
                onClick={() => bumpDevSavvyPointsOffset(1000)}
              >
                +1k
              </button>
              <button
                type="button"
                className="rounded-lg bg-emerald-900/50 px-2 py-1 text-[11px] font-semibold text-emerald-100 hover:bg-emerald-900/70"
                onClick={() => bumpDevSavvyPointsOffset(10000)}
              >
                +10k
              </button>
              <button
                type="button"
                className="rounded-lg bg-gray-800 px-2 py-1 text-[11px] font-semibold text-gray-200 hover:bg-gray-700"
                onClick={() => resetDevSavvyPointsOffset()}
              >
                Reset points
              </button>
            </div>
            <div className="mt-1 text-[10px] text-gray-500">Offset applied on top of server balance (UI only).</div>
          </div>

          <div>
            <div className="mb-1 text-[10px] font-bold uppercase tracking-wide text-gray-500">Bonus</div>
            <div className="flex flex-col gap-1">
              <button
                type="button"
                className="rounded-lg bg-violet-900/45 py-1 text-[11px] font-semibold text-violet-100 hover:bg-violet-900/65"
                onClick={() => unlockAllCallingCardsForDev()}
              >
                Unlock all calling cards
              </button>
              <button
                type="button"
                className="rounded-lg bg-indigo-900/45 py-1 text-[11px] font-semibold text-indigo-100 hover:bg-indigo-900/65"
                onClick={() => devUnlockAllProgramsVerified()}
              >
                Unlock all programs
              </button>
              <button
                type="button"
                className="rounded-lg bg-sky-900/40 py-1 text-[11px] font-semibold text-sky-100 hover:bg-sky-900/55"
                onClick={resetAlertsClient}
              >
                Clear all alerts (client prefs)
              </button>
            </div>
          </div>

          <div className="space-y-1 border-t border-white/10 pt-2">
            <button
              type="button"
              className="w-full rounded-lg bg-amber-900/45 py-1 text-[11px] font-semibold text-amber-100 hover:bg-amber-900/65"
              onClick={resetDailyBestMoves}
            >
              Reset daily Best Moves
            </button>
            <button
              type="button"
              className="w-full rounded-lg bg-rose-950/50 py-1 text-[11px] font-semibold text-rose-100 hover:bg-rose-950/70"
              onClick={resetOnboarding}
            >
              Reset onboarding
            </button>
          </div>

          <div className="text-[10px] leading-snug text-gray-600">
            Persisted in <code className="text-gray-400">localStorage</code> key{" "}
            <code className="text-gray-400">final10_dev_override</code>.
          </div>
        </div>
      ) : null}
    </div>
  );
}

function pad2(n) {
  const s = String(n);
  return s.length >= 2 ? s : `0${s}`;
}

function formatLogTime(ts) {
  const d = new Date(Number(ts) || Date.now());
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
}

function logLineLabel(entry) {
  if (entry.type === "fired") return `Alert triggered: ${entry.title || "(no title)"}`;
  if (entry.type === "premium_gate_shown") return "Premium gate shown";
  if (entry.type === "user_clicked_reveal") return "User clicked reveal";
  if (entry.type === "routed_quick_snipes") return "Routed → Quick Snipes";
  if (entry.type === "turbo_started") return `Turbo Mode started (${entry.detail || ""})`;
  if (entry.type === "turbo_stopped") return "Turbo Mode stopped";
  if (entry.type === "log_cleared") return "Log cleared";
  return entry.type;
}

function logLineTone(entry) {
  if (entry.type === "premium_gate_shown") return "text-amber-300";
  if (entry.type === "user_clicked_reveal") return "text-emerald-300";
  if (entry.type === "routed_quick_snipes") return "text-cyan-300";
  if (entry.type === "turbo_started") return "text-rose-300";
  if (entry.type === "turbo_stopped") return "text-rose-200/80";
  if (entry.type === "log_cleared") return "text-gray-500";
  return "text-gray-200";
}

function DevAlertLogList() {
  const [entries, setEntries] = useState(() => getDevAlertLog());
  useEffect(() => {
    const refresh = () => setEntries(getDevAlertLog());
    window.addEventListener(DEV_ALERT_LOG_EVENT, refresh);
    return () => window.removeEventListener(DEV_ALERT_LOG_EVENT, refresh);
  }, []);
  const recent = entries.slice(-10).reverse();
  if (recent.length === 0) {
    return (
      <div className="text-[10px] italic text-gray-600">
        No simulated alerts yet — fire one to populate.
      </div>
    );
  }
  return (
    <ul className="max-h-32 space-y-0.5 overflow-y-auto pr-1">
      {recent.map((e, i) => (
        <li
          key={`${e.ts}-${e.type}-${i}`}
          className="flex items-start gap-1.5 text-[10px] leading-tight"
        >
          <span className="shrink-0 font-mono text-gray-500">[{formatLogTime(e.ts)}]</span>
          <span className={`min-w-0 truncate ${logLineTone(e)}`} title={logLineLabel(e)}>
            {logLineLabel(e)}
          </span>
        </li>
      ))}
    </ul>
  );
}

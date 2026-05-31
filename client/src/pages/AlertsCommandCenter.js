import React, { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { getAlerts, toggleAlert, deleteAlert, markNotificationsRead } from "../lib/api";
import { SAVVY_ALERT_EVENT } from "../lib/savvyAlerts";
import ProjectAlertsPanel from "../components/projectAlerts/ProjectAlertsPanel";
import SmartAlertCreationWizard from "../components/alerts/SmartAlertCreationWizard";
import { filterAutocompleteSuggestions, normalizeKeyword } from "../lib/smartAlertWizardEngine";
import { SAVVY_SCOUT, SCOUT_LABELS, SCOUT_COPY } from "../config/savvyScoutBranding";
import LoadingState from "../components/ui/states/LoadingState";
import ErrorState from "../components/ui/states/ErrorState";
import EmptyState from "../components/ui/states/EmptyState";
import "../styles/AlertsCommandCenter.css";

const SIGNAL_LINES = [
  "Gamers panic-selling RTX cards tonight.",
  "Jordan 4 market cooling after midnight.",
  "Luxury watches dropping below market.",
  "Sneaker competition weakening.",
  "Low-bid auctions surging.",
];

const HUNTER_STATES = [
  "Savvy is scanning this lane.",
  "Waiting for market weakness.",
  "Seller panic conditions detected.",
  "Low competition window opening.",
  "Price pressure detected.",
  SCOUT_COPY.alerts.sweepActive,
  "Trust spike identified.",
  "Target locked.",
];

const rarity = (a) => {
  const s = Number(a?.minConfidence || 0) + Number(a?.context?.targetPercent || 0);
  if (s >= 180) return "One-of-One Move";
  if (s >= 165) return "Legendary";
  if (s >= 145) return "Elite";
  if (s >= 125) return "Rare";
  if (s >= 105) return "Uncommon";
  return "Common";
};

const target = (a) => (Number.isFinite(Number(a?.maxPrice)) ? `<= $${Number(a.maxPrice).toLocaleString()}` : "--");
const name = (a) => (a?.keywords?.length ? a.keywords.join(" · ") : a?.name || "Alert");

export default function AlertsCommandCenter() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [toast, setToast] = useState("");
  const [watchTopic, setWatchTopic] = useState("");
  const [quickSuggestOpen, setQuickSuggestOpen] = useState(false);
  const [editingAlert, setEditingAlert] = useState(null);
  const [signalIndex, setSignalIndex] = useState(0);
  const [stateIndex, setStateIndex] = useState(0);
  const quickInputRef = useRef(null);

  const load = async () => {
    try {
      setLoading(true);
      setLoadError(null);
      setItems(await getAlerts());
    } catch (e) {
      setLoadError(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);
  useEffect(() => {
    markNotificationsRead("alert_match").catch(() => {});
  }, []);
  useEffect(() => {
    const onClientReset = () => void load();
    window.addEventListener("f10:dev-alerts-client-reset", onClientReset);
    return () => window.removeEventListener("f10:dev-alerts-client-reset", onClientReset);
  }, []);
  useEffect(() => {
    const onCreated = (e) => {
      setToast(e?.detail?.message || "Savvy is scanning this lane now.");
      window.setTimeout(() => setToast(""), 2200);
      void load();
    };
    window.addEventListener(SAVVY_ALERT_EVENT, onCreated);
    return () => window.removeEventListener(SAVVY_ALERT_EVENT, onCreated);
  }, []);
  useEffect(() => {
    const id = window.setInterval(() => setSignalIndex((n) => (n + 1) % SIGNAL_LINES.length), 2800);
    return () => window.clearInterval(id);
  }, []);
  useEffect(() => {
    const id = window.setInterval(() => setStateIndex((n) => (n + 1) % HUNTER_STATES.length), 2200);
    return () => window.clearInterval(id);
  }, []);

  const suggestions = useMemo(() => filterAutocompleteSuggestions(normalizeKeyword(watchTopic), 10), [watchTopic]);
  const activeAlerts = items.filter((a) => a.isActive && a.status !== "triggered");
  const lockOn = Boolean(normalizeKeyword(watchTopic));
  const success = Math.min(100, (lockOn ? 46 : 0) + Math.min(24, watchTopic.length * 2) + Math.min(20, activeAlerts.length * 5));
  const successBand = success >= 74 ? "HIGH CHANCE" : success >= 45 ? "MODERATE" : "RARE OPPORTUNITY";
  const legendaryDetected = items.some((a) => ["Legendary", "One-of-One Move"].includes(rarity(a)));

  const onToggle = async (id) => { await toggleAlert(id); void load(); };
  const onDelete = async (id) => { await deleteAlert(id); if (editingAlert?._id === id) setEditingAlert(null); void load(); };

  return (
    <div className="min-h-screen alerts-cc-bg text-white">
      <div className="alerts-cc-scan" aria-hidden />
      <div className="alerts-cc-grid" aria-hidden />
      <div className="max-w-6xl mx-auto px-4 py-10 pb-20 relative z-10">
        {toast ? <div className="mb-6 rounded-xl border border-emerald-400/40 bg-emerald-500/10 px-4 py-3 text-emerald-100 text-sm">{toast}</div> : null}
        <header className="mb-10 alerts-hero-wrap rounded-3xl p-6 md:p-8 relative overflow-hidden">
          <div className="alerts-radar" /><div className="alerts-radar-ring" /><div className="alerts-signal-wave" />
          <p className="text-xs font-extrabold uppercase tracking-[0.24em] text-amber-300/95 mb-2">Deal Targeting Command Center</p>
          <h1 className="text-3xl md:text-5xl font-black text-white tracking-tight mb-3">LET SAVVY HUNT THIS FOR YOU</h1>
          <p className="text-lg text-slate-300 max-w-2xl leading-relaxed mb-4">Set your target once. Savvy scans the market until the perfect move appears.</p>
          <AnimatePresence mode="wait">
            <motion.div key={stateIndex} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="text-sm text-sky-200">
              {HUNTER_STATES[stateIndex]}
            </motion.div>
          </AnimatePresence>
        </header>
        {legendaryDetected ? <div className="mb-8 rounded-2xl border border-fuchsia-300/45 bg-gradient-to-r from-violet-700/30 via-fuchsia-500/20 to-amber-500/20 px-5 py-3 font-black tracking-wide text-amber-100">⚡ LEGENDARY MOVE DETECTED</div> : null}

        <section className="mb-10 rounded-2xl border border-slate-500/30 bg-slate-950/55 p-6 md:p-8 alerts-panel">
          <h2 className="text-sm font-extrabold uppercase tracking-wider text-violet-200 mb-1">LOCK TARGET</h2>
          <label htmlFor="alerts-quick-topic" className="block text-base font-semibold text-white mb-3">What lane are you hunting?</label>
          <div className="relative max-w-xl">
            <input ref={quickInputRef} id="alerts-quick-topic" type="text" value={watchTopic} onChange={(e) => { setWatchTopic(e.target.value); setQuickSuggestOpen(true); }} onFocus={() => setQuickSuggestOpen(true)} onBlur={() => setTimeout(() => setQuickSuggestOpen(false), 150)} placeholder="PS5 · Jordan 4 · Rolex" className="w-full rounded-xl border border-violet-500/40 bg-slate-950/90 px-4 py-3.5 text-white placeholder:text-slate-500" />
            {quickSuggestOpen && suggestions.length > 0 ? (
              <ul className="absolute z-30 mt-2 w-full max-h-52 overflow-auto rounded-xl border border-gray-700 bg-[#14121c]" role="listbox">
                {suggestions.map((s) => <li key={s}><button type="button" className="w-full text-left px-4 py-2.5 text-sm text-gray-100 hover:bg-amber-500/12" onMouseDown={(e) => e.preventDefault()} onClick={() => { setWatchTopic(s); setQuickSuggestOpen(false); }}>{s}</button></li>)}
              </ul>
            ) : null}
          </div>
          {lockOn ? <div className="alerts-target-acquired mt-4"><div className="alerts-reticle" />TARGET ACQUIRED — confidence, trust, and competition telemetry loading...</div> : null}
        </section>

        <section className="mb-8 grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="rounded-2xl border border-sky-300/30 bg-slate-950/60 p-5 lg:col-span-2">
            <h2 className="text-sm font-extrabold uppercase tracking-wider text-sky-200 mb-1">SUCCESS METER</h2>
            <div className="text-2xl font-black text-white mb-2">{successBand}</div>
            <div className="h-3 rounded-full bg-slate-800 overflow-hidden"><div className="h-full bg-gradient-to-r from-fuchsia-500 via-sky-400 to-emerald-400" style={{ width: `${success}%` }} /></div>
          </div>
          <aside className="rounded-2xl border border-fuchsia-300/35 bg-slate-950/65 p-5">
            <h3 className="text-sm font-extrabold uppercase tracking-wider text-fuchsia-200 mb-2">{SAVVY_SCOUT.shortTitle}</h3>
            <ul className="space-y-2 text-sm text-slate-200">
              <li>• Shift to lower-bid lanes for cleaner entries.</li>
              <li>• Avoid overheated markets with rising bid pressure.</li>
              <li>• Highest hit window: late-night + low watcher cycles.</li>
            </ul>
          </aside>
        </section>

        <section className="mb-10 rounded-2xl border border-violet-400/25 bg-slate-950/55 p-4 md:p-6">
          <h2 className="text-sm font-extrabold uppercase tracking-wider text-violet-200 mb-4">TRACKED TARGET CONFIG</h2>
          <SmartAlertCreationWizard embedded keyword={watchTopic} onKeywordChange={setWatchTopic} editingAlert={editingAlert} onDoneEdit={() => setEditingAlert(null)} onCreated={load} activeAlertCount={items.length} />
        </section>

        <ProjectAlertsPanel onAlertsMayHaveChanged={load} />

        <section className="mt-14" id="active-alerts">
          <h2 className="text-lg font-extrabold text-white mb-1">ACTIVE MONITORING MISSIONS</h2>
          <div className="space-y-4">
            {loading ? (
              <LoadingState variant="inline" label="Loading your alerts…" className="text-left items-stretch" />
            ) : null}
            {!loading && loadError ? (
              <ErrorState
                title="Couldn't load alerts"
                description="Check your connection and try again. Your targets above still work locally."
                error={loadError}
                onRetry={() => void load()}
                retryLabel="Retry"
                className="text-left items-stretch"
              />
            ) : null}
            {!loading && !loadError && items.length === 0 ? (
              <EmptyState
                title="No missions yet"
                description="Lock a target in Lock Target or finish the wizard — Savvy will monitor those lanes for you."
                className="text-left items-stretch"
                action={
                  <button
                    type="button"
                    className="f10-state__retry"
                    onClick={() => document.getElementById("alerts-quick-topic")?.focus()}
                  >
                    Set a target
                  </button>
                }
              />
            ) : null}
            {!loading && !loadError
              ? items.map((a, i) => (
              <article key={`alert-${a._id || i}`} className="rounded-2xl border border-slate-600/40 bg-slate-950/55 px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 alerts-mission-card">
                <div className="min-w-0 flex items-start gap-3">
                  <div className="alerts-mission-thumb">{name(a).slice(0, 1).toUpperCase()}</div>
                  <div className="min-w-0">
                    <div className="font-bold text-white truncate">{name(a)}</div>
                    <div className="text-xs text-fuchsia-200 mb-1">{rarity(a)} • {HUNTER_STATES[i % HUNTER_STATES.length]}</div>
                    <div className="text-xs text-gray-300">Target {target(a)} · {SCOUT_LABELS.confidence} {Math.round(Number(a?.minConfidence || 70))}%</div>
                    {(a.matches || []).length > 0 ? (
                      <div className="mt-2 rounded-lg border border-emerald-500/25 bg-emerald-500/5 px-2 py-1.5 text-[11px] text-emerald-100">
                        <div className="font-bold text-emerald-200/95">
                          {Number(a.triggerCount || (a.matches || []).length)} marketplace hit
                          {Number(a.triggerCount || 0) === 1 ? "" : "s"}
                        </div>
                        <div className="text-emerald-100/90 truncate" title={(a.matches || []).slice(-1)[0]?.auction?.title || ""}>
                          Latest: {(a.matches || []).slice(-1)[0]?.auction?.title || "Listing matched"}
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 shrink-0">
                  <button type="button" onClick={() => onToggle(a._id)} className="rounded-lg border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-xs font-bold text-amber-100">{a.isActive ? "Pause" : "Resume"}</button>
                  <button type="button" onClick={() => onDelete(a._id)} className="rounded-lg border border-red-500/40 bg-red-950/30 px-3 py-2 text-xs font-bold text-red-200">Delete</button>
                </div>
              </article>
            ))
              : null}
          </div>
        </section>

        <section className="mt-14 rounded-2xl border border-cyan-300/25 bg-slate-950/65 p-6">
          <h2 className="text-lg font-extrabold text-white mb-1">LIVE MARKET SIGNALS</h2>
          <AnimatePresence mode="wait">
            <motion.div key={signalIndex} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="rounded-xl border border-sky-300/35 bg-sky-400/5 px-4 py-3 text-sky-100">
              {SIGNAL_LINES[signalIndex]}
            </motion.div>
          </AnimatePresence>
        </section>
      </div>
    </div>
  );
}

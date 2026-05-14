import React, { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { getAlerts, toggleAlert, deleteAlert } from "../lib/api";
import { SAVVY_ALERT_EVENT } from "../lib/savvyAlerts";
import ProjectAlertsPanel from "../components/projectAlerts/ProjectAlertsPanel";
import SmartAlertCreationWizard from "../components/alerts/SmartAlertCreationWizard";
import { filterAutocompleteSuggestions, normalizeKeyword } from "../lib/smartAlertWizardEngine";
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
  "AI sweep active.",
  "Trust spike identified.",
  "Target locked.",
];

const rarityFromAlert = (a) => {
  const c = Number(a?.minConfidence || 0);
  const target = Number(a?.context?.targetPercent || 0);
  const score = c + target;
  if (score >= 180) return "One-of-One Move";
  if (score >= 165) return "Legendary";
  if (score >= 145) return "Elite";
  if (score >= 125) return "Rare";
  if (score >= 105) return "Uncommon";
  return "Common";
};

const alertTarget = (a) => {
  if (a?.maxPrice != null && Number.isFinite(Number(a.maxPrice))) return `<= $${Number(a.maxPrice).toLocaleString()}`;
  const p = Number(a?.context?.targetPercent);
  if (Number.isFinite(p)) return `>= ${Math.round(p)}% off`;
  return "--";
};

const alertTrust = (a) => {
  const c = Number(a?.minConfidence || 0);
  if (c >= 84) return "High Trust";
  if (c <= 64) return "Aggressive";
  return "Balanced";
};

const alertName = (a) => (a?.keywords?.length ? a.keywords.join(" · ") : a?.name || "Alert");

export default function Alerts() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
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
      setItems(await getAlerts());
    } catch (e) {
      setToast(e.message || "Could not load alerts");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);
  useEffect(() => {
    const onReset = () => void load();
    window.addEventListener("f10:dev-alerts-client-reset", onReset);
    return () => window.removeEventListener("f10:dev-alerts-client-reset", onReset);
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

  const quickSuggestions = useMemo(() => filterAutocompleteSuggestions(normalizeKeyword(watchTopic), 10), [watchTopic]);
  const activeAlerts = items.filter((a) => a.isActive && a.status !== "triggered");
  const lockOn = Boolean(normalizeKeyword(watchTopic));
  const success = Math.min(100, (lockOn ? 46 : 0) + Math.min(24, watchTopic.length * 2) + Math.min(20, activeAlerts.length * 5));
  const successBand = success >= 74 ? "HIGH CHANCE" : success >= 45 ? "MODERATE" : "RARE OPPORTUNITY";
  const legendaryDetected = items.some((a) => ["Legendary", "One-of-One Move"].includes(rarityFromAlert(a)));

  const scrollToBuilder = () => document.getElementById("smart-builder")?.scrollIntoView({ behavior: "smooth", block: "start" });
  const onToggle = async (id) => { await toggleAlert(id); void load(); };
  const onDelete = async (id) => { await deleteAlert(id); if (editingAlert?._id === id) setEditingAlert(null); void load(); };

  return (
    <div className="min-h-screen alerts-cc-bg text-white">
      <div className="alerts-cc-scan" aria-hidden />
      <div className="alerts-cc-grid" aria-hidden />
      <div className="max-w-6xl mx-auto px-4 py-10 pb-20 relative z-10">
        {toast ? <div className="mb-6 rounded-xl border border-emerald-400/40 bg-emerald-500/10 px-4 py-3 text-emerald-100 text-sm">{toast}</div> : null}

        <header className="mb-10 alerts-hero-wrap rounded-3xl p-6 md:p-8 relative overflow-hidden">
          <div className="alerts-radar" aria-hidden /><div className="alerts-radar-ring" aria-hidden /><div className="alerts-signal-wave" aria-hidden />
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
            <input
              ref={quickInputRef}
              id="alerts-quick-topic"
              type="text"
              value={watchTopic}
              onChange={(e) => { setWatchTopic(e.target.value); setQuickSuggestOpen(true); }}
              onFocus={() => setQuickSuggestOpen(true)}
              onBlur={() => setTimeout(() => setQuickSuggestOpen(false), 150)}
              placeholder="PS5 · Jordan 4 · Rolex"
              className="w-full rounded-xl border border-violet-500/40 bg-slate-950/90 px-4 py-3.5 text-white placeholder:text-slate-500"
              autoComplete="off"
            />
            {quickSuggestOpen && quickSuggestions.length > 0 ? (
              <ul className="absolute z-30 mt-2 w-full max-h-52 overflow-auto rounded-xl border border-gray-700 bg-[#14121c]" role="listbox">
                {quickSuggestions.map((s) => (
                  <li key={s}>
                    <button type="button" className="w-full text-left px-4 py-2.5 text-sm text-gray-100 hover:bg-amber-500/12" onMouseDown={(e) => e.preventDefault()} onClick={() => { setWatchTopic(s); setQuickSuggestOpen(false); }}>
                      {s}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
          {lockOn ? <div className="alerts-target-acquired mt-4"><div className="alerts-reticle" />TARGET ACQUIRED — confidence, trust, and competition telemetry loading...</div> : null}
          <button
            type="button"
            onClick={() => {
              if (!normalizeKeyword(watchTopic)) { setToast("Add a few words first so Savvy can lock onto a market lane."); window.setTimeout(() => setToast(""), 2200); quickInputRef.current?.focus(); return; }
              scrollToBuilder();
            }}
            className="mt-5 rounded-xl bg-gradient-to-r from-violet-600 to-amber-500 px-6 py-3 text-sm font-extrabold text-white"
          >
            LOCK TARGET
          </button>
        </section>

        <section className="mb-8 grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="rounded-2xl border border-sky-300/30 bg-slate-950/60 p-5 lg:col-span-2">
            <h2 className="text-sm font-extrabold uppercase tracking-wider text-sky-200 mb-1">SUCCESS METER</h2>
            <div className="text-2xl font-black text-white mb-2">{successBand}</div>
            <div className="h-3 rounded-full bg-slate-800 overflow-hidden"><div className="h-full bg-gradient-to-r from-fuchsia-500 via-sky-400 to-emerald-400" style={{ width: `${success}%` }} /></div>
            <div className="mt-2 text-xs text-slate-300">{success}% tactical opportunity confidence</div>
          </div>
          <aside className="rounded-2xl border border-fuchsia-300/35 bg-slate-950/65 p-5">
            <h3 className="text-sm font-extrabold uppercase tracking-wider text-fuchsia-200 mb-2">Savvy Tactical Assistant</h3>
            <ul className="space-y-2 text-sm text-slate-200">
              <li>• Shift to lower-bid lanes for cleaner entries.</li>
              <li>• Avoid overheated markets with rising bid pressure.</li>
              <li>• Highest hit window: late-night + low watcher cycles.</li>
              <li>• Best chance to hit: {lockOn ? normalizeKeyword(watchTopic) : "Select a target"}.</li>
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
          <p className="text-sm text-gray-400 mb-6">Not notifications. Live tactical hunts running 24/7.</p>
          <div className="space-y-4">
            {loading ? (
              <div className="text-gray-500 text-sm py-8">Booting tactical scanner...</div>
            ) : items.length === 0 ? (
              <div className="rounded-xl border border-dashed border-gray-700 bg-gray-950/40 px-6 py-12 text-center text-gray-500 text-sm">No tracked targets yet — lock your first target above.</div>
            ) : (
              items.map((a, index) => (
                <article key={`alert-${a._id || index}`} className="rounded-2xl border border-slate-600/40 bg-slate-950/55 px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 alerts-mission-card">
                  <div className="min-w-0 flex items-start gap-3">
                    <div className="alerts-mission-thumb">{alertName(a).slice(0, 1).toUpperCase()}</div>
                    <div className="min-w-0">
                      <div className="font-bold text-white truncate">{alertName(a)}</div>
                      <div className="text-xs text-fuchsia-200 mb-1">{rarityFromAlert(a)} • {HUNTER_STATES[index % HUNTER_STATES.length]}</div>
                      <div className="text-xs text-gray-300">Target {alertTarget(a)} · Trust {alertTrust(a)} · AI confidence {Math.round(Number(a?.minConfidence || 70))}%</div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 shrink-0">
                    <button type="button" onClick={() => { setEditingAlert(a); setWatchTopic(a.keywords?.length > 0 ? a.keywords.join(" ") : String(a.name || "").trim()); scrollToBuilder(); }} className="rounded-lg border border-gray-600 px-3 py-2 text-xs font-bold text-gray-200 hover:bg-gray-800">Edit</button>
                    <button type="button" onClick={() => onToggle(a._id)} className="rounded-lg border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-xs font-bold text-amber-100 hover:bg-amber-500/20">{a.isActive ? "Pause" : "Resume"}</button>
                    <button type="button" onClick={() => onDelete(a._id)} className="rounded-lg border border-red-500/40 bg-red-950/30 px-3 py-2 text-xs font-bold text-red-200 hover:bg-red-900/40">Delete</button>
                  </div>
                </article>
              ))
            )}
          </div>
          {!loading && activeAlerts.length > 0 ? <p className="mt-6 text-xs text-gray-600">{activeAlerts.length} tracked targets · Savvy runs checks based on your plan speed.</p> : null}
        </section>

        <section className="mt-14 rounded-2xl border border-cyan-300/25 bg-slate-950/65 p-6">
          <h2 className="text-lg font-extrabold text-white mb-1">LIVE MARKET SIGNALS</h2>
          <p className="text-sm text-slate-400 mb-4">Real-time pattern chatter from Savvy's market sweeps.</p>
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
import React, { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { getAlerts, toggleAlert, deleteAlert } from "../lib/api";
import { SAVVY_ALERT_EVENT } from "../lib/savvyAlerts";
import ProjectAlertsPanel from "../components/projectAlerts/ProjectAlertsPanel";
import SmartAlertCreationWizard from "../components/alerts/SmartAlertCreationWizard";
import { filterAutocompleteSuggestions, normalizeKeyword } from "../lib/smartAlertWizardEngine";
import "../styles/AlertsCommandCenter.css";

function formatAlertTarget(a) {
  if (a?.maxPrice != null && Number.isFinite(Number(a.maxPrice))) {
    return `<= $${Number(a.maxPrice).toLocaleString()}`;
  }
  const p = a?.context?.targetPercent;
  if (Number.isFinite(Number(p))) return `>= ${Math.round(Number(p))}% off`;
  return "--";
}

function formatAlertTrust(a) {
  const t = a?.context?.trustPreset;
  if (t === "high") return "High Trust";
  if (t === "aggressive") return "Aggressive";
  if (t === "balanced") return "Balanced";
  const c = Number(a?.minConfidence);
  if (c >= 84) return "High Trust";
  if (c <= 64) return "Aggressive";
  return "Balanced";
}

function alertItemLabel(a) {
  if (a?.keywords?.length) return a.keywords.join(" · ");
  return a?.name || "Alert";
}

function computeRarity(a) {
  const c = Number(a?.minConfidence || 0);
  const trust = formatAlertTrust(a);
  const target = Number(a?.context?.targetPercent || 0);
  const power = c + target + (trust === "High Trust" ? 16 : trust === "Balanced" ? 8 : 0);
  if (power >= 188) return "One-of-One Move";
  if (power >= 172) return "Legendary";
  if (power >= 150) return "Elite";
  if (power >= 132) return "Rare";
  if (power >= 108) return "Uncommon";
  return "Common";
}

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
  "AI sweep active.",
  "Trust spike identified.",
  "Target locked.",
];

export default function Alerts() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
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
      const data = await getAlerts();
      setItems(data);
    } catch (e) {
      setToast(e.message || "Could not load alerts");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
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
    const id = window.setInterval(() => setSignalIndex((n) => (n + 1) % SIGNAL_LINES.length), 2700);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => setStateIndex((n) => (n + 1) % HUNTER_STATES.length), 2200);
    return () => window.clearInterval(id);
  }, []);

  const quickSuggestions = useMemo(
    () => filterAutocompleteSuggestions(normalizeKeyword(watchTopic), 10),
    [watchTopic]
  );

  const onToggle = async (id) => {
    await toggleAlert(id);
    void load();
  };

  const onDelete = async (id) => {
    await deleteAlert(id);
    if (editingAlert?._id === id) setEditingAlert(null);
    void load();
  };

  const scrollToBuilder = () => {
    document.getElementById("smart-builder")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const activeAlerts = items.filter((a) => a.isActive && a.status !== "triggered");
  const normalizedTopic = normalizeKeyword(watchTopic);
  const lockOnActive = Boolean(normalizedTopic);
  const successScore = Math.min(
    100,
    (normalizedTopic ? 42 : 0) +
      Math.min(24, normalizedTopic.length * 2) +
      (editingAlert ? 18 : 0) +
      Math.min(16, activeAlerts.length * 4)
  );
  const successBand = successScore >= 74 ? "HIGH CHANCE" : successScore >= 45 ? "MODERATE" : "RARE OPPORTUNITY";
  const legendaryExists = items.some((a) => {
    const r = computeRarity(a);
    return r === "Legendary" || r === "One-of-One Move";
  });

  return (
    <div className="min-h-screen alerts-cc-bg text-white">
      <div className="alerts-cc-scan" aria-hidden />
      <div className="alerts-cc-grid" aria-hidden />

      <div className="max-w-6xl mx-auto px-4 py-10 pb-20 relative z-10">
        {toast ? (
          <div className="mb-6 rounded-xl border border-emerald-400/40 bg-emerald-500/10 px-4 py-3 text-emerald-100 text-sm shadow-[0_0_20px_rgba(16,185,129,.25)]">
            {toast}
          </div>
        ) : null}

        <header className="mb-10 alerts-hero-wrap rounded-3xl p-6 md:p-8 relative overflow-hidden">
          <div className="alerts-radar" aria-hidden />
          <div className="alerts-radar-ring" aria-hidden />
          <div className="alerts-signal-wave" aria-hidden />
          <p className="text-xs font-extrabold uppercase tracking-[0.24em] text-amber-300/95 mb-2">Deal Targeting Command Center</p>
          <h1 className="text-3xl md:text-5xl font-black text-white tracking-tight mb-3">
            LET SAVVY HUNT THIS FOR YOU
          </h1>
          <p className="text-lg text-slate-300 max-w-2xl leading-relaxed mb-4">
            Set your target once. Savvy scans the market until the perfect move appears.
          </p>
          <div className="alerts-hero-ticker">
            <AnimatePresence mode="wait">
              <motion.div
                key={`${stateIndex}-${HUNTER_STATES[stateIndex]}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="text-sm text-sky-200"
              >
                {HUNTER_STATES[stateIndex]}
              </motion.div>
            </AnimatePresence>
          </div>
        </header>

        {legendaryExists ? (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8 rounded-2xl border border-fuchsia-300/45 bg-gradient-to-r from-violet-700/30 via-fuchsia-500/20 to-amber-500/20 px-5 py-3 font-black tracking-wide text-amber-100 shadow-[0_0_24px_rgba(217,70,239,.28)]"
          >
            ⚡ LEGENDARY MOVE DETECTED
          </motion.div>
        ) : null}

        <section className="mb-10 rounded-2xl border border-slate-500/30 bg-slate-950/55 p-6 md:p-8 backdrop-blur-sm alerts-panel">
          <h2 className="text-sm font-extrabold uppercase tracking-wider text-violet-200 mb-1">LOCK TARGET</h2>
          <label htmlFor="alerts-quick-topic" className="block text-base font-semibold text-white mb-3">
            What lane are you hunting?
          </label>
          <div className="relative max-w-xl">
            <input
              ref={quickInputRef}
              id="alerts-quick-topic"
              type="text"
              value={watchTopic}
              onChange={(e) => {
                setWatchTopic(e.target.value);
                setQuickSuggestOpen(true);
              }}
              onFocus={() => setQuickSuggestOpen(true)}
              onBlur={() => setTimeout(() => setQuickSuggestOpen(false), 150)}
              placeholder="PS5 · Jordan 4 · Rolex · RTX 4090..."
              className="w-full rounded-xl border border-violet-500/40 bg-slate-950/90 px-4 py-3.5 text-white placeholder:text-slate-500 focus:border-amber-400/65 focus:ring-2 focus:ring-amber-400/20 outline-none text-base"
              autoComplete="off"
            />
            {quickSuggestOpen && quickSuggestions.length > 0 ? (
              <ul className="absolute z-30 mt-2 w-full max-h-52 overflow-auto rounded-xl border border-gray-700 bg-[#14121c] shadow-2xl" role="listbox">
                {quickSuggestions.map((s) => (
                  <li key={s}>
                    <button
                      type="button"
                      className="w-full text-left px-4 py-2.5 text-sm text-gray-100 hover:bg-amber-500/12"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        setWatchTopic(s);
                        setQuickSuggestOpen(false);
                      }}
                    >
                      {s}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          {lockOnActive ? (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="alerts-target-acquired mt-4">
              <div className="alerts-reticle" aria-hidden />
              <div className="font-black tracking-[0.12em] text-emerald-200">TARGET ACQUIRED</div>
              <div className="text-sm text-slate-200">Confidence meter, trust scan, and competition pressure are loading...</div>
            </motion.div>
          ) : null}

          <button
            type="button"
            onClick={() => {
              if (!normalizeKeyword(watchTopic)) {
                setToast("Add a few words first so Savvy can lock onto a market lane.");
                window.setTimeout(() => setToast(""), 2200);
                quickInputRef.current?.focus();
                return;
              }
              scrollToBuilder();
            }}
            className="mt-5 rounded-xl bg-gradient-to-r from-violet-600 to-amber-500 px-6 py-3 text-sm font-extrabold text-white hover:brightness-105 shadow-[0_0_20px_rgba(124,58,237,.3)]"
          >
            LOCK TARGET
          </button>
        </section>

        <section className="mb-8 grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="rounded-2xl border border-sky-300/30 bg-slate-950/60 p-5 lg:col-span-2">
            <h2 className="text-sm font-extrabold uppercase tracking-wider text-sky-200 mb-1 px-1">SUCCESS METER</h2>
            <div className="text-2xl font-black text-white mb-2">{successBand}</div>
            <div className="h-3 rounded-full bg-slate-800 overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-fuchsia-500 via-sky-400 to-emerald-400"
                initial={{ width: 0 }}
                animate={{ width: `${successScore}%` }}
                transition={{ type: "spring", stiffness: 120, damping: 20 }}
              />
            </div>
            <div className="mt-2 text-xs text-slate-300">{successScore}% tactical opportunity confidence</div>
          </div>
          <aside className="rounded-2xl border border-fuchsia-300/35 bg-slate-950/65 p-5">
            <h3 className="text-sm font-extrabold uppercase tracking-wider text-fuchsia-200 mb-2">Savvy Tactical Assistant</h3>
            <ul className="space-y-2 text-sm text-slate-200">
              <li>• Shift to lower-bid lanes for cleaner entries.</li>
              <li>• Avoid overheated markets with rising bid pressure.</li>
              <li>• Highest hit window: late-night + low watcher cycles.</li>
              <li>• Best chance to hit: {lockOnActive ? normalizedTopic : "Select a target"}.</li>
            </ul>
          </aside>
        </section>

        <section className="mb-4">
          <h2 className="text-sm font-extrabold uppercase tracking-wider text-gray-300 mb-1 px-1">ACTIVE MONITORING</h2>
        </section>

        <section className="mb-10 rounded-2xl border border-violet-400/25 bg-slate-950/55 p-4 md:p-6">
          <h2 className="text-sm font-extrabold uppercase tracking-wider text-violet-200 mb-4 px-1">TRACKED TARGET CONFIG</h2>
          <SmartAlertCreationWizard
            embedded
            keyword={watchTopic}
            onKeywordChange={setWatchTopic}
            editingAlert={editingAlert}
            onDoneEdit={() => setEditingAlert(null)}
            onCreated={load}
            activeAlertCount={items.length}
          />
        </section>

        <ProjectAlertsPanel onAlertsMayHaveChanged={load} />

        <section className="mt-14" id="active-alerts">
          <h2 className="text-lg font-extrabold text-white mb-1">ACTIVE MONITORING MISSIONS</h2>
          <p className="text-sm text-gray-400 mb-6">Not notifications. Live tactical hunts running 24/7.</p>
          <div className="space-y-4">
            {loading ? (
              <div className="text-gray-500 text-sm py-8">Booting tactical scanner...</div>
            ) : items.length === 0 ? (
              <div className="rounded-xl border border-dashed border-gray-700 bg-gray-950/40 px-6 py-12 text-center text-gray-500 text-sm">
                No tracked targets yet — lock your first target above.
              </div>
            ) : (
              items.map((a, index) => (
                <article key={`alert-${a._id || index}`} className="rounded-2xl border border-slate-600/40 bg-slate-950/55 px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 alerts-mission-card">
                  <div className="min-w-0 flex items-start gap-3">
                    <div className="alerts-mission-thumb">{alertItemLabel(a).slice(0, 1).toUpperCase()}</div>
                    <div className="min-w-0">
                      <div className="font-bold text-white truncate">{alertItemLabel(a)}</div>
                      <div className="text-xs text-fuchsia-200 mb-1">{computeRarity(a)} • {HUNTER_STATES[index % HUNTER_STATES.length]}</div>
                      <dl className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-xs text-gray-400">
                        <div>
                          <dt className="inline text-gray-600">Tracked target </dt>
                          <dd className="inline text-gray-300 font-semibold">{formatAlertTarget(a)}</dd>
                        </div>
                        <div>
                          <dt className="inline text-gray-600">Trust level </dt>
                          <dd className="inline text-gray-300 font-semibold">{formatAlertTrust(a)}</dd>
                        </div>
                        <div>
                          <dt className="inline text-gray-600">Scan status </dt>
                          <dd className="inline text-gray-300 font-semibold">
                            {a.status === "triggered" ? "Target hit" : a.isActive ? "AI sweep active" : "Monitoring paused"}
                          </dd>
                        </div>
                        <div>
                          <dt className="inline text-gray-600">AI confidence </dt>
                          <dd className="inline text-gray-300 font-semibold">{Math.round(Number(a?.minConfidence || 70))}%</dd>
                        </div>
                      </dl>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingAlert(a);
                        setWatchTopic(a.keywords?.length > 0 ? a.keywords.join(" ") : String(a.name || "").trim());
                        scrollToBuilder();
                      }}
                      className="rounded-lg border border-gray-600 px-3 py-2 text-xs font-bold text-gray-200 hover:bg-gray-800"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => onToggle(a._id)}
                      className="rounded-lg border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-xs font-bold text-amber-100 hover:bg-amber-500/20"
                    >
                      {a.isActive ? "Pause" : "Resume"}
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(a._id)}
                      className="rounded-lg border border-red-500/40 bg-red-950/30 px-3 py-2 text-xs font-bold text-red-200 hover:bg-red-900/40"
                    >
                      Delete
                    </button>
                  </div>
                </article>
              ))
            )}
          </div>
          {!loading && activeAlerts.length > 0 ? (
            <p className="mt-6 text-xs text-gray-600">{activeAlerts.length} tracked targets · Savvy runs checks based on your plan speed.</p>
          ) : null}
        </section>

        <section className="mt-14 rounded-2xl border border-cyan-300/25 bg-slate-950/65 p-6">
          <h2 className="text-lg font-extrabold text-white mb-1">LIVE MARKET SIGNALS</h2>
          <p className="text-sm text-slate-400 mb-4">Real-time pattern chatter from Savvy's market sweeps.</p>
          <AnimatePresence mode="wait">
            <motion.div
              key={`${signalIndex}-${SIGNAL_LINES[signalIndex]}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="rounded-xl border border-sky-300/35 bg-sky-400/5 px-4 py-3 text-sky-100"
            >
              {SIGNAL_LINES[signalIndex]}
            </motion.div>
          </AnimatePresence>
        </section>
      </div>
    </div>
  );
}
*/
/*
import React, { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { getAlerts, toggleAlert, deleteAlert } from "../lib/api";
import { SAVVY_ALERT_EVENT } from "../lib/savvyAlerts";
import ProjectAlertsPanel from "../components/projectAlerts/ProjectAlertsPanel";
import SmartAlertCreationWizard from "../components/alerts/SmartAlertCreationWizard";
import { filterAutocompleteSuggestions, normalizeKeyword } from "../lib/smartAlertWizardEngine";
import "../styles/AlertsCommandCenter.css";

function formatAlertTarget(a) {
  if (a?.maxPrice != null && Number.isFinite(Number(a.maxPrice))) {
    return `<= $${Number(a.maxPrice).toLocaleString()}`;
  }
  const p = a?.context?.targetPercent;
  if (Number.isFinite(Number(p))) return `>= ${Math.round(Number(p))}% off`;
  return "--";
}

function formatAlertTrust(a) {
  const t = a?.context?.trustPreset;
  if (t === "high") return "High Trust";
  if (t === "aggressive") return "Aggressive";
  if (t === "balanced") return "Balanced";
  const c = Number(a?.minConfidence);
  if (c >= 84) return "High Trust";
  if (c <= 64) return "Aggressive";
  return "Balanced";
}

function alertItemLabel(a) {
  if (a?.keywords?.length) return a.keywords.join(" · ");
  return a?.name || "Alert";
}

function computeRarity(a) {
  const c = Number(a?.minConfidence || 0);
  const trust = formatAlertTrust(a);
  const target = Number(a?.context?.targetPercent || 0);
  const power = c + target + (trust === "High Trust" ? 16 : trust === "Balanced" ? 8 : 0);
  if (power >= 188) return "One-of-One Move";
  if (power >= 172) return "Legendary";
  if (power >= 150) return "Elite";
  if (power >= 132) return "Rare";
  if (power >= 108) return "Uncommon";
  return "Common";
}

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
  "AI sweep active.",
  "Trust spike identified.",
  "Target locked.",
];

export default function Alerts() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
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
      const data = await getAlerts();
      setItems(data);
    } catch (e) {
      setToast(e.message || "Could not load alerts");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    const onClientReset = () => {
      void load();
    };
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
    const id = window.setInterval(() => setSignalIndex((n) => (n + 1) % SIGNAL_LINES.length), 2700);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => setStateIndex((n) => (n + 1) % HUNTER_STATES.length), 2200);
    return () => window.clearInterval(id);
  }, []);

  const quickSuggestions = useMemo(
    () => filterAutocompleteSuggestions(normalizeKeyword(watchTopic), 10),
    [watchTopic]
  );

  const onToggle = async (id) => {
    await toggleAlert(id);
    void load();
  };

  const onDelete = async (id) => {
    await deleteAlert(id);
    if (editingAlert?._id === id) setEditingAlert(null);
    void load();
  };

  const scrollToBuilder = () => {
    document.getElementById("smart-builder")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const activeAlerts = items.filter((a) => a.isActive && a.status !== "triggered");
  const normalizedTopic = normalizeKeyword(watchTopic);
  const lockOnActive = Boolean(normalizedTopic);
  const successScore = Math.min(
    100,
    (normalizedTopic ? 42 : 0) +
      Math.min(24, normalizedTopic.length * 2) +
      (editingAlert ? 18 : 0) +
      Math.min(16, activeAlerts.length * 4)
  );
  const successBand = successScore >= 74 ? "HIGH CHANCE" : successScore >= 45 ? "MODERATE" : "RARE OPPORTUNITY";
  const legendaryExists = items.some((a) => {
    const r = computeRarity(a);
    return r === "Legendary" || r === "One-of-One Move";
  });

  return (
    <div className="min-h-screen alerts-cc-bg text-white">
      <div className="alerts-cc-scan" aria-hidden />
      <div className="alerts-cc-grid" aria-hidden />

      <div className="max-w-6xl mx-auto px-4 py-10 pb-20 relative z-10">
        {toast ? (
          <div className="mb-6 rounded-xl border border-emerald-400/40 bg-emerald-500/10 px-4 py-3 text-emerald-100 text-sm shadow-[0_0_20px_rgba(16,185,129,.25)]">
            {toast}
          </div>
        ) : null}

        <header className="mb-10 alerts-hero-wrap rounded-3xl p-6 md:p-8 relative overflow-hidden">
          <div className="alerts-radar" aria-hidden />
          <div className="alerts-radar-ring" aria-hidden />
          <div className="alerts-signal-wave" aria-hidden />
          <p className="text-xs font-extrabold uppercase tracking-[0.24em] text-amber-300/95 mb-2">Deal Targeting Command Center</p>
          <h1 className="text-3xl md:text-5xl font-black text-white tracking-tight mb-3">
            LET SAVVY HUNT THIS FOR YOU
          </h1>
          <p className="text-lg text-slate-300 max-w-2xl leading-relaxed mb-4">
            Set your target once. Savvy scans the market until the perfect move appears.
          </p>
          <div className="alerts-hero-ticker">
            <AnimatePresence mode="wait">
              <motion.div
                key={`${stateIndex}-${HUNTER_STATES[stateIndex]}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="text-sm text-sky-200"
              >
                {HUNTER_STATES[stateIndex]}
              </motion.div>
            </AnimatePresence>
          </div>
        </header>

        {legendaryExists ? (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8 rounded-2xl border border-fuchsia-300/45 bg-gradient-to-r from-violet-700/30 via-fuchsia-500/20 to-amber-500/20 px-5 py-3 font-black tracking-wide text-amber-100 shadow-[0_0_24px_rgba(217,70,239,.28)]"
          >
            ⚡ LEGENDARY MOVE DETECTED
          </motion.div>
        ) : null}

        <section className="mb-10 rounded-2xl border border-slate-500/30 bg-slate-950/55 p-6 md:p-8 backdrop-blur-sm alerts-panel">
          <h2 className="text-sm font-extrabold uppercase tracking-wider text-violet-200 mb-1">LOCK TARGET</h2>
          <label htmlFor="alerts-quick-topic" className="block text-base font-semibold text-white mb-3">
            What lane are you hunting?
          </label>
          <div className="relative max-w-xl">
            <input
              ref={quickInputRef}
              id="alerts-quick-topic"
              type="text"
              value={watchTopic}
              onChange={(e) => {
                setWatchTopic(e.target.value);
                setQuickSuggestOpen(true);
              }}
              onFocus={() => setQuickSuggestOpen(true)}
              onBlur={() => setTimeout(() => setQuickSuggestOpen(false), 150)}
              placeholder="PS5 · Jordan 4 · Rolex · RTX 4090..."
              className="w-full rounded-xl border border-violet-500/40 bg-slate-950/90 px-4 py-3.5 text-white placeholder:text-slate-500 focus:border-amber-400/65 focus:ring-2 focus:ring-amber-400/20 outline-none text-base"
              autoComplete="off"
            />
            {quickSuggestOpen && quickSuggestions.length > 0 ? (
              <ul className="absolute z-30 mt-2 w-full max-h-52 overflow-auto rounded-xl border border-gray-700 bg-[#14121c] shadow-2xl" role="listbox">
                {quickSuggestions.map((s) => (
                  <li key={s}>
                    <button
                      type="button"
                      className="w-full text-left px-4 py-2.5 text-sm text-gray-100 hover:bg-amber-500/12"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        setWatchTopic(s);
                        setQuickSuggestOpen(false);
                      }}
                    >
                      {s}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          {lockOnActive ? (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="alerts-target-acquired mt-4">
              <div className="alerts-reticle" aria-hidden />
              <div className="font-black tracking-[0.12em] text-emerald-200">TARGET ACQUIRED</div>
              <div className="text-sm text-slate-200">Confidence meter, trust scan, and competition pressure are loading...</div>
            </motion.div>
          ) : null}

          <button
            type="button"
            onClick={() => {
              if (!normalizeKeyword(watchTopic)) {
                setToast("Add a few words first so Savvy can lock onto a market lane.");
                window.setTimeout(() => setToast(""), 2200);
                quickInputRef.current?.focus();
                return;
              }
              scrollToBuilder();
            }}
            className="mt-5 rounded-xl bg-gradient-to-r from-violet-600 to-amber-500 px-6 py-3 text-sm font-extrabold text-white hover:brightness-105 shadow-[0_0_20px_rgba(124,58,237,.3)]"
          >
            LOCK TARGET
          </button>
        </section>

        <section className="mb-8 grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="rounded-2xl border border-sky-300/30 bg-slate-950/60 p-5 lg:col-span-2">
            <h2 className="text-sm font-extrabold uppercase tracking-wider text-sky-200 mb-1 px-1">SUCCESS METER</h2>
            <div className="text-2xl font-black text-white mb-2">{successBand}</div>
            <div className="h-3 rounded-full bg-slate-800 overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-fuchsia-500 via-sky-400 to-emerald-400"
                initial={{ width: 0 }}
                animate={{ width: `${successScore}%` }}
                transition={{ type: "spring", stiffness: 120, damping: 20 }}
              />
            </div>
            <div className="mt-2 text-xs text-slate-300">{successScore}% tactical opportunity confidence</div>
          </div>
          <aside className="rounded-2xl border border-fuchsia-300/35 bg-slate-950/65 p-5">
            <h3 className="text-sm font-extrabold uppercase tracking-wider text-fuchsia-200 mb-2">Savvy Tactical Assistant</h3>
            <ul className="space-y-2 text-sm text-slate-200">
              <li>• Shift to lower-bid lanes for cleaner entries.</li>
              <li>• Avoid overheated markets with rising bid pressure.</li>
              <li>• Highest hit window: late-night + low watcher cycles.</li>
              <li>• Best chance to hit: {lockOnActive ? normalizedTopic : "Select a target"}.</li>
            </ul>
          </aside>
        </section>

        <section className="mb-4">
          <h2 className="text-sm font-extrabold uppercase tracking-wider text-gray-300 mb-1 px-1">ACTIVE MONITORING</h2>
        </section>

        <section className="mb-10 rounded-2xl border border-violet-400/25 bg-slate-950/55 p-4 md:p-6">
          <h2 className="text-sm font-extrabold uppercase tracking-wider text-violet-200 mb-4 px-1">TRACKED TARGET CONFIG</h2>
          <SmartAlertCreationWizard
            embedded
            keyword={watchTopic}
            onKeywordChange={setWatchTopic}
            editingAlert={editingAlert}
            onDoneEdit={() => setEditingAlert(null)}
            onCreated={load}
            activeAlertCount={items.length}
          />
        </section>

        <ProjectAlertsPanel onAlertsMayHaveChanged={load} />

        <section className="mt-14" id="active-alerts">
          <h2 className="text-lg font-extrabold text-white mb-1">ACTIVE MONITORING MISSIONS</h2>
          <p className="text-sm text-gray-400 mb-6">Not notifications. Live tactical hunts running 24/7.</p>
          <div className="space-y-4">
            {loading ? (
              <div className="text-gray-500 text-sm py-8">Booting tactical scanner...</div>
            ) : items.length === 0 ? (
              <div className="rounded-xl border border-dashed border-gray-700 bg-gray-950/40 px-6 py-12 text-center text-gray-500 text-sm">
                No tracked targets yet — lock your first target above.
              </div>
            ) : (
              items.map((a, index) => (
                <article key={`alert-${a._id || index}`} className="rounded-2xl border border-slate-600/40 bg-slate-950/55 px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 alerts-mission-card">
                  <div className="min-w-0 flex items-start gap-3">
                    <div className="alerts-mission-thumb">{alertItemLabel(a).slice(0, 1).toUpperCase()}</div>
                    <div className="min-w-0">
                      <div className="font-bold text-white truncate">{alertItemLabel(a)}</div>
                      <div className="text-xs text-fuchsia-200 mb-1">{computeRarity(a)} • {HUNTER_STATES[index % HUNTER_STATES.length]}</div>
                      <dl className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-xs text-gray-400">
                        <div>
                          <dt className="inline text-gray-600">Tracked target </dt>
                          <dd className="inline text-gray-300 font-semibold">{formatAlertTarget(a)}</dd>
                        </div>
                        <div>
                          <dt className="inline text-gray-600">Trust level </dt>
                          <dd className="inline text-gray-300 font-semibold">{formatAlertTrust(a)}</dd>
                        </div>
                        <div>
                          <dt className="inline text-gray-600">Scan status </dt>
                          <dd className="inline text-gray-300 font-semibold">
                            {a.status === "triggered" ? "Target hit" : a.isActive ? "AI sweep active" : "Monitoring paused"}
                          </dd>
                        </div>
                        <div>
                          <dt className="inline text-gray-600">AI confidence </dt>
                          <dd className="inline text-gray-300 font-semibold">{Math.round(Number(a?.minConfidence || 70))}%</dd>
                        </div>
                      </dl>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingAlert(a);
                        setWatchTopic(
                          a.keywords?.length > 0 ? a.keywords.join(" ") : String(a.name || "").trim()
                        );
                        scrollToBuilder();
                      }}
                      className="rounded-lg border border-gray-600 px-3 py-2 text-xs font-bold text-gray-200 hover:bg-gray-800"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => onToggle(a._id)}
                      className="rounded-lg border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-xs font-bold text-amber-100 hover:bg-amber-500/20"
                    >
                      {a.isActive ? "Pause" : "Resume"}
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(a._id)}
                      className="rounded-lg border border-red-500/40 bg-red-950/30 px-3 py-2 text-xs font-bold text-red-200 hover:bg-red-900/40"
                    >
                      Delete
                    </button>
                  </div>
                </article>
              ))
            )}
          </div>
          {!loading && activeAlerts.length > 0 ? (
            <p className="mt-6 text-xs text-gray-600">
              {activeAlerts.length} tracked targets · Savvy runs checks based on your plan speed.
            </p>
          ) : null}
        </section>

        <section className="mt-14 rounded-2xl border border-cyan-300/25 bg-slate-950/65 p-6">
          <h2 className="text-lg font-extrabold text-white mb-1">LIVE MARKET SIGNALS</h2>
          <p className="text-sm text-slate-400 mb-4">Real-time pattern chatter from Savvy's market sweeps.</p>
          <AnimatePresence mode="wait">
            <motion.div
              key={`${signalIndex}-${SIGNAL_LINES[signalIndex]}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="rounded-xl border border-sky-300/35 bg-sky-400/5 px-4 py-3 text-sky-100"
            >
              {SIGNAL_LINES[signalIndex]}
            </motion.div>
          </AnimatePresence>
        </section>
      </div>
    </div>
  );
}
import React, { useEffect, useMemo, useRef, useState } from "react";
import { getAlerts, toggleAlert, deleteAlert } from "../lib/api";
import { SAVVY_ALERT_EVENT } from "../lib/savvyAlerts";
import ProjectAlertsPanel from "../components/projectAlerts/ProjectAlertsPanel";
import SmartAlertCreationWizard from "../components/alerts/SmartAlertCreationWizard";
import { filterAutocompleteSuggestions, normalizeKeyword } from "../lib/smartAlertWizardEngine";

function formatAlertTarget(a) {
  if (a?.maxPrice != null && Number.isFinite(Number(a.maxPrice))) {
    return `≤ $${Number(a.maxPrice).toLocaleString()}`;
  }
  const p = a?.context?.targetPercent;
  if (Number.isFinite(Number(p))) return `≥ ${Math.round(Number(p))}% off`;
  return "—";
}

function formatAlertTrust(a) {
  const t = a?.context?.trustPreset;
  if (t === "high") return "High Trust";
  if (t === "aggressive") return "Aggressive";
  if (t === "balanced") return "Balanced";
  const c = Number(a?.minConfidence);
  if (c >= 84) return "High Trust";
  if (c <= 64) return "Aggressive";
  return "Balanced";
}

function alertItemLabel(a) {
  if (a?.keywords?.length) return a.keywords.join(" · ");
  return a?.name || "Alert";
}

export default function Alerts() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState("");
  const [watchTopic, setWatchTopic] = useState("");
  const [quickSuggestOpen, setQuickSuggestOpen] = useState(false);
  const [editingAlert, setEditingAlert] = useState(null);
  const quickInputRef = useRef(null);

  const load = async () => {
    try {
      setLoading(true);
      const data = await getAlerts();
      setItems(data);
    } catch (e) {
      setToast(e.message || "Could not load alerts");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);
  useEffect(() => {
    const onClientReset = () => {
      void load();
    };
    window.addEventListener("f10:dev-alerts-client-reset", onClientReset);
    return () => window.removeEventListener("f10:dev-alerts-client-reset", onClientReset);
  }, []);
  useEffect(() => {
    const onCreated = (e) => {
      setToast(e?.detail?.message || "Savvy is watching this now.");
      window.setTimeout(() => setToast(""), 2200);
      void load();
    };
    window.addEventListener(SAVVY_ALERT_EVENT, onCreated);
    return () => window.removeEventListener(SAVVY_ALERT_EVENT, onCreated);
  }, []);

  const quickSuggestions = useMemo(
    () => filterAutocompleteSuggestions(normalizeKeyword(watchTopic), 10),
    [watchTopic]
  );

  const onToggle = async (id) => {
    await toggleAlert(id);
    void load();
  };
  const onDelete = async (id) => {
    await deleteAlert(id);
    if (editingAlert?._id === id) setEditingAlert(null);
    void load();
  };

  const scrollToBuilder = () => {
    document.getElementById("smart-builder")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const activeAlerts = items.filter((a) => a.isActive && a.status !== "triggered");

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#08060c] via-[#0b0b12] to-[#12121a] text-white">
      <div className="max-w-4xl mx-auto px-4 py-10 pb-20">
        {toast ? (
          <div className="mb-6 rounded-xl border border-emerald-400/40 bg-emerald-500/10 px-4 py-3 text-emerald-100 text-sm">
            {toast}
          </div>
        ) : null}

        {/* Section 1 — Hero */}
        <header className="mb-12 text-center md:text-left">
          <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-amber-300/90 mb-2">Alerts</p>
          <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight mb-3">
            Let Savvy watch this for you
          </h1>
          <p className="text-lg text-gray-400 max-w-xl leading-relaxed">
            Set it once. We&apos;ll find the deal.
          </p>
        </header>

        {/* Section 2 — Quick create */}
        <section className="mb-12 rounded-2xl border border-white/10 bg-white/[0.03] p-6 md:p-8 backdrop-blur-sm">
          <h2 className="text-sm font-extrabold uppercase tracking-wider text-gray-400 mb-1">Quick create</h2>
          <label htmlFor="alerts-quick-topic" className="block text-base font-semibold text-white mb-3">
            What are you looking for?
          </label>
          <div className="relative max-w-xl">
            <input
              ref={quickInputRef}
              id="alerts-quick-topic"
              type="text"
              value={watchTopic}
              onChange={(e) => {
                setWatchTopic(e.target.value);
                setQuickSuggestOpen(true);
              }}
              onFocus={() => setQuickSuggestOpen(true)}
              onBlur={() => setTimeout(() => setQuickSuggestOpen(false), 150)}
              placeholder="Type a product, model, or brand…"
              className="w-full rounded-xl border border-gray-600 bg-gray-950/90 px-4 py-3.5 text-white placeholder:text-gray-500 focus:border-amber-400/55 focus:ring-2 focus:ring-amber-400/15 outline-none text-base"
              autoComplete="off"
            />
            {quickSuggestOpen && quickSuggestions.length > 0 ? (
              <ul
                className="absolute z-30 mt-2 w-full max-h-52 overflow-auto rounded-xl border border-gray-700 bg-[#14121c] shadow-2xl"
                role="listbox"
              >
                {quickSuggestions.map((s) => (
                  <li key={s}>
                    <button
                      type="button"
                      className="w-full text-left px-4 py-2.5 text-sm text-gray-100 hover:bg-amber-500/12"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        setWatchTopic(s);
                        setQuickSuggestOpen(false);
                      }}
                    >
                      {s}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
          <p className="text-xs text-gray-500 mt-3 max-w-xl">
            Same topic flows into the builder below — no duplicate typing.
          </p>
          <button
            type="button"
            onClick={() => {
              if (!normalizeKeyword(watchTopic)) {
                setToast("Add a few words first so Savvy knows what to scan for.");
                window.setTimeout(() => setToast(""), 2200);
                quickInputRef.current?.focus();
                return;
              }
              scrollToBuilder();
            }}
            className="mt-5 rounded-xl bg-gradient-to-r from-violet-600 to-amber-500 px-6 py-3 text-sm font-extrabold text-white hover:brightness-105"
          >
            Continue to target &amp; trust
          </button>
        </section>

        {/* Section 3 — Smart builder (steps 1–3) · Section 4 AI modal · Section 5 success meter (in-panel) */}
        <section className="mb-6">
          <h2 className="text-sm font-extrabold uppercase tracking-wider text-gray-400 mb-1 px-1">
            Success meter
          </h2>
          <p className="text-xs text-gray-500 mb-4 px-1 max-w-xl">
            As you choose target and trust, Savvy shows{" "}
            <span className="text-emerald-300/90 font-semibold">High chance</span>,{" "}
            <span className="text-amber-200/90 font-semibold">Moderate</span>, or{" "}
            <span className="text-rose-300/90 font-semibold">Rare</span> — so you always know what to expect.
          </p>
        </section>

        <section className="mb-12">
          <h2 className="text-sm font-extrabold uppercase tracking-wider text-gray-400 mb-4 px-1">
            Smart builder
          </h2>
          <SmartAlertCreationWizard
            embedded
            keyword={watchTopic}
            onKeywordChange={setWatchTopic}
            editingAlert={editingAlert}
            onDoneEdit={() => setEditingAlert(null)}
            onCreated={load}
            activeAlertCount={items.length}
          />
        </section>

        {/* Section 4 — AI suggestions copy is inside wizard modal; subsection label for clarity */}
        <p className="sr-only">AI suggestions appear when a target is unusually aggressive for the category.</p>

        <ProjectAlertsPanel onAlertsMayHaveChanged={load} />

        {/* Section 6 — Active alerts */}
        <section className="mt-14" id="active-alerts">
          <h2 className="text-lg font-extrabold text-white mb-1">Active alerts</h2>
          <p className="text-sm text-gray-500 mb-6">Pause anytime. Edit updates the same watch.</p>
          <div className="space-y-4">
            {loading ? (
              <div className="text-gray-500 text-sm py-8">Loading your watches…</div>
            ) : items.length === 0 ? (
              <div className="rounded-xl border border-dashed border-gray-700 bg-gray-950/40 px-6 py-12 text-center text-gray-500 text-sm">
                Nothing here yet — use quick create above and tap <strong className="text-gray-300">Start Watching</strong>.
              </div>
            ) : (
              items.map((a, index) => (
                <article
                  key={`alert-${a._id || index}`}
                  className="rounded-2xl border border-gray-800 bg-gray-950/50 px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
                >
                  <div className="min-w-0">
                    <div className="font-bold text-white truncate">{alertItemLabel(a)}</div>
                    <dl className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-xs text-gray-400">
                      <div>
                        <dt className="inline text-gray-600">Target </dt>
                        <dd className="inline text-gray-300 font-semibold">{formatAlertTarget(a)}</dd>
                      </div>
                      <div>
                        <dt className="inline text-gray-600">Trust </dt>
                        <dd className="inline text-gray-300 font-semibold">{formatAlertTrust(a)}</dd>
                      </div>
                      <div>
                        <dt className="inline text-gray-600">Status </dt>
                        <dd className="inline text-gray-300 font-semibold">
                          {a.status === "triggered" ? "Triggered" : a.isActive ? "Active" : "Paused"}
                        </dd>
                      </div>
                    </dl>
                  </div>
                  <div className="flex flex-wrap gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingAlert(a);
                        setWatchTopic(
                          a.keywords?.length > 0 ? a.keywords.join(" ") : String(a.name || "").trim()
                        );
                        scrollToBuilder();
                      }}
                      className="rounded-lg border border-gray-600 px-3 py-2 text-xs font-bold text-gray-200 hover:bg-gray-800"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => onToggle(a._id)}
                      className="rounded-lg border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-xs font-bold text-amber-100 hover:bg-amber-500/20"
                    >
                      {a.isActive ? "Pause" : "Resume"}
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(a._id)}
                      className="rounded-lg border border-red-500/40 bg-red-950/30 px-3 py-2 text-xs font-bold text-red-200 hover:bg-red-900/40"
                    >
                      Delete
                    </button>
                  </div>
                </article>
              ))
            )}
          </div>
          {!loading && activeAlerts.length > 0 ? (
            <p className="mt-6 text-xs text-gray-600">
              {activeAlerts.length} active · Savvy runs checks based on your plan speed.
            </p>
          ) : null}
        </section>
      </div>
    </div>
  );
}

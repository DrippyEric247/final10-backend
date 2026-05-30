import React, { useMemo, useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createSavvyAlert, SAVVY_ALERT_EVENT } from "../../lib/savvyAlerts";
import { updateAlert } from "../../lib/api";
import { getAlertCreationCapabilities } from "../../lib/alertTierPermissions";
import {
  normalizeKeyword,
  filterAutocompleteSuggestions,
  isTargetUnrealistic,
  unrealisticSuggestionCopy,
  suggestAdjustedPercent,
  computeSuccessMeter,
  successMeterLabel,
  successProbabilityCopy,
  buildSmartAlertPayload,
  inferTrustPresetFromAlert,
  inferTargetFromAlert,
} from "../../lib/smartAlertWizardEngine";

const STEPS = [
  { id: 1, label: "Item" },
  { id: 2, label: "Target" },
  { id: 3, label: "Trust" },
  { id: 4, label: "Confirm" },
];

function TierPitch({ caps }) {
  const { tier, textAi, voiceAi, alertsMax, checkNote } = caps;
  let pitch =
    "Savvy+ adds more smart alerts and faster checks. Pro and Elite unlock the full assistant experience.";
  if (tier === "free") {
    pitch =
      "Free includes manual alerts with Savvy monitoring — upgrade for more smart capacity and richer target coaching.";
  } else if (tier === "core") {
    pitch =
      "Core includes a limited set of smart alerts with improved check speed. Pro adds deeper AI phrasing on targets.";
  } else if (tier === "pro") {
    pitch = "Pro unlocks more alerts, better suggestions, and real-time style monitoring on your watches.";
  } else if (tier === "elite") {
    pitch = "Elite adds voice-first alert setup and maximum real-time priority across the board.";
  }
  return (
    <div className="rounded-xl border border-violet-500/30 bg-violet-950/40 p-4 text-sm text-violet-100/95">
      <div className="font-bold text-violet-200 mb-1">Your plan</div>
      <p className="text-violet-100/85 leading-relaxed mb-2">{pitch}</p>
      <ul className="list-disc pl-5 space-y-1 text-violet-200/80 text-xs">
        <li>Up to {alertsMax === Infinity ? "unlimited" : alertsMax} alerts on this tier.</li>
        <li>AI phrasing on targets: {textAi ? "On" : "Limited (client hints only)"}.</li>
        <li>Voice setup: {voiceAi ? "Available" : "Elite only"}.</li>
        <li>{checkNote}</li>
      </ul>
    </div>
  );
}

export default function SmartAlertCreationWizard({
  onCreated,
  activeAlertCount = 0,
  embedded = false,
  keyword: keywordProp,
  onKeywordChange,
  editingAlert = null,
  onDoneEdit,
}) {
  const navigate = useNavigate();
  const [, setTierRev] = useState(0);
  useEffect(() => {
    const h = () => setTierRev((n) => n + 1);
    window.addEventListener("f10:subscription-tier-updated", h);
    return () => window.removeEventListener("f10:subscription-tier-updated", h);
  }, []);
  const caps = getAlertCreationCapabilities();
  const isKeywordControlled = keywordProp !== undefined && typeof onKeywordChange === "function";
  const [internalKeyword, setInternalKeyword] = useState("");
  const keyword = isKeywordControlled ? keywordProp : internalKeyword;
  const setKeyword = (v) => {
    if (isKeywordControlled) onKeywordChange(v);
    else setInternalKeyword(v);
  };

  const [step, setStep] = useState(1);
  const [targetMode, setTargetMode] = useState("percent");
  const [targetPercent, setTargetPercent] = useState(50);
  const [maxPrice, setMaxPrice] = useState("");
  const [trust, setTrust] = useState("balanced");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showAiGate, setShowAiGate] = useState(false);
  const inputRef = useRef(null);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);

  const kw = normalizeKeyword(keyword);
  const suggestions = useMemo(() => filterAutocompleteSuggestions(kw, 10), [kw]);

  useEffect(() => {
    if (step === 1) inputRef.current?.focus();
  }, [step]);

  useEffect(() => {
    if (!editingAlert) {
      setStep(1);
      return;
    }
    const text =
      editingAlert.keywords?.length > 0
        ? editingAlert.keywords.join(" ")
        : String(editingAlert.name || "").trim();
    setKeyword(text);
    const { targetMode: tm, targetPercent: tp, maxPrice: mp } = inferTargetFromAlert(editingAlert);
    setTargetMode(tm);
    setTargetPercent(tp);
    setMaxPrice(mp || "");
    setTrust(inferTrustPresetFromAlert(editingAlert));
    setStep(4);
  }, [editingAlert?._id]); // eslint-disable-line react-hooks/exhaustive-deps -- hydrate edit session

  const atCap =
    Number.isFinite(caps.alertsMax) && activeAlertCount >= caps.alertsMax;

  const unrealistic =
    targetMode === "percent" && kw.length > 1 && isTargetUnrealistic(kw, targetPercent);

  const meterInputPercent = targetMode === "percent" ? targetPercent : 18;

  const meter = useMemo(
    () => computeSuccessMeter(trust, meterInputPercent, kw),
    [trust, meterInputPercent, kw]
  );

  const goNextFromStep2 = () => {
    setError("");
    if (!kw) {
      setError("Enter something to watch — a product, brand, or model.");
      return;
    }
    if (targetMode === "price") {
      if (!maxPrice || !Number.isFinite(Number(maxPrice)) || Number(maxPrice) <= 0) {
        setError("Enter a maximum price (USD) so Savvy knows when to ping you.");
        return;
      }
      setStep(3);
      return;
    }
    if (unrealistic) {
      setShowAiGate(true);
      return;
    }
    setStep(3);
  };

  const resolveAiAdjust = () => {
    setTargetPercent(suggestAdjustedPercent(kw));
    setShowAiGate(false);
    setStep(3);
  };

  const resolveAiKeep = () => {
    setShowAiGate(false);
    setStep(3);
  };

  const resolveAiDeals = () => {
    navigate(`/local-deals?q=${encodeURIComponent(kw)}`);
  };

  const handleStartWatching = async () => {
    setError("");
    if (atCap && !editingAlert) {
      setError(`You’re at the alert limit for your plan (${caps.alertsMax}). Remove one or upgrade.`);
      return;
    }
    setSaving(true);
    try {
      const maxPriceNum =
        targetMode === "price" && maxPrice !== "" && Number.isFinite(Number(maxPrice))
          ? Number(maxPrice)
          : undefined;
      const payload = buildSmartAlertPayload({
        keyword: kw,
        targetMode,
        targetPercent: targetMode === "percent" ? targetPercent : undefined,
        maxPrice: maxPriceNum,
        trustPreset: trust,
      });
      if (editingAlert?._id) {
        await updateAlert(editingAlert._id, {
          name: payload.name,
          keywords: payload.keywords,
          maxPrice: payload.maxPrice,
          minConfidence: payload.minConfidence,
          kind: payload.kind,
          context: payload.context,
        });
        try {
          window.dispatchEvent(
            new CustomEvent(SAVVY_ALERT_EVENT, {
              detail: { message: "Alert updated — Savvy is still watching." },
            })
          );
        } catch {
          /* ignore */
        }
        onDoneEdit?.();
      } else {
        await createSavvyAlert(payload);
      }
      onCreated?.();
      setStep(1);
      setKeyword("");
      setTargetPercent(50);
      setMaxPrice("");
      setTrust("balanced");
      setTargetMode("percent");
      setShowAiGate(false);
    } catch (e) {
      setError(e?.message || "Could not save alert");
    } finally {
      setSaving(false);
    }
  };

  const pctButtons = [25, 50, 75];

  return (
    <div
      id={embedded ? "smart-builder" : undefined}
      className="rounded-2xl border border-amber-400/25 bg-gradient-to-b from-[#14121f] to-[#0c0a12] p-6 md:p-8 shadow-[0_0_40px_rgba(250,204,21,0.08)]"
    >
      {!embedded ? (
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-8">
          <div>
            <h2 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">Smart Alerts</h2>
            <p className="text-amber-200/80 text-sm font-semibold mt-1">Set &amp; forget — Savvy already optimized the defaults.</p>
            <p className="text-gray-400 text-sm mt-2 max-w-xl leading-relaxed">
              A guided flow so you don&apos;t have to think about filters. We&apos;ll watch the market and
              ping you when your deal shows up.
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            {STEPS.map((s) => (
              <div
                key={s.id}
                className={`px-3 py-1.5 rounded-full text-xs font-bold border ${
                  step >= s.id
                    ? "border-amber-400/60 bg-amber-500/15 text-amber-100"
                    : "border-gray-700 text-gray-500"
                }`}
              >
                {s.id}. {s.label}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
          <div>
            <h3 className="text-lg font-extrabold text-white">Smart builder</h3>
            <p className="text-xs text-gray-500 mt-0.5">Three quick steps — Savvy fills in the rest.</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            {STEPS.map((s) => (
              <div
                key={s.id}
                className={`px-2.5 py-1 rounded-full text-[11px] font-bold border ${
                  step >= s.id
                    ? "border-amber-400/60 bg-amber-500/15 text-amber-100"
                    : "border-gray-700 text-gray-500"
                }`}
              >
                {s.id}. {s.label}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {error ? (
            <div className="rounded-lg border border-red-500/40 bg-red-950/40 px-4 py-2 text-sm text-red-100">
              {error}
            </div>
          ) : null}

          {step === 1 && (
            <section className="space-y-4">
              <label className="block text-sm font-semibold text-gray-200">1. Item</label>
              <div className="relative">
                <input
                  ref={inputRef}
                  type="text"
                  value={keyword}
                  onChange={(e) => {
                    setKeyword(e.target.value);
                    setSuggestionsOpen(true);
                  }}
                  onFocus={() => setSuggestionsOpen(true)}
                  onBlur={() => setTimeout(() => setSuggestionsOpen(false), 160)}
                  placeholder="e.g. PS5, iPhone 15 Pro, Jordan 1…"
                  className="w-full rounded-xl border border-gray-600 bg-gray-950/80 px-4 py-3 text-white placeholder:text-gray-500 focus:border-amber-400/60 focus:ring-2 focus:ring-amber-400/20 outline-none"
                  autoComplete="off"
                />
                {suggestionsOpen && suggestions.length > 0 ? (
                  <ul
                    className="absolute z-20 mt-1 w-full max-h-52 overflow-auto rounded-xl border border-gray-700 bg-gray-900 shadow-xl"
                    role="listbox"
                  >
                    {suggestions.map((s) => (
                      <li key={s}>
                        <button
                          type="button"
                          className="w-full text-left px-4 py-2.5 text-sm text-gray-100 hover:bg-amber-500/15"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => {
                            setKeyword(s);
                            setSuggestionsOpen(false);
                          }}
                        >
                          {s}
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
              <p className="text-xs text-gray-500">Keyword is stored as the watch topic — you can refine on the next step.</p>
              <button
                type="button"
                onClick={() => {
                  if (!normalizeKeyword(keyword)) {
                    setError("Type at least one keyword.");
                    return;
                  }
                  setError("");
                  setStep(2);
                }}
                className="rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 px-6 py-3 font-extrabold text-gray-900 hover:brightness-105"
              >
                Continue
              </button>
            </section>
          )}

          {step === 2 && (
            <section className="space-y-5">
              <div className="text-sm font-semibold text-gray-200">2. Target (price or %)</div>
              <div className="flex gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => setTargetMode("percent")}
                  className={`rounded-lg px-4 py-2 text-sm font-bold border ${
                    targetMode === "percent"
                      ? "border-amber-400 bg-amber-500/20 text-amber-100"
                      : "border-gray-600 text-gray-400"
                  }`}
                >
                  % off (deal depth)
                </button>
                <button
                  type="button"
                  onClick={() => setTargetMode("price")}
                  className={`rounded-lg px-4 py-2 text-sm font-bold border ${
                    targetMode === "price"
                      ? "border-amber-400 bg-amber-500/20 text-amber-100"
                      : "border-gray-600 text-gray-400"
                  }`}
                >
                  Max price
                </button>
              </div>

              {targetMode === "percent" ? (
                <div className="space-y-4">
                  <div className="flex gap-2 flex-wrap">
                    {pctButtons.map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setTargetPercent(p)}
                        className={`min-w-[4.5rem] rounded-lg px-4 py-3 font-extrabold border ${
                          targetPercent === p
                            ? "border-amber-400 bg-amber-500/25 text-white"
                            : "border-gray-600 text-gray-300 hover:border-gray-500"
                        }`}
                      >
                        {p}%
                      </button>
                    ))}
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">Fine tune ({targetPercent}%)</label>
                    <input
                      type="range"
                      min={5}
                      max={90}
                      value={targetPercent}
                      onChange={(e) => setTargetPercent(Number(e.target.value))}
                      className="w-full accent-amber-400"
                    />
                  </div>
                </div>
              ) : (
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Maximum price (USD)</label>
                  <input
                    type="number"
                    min={1}
                    value={maxPrice}
                    onChange={(e) => setMaxPrice(e.target.value)}
                    placeholder="e.g. 450"
                    className="w-full rounded-xl border border-gray-600 bg-gray-950/80 px-4 py-3 text-white"
                  />
                </div>
              )}

              <div className="flex gap-3 flex-wrap">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="rounded-lg border border-gray-600 px-4 py-2 text-sm font-semibold text-gray-300 hover:bg-gray-800"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={goNextFromStep2}
                  className="rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 px-6 py-3 font-extrabold text-gray-900"
                >
                  Continue
                </button>
              </div>
            </section>
          )}

          {step === 3 && (
            <section className="space-y-4">
              <div className="text-sm font-semibold text-gray-200">3. Trust level</div>
              <div className="grid sm:grid-cols-3 gap-3">
                {[
                  { id: "high", title: "High Trust", sub: "Fewer hits, safer sellers." },
                  { id: "balanced", title: "Balanced", sub: "Default — speed + safety." },
                  { id: "aggressive", title: "Aggressive", sub: "More deals, more noise." },
                ].map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setTrust(opt.id)}
                    className={`rounded-xl border p-4 text-left transition ${
                      trust === opt.id
                        ? "border-amber-400 bg-amber-500/15 shadow-[0_0_20px_rgba(250,204,21,0.12)]"
                        : "border-gray-700 bg-gray-900/40 hover:border-gray-500"
                    }`}
                  >
                    <div className="font-extrabold text-white">{opt.title}</div>
                    <div className="text-xs text-gray-400 mt-1">{opt.sub}</div>
                    {opt.id === "balanced" ? (
                      <span className="mt-2 inline-block text-[10px] font-bold uppercase tracking-wider text-amber-300/90">
                        Recommended
                      </span>
                    ) : null}
                  </button>
                ))}
              </div>
              <div className="rounded-lg border border-gray-700/80 bg-gray-950/50 px-4 py-3 text-xs text-gray-400">
                <span className="text-emerald-300/90 font-bold">Success outlook: </span>
                {successMeterLabel(meter)} — {successProbabilityCopy(meter)}
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="rounded-lg border border-gray-600 px-4 py-2 text-sm font-semibold text-gray-300"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={() => setStep(4)}
                  className="rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 px-6 py-3 font-extrabold text-gray-900"
                >
                  Review
                </button>
              </div>
            </section>
          )}

          {step === 4 && (
            <section className="space-y-5">
              <h3 className="text-lg font-bold text-white">You&apos;re one tap away</h3>
              <dl className="grid gap-3 text-sm">
                <div className="flex justify-between gap-4 border-b border-gray-800 pb-2">
                  <dt className="text-gray-500">Watching</dt>
                  <dd className="text-white font-semibold text-right">{kw}</dd>
                </div>
                <div className="flex justify-between gap-4 border-b border-gray-800 pb-2">
                  <dt className="text-gray-500">Target</dt>
                  <dd className="text-white font-semibold text-right">
                    {targetMode === "percent" ? `≥ ${targetPercent}% off typical listings` : maxPrice ? `≤ $${Number(maxPrice).toLocaleString()}` : "—"}
                  </dd>
                </div>
                <div className="flex justify-between gap-4 border-b border-gray-800 pb-2">
                  <dt className="text-gray-500">Trust</dt>
                  <dd className="text-white font-semibold text-right capitalize">{trust}</dd>
                </div>
                <div className="flex justify-between gap-4 pb-1">
                  <dt className="text-gray-500">Match likelihood</dt>
                  <dd className="text-right">
                    <span
                      className={`inline-block rounded-full px-3 py-1 text-xs font-extrabold ${
                        meter === "high"
                          ? "bg-emerald-500/25 text-emerald-200"
                          : meter === "moderate"
                            ? "bg-amber-500/25 text-amber-100"
                            : "bg-rose-500/20 text-rose-100"
                      }`}
                    >
                      {successMeterLabel(meter)}
                    </span>
                  </dd>
                </div>
              </dl>
              <p className="text-xs text-gray-500 leading-relaxed">{successProbabilityCopy(meter)}</p>
              {caps.voiceAi ? (
                <p className="text-xs text-violet-300/90">
                  Elite: you can also say this alert aloud from the assistant — same watch, zero typing.
                </p>
              ) : null}
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  className="rounded-lg border border-gray-600 px-4 py-2 text-sm font-semibold text-gray-300"
                >
                  Back
                </button>
                <button
                  type="button"
                  disabled={saving || (atCap && !editingAlert)}
                  onClick={handleStartWatching}
                  className="rounded-xl bg-gradient-to-r from-emerald-400 to-cyan-500 px-8 py-3.5 font-extrabold text-gray-900 disabled:opacity-40"
                >
                  {saving ? "Saving…" : editingAlert ? "Save changes" : "Start Watching"}
                </button>
              </div>
            </section>
          )}
        </div>

        <div className="space-y-4">
          <TierPitch caps={caps} />
          {!embedded ? (
            <div className="rounded-xl border border-gray-700 bg-gray-900/50 p-4 text-xs text-gray-400 leading-relaxed">
              <span className="text-gray-200 font-bold">Why this feels effortless</span>
              <p className="mt-2">
                Defaults are tuned for real eBay behavior. Savvy picks confidence thresholds so you spend less
                time tweaking and more time winning.
              </p>
            </div>
          ) : (
            <div className="rounded-xl border border-gray-800 bg-gray-950/60 p-4 text-xs text-gray-400 leading-relaxed">
              <span className="text-gray-200 font-bold">Success meter</span>
              <p className="mt-2 text-gray-300">
                Outlook: <span className="font-extrabold text-amber-200">{successMeterLabel(meter)}</span> —{" "}
                {successProbabilityCopy(meter)}
              </p>
            </div>
          )}
        </div>
      </div>

      {showAiGate ? (
        <div
          className="fixed inset-0 z-[140] flex items-center justify-center bg-black/75 px-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="smart-ai-title"
          onClick={() => setShowAiGate(false)}
        >
          <div
            className="max-w-md w-full rounded-2xl border border-amber-400/40 bg-[#111019] p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="smart-ai-title" className="text-lg font-extrabold text-amber-100 mb-2">
              Savvy suggestion
            </h3>
            <p className="text-gray-200 text-sm font-semibold leading-relaxed mb-2">
              That&apos;s a rare catch. Most deals are 10–20% off.
            </p>
            <p className="text-gray-400 text-xs leading-relaxed mb-4">
              {unrealisticSuggestionCopy(kw)} — your target is {targetPercent}% off.
            </p>
            {!caps.textAi ? (
              <p className="text-xs text-violet-300/90 mb-4">
                Pro+ unlocks deeper personalization here — you still get this guardrail on every plan.
              </p>
            ) : null}
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={resolveAiAdjust}
                className="w-full rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 py-3 font-extrabold text-gray-900"
              >
                Adjust
              </button>
              <button
                type="button"
                onClick={resolveAiKeep}
                className="w-full rounded-xl border border-gray-500 py-3 font-semibold text-gray-100 hover:bg-gray-800"
              >
                Keep
              </button>
              <button
                type="button"
                onClick={resolveAiDeals}
                className="w-full rounded-xl border border-cyan-500/40 py-3 font-semibold text-cyan-100 hover:bg-cyan-950/40"
              >
                Show current deals
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

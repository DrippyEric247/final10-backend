import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Mic, PenLine } from "lucide-react";
import { createSavvyAlert } from "../../lib/savvyAlerts";
import {
  DEV_SUBSCRIPTION_TOOLS_EVENT,
  formatTierMultiplierLabel,
  getAdvantageTier,
  getEffectiveSubscriptionTier,
} from "../../lib/tierMultiplier";
import { getAlertCreationCapabilities } from "../../lib/alertTierPermissions";
import {
  formatAiAlertConfirmation,
  parseNaturalLanguageAlert,
} from "../../lib/aiAlertParser";
import { trackUpgradeClicked } from "../../lib/analytics";

function getSpeechRecognitionCtor() {
  if (typeof window === "undefined") return null;
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

export default function SavvyAlertButton({
  label = "Track this",
  payload,
  className = "",
  onCreated = undefined,
  tone = "default",
}) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [chooserOpen, setChooserOpen] = useState(false);
  const [currentTier, setCurrentTier] = useState(() => getEffectiveSubscriptionTier());
  const [nlText, setNlText] = useState("");
  const [voiceListening, setVoiceListening] = useState(false);
  const [savvyReply, setSavvyReply] = useState("");
  const [upgradeHint, setUpgradeHint] = useState(null);
  const navigate = useNavigate();

  const toneClass =
    tone === "seller"
      ? "border-cyan-400/40 bg-cyan-500/10 text-cyan-100 hover:bg-cyan-500/20"
      : "border-purple-400/40 bg-purple-500/10 text-purple-100 hover:bg-purple-500/20";

  const caps = getAlertCreationCapabilities(currentTier);
  const activeTier = getAdvantageTier(currentTier);

  useEffect(() => {
    const onTier = () => setCurrentTier(getEffectiveSubscriptionTier());
    window.addEventListener("f10:subscription-tier-updated", onTier);
    window.addEventListener(DEV_SUBSCRIPTION_TOOLS_EVENT, onTier);
    return () => {
      window.removeEventListener("f10:subscription-tier-updated", onTier);
      window.removeEventListener(DEV_SUBSCRIPTION_TOOLS_EVENT, onTier);
    };
  }, []);

  useEffect(() => {
    if (!chooserOpen) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") setChooserOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [chooserOpen]);

  useEffect(() => {
    if (!chooserOpen) return undefined;
    setNlText("");
    setMsg("");
    setSavvyReply("");
    setUpgradeHint(null);
    const tierCaps = getAlertCreationCapabilities(currentTier);
    const seed = String(payload?.name || payload?.keywords?.[0] || "").trim();
    if (seed && tierCaps.textAi) {
      const hint = payload?.maxPrice
        ? `${seed} under $${Math.round(Number(payload.maxPrice))}`
        : seed;
      setNlText(hint);
    }
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- seed when modal opens; avoid payload identity churn
  }, [chooserOpen, currentTier]);

  const finishCreate = useCallback(
    async (mergedPayload) => {
      if (busy) return;
      setBusy(true);
      setMsg("");
      setSavvyReply("");
      try {
        const created = await createSavvyAlert(mergedPayload);
        setMsg("Savvy is watching this now.");
        onCreated?.(created);
        setChooserOpen(false);
        trackUpgradeClicked("savvy_alert_after_create", {
          trigger: "alert_created",
          tier: currentTier,
        });
        navigate(`/premium?trigger=alert_created&tier=${encodeURIComponent(currentTier)}`);
        window.setTimeout(() => setMsg(""), 2200);
      } catch (error) {
        setMsg(error?.message || "Could not create alert");
        window.setTimeout(() => setMsg(""), 3200);
      } finally {
        setBusy(false);
      }
    },
    [busy, navigate, onCreated, currentTier]
  );

  const handleManualCreate = () => {
    const manualPayload = {
      ...payload,
      context: {
        ...(payload?.context || {}),
        creationMode: "manual",
      },
    };
    finishCreate(manualPayload);
  };

  const handleTextAiCreate = () => {
    if (!caps.textAi) {
      setUpgradeHint("text_ai");
      window.setTimeout(() => {
        trackUpgradeClicked("savvy_alert_text_ai_gate", {
          trigger: "alert_text_ai",
          target: "savvy_pro",
        });
        navigate("/premium?trigger=alert_text_ai&target=savvy_pro");
      }, 400);
      return;
    }
    try {
      const parsed = parseNaturalLanguageAlert(nlText, payload);
      finishCreate(parsed);
    } catch (e) {
      setMsg(e?.message || "Could not read that alert");
      window.setTimeout(() => setMsg(""), 2800);
    }
  };

  const handleMicClick = () => {
    if (!caps.voiceAi) {
      setUpgradeHint("voice_ai");
      window.setTimeout(() => {
        trackUpgradeClicked("savvy_alert_voice_ai_gate", {
          trigger: "alert_voice_ai",
          target: "savvy_elite",
        });
        navigate("/premium?trigger=alert_voice_ai&target=savvy_elite");
      }, 400);
      return;
    }

    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) {
      setMsg("Voice alerts need a browser with speech recognition (try Chrome).");
      window.setTimeout(() => setMsg(""), 3200);
      return;
    }

    const recognition = new Ctor();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setNlText(transcript);
      setVoiceListening(false);
      void (async () => {
        setBusy(true);
        setMsg("");
        try {
          const parsed = parseNaturalLanguageAlert(transcript, payload);
          const withVoice = {
            ...parsed,
            context: {
              ...(parsed.context || {}),
              creationMode: "voice_ai",
              voiceTranscript: transcript,
            },
          };
          const created = await createSavvyAlert(withVoice);
          setSavvyReply(formatAiAlertConfirmation(withVoice));
          onCreated?.(created);
          setMsg("Savvy is watching this now.");
          window.setTimeout(() => {
            setChooserOpen(false);
            trackUpgradeClicked("savvy_alert_after_create_voice", {
              trigger: "alert_created_voice",
              tier: currentTier,
            });
            navigate(`/premium?trigger=alert_created_voice&tier=${encodeURIComponent(currentTier)}`);
          }, 1800);
          window.setTimeout(() => setMsg(""), 3200);
        } catch (e) {
          setMsg(e?.message || "Could not create alert from voice");
          window.setTimeout(() => setMsg(""), 3200);
        } finally {
          setBusy(false);
        }
      })();
    };

    recognition.onerror = () => {
      setVoiceListening(false);
      setMsg("Could not use the microphone. Check permissions and try again.");
      window.setTimeout(() => setMsg(""), 2800);
    };

    recognition.onend = () => {
      setVoiceListening(false);
    };

    try {
      setVoiceListening(true);
      recognition.start();
    } catch {
      setVoiceListening(false);
      setMsg("Could not start listening.");
      window.setTimeout(() => setMsg(""), 2200);
    }
  };

  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => setChooserOpen(true)}
        className={`rounded-lg border px-3 py-2 text-sm font-semibold transition-colors ${toneClass}`}
        aria-label={label}
      >
        {busy ? "Watching..." : label}
      </button>
      {chooserOpen ? (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-black/65 backdrop-blur-sm p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Create alert"
        >
          <div className="w-full max-w-5xl rounded-2xl border border-purple-400/25 bg-gray-900 p-4 sm:p-6 shadow-2xl">
            <div className="mb-4 text-center">
              <h3 className="text-xl font-extrabold text-white">Create a Savvy alert</h3>
              <p className="mt-1 text-sm text-gray-300">
                Free stays fully usable with manual alerts. Savvy+ adds text AI; Savvy Pro adds voice + the fastest
                checks.
              </p>
              <p className="mt-1 text-xs text-gray-400">
                Plan: {activeTier.label} · {formatTierMultiplierLabel(currentTier)} Savvy ·{" "}
                {Number.isFinite(caps.alertsMax)
                  ? `Up to ${caps.alertsMax} active alerts`
                  : "Unlimited alerts"}{" "}
                · {caps.checkNote}
              </p>
            </div>

            {upgradeHint === "text_ai" ? (
              <p className="mb-3 rounded-lg border border-purple-400/40 bg-purple-500/15 px-3 py-2 text-center text-sm text-purple-100">
                Text AI alerts are included with <strong>Savvy+ ($7/mo)</strong>. Upgrade to type natural instructions
                like &quot;PS5 under $375&quot;.
              </p>
            ) : null}
            {upgradeHint === "voice_ai" ? (
              <p className="mb-3 rounded-lg border border-amber-400/40 bg-amber-500/15 px-3 py-2 text-center text-sm text-amber-100">
                Voice AI alerts are included with <strong>Savvy Pro ($14/mo)</strong> with real-time checks and spoken
                confirmations.
              </p>
            ) : null}

            <div className="grid gap-3 lg:grid-cols-3">
              {/* Manual — Free */}
              <section className="flex flex-col rounded-xl border border-gray-600/70 bg-gray-800/80 p-4">
                <div className="flex items-center gap-2 text-lg font-bold text-white">
                  <PenLine className="h-5 w-5 text-gray-300" aria-hidden />
                  Manual Alert
                </div>
                <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-gray-400">Free</p>
                <p className="mt-2 text-sm text-gray-300">
                  Uses this card&apos;s details. Limited alert count on Free; checks are delayed — still reliable for
                  everyday snipes.
                </p>
                <ul className="mt-3 space-y-1 text-sm text-gray-200">
                  <li>· You control the exact keywords &amp; caps</li>
                  <li>· Same alert quality as today</li>
                  <li>· Upgrade anytime for faster scans</li>
                </ul>
                <button
                  type="button"
                  disabled={busy}
                  onClick={handleManualCreate}
                  className="mt-auto w-full rounded-lg border border-gray-500 bg-gray-700 px-3 py-2.5 text-sm font-semibold text-white hover:bg-gray-600 disabled:opacity-60"
                >
                  {busy ? "Creating…" : "Create manual alert"}
                </button>
              </section>

              {/* Text AI — Savvy+ $7 */}
              <section
                className={`flex flex-col rounded-xl border p-4 ${
                  caps.textAi
                    ? "border-purple-400/70 bg-gradient-to-br from-purple-500/18 to-pink-500/16"
                    : "border-gray-600/60 bg-gray-900/60"
                }`}
              >
                <div className="text-lg font-bold text-purple-100">Text AI Alert</div>
                <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-purple-200/90">Savvy+ · $7</p>
                <p className="mt-2 text-sm text-purple-50/95">
                  Type what you want: we parse item, price cap, trust hints, and categories — then faster checks than
                  Free.
                </p>
                <textarea
                  value={nlText}
                  onChange={(e) => setNlText(e.target.value)}
                  placeholder='e.g. "Set alert for PS5 under $375" or "Watch iPhone 13 high trust under $400"'
                  rows={4}
                  className="mt-3 w-full resize-y rounded-lg border border-purple-400/35 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-purple-200/50"
                />
                <button
                  type="button"
                  disabled={busy}
                  onClick={handleTextAiCreate}
                  className={`mt-3 w-full rounded-lg px-3 py-2.5 text-sm font-extrabold disabled:opacity-60 ${
                    caps.textAi
                      ? "border border-purple-300 bg-gradient-to-r from-purple-300 to-fuchsia-400 text-gray-900 hover:brightness-105"
                      : "border border-purple-400/50 bg-purple-500/20 text-purple-100 hover:bg-purple-500/30"
                  }`}
                >
                  {caps.textAi ? (busy ? "Creating…" : "Create from text AI") : "Upgrade to Savvy+ for text AI"}
                </button>
              </section>

              {/* Voice AI — Savvy Pro $14 */}
              <section
                className={`flex flex-col rounded-xl border p-4 shadow-[0_0_20px_rgba(250,204,21,0.12)] ${
                  caps.voiceAi
                    ? "border-yellow-400/70 bg-gradient-to-br from-amber-400/20 via-yellow-300/15 to-purple-500/20"
                    : "border-gray-600/60 bg-gray-900/60"
                }`}
              >
                <div className="text-lg font-bold text-yellow-100">Voice AI Alert</div>
                <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-yellow-200/90">
                  Savvy Pro · $14
                </p>
                <p className="mt-2 text-sm text-yellow-50/95">
                  Say it naturally — voice becomes the alert. Real-time / priority checks on Pro, with a quick Savvy
                  confirmation.
                </p>
                <div className="mt-4 flex flex-1 flex-col items-center justify-center gap-3">
                  <button
                    type="button"
                    disabled={busy || voiceListening}
                    onClick={handleMicClick}
                    className={`flex h-20 w-20 items-center justify-center rounded-full border-2 text-white shadow-lg transition-transform hover:scale-[1.03] disabled:opacity-50 ${
                      caps.voiceAi
                        ? "border-yellow-300/80 bg-gradient-to-br from-amber-500 to-yellow-400 text-gray-900"
                        : "border-yellow-500/40 bg-yellow-500/10 text-yellow-100 hover:bg-yellow-500/20"
                    }`}
                    aria-label={caps.voiceAi ? "Start voice alert" : "Upgrade for voice alerts"}
                  >
                    <Mic className={`h-9 w-9 ${voiceListening ? "animate-pulse" : ""}`} />
                  </button>
                  <p className="text-center text-xs text-yellow-100/90">
                    {voiceListening
                      ? "Listening… speak your alert."
                      : caps.voiceAi
                        ? 'Tap the mic — try: "Savvy, set me an alert for PS5 under $375."'
                        : "Mic unlocks on Savvy Pro — tap to see upgrade."}
                  </p>
                </div>
              </section>
            </div>

            {savvyReply ? (
              <p className="mt-4 rounded-xl border border-emerald-400/40 bg-emerald-500/15 px-4 py-3 text-center text-sm font-semibold text-emerald-100">
                {savvyReply}
              </p>
            ) : null}

            <div className="mt-4 flex justify-center gap-3">
              <button
                type="button"
                onClick={() => setChooserOpen(false)}
                className="rounded-md px-3 py-1.5 text-sm text-gray-300 hover:text-white"
              >
                Not now
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {msg ? <div className="mt-1 text-xs text-gray-300">{msg}</div> : null}
    </div>
  );
}

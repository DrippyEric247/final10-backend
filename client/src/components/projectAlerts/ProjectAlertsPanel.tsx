import React, { useCallback, useEffect, useMemo, useReducer, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Layers, Megaphone, Plus, Sparkles, Trash2, Wand2 } from "lucide-react";
import {
  addProjectItem,
  createProjectAlert,
  deleteProjectAlert,
  getProjectAlerts,
  removeProjectItem,
  spawnProjectMissingAlerts,
  updateProjectAlert,
  updateProjectItem,
} from "../../lib/api";
import {
  DEV_SUBSCRIPTION_TOOLS_EVENT,
  getProjectAlertCapabilities,
} from "../../lib/tierMultiplier";
import { parseProjectBriefFromText } from "../../lib/projectAlertAiParser";

type TrackedItem = {
  _id: string;
  title: string;
  keywords?: string[];
  targetPrice?: number;
  estimatedSavings?: number;
  trustMin?: number;
  status: string;
  linkedAlertId?: string | null;
};

export type ProjectRow = {
  _id: string;
  name: string;
  category?: string;
  budget?: number;
  trustRequirement?: number;
  status: string;
  items: TrackedItem[];
  bundleSavingsTarget?: number;
  estimatedBundleSavings?: number;
  aiSummary?: string;
};

function getSpeechRecognitionCtor(): unknown {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

type Props = {
  onAlertsMayHaveChanged?: () => void;
};

export default function ProjectAlertsPanel({ onAlertsMayHaveChanged }: Props) {
  const navigate = useNavigate();
  const [, bump] = useReducer((n) => n + 1, 0);
  const caps = getProjectAlertCapabilities();

  useEffect(() => {
    const h = () => bump();
    window.addEventListener("f10:subscription-tier-updated", h);
    window.addEventListener(DEV_SUBSCRIPTION_TOOLS_EVENT, h);
    return () => {
      window.removeEventListener("f10:subscription-tier-updated", h);
      window.removeEventListener(DEV_SUBSCRIPTION_TOOLS_EVENT, h);
    };
  }, []);

  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const [draftName, setDraftName] = useState("");
  const [draftCategory, setDraftCategory] = useState("general");
  const [draftBudget, setDraftBudget] = useState("");
  const [draftTrust, setDraftTrust] = useState("72");
  const [aiAssist, setAiAssist] = useState("");
  const [voiceListening, setVoiceListening] = useState(false);

  const [newItemByProject, setNewItemByProject] = useState<Record<string, { title: string; price: string }>>({});

  const load = useCallback(async () => {
    if (!caps.enabled) {
      setProjects([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const data = await getProjectAlerts();
      setProjects(Array.isArray(data) ? data : []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not load project alerts");
      setProjects([]);
    } finally {
      setLoading(false);
    }
  }, [caps.enabled]);

  useEffect(() => {
    void load();
  }, [load]);

  const activeCount = useMemo(
    () => projects.filter((p) => p.status !== "completed").length,
    [projects]
  );

  const atProjectLimit = useMemo(() => {
    const max = caps.maxActiveProjects;
    if (!Number.isFinite(max)) return false;
    return activeCount >= (max as number);
  }, [activeCount, caps.maxActiveProjects]);

  const sumTargets = (p: ProjectRow) =>
    (p.items || []).reduce((s, it) => s + (Number(it.targetPrice) || 0), 0);

  const sumSavings = (p: ProjectRow) =>
    (p.items || []).reduce((s, it) => s + (Number(it.estimatedSavings) || 0), 0);

  const createProject = async () => {
    if (!draftName.trim()) return;
    setBusyId("new");
    setError("");
    try {
      await createProjectAlert({
        name: draftName.trim(),
        category: draftCategory,
        budget: draftBudget ? Number(draftBudget) : undefined,
        trustRequirement: Number(draftTrust) || 0,
        items: [],
        aiSummary: caps.aiPartsList ? aiAssist.trim() : "",
      });
      setDraftName("");
      setDraftBudget("");
      setAiAssist("");
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Create failed");
    } finally {
      setBusyId(null);
    }
  };

  const applyAiDraft = () => {
    const d = parseProjectBriefFromText(aiAssist);
    if (!d) {
      setError("Savvy could not read that brief — try adding a budget and a short parts list.");
      return;
    }
    setDraftName(d.name);
    setDraftCategory(d.category);
    setDraftBudget(d.budget != null ? String(d.budget) : "");
    setDraftTrust(String(d.trustRequirement));
    setError("");
  };

  const createFromAiDraft = async () => {
    const d = parseProjectBriefFromText(aiAssist);
    if (!d) {
      setError("Add a Savvy brief first, then create.");
      return;
    }
    setBusyId("new");
    setError("");
    try {
      await createProjectAlert({
        name: d.name,
        category: d.category,
        budget: d.budget,
        trustRequirement: d.trustRequirement,
        items: d.items,
        aiSummary: caps.aiPartsList ? d.aiSummary : "",
      });
      setAiAssist("");
      setDraftName("");
      setDraftBudget("");
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Create failed");
    } finally {
      setBusyId(null);
    }
  };

  const startVoice = () => {
    if (!caps.voiceProjectCreation) {
      navigate("/premium?trigger=project_voice&target=savvy_elite");
      return;
    }
    const Ctor = getSpeechRecognitionCtor() as new () => {
      lang: string;
      interimResults: boolean;
      maxAlternatives: number;
      onresult: ((ev: { results: { 0: { 0: { transcript: string } } } }) => void) | null;
      onerror: (() => void) | null;
      onend: (() => void) | null;
      start: () => void;
    };
    if (!Ctor) {
      setError("Voice needs a browser with speech recognition (e.g. Chrome).");
      return;
    }
    const rec = new Ctor();
    rec.lang = "en-US";
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.onresult = (ev: { results: { 0: { 0: { transcript: string } } } }) => {
      const t = ev.results[0][0].transcript;
      setAiAssist((prev) => (prev ? `${prev}\n${t}` : t));
      setVoiceListening(false);
    };
    rec.onerror = () => setVoiceListening(false);
    rec.onend = () => setVoiceListening(false);
    setVoiceListening(true);
    rec.start();
  };

  const addItem = async (projectId: string) => {
    const row = newItemByProject[projectId] || { title: "", price: "" };
    if (!row.title.trim()) return;
    setBusyId(projectId);
    try {
      await addProjectItem(projectId, {
        title: row.title.trim(),
        keywords: row.title.split(/\s+/).filter((w) => w.length > 2),
        targetPrice: row.price ? Number(row.price) : undefined,
      });
      setNewItemByProject((m) => ({ ...m, [projectId]: { title: "", price: "" } }));
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Add item failed");
    } finally {
      setBusyId(null);
    }
  };

  const patchItem = async (projectId: string, item: TrackedItem, patch: Partial<TrackedItem>) => {
    setBusyId(item._id);
    try {
      await updateProjectItem(projectId, item._id, patch);
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Update failed");
    } finally {
      setBusyId(null);
    }
  };

  const delProject = async (id: string) => {
    if (!window.confirm("Delete this project and its item links?")) return;
    setBusyId(id);
    try {
      await deleteProjectAlert(id);
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setBusyId(null);
    }
  };

  const spawnAlerts = async (projectId: string) => {
    setBusyId(projectId);
    try {
      await spawnProjectMissingAlerts(projectId);
      await load();
      onAlertsMayHaveChanged?.();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not create alerts");
    } finally {
      setBusyId(null);
    }
  };

  if (!caps.enabled) {
    return (
      <section className="mb-10 rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-500/10 to-purple-900/20 p-6">
        <div className="flex items-start gap-3">
          <Layers className="h-8 w-8 shrink-0 text-amber-300" aria-hidden />
          <div>
            <h2 className="text-xl font-extrabold text-amber-100">Project Alerts</h2>
            <p className="mt-2 text-sm text-gray-300 leading-relaxed">
              Savvy can help you complete a whole build — gaming PC, project car, studio, or maintenance kit — not just
              one-off listings. <strong className="text-white">Core and up</strong> unlock multi-item projects;{" "}
              <strong className="text-white">Pro</strong> adds bundle savings and per-part price targets;{" "}
              <strong className="text-white">Elite</strong> adds AI parts lists and voice/text project creation.
            </p>
            <Link
              to="/premium?trigger=project_alerts"
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-amber-400 to-purple-600 px-4 py-2 text-sm font-bold text-gray-900"
            >
              Upgrade for Project Alerts
            </Link>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="mb-10 rounded-2xl border border-cyan-500/35 bg-gray-900/50 p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Layers className="h-7 w-7 text-cyan-300" aria-hidden />
          <div>
            <h2 className="text-xl font-extrabold text-white">Project Alerts</h2>
            <p className="text-xs text-gray-400">
              Savvy helps you finish the whole build — track parts, budgets, and bundle savings together.{" "}
              <Link className="font-semibold text-cyan-300 underline hover:text-cyan-200" to="/build-wars">
                Savvy Build Wars →
              </Link>
            </p>
          </div>
        </div>
        <div className="text-xs text-cyan-200/90">
          Plan:{" "}
          <span className="font-bold text-white">
            {Number.isFinite(caps.maxActiveProjects as number)
              ? `${activeCount} / ${caps.maxActiveProjects} active projects`
              : `${activeCount} active projects (unlimited)`}
          </span>
          {" · "}
          {Number.isFinite(caps.maxItemsPerProject as number)
            ? `up to ${caps.maxItemsPerProject} items / project`
            : "unlimited items / project"}
        </div>
      </div>

      {caps.enabled && (
        <div className="mb-6 rounded-xl border border-purple-500/30 bg-purple-950/30 p-4">
          <div className="mb-2 flex items-center gap-2 text-purple-200">
            <Wand2 className="h-4 w-4" aria-hidden />
            <span className="text-sm font-bold">Savvy project assistant</span>
            {caps.aiPartsList ? <Sparkles className="h-4 w-4 text-amber-300" aria-hidden /> : null}
          </div>
          <p className="mb-2 text-xs text-gray-400">
            Try: &quot;Help me build a gaming PC under $900&quot; · &quot;Track parts for my E60 M5 project&quot; ·
            &quot;Find brake pads, oil kit, and tires for my BMW&quot;
          </p>
          <textarea
            className="mb-2 w-full rounded-lg border border-gray-600 bg-gray-950 px-3 py-2 text-sm text-white placeholder-gray-500"
            rows={3}
            placeholder="Describe your project…"
            value={aiAssist}
            onChange={(e) => setAiAssist(e.target.value)}
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded-lg bg-purple-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-purple-500"
              onClick={applyAiDraft}
            >
              Apply to create form
            </button>
            <button
              type="button"
              className="rounded-lg bg-amber-500/90 px-3 py-1.5 text-xs font-bold text-gray-900 hover:bg-amber-400"
              onClick={() => void createFromAiDraft()}
              disabled={Boolean(busyId)}
            >
              Create project from brief
            </button>
            {caps.voiceProjectCreation ? (
              <button
                type="button"
                onClick={startVoice}
                className="rounded-lg border border-gray-500 px-3 py-1.5 text-xs font-semibold text-gray-200 hover:bg-gray-800"
              >
                {voiceListening ? "Listening…" : "Voice brief"}
              </button>
            ) : null}
          </div>
        </div>
      )}

      <div className="mb-6 rounded-xl border border-gray-700 bg-gray-950/60 p-4">
        <h3 className="mb-3 text-sm font-bold text-gray-200">Create project</h3>
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <label className="text-xs text-gray-400">Name</label>
            <input
              className="mt-1 w-full rounded-lg border border-gray-600 bg-gray-900 px-3 py-2 text-sm"
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              placeholder="Gaming PC build"
            />
          </div>
          <div>
            <label className="text-xs text-gray-400">Category</label>
            <input
              className="mt-1 w-full rounded-lg border border-gray-600 bg-gray-900 px-3 py-2 text-sm"
              value={draftCategory}
              onChange={(e) => setDraftCategory(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs text-gray-400">Budget (optional)</label>
            <input
              type="number"
              className="mt-1 w-full rounded-lg border border-gray-600 bg-gray-900 px-3 py-2 text-sm"
              value={draftBudget}
              onChange={(e) => setDraftBudget(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs text-gray-400">Min trust (0–100)</label>
            <input
              type="number"
              className="mt-1 w-full rounded-lg border border-gray-600 bg-gray-900 px-3 py-2 text-sm"
              value={draftTrust}
              onChange={(e) => setDraftTrust(e.target.value)}
            />
          </div>
        </div>
        <button
          type="button"
          disabled={!draftName.trim() || atProjectLimit || busyId === "new"}
          onClick={() => void createProject()}
          className="mt-3 inline-flex items-center gap-2 rounded-lg bg-cyan-600 px-4 py-2 text-sm font-bold text-white hover:bg-cyan-500 disabled:opacity-40"
        >
          <Plus className="h-4 w-4" aria-hidden />
          Create project
        </button>
        {atProjectLimit ? (
          <p className="mt-2 text-xs text-amber-300">Active project limit reached — complete or delete a project.</p>
        ) : null}
      </div>

      {error ? <div className="mb-4 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">{error}</div> : null}

      {loading ? <div className="text-gray-400">Loading projects…</div> : null}

      {!loading && projects.length === 0 ? (
        <p className="text-sm text-gray-400">No projects yet — create one above or use the Savvy assistant.</p>
      ) : null}

      <div className="space-y-4">
        {projects.map((p) => (
          <div key={p._id} className="rounded-xl border border-gray-700 bg-gray-900/70 p-4">
            <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
              <div>
                <div className="text-lg font-bold text-white">{p.name}</div>
                <div className="text-xs text-gray-400">
                  {p.category || "general"}
                  {p.budget != null ? ` · Budget $${p.budget}` : ""}
                  {p.trustRequirement != null ? ` · Trust ≥ ${p.trustRequirement}` : ""}
                  {" · "}
                  <span className="text-cyan-300">Status: {p.status}</span>
                </div>
                {p.status === "ready" && caps.allPartsReadyNotify ? (
                  <div className="mt-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-100">
                    All tracked parts are found or skipped — project is ready. Savvy can keep watching for upgrades if
                    you leave items on watch.
                  </div>
                ) : null}
                {caps.aiPartsList && p.aiSummary ? (
                  <p className="mt-2 text-xs text-gray-400">{p.aiSummary}</p>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-2">
                <select
                  className="rounded-lg border border-gray-600 bg-gray-950 px-2 py-1 text-xs"
                  value={p.status}
                  onChange={(e) =>
                    void (async () => {
                      setBusyId(p._id);
                      try {
                        await updateProjectAlert(p._id, { status: e.target.value });
                        await load();
                      } catch (err: unknown) {
                        setError(err instanceof Error ? err.message : "Update failed");
                      } finally {
                        setBusyId(null);
                      }
                    })()
                  }
                >
                  <option value="watching">Watching</option>
                  <option value="ready">Ready</option>
                  <option value="completed">Completed</option>
                </select>
                <button
                  type="button"
                  className="rounded-lg border border-red-500/50 px-2 py-1 text-xs text-red-300 hover:bg-red-500/10"
                  onClick={() => void delProject(p._id)}
                >
                  <Trash2 className="inline h-3 w-3" aria-hidden /> Delete
                </button>
              </div>
            </div>

            {caps.bundleSavings && (
              <div className="mb-3 rounded-lg border border-amber-500/25 bg-amber-500/5 px-3 py-2 text-xs text-amber-100">
                <strong>Bundle view:</strong> sum of part targets ${sumTargets(p).toLocaleString()} · recorded savings $
                {sumSavings(p).toLocaleString()}
                {p.bundleSavingsTarget != null ? ` · savings goal $${p.bundleSavingsTarget}` : ""}
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-left text-sm">
                <thead>
                  <tr className="text-xs text-gray-500">
                    <th className="pb-2 pr-2">Part</th>
                    <th className="pb-2 pr-2">Status</th>
                    {caps.priceTargetPerItem ? <th className="pb-2 pr-2">Target $</th> : null}
                    <th className="pb-2 pr-2">Alert</th>
                  </tr>
                </thead>
                <tbody>
                  {(p.items || []).map((it) => (
                    <tr key={it._id} className="border-t border-gray-800">
                      <td className="py-2 pr-2 text-gray-200">{it.title}</td>
                      <td className="py-2 pr-2">
                        <select
                          className="rounded border border-gray-600 bg-gray-950 px-1 py-0.5 text-xs"
                          value={it.status}
                          onChange={(e) => void patchItem(p._id, it, { status: e.target.value })}
                          disabled={busyId === it._id}
                        >
                          <option value="watching">Watching</option>
                          <option value="found">Found</option>
                          <option value="skipped">Skipped</option>
                        </select>
                      </td>
                      {caps.priceTargetPerItem ? (
                        <td className="py-2 pr-2">
                          <input
                            type="number"
                            className="w-24 rounded border border-gray-600 bg-gray-950 px-1 py-0.5 text-xs"
                            defaultValue={it.targetPrice ?? ""}
                            key={`${it._id}-${it.targetPrice}`}
                            onBlur={(e) => {
                              const v = e.target.value ? Number(e.target.value) : undefined;
                              if (v !== it.targetPrice) void patchItem(p._id, it, { targetPrice: v });
                            }}
                          />
                        </td>
                      ) : null}
                      <td className="py-2 pr-2 text-xs text-gray-400">
                        {it.linkedAlertId ? "Linked" : "—"}
                        {" · "}
                        <button
                          type="button"
                          className="text-red-300 hover:underline"
                          onClick={() =>
                            void (async () => {
                              setBusyId(it._id);
                              try {
                                await removeProjectItem(p._id, it._id);
                                await load();
                              } catch (err: unknown) {
                                setError(err instanceof Error ? err.message : "Remove failed");
                              } finally {
                                setBusyId(null);
                              }
                            })()
                          }
                        >
                          remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-3 flex flex-wrap items-end gap-2 border-t border-gray-800 pt-3">
              <div>
                <label className="text-xs text-gray-500">Add item</label>
                <input
                  className="mt-1 block w-48 rounded-lg border border-gray-600 bg-gray-950 px-2 py-1 text-sm"
                  placeholder="e.g. RTX 4070"
                  value={newItemByProject[p._id]?.title || ""}
                  onChange={(e) =>
                    setNewItemByProject((m) => ({
                      ...m,
                      [p._id]: { title: e.target.value, price: m[p._id]?.price || "" },
                    }))
                  }
                />
              </div>
              {caps.priceTargetPerItem ? (
                <div>
                  <label className="text-xs text-gray-500">Target $</label>
                  <input
                    type="number"
                    className="mt-1 block w-24 rounded-lg border border-gray-600 bg-gray-950 px-2 py-1 text-sm"
                    value={newItemByProject[p._id]?.price || ""}
                    onChange={(e) =>
                      setNewItemByProject((m) => ({
                        ...m,
                        [p._id]: { title: m[p._id]?.title || "", price: e.target.value },
                      }))
                    }
                  />
                </div>
              ) : null}
              <button
                type="button"
                className="rounded-lg bg-gray-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-gray-600"
                onClick={() => void addItem(p._id)}
                disabled={
                  busyId === p._id ||
                  !(newItemByProject[p._id]?.title || "").trim() ||
                  (Number.isFinite(caps.maxItemsPerProject as number) &&
                    (p.items?.length || 0) >= (caps.maxItemsPerProject as number))
                }
              >
                <Plus className="mr-1 inline h-3 w-3" aria-hidden />
                Add item
              </button>
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded-lg border border-amber-400/50 bg-amber-500/10 px-3 py-1.5 text-xs font-bold text-amber-100 hover:bg-amber-500/20"
                onClick={() => void spawnAlerts(p._id)}
                disabled={busyId === p._id}
              >
                <Megaphone className="h-3 w-3" aria-hidden />
                Create alerts for missing parts
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

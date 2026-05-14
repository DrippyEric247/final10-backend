import { useMemo, useState } from "react";
import {
  GROWTH_LEVERS,
  KPI_CURRENT_VALUES,
  KPI_GROWTH_CONFIG,
  type GrowthLever,
  type GrowthLeverCategory,
  type KpiGrowthConfig,
  type LeverImpact,
  type LeverPriority,
} from "../data/growthLevers";

type KpiStatus = "good" | "warning" | "bad";

interface EvaluatedKpi extends KpiGrowthConfig {
  currentValue: number;
  status: KpiStatus;
  levers: GrowthLever[];
}

const CATEGORY_FILTERS: Array<{ id: "all" | GrowthLeverCategory; label: string }> = [
  { id: "all", label: "All" },
  { id: "onboarding", label: "Onboarding" },
  { id: "engagement", label: "Engagement" },
  { id: "monetization", label: "Monetization" },
  { id: "reliability", label: "Reliability" },
];

function getStatus(config: KpiGrowthConfig, value: number): KpiStatus {
  if (value >= config.thresholdGood) return "good";
  if (value >= config.thresholdWarning) return "warning";
  return "bad";
}

function statusClasses(status: KpiStatus) {
  if (status === "good") return "text-emerald-300 border-emerald-500/40 bg-emerald-500/10";
  if (status === "warning") return "text-amber-300 border-amber-500/40 bg-amber-500/10";
  return "text-rose-300 border-rose-500/40 bg-rose-500/10";
}

function priorityRank(priority: LeverPriority) {
  if (priority === "high") return 0;
  if (priority === "medium") return 1;
  return 2;
}

function impactRank(impact: LeverImpact) {
  if (impact === "high") return 0;
  if (impact === "medium") return 1;
  return 2;
}

function KPIStatusBadge({ status }: { status: KpiStatus }) {
  return (
    <span className={`rounded-full border px-2 py-1 text-xs font-semibold uppercase tracking-wide ${statusClasses(status)}`}>
      {status}
    </span>
  );
}

function KPICard({ kpi }: { kpi: EvaluatedKpi }) {
  return (
    <article className="rounded-2xl border border-gray-700 bg-gray-800/65 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-white font-bold">{kpi.name}</h3>
          <p className="text-xs text-gray-400 mt-1">{kpi.description}</p>
        </div>
        <KPIStatusBadge status={kpi.status} />
      </div>
      <div className="mt-3">
        <div className={`text-3xl font-extrabold ${statusClasses(kpi.status).split(" ")[0]}`}>
          {kpi.currentValue.toFixed(1)}%
        </div>
        <div className="text-xs text-gray-500 mt-1">
          Good: {kpi.thresholdGood}%+ | Warning: {kpi.thresholdWarning}%+
        </div>
      </div>
      <div className="mt-3 text-sm text-gray-300">{kpi.simpleExplanation}</div>
    </article>
  );
}

function LeverCard({
  lever,
  implemented,
  onToggleImplemented,
}: {
  lever: GrowthLever;
  implemented: boolean;
  onToggleImplemented: (leverId: string) => void;
}) {
  return (
    <div className="rounded-xl border border-gray-700 bg-gray-800/70 p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h4 className="text-white font-semibold">{lever.title}</h4>
          <p className="text-sm text-gray-400 mt-1">{lever.description}</p>
        </div>
        <div className="flex gap-1.5">
          <span className="text-[10px] sm:text-xs px-2 py-1 rounded-md bg-gray-700 text-gray-200">{lever.category}</span>
          <span className="text-[10px] sm:text-xs px-2 py-1 rounded-md bg-indigo-500/20 text-indigo-200">impact {lever.estimatedImpact}</span>
          <span className="text-[10px] sm:text-xs px-2 py-1 rounded-md bg-fuchsia-500/20 text-fuchsia-200">priority {lever.priority}</span>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => onToggleImplemented(lever.id)}
          className={`text-sm px-3 py-1.5 rounded-lg border transition-colors ${
            implemented
              ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-200"
              : "border-gray-600 bg-gray-700 text-gray-200 hover:bg-gray-600"
          }`}
        >
          {implemented ? "Implemented" : "Mark as implemented"}
        </button>
        <span className="text-xs text-gray-500">Impact tracking: placeholder</span>
      </div>
    </div>
  );
}

function LeverList({
  kpi,
  categoryFilter,
  implementedMap,
  onToggleImplemented,
}: {
  kpi: EvaluatedKpi;
  categoryFilter: "all" | GrowthLeverCategory;
  implementedMap: Record<string, boolean>;
  onToggleImplemented: (leverId: string) => void;
}) {
  const scopedLevers = useMemo(() => {
    const source = kpi.status === "bad"
      ? [...kpi.levers].sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority) || impactRank(a.estimatedImpact) - impactRank(b.estimatedImpact))
      : kpi.levers;
    return source.filter((lever) => categoryFilter === "all" || lever.category === categoryFilter);
  }, [kpi, categoryFilter]);

  if (scopedLevers.length === 0) {
    return <div className="text-sm text-gray-500">No levers match the current filter.</div>;
  }

  return (
    <div className="space-y-3">
      {scopedLevers.map((lever) => (
        <LeverCard
          key={lever.id}
          lever={lever}
          implemented={Boolean(implementedMap[lever.id])}
          onToggleImplemented={onToggleImplemented}
        />
      ))}
    </div>
  );
}

export default function GrowthLeversDashboard() {
  const [categoryFilter, setCategoryFilter] = useState<"all" | GrowthLeverCategory>("all");
  const [implementedMap, setImplementedMap] = useState<Record<string, boolean>>({});

  const evaluated = useMemo<EvaluatedKpi[]>(() => {
    return KPI_GROWTH_CONFIG.map((kpi) => {
      const currentValue = KPI_CURRENT_VALUES[kpi.id] ?? 0;
      const status = getStatus(kpi, currentValue);
      const levers = kpi.recommendedLeverIds
        .map((leverId) => GROWTH_LEVERS.find((lever) => lever.id === leverId))
        .filter(Boolean) as GrowthLever[];
      return { ...kpi, currentValue, status, levers };
    });
  }, []);

  const topPriorityFixes = useMemo(() => {
    const rows = evaluated
      .filter((kpi) => kpi.status !== "good")
      .flatMap((kpi) =>
        kpi.levers.map((lever) => ({
          ...lever,
          sourceKpiName: kpi.name,
          sourceKpiStatus: kpi.status,
        }))
      )
      .filter((row) => categoryFilter === "all" || row.category === categoryFilter);

    const dedup = new Map<string, (typeof rows)[number]>();
    rows.forEach((row) => {
      const prior = dedup.get(row.id);
      if (!prior) dedup.set(row.id, row);
      else if (prior.sourceKpiStatus !== "bad" && row.sourceKpiStatus === "bad") dedup.set(row.id, row);
    });

    return [...dedup.values()].sort((a, b) => {
      if (a.sourceKpiStatus !== b.sourceKpiStatus) return a.sourceKpiStatus === "bad" ? -1 : 1;
      return priorityRank(a.priority) - priorityRank(b.priority) || impactRank(a.estimatedImpact) - impactRank(b.estimatedImpact);
    });
  }, [evaluated, categoryFilter]);

  const onToggleImplemented = (leverId: string) => {
    setImplementedMap((prev) => ({ ...prev, [leverId]: !prev[leverId] }));
  };

  return (
    <div className="min-h-screen bg-gray-900 pt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">Growth Lever System</h1>
            <p className="text-sm sm:text-base text-gray-400 mt-1">
              Internal action dashboard mapping weak KPIs to the next product fixes.
            </p>
          </div>
          <div className="inline-flex rounded-xl border border-gray-700 bg-gray-800/80 p-1 self-start">
            {CATEGORY_FILTERS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setCategoryFilter(opt.id)}
                className={`px-3 py-1.5 text-xs sm:text-sm rounded-lg transition-colors ${
                  categoryFilter === opt.id
                    ? "bg-indigo-500 text-white"
                    : "text-gray-300 hover:text-white hover:bg-gray-700"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </header>

        <section className="rounded-2xl border border-gray-700 bg-gray-800/40 p-4 sm:p-5">
          <h2 className="text-xl font-bold text-white mb-3">Top Priority Fixes</h2>
          <p className="text-sm text-gray-400 mb-4">
            Highest-priority actions from warning/bad KPIs. Bad KPI actions are ranked first.
          </p>
          {topPriorityFixes.length === 0 ? (
            <div className="text-sm text-gray-500">No current priority fixes for this filter.</div>
          ) : (
            <div className="space-y-3">
              {topPriorityFixes.slice(0, 6).map((lever) => (
                <div key={`${lever.id}-${lever.sourceKpiName}`} className="rounded-xl border border-gray-700 bg-gray-800/70 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm text-gray-400">{lever.sourceKpiName}</div>
                      <div className="text-white font-semibold">{lever.title}</div>
                    </div>
                    <KPIStatusBadge status={lever.sourceKpiStatus} />
                  </div>
                  <div className="text-sm text-gray-400 mt-1">{lever.description}</div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section>
          <h2 className="text-xl font-bold text-white mb-3">KPI Overview</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {evaluated.map((kpi) => (
              <KPICard key={kpi.id} kpi={kpi} />
            ))}
          </div>
        </section>

        <section className="space-y-4">
          {evaluated.map((kpi) => (
            <article key={`levers-${kpi.id}`} className="rounded-2xl border border-gray-700 bg-gray-800/35 p-4 sm:p-5">
              <div className="flex items-center justify-between gap-3 mb-3">
                <div>
                  <h3 className="text-lg font-bold text-white">{kpi.name}</h3>
                  <p className="text-sm text-gray-400">{kpi.simpleExplanation}</p>
                </div>
                <KPIStatusBadge status={kpi.status} />
              </div>
              {kpi.status === "good" ? (
                <div className="text-sm text-emerald-300">Healthy KPI. Keep monitoring and preserve current levers.</div>
              ) : (
                <LeverList
                  kpi={kpi}
                  categoryFilter={categoryFilter}
                  implementedMap={implementedMap}
                  onToggleImplemented={onToggleImplemented}
                />
              )}
            </article>
          ))}
        </section>
      </div>
    </div>
  );
}


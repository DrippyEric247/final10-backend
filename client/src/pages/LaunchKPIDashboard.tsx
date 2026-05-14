import { useMemo, useState } from "react";
import {
  KPI_MOCK_DATA,
  type FunnelStep,
  type KpiMetric,
  type KpiPeriodKey,
  type KpiTone,
  type KpiTrendPoint,
} from "../data/kpiMockData";

function toneClasses(tone: KpiTone) {
  if (tone === "good") return "text-emerald-300 border-emerald-500/40 bg-emerald-500/10";
  if (tone === "warning") return "text-amber-300 border-amber-500/40 bg-amber-500/10";
  return "text-rose-300 border-rose-500/40 bg-rose-500/10";
}

function deltaClasses(deltaPct: number) {
  if (deltaPct > 0) return "text-emerald-300";
  if (deltaPct < 0) return "text-rose-300";
  return "text-gray-300";
}

function fmtMetric(metric: KpiMetric) {
  const n = metric.decimals ?? 0;
  const base = metric.value.toLocaleString(undefined, {
    minimumFractionDigits: n,
    maximumFractionDigits: n,
  });
  return `${base}${metric.suffix ?? ""}`;
}

function KPIStatCard({ metric, compact = false }: { metric: KpiMetric; compact?: boolean }) {
  return (
    <div className="rounded-2xl border border-gray-700 bg-gray-800/65 p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs sm:text-sm text-gray-400">{metric.label}</div>
          <div className={`font-extrabold tracking-tight ${compact ? "text-2xl mt-2" : "text-3xl mt-2"} ${toneClasses(metric.tone).split(" ")[0]}`}>
            {fmtMetric(metric)}
          </div>
        </div>
        <span className={`rounded-full border px-2 py-1 text-xs font-semibold ${toneClasses(metric.tone)}`}>
          {metric.tone}
        </span>
      </div>
      <div className={`mt-3 text-xs sm:text-sm ${deltaClasses(metric.deltaPct)}`}>
        {metric.deltaPct >= 0 ? "+" : ""}
        {metric.deltaPct.toFixed(1)}% vs previous period
      </div>
    </div>
  );
}

function KPITrendLine({ title, points }: { title: string; points: KpiTrendPoint[] }) {
  const max = Math.max(...points.map((p) => p.value), 1);
  return (
    <div className="rounded-2xl border border-gray-700 bg-gray-800/65 p-4 sm:p-5">
      <div className="text-sm font-semibold text-white mb-4">{title}</div>
      <div className="flex items-end gap-2 h-28">
        {points.map((p) => {
          const heightPct = Math.max(10, Math.round((p.value / max) * 100));
          return (
            <div key={p.label} className="flex-1 min-w-0">
              <div className="h-24 flex items-end">
                <div
                  className="w-full rounded-t-md bg-gradient-to-t from-indigo-500/70 to-cyan-400/70 border border-indigo-300/20"
                  style={{ height: `${heightPct}%` }}
                  title={`${p.label}: ${p.value}`}
                />
              </div>
              <div className="mt-1 text-[10px] sm:text-xs text-gray-400 truncate text-center">{p.label}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function FunnelCard({ title, steps }: { title: string; steps: FunnelStep[] }) {
  const top = Math.max(steps[0]?.users || 1, 1);
  return (
    <div className="rounded-2xl border border-gray-700 bg-gray-800/65 p-4 sm:p-5">
      <div className="text-base font-semibold text-white mb-4">{title}</div>
      <div className="space-y-3">
        {steps.map((step) => {
          const pct = Math.round((step.users / top) * 100);
          return (
            <div key={step.id}>
              <div className="flex items-center justify-between text-xs sm:text-sm mb-1">
                <span className="text-gray-300">{step.label}</span>
                <span className="text-gray-400">
                  {step.users.toLocaleString()} ({pct}%)
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-gray-700 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-fuchsia-500 to-indigo-400"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function KPISection({ title, metrics }: { title: string; metrics: KpiMetric[] }) {
  return (
    <section className="rounded-2xl border border-gray-700 bg-gray-800/30 p-4 sm:p-5">
      <h2 className="text-lg font-bold text-white mb-4">{title}</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
        {metrics.map((metric) => (
          <KPIStatCard key={metric.id} metric={metric} compact />
        ))}
      </div>
    </section>
  );
}

export default function LaunchKPIDashboard() {
  const [period, setPeriod] = useState<KpiPeriodKey>("7d");
  const snapshot = KPI_MOCK_DATA[period];

  const lastUpdatedLabel = useMemo(() => {
    const dt = new Date(snapshot.lastUpdatedIso);
    return dt.toLocaleString();
  }, [snapshot.lastUpdatedIso]);

  return (
    <div className="min-h-screen bg-gray-900 pt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">Launch KPI Dashboard</h1>
            <p className="text-gray-400 mt-1 text-sm sm:text-base">
              Founder view for activation, retention, monetization, and product reliability.
            </p>
            <div className="text-xs text-gray-500 mt-2">Last updated: {lastUpdatedLabel}</div>
          </div>
          <div className="inline-flex rounded-xl border border-gray-700 bg-gray-800/80 p-1 self-start">
            {(["today", "7d", "30d"] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                  period === p ? "bg-indigo-500 text-white" : "text-gray-300 hover:text-white hover:bg-gray-700"
                }`}
              >
                {p === "today" ? "Today" : p}
              </button>
            ))}
          </div>
        </header>

        <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3">
          {snapshot.topRow.map((metric) => (
            <KPIStatCard key={metric.id} metric={metric} />
          ))}
        </section>

        <section className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <FunnelCard title="Activation Funnel" steps={snapshot.activationFunnel} />
          <FunnelCard title="Monetization Funnel" steps={snapshot.monetizationFunnel} />
        </section>

        <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <KPITrendLine title="Activation Trend" points={snapshot.trends.activationPct} />
          <KPITrendLine title="Day 1 Retention Trend" points={snapshot.trends.retentionD1Pct} />
          <KPITrendLine title="Conversion Trend" points={snapshot.trends.conversionPct} />
        </section>

        <div className="space-y-4">
          <KPISection title="Activation" metrics={snapshot.activation} />
          <KPISection title="Engagement" metrics={snapshot.engagement} />
          <KPISection title="Retention" metrics={snapshot.retention} />
          <KPISection title="Monetization" metrics={snapshot.monetization} />
          <KPISection title="Reliability" metrics={snapshot.reliability} />
          <KPISection title="Final10-Specific" metrics={snapshot.final10Specific} />
        </div>
      </div>
    </div>
  );
}


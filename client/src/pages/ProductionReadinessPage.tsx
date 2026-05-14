import { useMemo, useState } from "react";
import { PRODUCTION_CHECKLIST, type ChecklistItem, type ChecklistStatus } from "../data/productionChecklist";
import { ChecklistCategory } from "../components/production/ChecklistCategory";

function loadOverrides(): Record<string, ChecklistStatus> {
  try {
    const raw = JSON.parse(localStorage.getItem("f10_production_checklist_overrides") || "{}");
    return raw && typeof raw === "object" ? raw : {};
  } catch {
    return {};
  }
}

export default function ProductionReadinessPage() {
  const [statusMap, setStatusMap] = useState<Record<string, ChecklistStatus>>(loadOverrides);

  const allItems = useMemo(
    () => PRODUCTION_CHECKLIST.flatMap((category) => category.items),
    []
  );

  const resolvedItems = useMemo(
    () => allItems.map((item) => ({ ...item, resolvedStatus: statusMap[item.id] ?? item.status })),
    [allItems, statusMap]
  );

  const completeCount = resolvedItems.filter((i) => i.resolvedStatus === "complete").length;
  const blockedItems = resolvedItems.filter((i) => i.resolvedStatus === "blocked");
  const criticalPath = resolvedItems.filter(
    (i) => i.priority === "critical" && i.resolvedStatus !== "complete"
  );
  const readiness = resolvedItems.length
    ? Math.round((completeCount / resolvedItems.length) * 100)
    : 0;

  const onStatusChange = (itemId: string, status: ChecklistStatus) => {
    setStatusMap((prev) => {
      const next = { ...prev, [itemId]: status };
      localStorage.setItem("f10_production_checklist_overrides", JSON.stringify(next));
      return next;
    });
  };

  const cardBase = "rounded-2xl border border-gray-700 bg-gray-800/60 p-4";
  const renderMiniItem = (item: ChecklistItem & { resolvedStatus: ChecklistStatus }) => (
    <div key={item.id} className="text-sm text-gray-200 py-1 border-b border-gray-700/60 last:border-b-0">
      {item.title}
      <span className="ml-2 text-xs text-gray-400">({item.resolvedStatus.replace("_", " ")})</span>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-900 pt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <header className="text-center">
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white mb-2">Final10 Production Readiness</h1>
          <p className="text-gray-400">Internal launch tracker with editable mock status for founder planning.</p>
        </header>

        <section className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className={cardBase}>
            <div className="text-xs text-gray-400 mb-1">Readiness score</div>
            <div className="text-2xl font-bold text-green-300">{readiness}%</div>
            <div className="w-full h-2 rounded-full bg-gray-700 mt-3 overflow-hidden">
              <div className="h-full bg-gradient-to-r from-green-500 to-emerald-400" style={{ width: `${readiness}%` }} />
            </div>
          </div>
          <div className={cardBase}>
            <div className="text-xs text-gray-400 mb-1">Completed items</div>
            <div className="text-2xl font-bold text-white">{completeCount}/{resolvedItems.length}</div>
          </div>
          <div className={cardBase}>
            <div className="text-xs text-gray-400 mb-1">Launch blockers</div>
            <div className="text-2xl font-bold text-red-300">{blockedItems.length}</div>
          </div>
        </section>

        <section className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <div className={cardBase}>
            <h2 className="text-lg font-bold text-white mb-2">Critical Path</h2>
            <p className="text-xs text-gray-400 mb-3">Critical items not yet complete.</p>
            {criticalPath.length === 0 ? (
              <div className="text-sm text-green-300">All critical items are complete.</div>
            ) : (
              criticalPath.slice(0, 12).map((item) => renderMiniItem(item))
            )}
          </div>
          <div className={cardBase}>
            <h2 className="text-lg font-bold text-white mb-2">Launch blockers</h2>
            <p className="text-xs text-gray-400 mb-3">Items explicitly blocked.</p>
            {blockedItems.length === 0 ? (
              <div className="text-sm text-green-300">No blockers currently marked.</div>
            ) : (
              blockedItems.map((item) => renderMiniItem(item))
            )}
          </div>
        </section>

        <div className="space-y-4">
          {PRODUCTION_CHECKLIST.map((category) => (
            <ChecklistCategory
              key={category.id}
              category={category}
              statusMap={statusMap}
              onStatusChange={onStatusChange}
            />
          ))}
        </div>
      </div>
    </div>
  );
}


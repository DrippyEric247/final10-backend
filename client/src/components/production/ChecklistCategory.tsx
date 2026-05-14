import type { ChecklistCategory as ChecklistCategoryType, ChecklistStatus } from "../../data/productionChecklist";
import { ChecklistItemCard } from "./ChecklistItemCard";

interface ChecklistCategoryProps {
  category: ChecklistCategoryType;
  statusMap: Record<string, ChecklistStatus>;
  onStatusChange: (itemId: string, status: ChecklistStatus) => void;
}

export function ChecklistCategory({ category, statusMap, onStatusChange }: ChecklistCategoryProps) {
  const total = category.items.length;
  const completed = category.items.filter((item) => (statusMap[item.id] ?? item.status) === "complete").length;
  const pct = total ? Math.round((completed / total) * 100) : 0;

  return (
    <section className="rounded-2xl border border-gray-700 bg-gray-800/50 p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3 mb-3">
        <h3 className="text-white text-lg font-bold">{category.title}</h3>
        <span className="text-xs text-gray-300">{completed}/{total} complete</span>
      </div>
      <div className="w-full h-2 rounded-full bg-gray-700 mb-4 overflow-hidden">
        <div className="h-full rounded-full bg-gradient-to-r from-purple-500 to-cyan-400" style={{ width: `${pct}%` }} />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {category.items.map((item) => (
          <ChecklistItemCard
            key={item.id}
            item={item}
            statusOverride={statusMap[item.id]}
            onStatusChange={onStatusChange}
          />
        ))}
      </div>
    </section>
  );
}


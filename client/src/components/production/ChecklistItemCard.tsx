import type { ChecklistItem, ChecklistPriority, ChecklistStatus } from "../../data/productionChecklist";

const STATUS_STYLES: Record<ChecklistStatus, string> = {
  not_started: "bg-gray-700 text-gray-200 border-gray-600",
  in_progress: "bg-blue-500/20 text-blue-300 border-blue-500/40",
  blocked: "bg-red-500/20 text-red-300 border-red-500/40",
  complete: "bg-green-500/20 text-green-300 border-green-500/40",
};

const PRIORITY_STYLES: Record<ChecklistPriority, string> = {
  critical: "bg-red-500/20 text-red-200 border-red-500/30",
  high: "bg-orange-500/20 text-orange-200 border-orange-500/30",
  medium: "bg-yellow-500/20 text-yellow-200 border-yellow-500/30",
  low: "bg-slate-500/20 text-slate-200 border-slate-500/30",
};

interface ChecklistItemCardProps {
  item: ChecklistItem;
  statusOverride?: ChecklistStatus;
  onStatusChange?: (itemId: string, status: ChecklistStatus) => void;
}

export function ChecklistItemCard({ item, statusOverride, onStatusChange }: ChecklistItemCardProps) {
  const status = statusOverride ?? item.status;
  return (
    <article className="rounded-xl border border-gray-700 bg-gray-900/70 p-4">
      <div className="flex items-start justify-between gap-3 mb-2">
        <h4 className="text-white font-semibold text-sm">{item.title}</h4>
        <span className={`px-2 py-1 text-[11px] rounded-full border ${STATUS_STYLES[status]}`}>
          {status.replace("_", " ")}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-2 mb-2">
        {item.priority ? (
          <span className={`px-2 py-1 text-[11px] rounded-full border ${PRIORITY_STYLES[item.priority]}`}>
            {item.priority}
          </span>
        ) : null}
        {item.owner ? <span className="text-xs text-gray-400">Owner: {item.owner}</span> : null}
      </div>
      {item.notes ? <p className="text-xs text-gray-300 mb-1">{item.notes}</p> : null}
      {item.dependency ? <p className="text-xs text-gray-500">Dependency: {item.dependency}</p> : null}
      {onStatusChange ? (
        <div className="mt-3">
          <label className="text-xs text-gray-400 mr-2">Status</label>
          <select
            value={status}
            onChange={(e) => onStatusChange(item.id, e.target.value as ChecklistStatus)}
            className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-white"
          >
            <option value="not_started">Not Started</option>
            <option value="in_progress">In Progress</option>
            <option value="blocked">Blocked</option>
            <option value="complete">Complete</option>
          </select>
        </div>
      ) : null}
    </article>
  );
}


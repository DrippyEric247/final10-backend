import type { SmartCoachMessageConfig } from "../../data/smartCoachMessages";
import SavvyMark from "../SavvyMark";

export function SmartCoachBanner({
  message,
  onDismiss,
  onAction,
}: {
  message: SmartCoachMessageConfig;
  onDismiss: () => void;
  onAction: () => void;
}) {
  return (
    <div className="fixed inset-x-0 bottom-3 z-40 px-3 sm:px-6">
      <div className="max-w-3xl mx-auto rounded-2xl border border-indigo-400/35 bg-gray-900/95 backdrop-blur p-3 sm:p-4 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[11px] uppercase tracking-wide text-indigo-300 flex items-center gap-1.5">
              <SavvyMark variant="icon" size={13} glow />
              Smart Coach
            </div>
            <h4 className="text-white font-semibold text-sm sm:text-base">{message.title}</h4>
            <p className="text-gray-300 text-xs sm:text-sm mt-1">{message.message}</p>
          </div>
          <button
            type="button"
            className="text-gray-400 hover:text-white text-xs sm:text-sm"
            onClick={onDismiss}
            aria-label="Dismiss smart coach message"
          >
            Dismiss
          </button>
        </div>
        {message.ctaLabel ? (
          <div className="mt-3">
            <button
              type="button"
              onClick={onAction}
              className="w-full sm:w-auto px-3 py-2 rounded-lg bg-indigo-500 hover:bg-indigo-400 text-white text-sm font-medium transition-colors"
            >
              {message.ctaLabel}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}


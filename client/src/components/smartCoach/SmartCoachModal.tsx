import type { SmartCoachMessageConfig } from "../../data/smartCoachMessages";
import SavvyMark from "../SavvyMark";

export function SmartCoachModal({
  message,
  onDismiss,
  onAction,
}: {
  message: SmartCoachMessageConfig;
  onDismiss: () => void;
  onAction: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-3 sm:p-6">
      <div className="w-full max-w-md rounded-2xl border border-fuchsia-400/35 bg-gray-900 p-4 sm:p-5 shadow-2xl">
        <div className="text-[11px] uppercase tracking-wide text-fuchsia-300 flex items-center gap-1.5">
          <SavvyMark variant="icon" size={13} glow />
          Smart Coach Priority
        </div>
        <h3 className="text-white text-lg font-bold mt-1">{message.title}</h3>
        <p className="text-gray-300 text-sm mt-2">{message.message}</p>
        <div className="mt-4 flex gap-2 justify-end">
          <button
            type="button"
            onClick={onDismiss}
            className="px-3 py-2 rounded-lg border border-gray-600 text-gray-200 hover:bg-gray-800 text-sm"
          >
            Later
          </button>
          {message.ctaLabel ? (
            <button
              type="button"
              onClick={onAction}
              className="px-3 py-2 rounded-lg bg-fuchsia-500 hover:bg-fuchsia-400 text-white text-sm font-medium"
            >
              {message.ctaLabel}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}


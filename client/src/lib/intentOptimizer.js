import {
  buildProactiveOptimizationHint,
  pushDealCoachToast,
} from "./dealCoach";

const GLOBAL_GAP_MS = 44000;
let lastGlobalNudgeAt = 0;

/**
 * Fires at most one intent-based toast globally per GLOBAL_GAP_MS, only if a valuable hint exists.
 * @returns {boolean} whether a toast was shown
 */
export function tryIntentMomentNudge(item, ctx) {
  if (typeof window === "undefined") return false;
  const now = Date.now();
  if (now - lastGlobalNudgeAt < GLOBAL_GAP_MS) return false;

  const hint = buildProactiveOptimizationHint(item, ctx);
  if (!hint) return false;

  const ok = pushDealCoachToast(
    {
      ...hint.payload,
      eyebrow: "Smart pick",
    },
    hint.dedupeKey,
    150000
  );
  if (ok) {
    lastGlobalNudgeAt = Date.now();
  }
  return ok;
}

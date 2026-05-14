/** Lightweight Power feedback toasts (UX only; no formula). */

export const POWER_TOAST_EVENT = "f10-power-toast";

/**
 * @param {number} points — shown as +N Power
 * @param {string|null} [praise] — optional second line
 */
export function emitPowerToast(points, praise = null) {
  if (typeof window === "undefined") return;
  const n = Number(points);
  if (!Number.isFinite(n) || n <= 0) return;
  window.dispatchEvent(
    new CustomEvent(POWER_TOAST_EVENT, {
      detail: { points: Math.round(n), praise },
    })
  );
}

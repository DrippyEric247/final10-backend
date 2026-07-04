/**
 * Scout Flight gameplay focus — hides app chrome and locks scroll while in a run.
 */

export const SCOUT_FLIGHT_GAMEPLAY_FOCUS_EVENT = 'f10:scout-flight-gameplay-focus';

let focusActive = false;

export function isScoutFlightGameplayFocusActive() {
  return focusActive;
}

export function setScoutFlightGameplayFocus(active) {
  if (typeof document === 'undefined') return;
  const on = Boolean(active);
  if (focusActive === on) return;
  focusActive = on;
  document.documentElement.classList.toggle('f10-scout-flight-gameplay', on);
  document.body.classList.toggle('f10-scout-flight-gameplay', on);
  try {
    window.dispatchEvent(
      new CustomEvent(SCOUT_FLIGHT_GAMEPLAY_FOCUS_EVENT, { detail: { active: on } })
    );
  } catch {
    /* ignore */
  }
}

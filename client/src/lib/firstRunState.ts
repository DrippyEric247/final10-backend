/**
 * Tracks whether the visitor has seen the "first 60 seconds" landing.
 *
 * The Savvy first-run-experience (post-signup tour) lives elsewhere; this
 * file is specifically about the *pre-signup* / first-visit landing surface
 * that explains what Final10 / Best Move / Savvy are before any auth.
 */

const VISITED_KEY = "f10_first60_visited_v1";
const COMPLETED_KEY = "f10_first60_completed_v1";

export function hasSeenFirstSixty(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(VISITED_KEY) === "1";
  } catch {
    return true;
  }
}

export function markFirstSixtyVisited(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(VISITED_KEY, "1");
  } catch {
    /* ignore */
  }
}

export function hasCompletedFirstSixty(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(COMPLETED_KEY) === "1";
  } catch {
    return true;
  }
}

export function markFirstSixtyCompleted(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(COMPLETED_KEY, "1");
  } catch {
    /* ignore */
  }
}

export function resetFirstSixty(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(VISITED_KEY);
    window.localStorage.removeItem(COMPLETED_KEY);
  } catch {
    /* ignore */
  }
}

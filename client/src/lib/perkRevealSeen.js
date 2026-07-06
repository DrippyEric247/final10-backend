/**
 * Tracks which Perk Machine reward types a player has already seen revealed,
 * so the *first time ever* unlocking any reward gets the full cinematic reveal
 * even if it would normally be a quick reveal. Subsequent pulls stay fast.
 */

const STORAGE_KEY = "f10_perk_reward_seen";

function readSeen() {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

/** True if this reward key has never been revealed before on this device. */
export function isFirstRevealOfKey(key) {
  const id = String(key || "").trim();
  if (!id) return false;
  return !readSeen().has(id);
}

/** Record that a reward key has now been revealed. */
export function markRevealKeySeen(key) {
  const id = String(key || "").trim();
  if (!id || typeof window === "undefined") return;
  const seen = readSeen();
  if (seen.has(id)) return;
  seen.add(id);
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...seen]));
  } catch {
    /* ignore */
  }
}

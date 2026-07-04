/**
 * Browser autoplay unlock — one global gate for menu / app music.
 * Returning users with prior unlock attempt playback immediately when allowed.
 */

const STORAGE_UNLOCKED = 'f10_audio_unlocked';

export const AUDIO_UNLOCKED_EVENT = 'f10:audio-unlocked';
export const AUDIO_NEEDS_GESTURE_EVENT = 'f10:audio-needs-gesture';

let listenersAttached = false;
let pendingResume = null;
let needsGesture = false;

function readPersistedUnlock() {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(STORAGE_UNLOCKED) === '1';
  } catch {
    return false;
  }
}

function persistUnlock() {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_UNLOCKED, '1');
  } catch {
    /* ignore */
  }
}

function emit(name) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(name));
}

function attachGestureListeners() {
  if (typeof window === 'undefined' || listenersAttached) return;
  listenersAttached = true;

  const onGesture = () => {
    unlockAudio({ fromGesture: true });
  };

  window.addEventListener('pointerdown', onGesture, { capture: true, passive: true });
  window.addEventListener('keydown', onGesture, { capture: true });
  window.addEventListener('touchstart', onGesture, { capture: true, passive: true });
}

function detachGestureListeners() {
  if (typeof window === 'undefined' || !listenersAttached) return;
  listenersAttached = false;
  /* Listeners are intentionally left — cheap no-op once unlocked. */
}

/**
 * @returns {boolean}
 */
export function isAudioUnlocked() {
  return readPersistedUnlock();
}

/**
 * Mark audio as user-approved (after successful play or explicit unlock tap).
 */
export function markAudioUnlocked() {
  persistUnlock();
  needsGesture = false;
  emit(AUDIO_UNLOCKED_EVENT);
}

/**
 * @param {{ fromGesture?: boolean }} [opts]
 */
export function unlockAudio(opts = {}) {
  markAudioUnlocked();
  if (typeof pendingResume === 'function') {
    const fn = pendingResume;
    pendingResume = null;
    void fn();
  }
  if (opts.fromGesture) {
    detachGestureListeners();
  }
}

/**
 * Attempt playback; on autoplay block queue resume and prompt for gesture.
 * @param {() => Promise<boolean>} playFn
 * @returns {Promise<boolean>}
 */
export async function requestAudioPlayback(playFn) {
  if (typeof window === 'undefined') return false;

  const attempt = async () => {
    try {
      const ok = await playFn();
      if (ok) {
        markAudioUnlocked();
        needsGesture = false;
        pendingResume = null;
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  const ok = await attempt();
  if (ok) return true;

  needsGesture = true;
  pendingResume = attempt;
  attachGestureListeners();
  emit(AUDIO_NEEDS_GESTURE_EVENT);
  return false;
}

export function audioNeedsGesture() {
  return needsGesture;
}

export function clearPendingAudioResume() {
  pendingResume = null;
  needsGesture = false;
}

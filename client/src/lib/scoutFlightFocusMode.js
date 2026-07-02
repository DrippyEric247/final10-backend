/**
 * Scout Flight focus / fullscreen helpers — scoped to the game page only.
 */

export function isNativeFullscreenActive() {
  return !!(
    document.fullscreenElement ||
    document.webkitFullscreenElement ||
    document.mozFullScreenElement
  );
}

export function isNativeFullscreenSupported(el) {
  if (!el) return false;
  return !!(
    el.requestFullscreen ||
    el.webkitRequestFullscreen ||
    el.mozRequestFullScreen
  );
}

export async function requestNativeFullscreen(el) {
  if (!el) return false;
  try {
    if (el.requestFullscreen) {
      await el.requestFullscreen();
      return true;
    }
    if (el.webkitRequestFullscreen) {
      await el.webkitRequestFullscreen();
      return true;
    }
    if (el.mozRequestFullScreen) {
      await el.mozRequestFullScreen();
      return true;
    }
  } catch {
    /* iOS / denied — fall back to CSS focus mode */
  }
  return false;
}

export async function exitNativeFullscreen() {
  try {
    if (document.exitFullscreen) {
      await document.exitFullscreen();
      return;
    }
    if (document.webkitExitFullscreen) {
      await document.webkitExitFullscreen();
    }
    if (document.mozCancelFullScreen) {
      await document.mozCancelFullScreen();
    }
  } catch {
    /* ignore */
  }
}

let bodyScrollLocked = false;
let previousBodyOverflow = '';
let previousBodyTouchAction = '';

export function lockBodyScroll() {
  if (bodyScrollLocked || typeof document === 'undefined') return;
  bodyScrollLocked = true;
  previousBodyOverflow = document.body.style.overflow;
  previousBodyTouchAction = document.body.style.touchAction;
  document.body.style.overflow = 'hidden';
  document.body.style.touchAction = 'none';
}

export function unlockBodyScroll() {
  if (!bodyScrollLocked || typeof document === 'undefined') return;
  bodyScrollLocked = false;
  document.body.style.overflow = previousBodyOverflow;
  document.body.style.touchAction = previousBodyTouchAction;
}

/** Viewport height safe for mobile browser chrome (100dvh fallback). */
export function getFocusViewportHeight() {
  if (typeof window === 'undefined') return 640;
  const vv = window.visualViewport?.height;
  if (vv && vv > 0) return Math.floor(vv);
  return Math.floor(window.innerHeight);
}

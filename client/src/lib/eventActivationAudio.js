/**
 * Final10 Live Event audio map — drop MP3s into public/audio/events/.
 */

export const EVENT_AUDIO = Object.freeze({
  double_points: '/audio/events/double-points.mp3',
  triple_points: '/audio/events/triple-points.mp3',
  savvy_sale: '/audio/events/savvy-sale.mp3',
  max_supply_drop: '/audio/events/max-supply-drop.mp3',
});

let sharedAudio = null;

export function playEventAudio(audioKey) {
  const key = String(audioKey || '').trim();
  const src = EVENT_AUDIO[key];
  if (!src || typeof window === 'undefined') return;

  try {
    if (!sharedAudio) {
      sharedAudio = new Audio();
    }
    sharedAudio.pause();
    sharedAudio.currentTime = 0;
    sharedAudio.src = src;
    const playPromise = sharedAudio.play();
    if (playPromise && typeof playPromise.catch === 'function') {
      playPromise.catch(() => {
        /* missing file or autoplay policy — fail silently */
      });
    }
  } catch {
    /* ignore */
  }
}

/**
 * Final10 Live Event audio — play-on-tap (mobile-safe), once per activation.
 */

export const EVENT_AUDIO = Object.freeze({
  double_points: '/audio/events/double-points.mp3',
  triple_points: '/audio/events/triple-points.mp3',
  savvy_sale: '/audio/events/savvy-sale.mp3',
  max_supply_drop: '/audio/events/max-supply-drop.mp3',
});

let sharedAudio = null;
let playingKey = null;
let playSessionId = 0;

function getAudioElement() {
  if (typeof window === 'undefined') return null;
  if (!sharedAudio) {
    sharedAudio = new Audio();
    sharedAudio.preload = 'auto';
  }
  return sharedAudio;
}

/**
 * Play event stinger after user tap. Resolves when audio ends or fails.
 * @returns {Promise<{ played: boolean, durationMs: number }>}
 */
export function playEventAudio(audioKey, { fallbackMs = 3500 } = {}) {
  const key = String(audioKey || '').trim();
  const src = EVENT_AUDIO[key];

  if (!src || typeof window === 'undefined') {
    return Promise.resolve({ played: false, durationMs: fallbackMs });
  }

  if (playingKey === key) {
    return Promise.resolve({ played: false, durationMs: 0 });
  }

  const audio = getAudioElement();
  if (!audio) {
    return Promise.resolve({ played: false, durationMs: fallbackMs });
  }

  const session = ++playSessionId;
  playingKey = key;

  return new Promise((resolve) => {
    let settled = false;
    const finish = (played, durationMs) => {
      if (settled || session !== playSessionId) return;
      settled = true;
      if (playingKey === key) playingKey = null;
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('error', onError);
      resolve({ played, durationMs: durationMs || fallbackMs });
    };

    const onEnded = () => {
      const ms = Math.round((Number(audio.duration) || 0) * 1000) || fallbackMs;
      finish(true, ms);
    };

    const onError = () => finish(false, fallbackMs);

    audio.addEventListener('ended', onEnded);
    audio.addEventListener('error', onError);

    try {
      audio.pause();
      audio.currentTime = 0;
      audio.src = src;
      const playPromise = audio.play();
      if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch(() => finish(false, fallbackMs));
      }
    } catch {
      finish(false, fallbackMs);
    }
  });
}

export function isEventAudioPlaying() {
  return Boolean(playingKey);
}

export function stopEventAudio() {
  playSessionId += 1;
  playingKey = null;
  if (sharedAudio) {
    try {
      sharedAudio.pause();
      sharedAudio.currentTime = 0;
    } catch {
      /* ignore */
    }
  }
}

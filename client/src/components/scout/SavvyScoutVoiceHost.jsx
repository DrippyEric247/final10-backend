import { useEffect } from 'react';
import {
  playScoutVoice,
  preloadScoutAudio,
  setScoutVoiceEnabled,
  stopScoutVoice,
  ensureScoutAudioUnlocked,
} from '../../lib/savvyScoutAudioService';
import {
  SCOUT_VOICE_EVENT,
  SCOUT_VOICE_LINES,
} from '../../lib/scoutVoiceLines';

const VOICE_PREF_KEY = 'f10_savvy_voice_on';

function readVoicePref() {
  try {
    return localStorage.getItem(VOICE_PREF_KEY) === '1';
  } catch {
    return false;
  }
}

/**
 * Global Savvy Scout voice host — event bus, preload, lifecycle cleanup.
 */
export default function SavvyScoutVoiceHost() {
  useEffect(() => {
    setScoutVoiceEnabled(readVoicePref());
    void preloadScoutAudio();
    bindUnlockGestures();

    const onVoiceLine = (event) => {
      const detail = event?.detail || {};
      const { lineKey, text, voiceSrc, volume, movementAccent, onStart, onEnd } = detail;
      if (movementAccent) {
        void playScoutVoice({ movementAccent: true });
        return;
      }
      if (!lineKey && !text && !voiceSrc) return;
      void playScoutVoice({
        lineKey,
        text,
        voiceSrc,
        volume,
        onStart,
        onEnd,
      });
    };

    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        stopScoutVoice({ reason: 'tab_hidden' });
      }
    };

    const onStorage = (event) => {
      if (event.key === VOICE_PREF_KEY) {
        setScoutVoiceEnabled(event.newValue === '1');
      }
    };

    window.addEventListener(SCOUT_VOICE_EVENT, onVoiceLine);
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('storage', onStorage);

    return () => {
      window.removeEventListener(SCOUT_VOICE_EVENT, onVoiceLine);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('storage', onStorage);
      stopScoutVoice({ reason: 'unmount' });
    };
  }, []);

  return null;
}

function bindUnlockGestures() {
  const unlock = () => {
    void ensureScoutAudioUnlocked();
  };
  window.addEventListener('pointerdown', unlock, { capture: true, passive: true, once: false });
  window.addEventListener('touchstart', unlock, { capture: true, passive: true, once: false });
}

export { SCOUT_VOICE_LINES };

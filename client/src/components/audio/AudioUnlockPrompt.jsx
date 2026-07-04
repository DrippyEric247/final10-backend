import { useEffect, useState } from 'react';
import {
  AUDIO_NEEDS_GESTURE_EVENT,
  AUDIO_UNLOCKED_EVENT,
  audioNeedsGesture,
  unlockAudio,
} from '../../lib/audioUnlockManager';
import '../../styles/AudioUnlockPrompt.css';

/**
 * Shown when the browser blocks autoplay — first tap anywhere unlocks app audio.
 */
export default function AudioUnlockPrompt() {
  const [visible, setVisible] = useState(() => audioNeedsGesture());

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const show = () => setVisible(true);
    const hide = () => setVisible(false);

    window.addEventListener(AUDIO_NEEDS_GESTURE_EVENT, show);
    window.addEventListener(AUDIO_UNLOCKED_EVENT, hide);
    return () => {
      window.removeEventListener(AUDIO_NEEDS_GESTURE_EVENT, show);
      window.removeEventListener(AUDIO_UNLOCKED_EVENT, hide);
    };
  }, []);

  if (!visible) return null;

  return (
    <button
      type="button"
      className="f10-audio-unlock-prompt"
      aria-label="Tap to enable Final10 menu music"
      onClick={() => unlockAudio({ fromGesture: true })}
    >
      <span className="f10-audio-unlock-icon" aria-hidden>
        🎵
      </span>
      <span className="f10-audio-unlock-copy">
        <strong>Tap to enable sound</strong>
        <span>Final10 menu theme · Savvy Universe</span>
      </span>
    </button>
  );
}

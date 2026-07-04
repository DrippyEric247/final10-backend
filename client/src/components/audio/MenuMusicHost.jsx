import AppAudioProvider, { useAppAudioSync } from './AppAudioProvider';

export { useAppAudioSync, AppAudioProvider };

/** Legacy null host — prefer wrapping the app with AppAudioProvider. */
export default function MenuMusicHost() {
  useAppAudioSync();
  return null;
}

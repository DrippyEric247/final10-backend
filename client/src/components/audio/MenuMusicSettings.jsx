import React, { useEffect, useState } from 'react';
import { Music2 } from 'lucide-react';
import {
  getMenuMusicVolume,
  isMenuMusicEnabled,
  MENU_MUSIC_SETTINGS_EVENT,
  menuMusicEngine,
  setMenuMusicEnabled,
  setMenuMusicVolume,
} from '../../lib/menuMusicEngine';
import { DEFAULT_MENU_TRACK_ID, getMenuTrack } from '../../lib/menuMusicLibrary';

export default function MenuMusicSettings() {
  const [enabled, setEnabled] = useState(() => isMenuMusicEnabled());
  const [volume, setVolume] = useState(() => getMenuMusicVolume());
  const track = getMenuTrack(menuMusicEngine.getTrackId() || DEFAULT_MENU_TRACK_ID);

  useEffect(() => {
    const sync = () => {
      setEnabled(isMenuMusicEnabled());
      setVolume(getMenuMusicVolume());
    };
    window.addEventListener(MENU_MUSIC_SETTINGS_EVENT, sync);
    return () => window.removeEventListener(MENU_MUSIC_SETTINGS_EVENT, sync);
  }, []);

  return (
    <section className="mb-8">
      <h2 className="text-sm font-bold uppercase tracking-wide text-[var(--f10-text-dim)] mb-3">
        Audio
      </h2>
      <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-4 space-y-4">
        <div className="flex items-start gap-3">
          <Music2 className="h-5 w-5 shrink-0 text-purple-300 mt-0.5" aria-hidden />
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-[var(--f10-text)] m-0">Menu music</p>
            <p className="text-sm text-[var(--f10-text-dim)] mt-1 mb-0">
              {track.label} — your Savvy Universe home soundtrack.
            </p>
          </div>
          <label className="inline-flex items-center gap-2 shrink-0 cursor-pointer">
            <span className="sr-only">Menu music on or off</span>
            <input
              type="checkbox"
              className="h-4 w-4 accent-purple-400"
              checked={enabled}
              onChange={(e) => {
                const on = e.target.checked;
                setEnabled(on);
                setMenuMusicEnabled(on);
              }}
            />
            <span className="text-sm text-[var(--f10-text-dim)]">{enabled ? 'On' : 'Off'}</span>
          </label>
        </div>

        <div className={enabled ? '' : 'opacity-50 pointer-events-none'}>
          <label htmlFor="menu-music-volume" className="block text-sm text-[var(--f10-text-dim)] mb-2">
            Music volume
          </label>
          <input
            id="menu-music-volume"
            type="range"
            min={0}
            max={100}
            step={1}
            value={Math.round(volume * 100)}
            className="w-full accent-purple-400"
            disabled={!enabled}
            onChange={(e) => {
              const next = Number(e.target.value) / 100;
              setVolume(next);
              setMenuMusicVolume(next);
            }}
          />
        </div>
      </div>
    </section>
  );
}

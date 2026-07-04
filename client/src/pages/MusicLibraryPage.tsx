import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  downloadSoundtrack,
  fetchSoundtrackLibrary,
  getSoundtrackPreviewObjectUrl,
  setMenuMusicTrack,
} from "../lib/api";
import { soundtrackSourceLabel } from "../lib/soundtrackCatalog";
import Final10Slogan from "../components/branding/Final10Slogan";
import LoadingState from "../components/ui/states/LoadingState";
import ErrorState from "../components/ui/states/ErrorState";
import "../styles/MusicLibraryPage.css";

type LibraryTrack = {
  id: string;
  title: string;
  description: string;
  source: string;
  menuEligible: boolean;
  unlocked: boolean;
  lockedTeaser?: string;
};

function TrackRow({
  track,
  menuMusicTrackId,
  onMenuMusicSet,
  busyId,
  onBusy,
}: {
  track: LibraryTrack;
  menuMusicTrackId?: string | null;
  onMenuMusicSet: (trackId: string) => void;
  busyId: string | null;
  onBusy: (id: string | null) => void;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const unlocked = Boolean(track.unlocked);

  const stopPreview = useCallback(() => {
    const audio = audioRef.current;
    if (audio) {
      try {
        audio.pause();
        audio.currentTime = 0;
      } catch {
        /* ignore */
      }
    }
    setPreviewing(false);
  }, []);

  useEffect(() => () => stopPreview(), [stopPreview]);

  const handlePreview = async () => {
    if (!unlocked || busyId) return;
    onBusy(track.id);
    try {
      stopPreview();
      const audio = audioRef.current;
      if (!audio) return;
      const url = await getSoundtrackPreviewObjectUrl(track.id);
      audio.src = url;
      setPreviewing(true);
      await audio.play();
    } catch {
      setPreviewing(false);
    } finally {
      onBusy(null);
    }
  };

  const handleDownload = async () => {
    if (!unlocked || busyId) return;
    onBusy(track.id);
    try {
      await downloadSoundtrack(track.id, track.title);
    } finally {
      onBusy(null);
    }
  };

  const isMenuMusic = menuMusicTrackId === track.id;

  return (
    <article className={`f10-music-row ${unlocked ? "is-unlocked" : "is-locked"}`}>
      <audio ref={audioRef} onEnded={() => setPreviewing(false)} onError={() => setPreviewing(false)} />
      <div className="f10-music-row-main">
        <div className="f10-music-row-icon" aria-hidden>
          {unlocked ? "🎵" : "🔒"}
        </div>
        <div>
          <h3 className="f10-music-row-title">{track.title}</h3>
          <p className="f10-music-row-desc">
            {unlocked ? track.description : track.lockedTeaser || "Unlock via Battle Pass or events."}
          </p>
          <span className="f10-music-row-source">{soundtrackSourceLabel(track.source)}</span>
        </div>
      </div>
      <div className="f10-music-row-actions">
        {unlocked ? (
          <>
            <button
              type="button"
              className="f10-music-btn f10-music-btn--ghost"
              disabled={Boolean(busyId)}
              onClick={previewing ? stopPreview : handlePreview}
            >
              {previewing ? "Stop" : "Preview"}
            </button>
            <button
              type="button"
              className="f10-music-btn f10-music-btn--ghost"
              disabled={Boolean(busyId)}
              onClick={handleDownload}
            >
              Download
            </button>
            {track.menuEligible ? (
              <button
                type="button"
                className={`f10-music-btn ${isMenuMusic ? "f10-music-btn--active" : "f10-music-btn--primary"}`}
                disabled={Boolean(busyId) || isMenuMusic}
                title="Menu music selection — coming soon to Settings"
                onClick={() => onMenuMusicSet(track.id)}
              >
                {isMenuMusic ? "Menu Music" : "Set as Menu Music"}
              </button>
            ) : (
              <span className="f10-music-row-note">Stinger · not for menu</span>
            )}
          </>
        ) : (
          <span className="f10-music-locked-teaser">Preview locked — earn this track first</span>
        )}
      </div>
    </article>
  );
}

export default function MusicLibraryPage() {
  const { user } = useAuth() || {};
  const [library, setLibrary] = useState<{
    tracks: LibraryTrack[];
    menuMusicTrackId?: string | null;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await fetchSoundtrackLibrary();
      setLibrary(data);
    } catch (e: unknown) {
      const ax = e as { response?: { data?: { message?: string } } };
      setError(ax.response?.data?.message || "Could not load Music Library.");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  const sortedTracks = useMemo(() => {
    const tracks = library?.tracks || [];
    return [...tracks].sort((a, b) => {
      if (a.unlocked !== b.unlocked) return a.unlocked ? -1 : 1;
      return a.title.localeCompare(b.title);
    });
  }, [library]);

  const unlockedCount = useMemo(
    () => sortedTracks.filter((t) => t.unlocked).length,
    [sortedTracks]
  );

  const handleMenuMusicSet = async (trackId: string) => {
    setBusyId(trackId);
    try {
      await setMenuMusicTrack(trackId);
      setLibrary((prev) => (prev ? { ...prev, menuMusicTrackId: trackId } : prev));
      setToast("Menu music preference saved for when the picker ships in Settings.");
      setTimeout(() => setToast(null), 4000);
    } catch (e: unknown) {
      const ax = e as { response?: { data?: { message?: string } } };
      setError(ax.response?.data?.message || "Could not set menu music.");
    } finally {
      setBusyId(null);
    }
  };

  if (!user) {
    return (
      <article className="f10-music-page mx-auto max-w-3xl py-4">
        <div className="card p-6">
          <h1 className="text-2xl font-bold m-0">Music Library</h1>
          <p className="text-[var(--f10-text-dim)] mt-2">Sign in to browse your Savvy Universe soundtracks.</p>
          <Link to="/login" className="f10-music-btn f10-music-btn--primary mt-4 inline-block">
            Sign in
          </Link>
        </div>
      </article>
    );
  }

  return (
    <article className="f10-music-page mx-auto max-w-3xl py-4">
      <div className="card p-6 sm:p-8">
        <header className="f10-music-header">
          <p className="f10-music-kicker">Savvy Universe</p>
          <h1 className="f10-music-title">Music Library</h1>
          <p className="f10-music-sub">
            Collectible audio from Battle Pass, events, and founder rewards — preview, download, and equip as menu music.
          </p>
          <Final10Slogan variant="empty" as="p" className="mt-2" />
          <div className="f10-music-stats">
            <span>{unlockedCount} unlocked</span>
            <span>{sortedTracks.length - unlockedCount} locked</span>
            <Link to="/battle-pass" className="f10-music-link">
              Earn more on Battle Pass →
            </Link>
          </div>
        </header>

        {toast ? <div className="f10-music-toast">{toast}</div> : null}
        {loading ? <LoadingState label="Loading soundtracks…" /> : null}
        {error ? <ErrorState description={error} onRetry={load} /> : null}

        {!loading && !error ? (
          <section className="f10-music-list" aria-label="Soundtrack collection">
            {sortedTracks.map((track) => (
              <TrackRow
                key={track.id}
                track={track}
                menuMusicTrackId={library?.menuMusicTrackId}
                onMenuMusicSet={handleMenuMusicSet}
                busyId={busyId}
                onBusy={setBusyId}
              />
            ))}
          </section>
        ) : null}
      </div>
    </article>
  );
}

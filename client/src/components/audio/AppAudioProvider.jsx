import { useCallback, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  enterPerkMachineMusic,
  exitPerkMachineMusic,
  initializeAppAudioAfterAuth,
  isPerkMachineRoute,
  preloadAppMusic,
  tryStartMenuMusic,
} from '../../lib/appMusicCoordinator';
import { AUDIO_UNLOCKED_EVENT, clearPendingAudioResume } from '../../lib/audioUnlockManager';
import {
  getMusicRoutePolicy,
  MUSIC_ROUTE_POLICY,
  shouldKeepMenuMusic,
} from '../../lib/menuMusicLibrary';
import { isScoutFlightGameplayFocusActive } from '../../lib/scoutFlightGameplayFocus';
import { menuMusicEngine } from '../../lib/menuMusicEngine';
import { perkMachineMusicEngine } from '../../lib/perkMachineMusicEngine';
import { scoutFlightMusicEngine } from '../../lib/scoutFlightMusicEngine';
import AudioUnlockPrompt from './AudioUnlockPrompt';

const AUTH_SESSION_EVENT = 'f10:auth-session-started';

function shouldPlayMenuMusic(pathname = '') {
  if (isScoutFlightGameplayFocusActive()) return false;
  if (!shouldKeepMenuMusic(pathname)) return false;
  if (scoutFlightMusicEngine.isActive()) return false;
  // eslint-disable-next-line no-console
  console.log('[MUSIC_ROUTE_KEEP_PLAYING]', pathname);
  return true;
}

/**
 * Global audio sync — one shared menu engine instance across all routes.
 * Mounted inside the router so navigation never unmounts the audio singleton.
 */
export function useAppAudioSync() {
  const { user, loading } = useAuth();
  const location = useLocation();
  const wasPerkRef = useRef(false);
  const authPrimedRef = useRef(false);

  const pathname = location.pathname;

  const startMenuIfAllowed = useCallback(
    (opts = {}) => {
      if (!user || loading) return;
      if (!shouldPlayMenuMusic(pathname)) return;
      void tryStartMenuMusic({
        pathname,
        fadeMs: opts.fadeMs,
        fromStart: Boolean(opts.fromStart),
      });
    },
    [user, loading, pathname]
  );

  useEffect(() => {
    if (!user || loading) {
      authPrimedRef.current = false;
      return undefined;
    }
    void preloadAppMusic();
    return undefined;
  }, [user, loading]);

  useEffect(() => {
    if (typeof window === 'undefined' || !user || loading) return undefined;

    const onAuthSession = (event) => {
      authPrimedRef.current = true;
      const fromLogin =
        event?.detail?.source === 'login' ||
        event?.detail?.source === 'register' ||
        event?.detail?.source === 'social';
      void initializeAppAudioAfterAuth({
        pathname: window.location.pathname,
        fromLogin,
      });
    };

    const onAudioUnlocked = () => {
      startMenuIfAllowed({ fadeMs: 900 });
    };

    const onScoutFlightEnded = () => {
      startMenuIfAllowed({ fadeMs: 900 });
    };

    window.addEventListener(AUTH_SESSION_EVENT, onAuthSession);
    window.addEventListener(AUDIO_UNLOCKED_EVENT, onAudioUnlocked);
    window.addEventListener('f10:scout-flight-music-ended', onScoutFlightEnded);
    return () => {
      window.removeEventListener(AUTH_SESSION_EVENT, onAuthSession);
      window.removeEventListener(AUDIO_UNLOCKED_EVENT, onAudioUnlocked);
      window.removeEventListener('f10:scout-flight-music-ended', onScoutFlightEnded);
    };
  }, [user, loading, startMenuIfAllowed]);

  useEffect(() => {
    if (loading) return undefined;

    if (!user) {
      wasPerkRef.current = false;
      authPrimedRef.current = false;
      clearPendingAudioResume();
      void menuMusicEngine.stop({ fadeMs: 400 });
      void perkMachineMusicEngine.stop({ fadeMs: 400 });
      void scoutFlightMusicEngine.stop({ fadeMs: 400 });
      return undefined;
    }

    const onPerkRoute = isPerkMachineRoute(pathname);
    const wasPerk = wasPerkRef.current;
    const routePolicy = getMusicRoutePolicy(pathname);
    const wantMenu = shouldPlayMenuMusic(pathname);

    if (onPerkRoute && !wasPerk) {
      void enterPerkMachineMusic();
    } else if (!onPerkRoute && wasPerk) {
      void exitPerkMachineMusic(pathname);
    } else if (wantMenu && !onPerkRoute) {
      if (menuMusicEngine.isPlaying()) {
        menuMusicEngine.pausedForRoute = false;
      } else {
        startMenuIfAllowed({
          fadeMs: menuMusicEngine.pausedForRoute ? 900 : 1600,
          fromStart: false,
        });
      }
    } else if (
      routePolicy === MUSIC_ROUTE_POLICY.SILENT &&
      !onPerkRoute &&
      !scoutFlightMusicEngine.isActive()
    ) {
      if (menuMusicEngine.isPlaying()) {
        void menuMusicEngine.pause({ fadeMs: 900 });
      }
    }

    wasPerkRef.current = onPerkRoute;
    return undefined;
  }, [user, loading, pathname, startMenuIfAllowed]);

  /** Session restore on refresh — auth event may have fired before this hook mounted. */
  useEffect(() => {
    if (!user || loading || authPrimedRef.current) return undefined;
    authPrimedRef.current = true;
    void initializeAppAudioAfterAuth({ pathname, fromLogin: false });
    return undefined;
  }, [user, loading, pathname]);
}

export default function AppAudioProvider({ children }) {
  useAppAudioSync();
  return (
    <>
      {children ?? null}
      <AudioUnlockPrompt />
    </>
  );
}

import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  enterPerkMachineMusic,
  exitPerkMachineMusic,
  isMenuMusicRoute,
  isPerkMachineRoute,
  preloadAppMusic,
} from '../../lib/appMusicCoordinator';
import { isDedicatedMusicOverrideRoute } from '../../lib/menuMusicLibrary';
import { menuMusicEngine } from '../../lib/menuMusicEngine';
import { perkMachineMusicEngine } from '../../lib/perkMachineMusicEngine';
import { scoutFlightMusicEngine } from '../../lib/scoutFlightMusicEngine';

function shouldPlayMenuMusic(pathname = '') {
  return (
    isMenuMusicRoute(pathname) &&
    !isDedicatedMusicOverrideRoute(pathname) &&
    !scoutFlightMusicEngine.isActive()
  );
}

/**
 * Global audio sync — one shared menu engine instance across all routes.
 * Mounted above the router so navigation never unmounts the audio singleton.
 */
export function useAppAudioSync() {
  const { user, loading } = useAuth();
  const location = useLocation();
  const wasPerkRef = useRef(false);
  const bootReadyRef = useRef(false);

  useEffect(() => {
    if (!user || loading) return undefined;
    void preloadAppMusic();
  }, [user, loading]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const markBootReady = () => {
      bootReadyRef.current = true;
    };

    window.addEventListener('f10:startup-boot-complete', markBootReady);
    const fallback = window.setTimeout(markBootReady, 2400);

    return () => {
      window.removeEventListener('f10:startup-boot-complete', markBootReady);
      window.clearTimeout(fallback);
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const onScoutFlightEnded = () => {
      const pathname = window.location.pathname;
      if (shouldPlayMenuMusic(pathname) && !menuMusicEngine.isPlaying()) {
        void menuMusicEngine.play({ fadeMs: 900, fromStart: false });
      }
    };

    window.addEventListener('f10:scout-flight-music-ended', onScoutFlightEnded);
    return () => window.removeEventListener('f10:scout-flight-music-ended', onScoutFlightEnded);
  }, []);

  useEffect(() => {
    if (loading) return undefined;

    const pathname = location.pathname;

    if (!user) {
      wasPerkRef.current = false;
      void menuMusicEngine.stop({ fadeMs: 400 });
      void perkMachineMusicEngine.stop({ fadeMs: 400 });
      void scoutFlightMusicEngine.stop({ fadeMs: 400 });
      return undefined;
    }

    const onPerkRoute = isPerkMachineRoute(pathname);
    const wasPerk = wasPerkRef.current;
    const wantMenu = shouldPlayMenuMusic(pathname);

    const ensureMenuMusic = () => {
      if (!shouldPlayMenuMusic(pathname)) return;
      if (menuMusicEngine.isPlaying()) return;
      void menuMusicEngine.play({
        fadeMs: menuMusicEngine.pausedForRoute ? 900 : 2000,
        fromStart: true,
      });
    };

    const pauseMenuMusic = () => {
      if (!menuMusicEngine.isPlaying()) return;
      void menuMusicEngine.pause({ fadeMs: 900 });
    };

    if (onPerkRoute && !wasPerk) {
      const startPerkMusic = () => {
        if (!isPerkMachineRoute(pathname)) return;
        void enterPerkMachineMusic();
      };

      if (bootReadyRef.current) {
        startPerkMusic();
      } else {
        const onBoot = () => startPerkMusic();
        window.addEventListener('f10:startup-boot-complete', onBoot, { once: true });
        const timer = window.setTimeout(startPerkMusic, 2600);
        wasPerkRef.current = onPerkRoute;
        return () => {
          window.removeEventListener('f10:startup-boot-complete', onBoot);
          window.clearTimeout(timer);
        };
      }
    } else if (!onPerkRoute && wasPerk) {
      void exitPerkMachineMusic(pathname);
    } else if (wantMenu) {
      if (bootReadyRef.current) {
        ensureMenuMusic();
      } else {
        const onBoot = () => ensureMenuMusic();
        window.addEventListener('f10:startup-boot-complete', onBoot, { once: true });
        const timer = window.setTimeout(ensureMenuMusic, 2600);
        wasPerkRef.current = onPerkRoute;
        return () => {
          window.removeEventListener('f10:startup-boot-complete', onBoot);
          window.clearTimeout(timer);
        };
      }
    } else if (!wantMenu && !onPerkRoute && !scoutFlightMusicEngine.isActive()) {
      pauseMenuMusic();
    }

    wasPerkRef.current = onPerkRoute;
    return undefined;
  }, [user, loading, location.pathname]);
}

export default function AppAudioProvider({ children }) {
  useAppAudioSync();
  return children ?? null;
}

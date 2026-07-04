import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  enterPerkMachineMusic,
  exitPerkMachineMusic,
  exitScoutFlightGameplayMusic,
  isMenuMusicRoute,
  isPerkMachineRoute,
  isScoutFlightGameplayRoute,
  preloadAppMusic,
} from '../../lib/appMusicCoordinator';
import { menuMusicEngine } from '../../lib/menuMusicEngine';
import { perkMachineMusicEngine } from '../../lib/perkMachineMusicEngine';
import { scoutFlightMusicEngine } from '../../lib/scoutFlightMusicEngine';

/**
 * Route-aware menu, Perk Machine, and Scout Flight music host.
 */
export default function MenuMusicHost() {
  const { user, loading } = useAuth();
  const location = useLocation();
  const wasMenuRef = useRef(false);
  const wasPerkRef = useRef(false);
  const wasScoutFlightRef = useRef(false);
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
    if (loading) return undefined;

    if (!user) {
      wasMenuRef.current = false;
      wasPerkRef.current = false;
      wasScoutFlightRef.current = false;
      void menuMusicEngine.stop({ fadeMs: 400 });
      void perkMachineMusicEngine.stop({ fadeMs: 400 });
      void scoutFlightMusicEngine.stop({ fadeMs: 400 });
      return undefined;
    }

    const onPerkRoute = isPerkMachineRoute(location.pathname);
    const onScoutFlightRoute = isScoutFlightGameplayRoute(location.pathname);
    const onMenuRoute = isMenuMusicRoute(location.pathname);
    const wasPerk = wasPerkRef.current;
    const wasScoutFlight = wasScoutFlightRef.current;
    const wasMenu = wasMenuRef.current;

    if (onPerkRoute && !wasPerk) {
      const startPerkMusic = () => {
        if (!isPerkMachineRoute(location.pathname)) return;
        void enterPerkMachineMusic();
      };

      if (bootReadyRef.current) {
        startPerkMusic();
      } else {
        const onBoot = () => startPerkMusic();
        window.addEventListener('f10:startup-boot-complete', onBoot, { once: true });
        const timer = window.setTimeout(startPerkMusic, 2600);
        return () => {
          window.removeEventListener('f10:startup-boot-complete', onBoot);
          window.clearTimeout(timer);
        };
      }
    } else if (!onPerkRoute && wasPerk) {
      void exitPerkMachineMusic(location.pathname);
    } else if (!onScoutFlightRoute && wasScoutFlight) {
      void exitScoutFlightGameplayMusic({ pathname: location.pathname });
    } else if (onMenuRoute && !wasMenu && !onPerkRoute && !onScoutFlightRoute) {
      const startMenuMusic = () => {
        if (
          !isMenuMusicRoute(location.pathname) ||
          isPerkMachineRoute(location.pathname) ||
          isScoutFlightGameplayRoute(location.pathname)
        ) {
          return;
        }
        void menuMusicEngine.play({ fadeMs: 2000, fromStart: true });
      };

      if (bootReadyRef.current) {
        startMenuMusic();
      } else {
        const onBoot = () => startMenuMusic();
        window.addEventListener('f10:startup-boot-complete', onBoot, { once: true });
        const timer = window.setTimeout(startMenuMusic, 2600);
        return () => {
          window.removeEventListener('f10:startup-boot-complete', onBoot);
          window.clearTimeout(timer);
        };
      }
    } else if (!onMenuRoute && wasMenu && !wasPerk && !onPerkRoute && !onScoutFlightRoute) {
      void menuMusicEngine.pause({ fadeMs: 900 });
    }

    wasPerkRef.current = onPerkRoute;
    wasScoutFlightRef.current = onScoutFlightRoute;
    wasMenuRef.current = onMenuRoute;
    return undefined;
  }, [user, loading, location.pathname]);

  return null;
}

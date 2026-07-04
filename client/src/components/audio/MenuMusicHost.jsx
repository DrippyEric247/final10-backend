import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { isMenuMusicRoute } from '../../lib/menuMusicLibrary';
import { menuMusicEngine } from '../../lib/menuMusicEngine';

/**
 * Route-aware menu music host — single instance, preload after login.
 */
export default function MenuMusicHost() {
  const { user, loading } = useAuth();
  const location = useLocation();
  const wasMenuRef = useRef(false);
  const bootReadyRef = useRef(false);

  useEffect(() => {
    if (!user || loading) return undefined;
    void menuMusicEngine.preload();
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
      void menuMusicEngine.stop({ fadeMs: 400 });
      return undefined;
    }

    const onMenuRoute = isMenuMusicRoute(location.pathname);
    const wasMenu = wasMenuRef.current;

    if (onMenuRoute && !wasMenu) {
      const startMenuMusic = () => {
        if (!isMenuMusicRoute(location.pathname)) return;
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
    } else if (!onMenuRoute && wasMenu) {
      void menuMusicEngine.pause({ fadeMs: 900 });
    }

    wasMenuRef.current = onMenuRoute;
    return undefined;
  }, [user, loading, location.pathname]);

  return null;
}

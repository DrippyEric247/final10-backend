import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useLocation } from 'react-router-dom';

const MoreMenuContext = createContext(null);

export function MoreMenuProvider({ children }) {
  const [isOpen, setIsOpen] = useState(false);
  const isOpenRef = useRef(isOpen);
  const location = useLocation();

  useEffect(() => {
    isOpenRef.current = isOpen;
  }, [isOpen]);

  useEffect(() => {
    document.documentElement.classList.toggle('f10-nav-more-open', isOpen);
    return () => document.documentElement.classList.remove('f10-nav-more-open');
  }, [isOpen]);

  // Intentional close only on navigation — never from window scroll handlers.
  useEffect(() => {
    setIsOpen(false);
  }, [location.pathname, location.hash, location.search]);

  const openMore = useCallback(() => setIsOpen(true), []);
  const closeMore = useCallback(() => setIsOpen(false), []);
  const toggleMore = useCallback(() => setIsOpen((open) => !open), []);

  const value = useMemo(
    () => ({
      isOpen,
      isOpenRef,
      openMore,
      closeMore,
      toggleMore,
    }),
    [isOpen, openMore, closeMore, toggleMore]
  );

  return <MoreMenuContext.Provider value={value}>{children}</MoreMenuContext.Provider>;
}

export function useMoreMenu() {
  const ctx = useContext(MoreMenuContext);
  if (!ctx) {
    throw new Error('useMoreMenu must be used within MoreMenuProvider');
  }
  return ctx;
}

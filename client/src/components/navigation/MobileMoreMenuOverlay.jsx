import React, { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import BugReportModal from '../BugReportModal';
import MoreMenuSections from './MoreMenuSections';
import { useMoreMenu } from '../../context/MoreMenuContext';
import { lockPageScroll, unlockPageScroll, MORE_MENU_SCROLL_ID } from '../../lib/pageScrollLock';
import '../../styles/MobileMoreMenuOverlay.css';

/**
 * Full-screen mobile More menu — mounted once at app-shell level.
 * Desktop uses the inline dropdown inside Navigation.js.
 */
export default function MobileMoreMenuOverlay() {
  const { isOpen, closeMore } = useMoreMenu();
  const scrollRef = useRef(null);
  const savedScrollTopRef = useRef(0);
  const [showBugReport, setShowBugReport] = useState(false);

  // Lock page scroll while open; restore exact scrollY on close.
  useEffect(() => {
    if (!isOpen) return undefined;
    const scrollState = lockPageScroll();
    return () => unlockPageScroll(scrollState);
  }, [isOpen]);

  // Restore internal menu scroll position when reopening in the same session.
  useEffect(() => {
    if (!isOpen) return undefined;
    const saved = savedScrollTopRef.current;
    const id = window.requestAnimationFrame(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollTop = saved;
      }
    });
    return () => window.cancelAnimationFrame(id);
  }, [isOpen]);

  const handleClose = () => {
    if (scrollRef.current) {
      savedScrollTopRef.current = scrollRef.current.scrollTop;
    }
    closeMore();
  };

  return (
    <>
      <div
        className={`f10-mobile-more-overlay${isOpen ? ' is-open' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label="More menu"
        aria-hidden={!isOpen}
      >
        <header className="f10-mobile-more-header">
          <div className="f10-mobile-more-handle" aria-hidden />
          <h2 className="f10-mobile-more-title">More</h2>
          <button
            type="button"
            className="f10-mobile-more-close"
            aria-label="Close More menu"
            onClick={handleClose}
          >
            <X size={22} strokeWidth={2.25} aria-hidden />
          </button>
        </header>

        <div
          id={MORE_MENU_SCROLL_ID}
          ref={scrollRef}
          className="f10-mobile-more-scroll"
        >
          <MoreMenuSections onReportBug={() => setShowBugReport(true)} />
        </div>
      </div>

      <BugReportModal isOpen={showBugReport} onClose={() => setShowBugReport(false)} />
    </>
  );
}

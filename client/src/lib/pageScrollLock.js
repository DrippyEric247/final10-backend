/** Id of the mobile More menu scroll container — touch scroll is allowed only here. */
export const MORE_MENU_SCROLL_ID = 'f10-mobile-more-scroll';

/**
 * Lock page scroll (iOS-safe): fixed body + block touchmove outside the More scroller.
 * @returns {object|null} Previous styles + listener — pass to unlockPageScroll on cleanup.
 */
export function lockPageScroll() {
  const y = window.scrollY || window.pageYOffset || 0;
  const body = document.body;
  const html = document.documentElement;
  const prev = {
    bodyOverflow: body.style.overflow,
    bodyPosition: body.style.position,
    bodyTop: body.style.top,
    bodyWidth: body.style.width,
    htmlOverflow: html.style.overflow,
    scrollY: y,
  };

  body.style.overflow = 'hidden';
  body.style.position = 'fixed';
  body.style.top = `-${y}px`;
  body.style.width = '100%';
  html.style.overflow = 'hidden';

  const onTouchMove = (e) => {
    const scrollEl = document.getElementById(MORE_MENU_SCROLL_ID);
    if (scrollEl && (scrollEl === e.target || scrollEl.contains(e.target))) {
      return;
    }
    e.preventDefault();
  };
  document.addEventListener('touchmove', onTouchMove, { passive: false });

  return { ...prev, onTouchMove };
}

/** Restore body/html styles and the saved page scroll position. */
export function unlockPageScroll(prev) {
  if (!prev) return;
  document.removeEventListener('touchmove', prev.onTouchMove);
  const body = document.body;
  const html = document.documentElement;
  body.style.overflow = prev.bodyOverflow;
  body.style.position = prev.bodyPosition;
  body.style.top = prev.bodyTop;
  body.style.width = prev.bodyWidth;
  html.style.overflow = prev.htmlOverflow;
  window.scrollTo(0, prev.scrollY);
}

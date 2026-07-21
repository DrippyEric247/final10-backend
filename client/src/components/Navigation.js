import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import BugReportModal from './BugReportModal';
import MoreMenuSections from './navigation/MoreMenuSections';
import {
  Bell,
  ChevronDown,
  Gavel,
  Grid3x3,
  Home,
  Plane,
  User,
  Zap,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import MembershipStatusBadge from './membership/MembershipStatusBadge';
import { useMoreMenu } from '../context/MoreMenuContext';
import { getNotificationSummary, markNotificationsRead } from '../lib/api';
import { ApiCoolingDownError } from '../lib/apiRequestGate';
import { isNavActive } from '../lib/navigationActive';
import { DEAL_PHILOSOPHY_LANES, NAV_ITEM_KEYS, PROFILE_NAV_PATH } from '../lib/primaryNavigation';
import {
  ADMIN_MORE_ITEMS,
  MORE_MENU_SECTIONS,
  NAV_SHORT_LABELS,
  SCOUT_FLIGHT_PATH,
} from '../lib/navigationMenuConfig';
import { shouldShowAdminNav } from '../lib/adminAccess';
import '../styles/PrimaryNavigation.css';

const NAV_ICON_SIZE = 18;
const NAV_ICON_STROKE = 2.25;
const MOBILE_NAV_MQ = '(max-width: 768px)';

/** Session-only persistence for the collapsed nav state (rule 11). */
const NAV_COLLAPSE_STORAGE_KEY = 'f10_nav_collapsed';
/** Min vertical gesture distance (px) to count as a nav swipe. */
const NAV_SWIPE_THRESHOLD = 44;
/** Scroll delta (px) before we react, and the top zone that always shows nav. */
const NAV_SCROLL_DELTA = 8;
const NAV_SCROLL_TOP_ZONE = 48;
/** Top edge band (px) where a downward swipe pulls the nav back. */
const NAV_TOP_EDGE_BAND = 56;

function readInitialCollapsed() {
  if (typeof window === 'undefined') return false;
  try {
    return window.sessionStorage.getItem(NAV_COLLAPSE_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function useMobileNavLayout() {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia(MOBILE_NAV_MQ).matches;
  });

  useEffect(() => {
    const mq = window.matchMedia(MOBILE_NAV_MQ);
    const onChange = () => setIsMobile(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  return isMobile;
}

const Navigation = () => {
  const location = useLocation();
  const [showBugReport, setShowBugReport] = useState(false);
  const [alertUnreadCount, setAlertUnreadCount] = useState(0);
  const [collapsed, setCollapsed] = useState(readInitialCollapsed);
  const { user } = useAuth() || {};
  const showAdminNav = shouldShowAdminNav(user);
  const isMobile = useMobileNavLayout();
  const { isOpen: moreOpen, isOpenRef: moreOpenRef, toggleMore: toggleMoreMenu } = useMoreMenu();

  const collapsedRef = useRef(collapsed);
  const navTouchRef = useRef({ x: 0, y: 0, active: false });

  useEffect(() => {
    collapsedRef.current = collapsed;
  }, [collapsed]);

  const applyCollapsed = useCallback((next) => {
    if (next && moreOpenRef.current) return;
    setCollapsed((prev) => {
      if (prev === next) return prev;
      try {
        window.sessionStorage.setItem(NAV_COLLAPSE_STORAGE_KEY, next ? '1' : '0');
      } catch {
        /* ignore storage failures (private mode) */
      }
      if (next) {
        // eslint-disable-next-line no-console
        console.log('[NAV_COLLAPSED]');
      } else {
        // eslint-disable-next-line no-console
        console.log('[NAV_EXPANDED]');
      }
      return next;
    });
  }, [moreOpenRef]);

  const toggleMore = useCallback(() => {
    if (!moreOpenRef.current) {
      applyCollapsed(false);
    }
    toggleMoreMenu();
  }, [applyCollapsed, moreOpenRef, toggleMoreMenu]);

  useEffect(() => {
    document.documentElement.classList.toggle('f10-nav-collapsed', collapsed);
    return () => document.documentElement.classList.remove('f10-nav-collapsed');
  }, [collapsed]);

  useEffect(() => {
    let lastY = window.scrollY || 0;
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(() => {
        ticking = false;
        if (moreOpenRef.current) return;
        const y = window.scrollY || 0;
        const dy = y - lastY;
        lastY = y;
        if (y <= NAV_SCROLL_TOP_ZONE) {
          applyCollapsed(false);
          return;
        }
        if (dy > NAV_SCROLL_DELTA) applyCollapsed(true);
        else if (dy < -NAV_SCROLL_DELTA) applyCollapsed(false);
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [applyCollapsed, moreOpenRef]);

  useEffect(() => {
    const start = { x: 0, y: 0, active: false };
    const onStart = (e) => {
      const t = e.touches && e.touches[0];
      if (!t) return;
      start.active = collapsedRef.current && t.clientY <= NAV_TOP_EDGE_BAND;
      start.x = t?.clientX || 0;
      start.y = t?.clientY || 0;
    };
    const onEnd = (e) => {
      if (!start.active) return;
      start.active = false;
      const t = e.changedTouches && e.changedTouches[0];
      if (!t) return;
      const dy = t.clientY - start.y;
      const dx = t.clientX - start.x;
      if (dy > NAV_SWIPE_THRESHOLD && Math.abs(dy) > Math.abs(dx)) {
        // eslint-disable-next-line no-console
        console.log('[NAV_SWIPE]', 'down');
        applyCollapsed(false);
      }
    };
    window.addEventListener('touchstart', onStart, { passive: true });
    window.addEventListener('touchend', onEnd, { passive: true });
    return () => {
      window.removeEventListener('touchstart', onStart);
      window.removeEventListener('touchend', onEnd);
    };
  }, [applyCollapsed]);

  const handleNavTouchStart = useCallback((e) => {
    const t = e.touches && e.touches[0];
    if (!t) return;
    navTouchRef.current = { x: t.clientX, y: t.clientY, active: true };
  }, []);

  const handleNavTouchEnd = useCallback(
    (e) => {
      if (moreOpenRef.current) return;
      if (!navTouchRef.current.active) return;
      navTouchRef.current.active = false;
      const t = e.changedTouches && e.changedTouches[0];
      if (!t) return;
      const dy = t.clientY - navTouchRef.current.y;
      const dx = t.clientX - navTouchRef.current.x;
      if (Math.abs(dy) < NAV_SWIPE_THRESHOLD || Math.abs(dx) > Math.abs(dy)) return;
      if (dy < 0) {
        // eslint-disable-next-line no-console
        console.log('[NAV_SWIPE]', 'up');
        applyCollapsed(true);
      } else {
        // eslint-disable-next-line no-console
        console.log('[NAV_SWIPE]', 'down');
        applyCollapsed(false);
      }
    },
    [applyCollapsed, moreOpenRef]
  );

  useEffect(() => {
    if (!user) {
      setAlertUnreadCount(0);
      return undefined;
    }

    let cancelled = false;
    const refreshBadge = async () => {
      try {
        const data = await getNotificationSummary();
        if (!cancelled) setAlertUnreadCount(Number(data?.alertUnreadCount) || 0);
      } catch (err) {
        if (!(err instanceof ApiCoolingDownError) && err?.isCoolingDown !== true) {
          /* ignore — badge is best-effort */
        }
      }
    };

    void refreshBadge();
    const id = window.setInterval(refreshBadge, 60000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [user]);

  useEffect(() => {
    if (user && location.pathname === '/alerts') {
      setAlertUnreadCount(0);
      markNotificationsRead('alert_match').catch(() => {});
    }
  }, [location.pathname, user]);

  const profileNavItem = useMemo(
    () => ({
      key: NAV_ITEM_KEYS.profile,
      name: 'Profile',
      shortLabel: NAV_SHORT_LABELS[NAV_ITEM_KEYS.profile],
      path: PROFILE_NAV_PATH,
      Icon: User,
    }),
    []
  );

  const primaryNavItems = useMemo(
    () => [
      {
        key: NAV_ITEM_KEYS.home,
        name: 'Home',
        shortLabel: NAV_SHORT_LABELS[NAV_ITEM_KEYS.home],
        path: '/',
        Icon: Home,
      },
      {
        key: NAV_ITEM_KEYS.alerts,
        name: 'Alerts',
        shortLabel: NAV_SHORT_LABELS[NAV_ITEM_KEYS.alerts],
        path: '/alerts',
        Icon: Bell,
        bell: true,
        philosophy: DEAL_PHILOSOPHY_LANES.alerts.philosophy,
        title: DEAL_PHILOSOPHY_LANES.alerts.helperText,
      },
      {
        key: NAV_ITEM_KEYS.quickSnipes,
        name: 'Quick Snipes',
        shortLabel: NAV_SHORT_LABELS[NAV_ITEM_KEYS.quickSnipes],
        path: '/local-deals',
        Icon: Zap,
        philosophy: DEAL_PHILOSOPHY_LANES.quickSnipes.philosophy,
        title: DEAL_PHILOSOPHY_LANES.quickSnipes.helperText,
      },
      {
        key: NAV_ITEM_KEYS.auctions,
        name: 'Auctions',
        shortLabel: NAV_SHORT_LABELS[NAV_ITEM_KEYS.auctions],
        path: '/auctions',
        Icon: Gavel,
        philosophy: DEAL_PHILOSOPHY_LANES.auctions.philosophy,
        title: DEAL_PHILOSOPHY_LANES.auctions.helperText,
      },
      profileNavItem,
    ],
    [profileNavItem]
  );

  const scoutFlightNavItem = useMemo(
    () => ({
      key: 'scoutFlight',
      name: 'Savvy Scout Flight',
      shortLabel: NAV_SHORT_LABELS.scoutFlight,
      path: SCOUT_FLIGHT_PATH,
      Icon: Plane,
      badge: 'NEW',
      featured: true,
    }),
    []
  );

  const flatMoreItems = useMemo(() => {
    const sections = MORE_MENU_SECTIONS.map((section) => ({
      ...section,
      items: section.items.filter((item) => !item.requiresAuth || user),
    }));
    if (showAdminNav) {
      sections.push({ id: 'admin', items: ADMIN_MORE_ITEMS });
    }
    return sections.flatMap((section) => section.items);
  }, [showAdminNav, user]);

  const isMoreActive = useMemo(
    () =>
      flatMoreItems.some(
        (item) =>
          item.path !== PROFILE_NAV_PATH &&
          item.path !== SCOUT_FLIGHT_PATH &&
          isNavActive(location.pathname, location.hash, location.search, item)
      ),
    [flatMoreItems, location.hash, location.pathname, location.search]
  );

  const renderNavLink = useCallback(
    (item, { variant = 'default' } = {}) => {
      const Icon = item.Icon;
      const active = isNavActive(
        location.pathname,
        location.hash,
        location.search,
        item
      );
      const to = `${item.path}${item.hash || ''}${item.search || ''}`;
      const displayLabel = item.shortLabel || item.name;

      return (
        <Link
          key={`${item.key || item.path}${item.hash || ''}${item.search || ''}`}
          to={to}
          title={item.title || item.name}
          className={`nav-item nav-item--${variant} ${item.featured ? 'nav-item--featured' : ''} ${active ? 'active' : ''}`}
        >
          <span className="nav-icon nav-icon-wrap">
            {item.bell ? (
              <>
                <Bell
                  className="nav-lucide-icon"
                  size={NAV_ICON_SIZE}
                  strokeWidth={NAV_ICON_STROKE}
                  aria-hidden
                />
                {item.path === '/alerts' && alertUnreadCount > 0 ? (
                  <span
                    className="nav-alert-badge"
                    aria-label={`${alertUnreadCount} unread alert matches`}
                  >
                    {alertUnreadCount > 99 ? '99+' : alertUnreadCount}
                  </span>
                ) : null}
              </>
            ) : Icon ? (
              <Icon
                className="nav-lucide-icon"
                size={NAV_ICON_SIZE}
                strokeWidth={NAV_ICON_STROKE}
                aria-hidden
              />
            ) : null}
            {item.badge ? (
              <span className="nav-item-badge" aria-hidden>
                {item.badge}
              </span>
            ) : null}
          </span>
          <span className="nav-label nav-label--full">{item.name}</span>
          <span className="nav-label nav-label--short">{displayLabel}</span>
          {variant === 'discovery' && item.philosophy ? (
            <span className="nav-philosophy">{item.philosophy}</span>
          ) : null}
        </Link>
      );
    },
    [alertUnreadCount, location.hash, location.pathname, location.search]
  );

  return (
    <>
      <button
        type="button"
        className={`f10-nav-pull-handle ${collapsed ? 'is-visible' : ''}`}
        aria-label="Show navigation"
        aria-hidden={!collapsed}
        tabIndex={collapsed ? 0 : -1}
        onClick={() => applyCollapsed(false)}
      >
        <span className="f10-nav-pull-handle__grabber" aria-hidden />
        <ChevronDown size={16} strokeWidth={2.5} aria-hidden />
      </button>

      <nav
        className={`main-navigation ${collapsed ? 'main-navigation--collapsed' : ''} ${moreOpen ? 'main-navigation--more-open' : ''}`}
        aria-label="Final10 navigation"
      >
        <div
          className="nav-brand-row"
          onTouchStart={handleNavTouchStart}
          onTouchEnd={handleNavTouchEnd}
        >
          <div className="nav-brand" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Link to="/" style={{ textDecoration: 'none', color: 'inherit' }}>
              <h2>Final10</h2>
            </Link>
            {user ? <MembershipStatusBadge user={user} /> : null}
          </div>
        </div>

        <div
          className="nav-items nav-discovery-row"
          aria-label="Primary"
          onTouchStart={handleNavTouchStart}
          onTouchEnd={handleNavTouchEnd}
        >
          {primaryNavItems.map((item) => renderNavLink(item, { variant: 'discovery' }))}
        </div>

        <div
          className="nav-items nav-progression-row f10-nav-progression-enter"
          aria-label="Featured and more"
          onTouchStart={handleNavTouchStart}
          onTouchEnd={handleNavTouchEnd}
        >
          {renderNavLink(scoutFlightNavItem, { variant: 'featured' })}
          <button
            type="button"
            className={`nav-more-toggle ${isMoreActive ? 'nav-more-toggle--active' : ''} ${moreOpen ? 'nav-more-toggle--open' : ''}`}
            aria-expanded={moreOpen}
            aria-controls={isMobile ? 'f10-mobile-more-scroll' : 'nav-more-panel'}
            onClick={toggleMore}
          >
            <span className="nav-more-toggle__icon" aria-hidden>
              <Grid3x3 size={NAV_ICON_SIZE} strokeWidth={NAV_ICON_STROKE} />
            </span>
            <span className="nav-more-toggle__label nav-label--full">More</span>
            <span className="nav-more-toggle__label nav-label--short">{NAV_SHORT_LABELS.more}</span>
            <ChevronDown
              size={14}
              aria-hidden
              className="nav-more-toggle__chevron"
              style={{
                transform: moreOpen ? 'rotate(180deg)' : undefined,
                transition: 'transform 160ms ease',
              }}
            />
          </button>
        </div>

        {!isMobile && moreOpen ? (
          <div id="nav-more-panel" className="nav-more-panel" aria-label="More tools and ecosystem">
            <MoreMenuSections onReportBug={() => setShowBugReport(true)} />
          </div>
        ) : null}

        {!isMobile ? (
          <BugReportModal isOpen={showBugReport} onClose={() => setShowBugReport(false)} />
        ) : null}
      </nav>
    </>
  );
};

export default Navigation;

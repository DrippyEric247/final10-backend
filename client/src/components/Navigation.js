import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Link, useLocation } from 'react-router-dom';
import BugReportModal from './BugReportModal';
import {
  Award,
  BarChart3,
  Bell,
  Bookmark,
  Bug,
  Building2,
  ChevronDown,
  Crown,
  Dices,
  Gavel,
  Gift,
  Grid3x3,
  Home,
  Medal,
  Plane,
  Settings,
  Shield,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Target,
  TestTube2,
  Trophy,
  User,
  Users,
  Zap,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import MembershipStatusBadge from './membership/MembershipStatusBadge';
import { shouldShowAdminNav } from '../lib/adminAccess';
import { getNotificationSummary, markNotificationsRead } from '../lib/api';
import { ApiCoolingDownError } from '../lib/apiRequestGate';
import { DEAL_PHILOSOPHY_LANES, NAV_ITEM_KEYS, PROFILE_NAV_PATH } from '../lib/primaryNavigation';
import {
  ADMIN_MORE_ITEMS,
  MORE_MENU_SECTIONS,
  NAV_SHORT_LABELS,
  SCOUT_FLIGHT_PATH,
} from '../lib/navigationMenuConfig';
import '../styles/PrimaryNavigation.css';

const NAV_ICON_SIZE = 18;
const NAV_ICON_STROKE = 2.25;

const MORE_ITEM_ICONS = {
  scoutFlightFeatured: Plane,
  bestMoves: Sparkles,
  watchlist: Bookmark,
  sellerDashboard: BarChart3,
  savvyShop: ShoppingBag,
  savvyOffers: Gift,
  perkMachine: Dices,
  battlePass: Target,
  customization: Award,
  savvyWins: Trophy,
  leaderboards: Medal,
  lifeOptimizer: Building2,
  savvyPrograms: Shield,
  foundingTester: TestTube2,
  communityHub: Users,
  settings: Settings,
  admin: Settings,
  shield: ShieldCheck,
  founderAdmin: Crown,
};

function normalizeNavHash(hash) {
  if (!hash) return '';
  return hash.startsWith('#') ? hash : `#${hash}`;
}

function isNavActive(pathname, hash, search, item) {
  const path = item.path;
  const normalizedHash = normalizeNavHash(hash);
  const itemSearch = item.search || '';

  if (item.hash) {
    return pathname === path && normalizedHash === normalizeNavHash(item.hash);
  }

  if (itemSearch) {
    if (pathname !== path && !pathname.startsWith(`${path}/`)) return false;
    const params = new URLSearchParams(search || '');
    const expected = new URLSearchParams(itemSearch.startsWith('?') ? itemSearch.slice(1) : itemSearch);
    for (const [key, value] of expected.entries()) {
      if (params.get(key) !== value) return false;
    }
    return true;
  }

  if (path === '/') return pathname === '/';

  const pathMatches = pathname === path || pathname.startsWith(`${path}/`);
  if (!pathMatches) return false;

  if (path === '/win-feed' && normalizedHash === '#community-hub') {
    return false;
  }

  if (path === '/auctions' && (search || '').includes('watchlist=1')) {
    return false;
  }

  return true;
}

function resolveMoreItemIcon(item) {
  if (item.Icon) return item.Icon;
  return MORE_ITEM_ICONS[item.key] || null;
}

const Navigation = () => {
  const location = useLocation();
  const [showBugReport, setShowBugReport] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [alertUnreadCount, setAlertUnreadCount] = useState(0);
  const { user } = useAuth() || {};
  const showAdminNav = shouldShowAdminNav(user);

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

  useEffect(() => {
    setMoreOpen(false);
  }, [location.pathname, location.hash, location.search]);

  useEffect(() => {
    document.documentElement.classList.toggle('f10-nav-more-open', moreOpen);
    return () => document.documentElement.classList.remove('f10-nav-more-open');
  }, [moreOpen]);

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

  const moreMenuSections = useMemo(() => {
    const sections = MORE_MENU_SECTIONS.map((section) => ({
      ...section,
      items: section.items
        .filter((item) => !item.requiresAuth || user)
        .map((item) => ({
          ...item,
          Icon: resolveMoreItemIcon(item),
        })),
    }));

    if (showAdminNav) {
      sections.push({
        id: 'admin',
        title: 'Admin',
        items: ADMIN_MORE_ITEMS.map((item) => ({
          ...item,
          Icon: resolveMoreItemIcon(item),
        })),
      });
    }

    return sections;
  }, [showAdminNav, user]);

  const flatMoreItems = useMemo(
    () => moreMenuSections.flatMap((section) => section.items),
    [moreMenuSections]
  );

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
      const Icon = item.Icon || resolveMoreItemIcon(item);
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
    <nav
      className={`main-navigation ${moreOpen ? 'main-navigation--more-open' : ''}`}
      aria-label="Final10 navigation"
    >
      <div className="nav-brand-row">
        <div className="nav-brand" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Link to="/" style={{ textDecoration: 'none', color: 'inherit' }}>
            <h2>Final10</h2>
          </Link>
          {user ? <MembershipStatusBadge user={user} /> : null}
        </div>
      </div>

      <div className="nav-items nav-discovery-row" aria-label="Primary">
        {primaryNavItems.map((item) => renderNavLink(item, { variant: 'discovery' }))}
      </div>

      <div
        className="nav-items nav-progression-row f10-nav-progression-enter"
        aria-label="Featured and more"
      >
        {renderNavLink(scoutFlightNavItem, { variant: 'featured' })}
        <button
          type="button"
          className={`nav-more-toggle ${isMoreActive ? 'nav-more-toggle--active' : ''} ${moreOpen ? 'nav-more-toggle--open' : ''}`}
          aria-expanded={moreOpen}
          aria-controls="nav-more-panel"
          onClick={() => setMoreOpen((v) => !v)}
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

      {moreOpen ? (
        <div id="nav-more-panel" className="nav-more-panel" aria-label="More tools and ecosystem">
          {moreMenuSections.map((section) => (
            <div
              key={section.id}
              className={`nav-more-section ${section.id === 'featured' ? 'nav-more-section--featured' : ''}`}
            >
              <div className="nav-more-section__title">{section.title}</div>
              <div className="nav-more-grid">
                {section.items.map((item) => renderNavLink(item, { variant: 'more' }))}
              </div>
            </div>
          ))}
          <div className="nav-more-section nav-more-section--utility">
            <button
              onClick={() => setShowBugReport(true)}
              className="nav-item nav-item--more nav-item--bug-report bug-report-btn"
              title="Report a Bug"
              type="button"
            >
              <Bug
                className="nav-lucide-icon nav-lucide-icon--bug"
                size={NAV_ICON_SIZE}
                strokeWidth={NAV_ICON_STROKE}
                aria-hidden
              />
              <span className="nav-label nav-label--full">Report Bug</span>
              <span className="nav-label nav-label--short">Report Bug</span>
            </button>
          </div>
        </div>
      ) : null}

      <BugReportModal isOpen={showBugReport} onClose={() => setShowBugReport(false)} />
    </nav>
  );
};

export default Navigation;

import React, { useState, useEffect, useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import BugReportModal from './BugReportModal';
import {
  Award,
  BarChart3,
  Bell,
  Bug,
  Building2,
  ChevronDown,
  Crown,
  Dices,
  Gavel,
  Gift,
  Home,
  Medal,
  Plane,
  Settings,
  Shield,
  ShieldCheck,
  ShoppingBag,
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
import { DEAL_PHILOSOPHY_LANES } from '../lib/primaryNavigation';
import '../styles/PrimaryNavigation.css';

const NAV_ICON_SIZE = 17;
const NAV_ICON_STROKE = 2.25;

function normalizeNavHash(hash) {
  if (!hash) return '';
  return hash.startsWith('#') ? hash : `#${hash}`;
}

function isNavActive(pathname, hash, item) {
  const path = item.path;
  const normalizedHash = normalizeNavHash(hash);

  if (item.hash) {
    return pathname === path && normalizedHash === normalizeNavHash(item.hash);
  }

  if (path === '/') return pathname === '/';

  const pathMatches = pathname === path || pathname.startsWith(`${path}/`);
  if (!pathMatches) return false;

  if (path === '/win-feed' && normalizedHash === '#community-hub') {
    return false;
  }

  return true;
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
  }, [location.pathname, location.hash]);

  const discoveryNavItems = useMemo(
    () => [
      { name: 'Home', path: '/', Icon: Home },
      {
        name: 'Alerts',
        path: '/alerts',
        Icon: Bell,
        bell: true,
        philosophy: DEAL_PHILOSOPHY_LANES.alerts.philosophy,
        title: DEAL_PHILOSOPHY_LANES.alerts.helperText,
      },
      {
        name: 'Quick Snipes',
        path: '/local-deals',
        Icon: Zap,
        philosophy: DEAL_PHILOSOPHY_LANES.quickSnipes.philosophy,
        title: DEAL_PHILOSOPHY_LANES.quickSnipes.helperText,
      },
      {
        name: 'Auctions',
        path: '/auctions',
        Icon: Gavel,
        philosophy: DEAL_PHILOSOPHY_LANES.auctions.philosophy,
        title: DEAL_PHILOSOPHY_LANES.auctions.helperText,
      },
      {
        name: 'Life Optimizer',
        path: '/business-offers',
        Icon: Building2,
        philosophy: DEAL_PHILOSOPHY_LANES.lifeOptimizer.philosophy,
        title: DEAL_PHILOSOPHY_LANES.lifeOptimizer.helperText,
      },
      { name: 'Profile', path: '/profile', Icon: User },
    ],
    []
  );

  const progressionNavItems = useMemo(
    () => [
      { name: 'Perk Machine', path: '/perk-machine', Icon: Dices },
      { name: 'Battle Pass', path: '/battle-pass', Icon: Target },
      { name: 'Calling Cards & Emblems', path: '/customization', Icon: Award },
      { name: 'Savvy Wins', path: '/win-feed', Icon: Trophy },
    ],
    []
  );

  const moreNavItems = useMemo(
    () => [
      { name: 'Seller Dashboard', path: '/seller-dashboard', Icon: BarChart3 },
      ...(user
        ? [{ name: 'My Savvy Shop', path: '/savvy-shop/studio', Icon: ShoppingBag }]
        : []),
      { name: 'Savvy Offers', path: '/savvy-offers', Icon: Gift },
      { name: 'Savvy Programs', path: '/savvy-programs', Icon: Shield },
      { name: 'Scout Flight', path: '/scout-flight', Icon: Plane },
      { name: 'Leaderboards', path: '/leaderboard', Icon: Medal },
      {
        name: 'Community Hub',
        path: '/win-feed',
        hash: '#community-hub',
        Icon: Users,
      },
      { name: 'Founding Tester', path: '/founding-tester', Icon: TestTube2 },
      { name: 'Settings', path: '/settings', Icon: Settings },
      ...(showAdminNav
        ? [
            { name: 'Admin', path: '/admin', Icon: Settings },
            { name: 'Shield', path: '/shield-dashboard', Icon: ShieldCheck },
            { name: 'Founder Admin', path: '/owner-control', Icon: Crown },
          ]
        : []),
    ],
    [showAdminNav, user]
  );

  const isMoreActive = useMemo(
    () =>
      moreNavItems.some((item) =>
        isNavActive(location.pathname, location.hash, item)
      ),
    [location.hash, location.pathname, moreNavItems]
  );

  const renderNavLink = (item, { variant = 'default' } = {}) => {
    const Icon = item.Icon;
    const active = isNavActive(location.pathname, location.hash, item);
    const to = item.hash ? `${item.path}${item.hash}` : item.path;

    return (
      <Link
        key={`${item.path}${item.hash || ''}`}
        to={to}
        title={item.title || item.name}
        className={`nav-item nav-item--${variant} ${active ? 'active' : ''}`}
      >
        <span className="nav-icon nav-icon-wrap">
          {item.bell ? (
            <>
              <Bell className="nav-lucide-icon" size={NAV_ICON_SIZE} strokeWidth={NAV_ICON_STROKE} aria-hidden />
              {item.path === '/alerts' && alertUnreadCount > 0 ? (
                <span className="nav-alert-badge" aria-label={`${alertUnreadCount} unread alert matches`}>
                  {alertUnreadCount > 99 ? '99+' : alertUnreadCount}
                </span>
              ) : null}
            </>
          ) : (
            Icon ? (
              <Icon className="nav-lucide-icon" size={NAV_ICON_SIZE} strokeWidth={NAV_ICON_STROKE} aria-hidden />
            ) : null
          )}
        </span>
        <span className="nav-label">{item.name}</span>
        {variant === 'discovery' && item.philosophy ? (
          <span className="nav-philosophy">{item.philosophy}</span>
        ) : null}
      </Link>
    );
  };

  return (
    <nav className="main-navigation" aria-label="Final10 navigation">
      <div className="nav-brand-row">
        <div className="nav-brand" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Link to="/" style={{ textDecoration: 'none', color: 'inherit' }}>
            <h2>Final10</h2>
          </Link>
          {user ? <MembershipStatusBadge user={user} /> : null}
        </div>
      </div>

      <div
        className="nav-items nav-discovery-row"
        aria-label="Deal discovery"
      >
        {discoveryNavItems.map((item) => renderNavLink(item, { variant: 'discovery' }))}
      </div>

      <div
        className="nav-items nav-progression-row f10-nav-progression-enter"
        aria-label="Account progression"
      >
        {progressionNavItems.map((item) => renderNavLink(item, { variant: 'progression' }))}
        <button
          type="button"
          className={`nav-more-toggle ${isMoreActive ? 'nav-more-toggle--active' : ''}`}
          aria-expanded={moreOpen}
          aria-controls="nav-more-panel"
          onClick={() => setMoreOpen((v) => !v)}
        >
          More
          <ChevronDown
            size={14}
            aria-hidden
            style={{ transform: moreOpen ? 'rotate(180deg)' : undefined, transition: 'transform 160ms ease' }}
          />
        </button>
      </div>

      {moreOpen ? (
        <div id="nav-more-panel" className="nav-more-panel" aria-label="More tools and ecosystem">
          {moreNavItems.map((item) => renderNavLink(item, { variant: 'more' }))}
          <button
            onClick={() => setShowBugReport(true)}
            className="nav-item nav-item--more bug-report-btn"
            title="Report a Bug"
            type="button"
          >
            <Bug className="nav-lucide-icon" size={NAV_ICON_SIZE} strokeWidth={NAV_ICON_STROKE} aria-hidden />
            <span className="nav-label">Report Bug</span>
          </button>
        </div>
      ) : null}

      <BugReportModal
        isOpen={showBugReport}
        onClose={() => setShowBugReport(false)}
      />
    </nav>
  );
};

export default Navigation;

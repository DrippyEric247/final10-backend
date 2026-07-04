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
  Flame,
  Gift,
  Gavel,
  Home,
  Lightbulb,
  Medal,
  ScanLine,
  Settings,
  Shield,
  ShieldCheck,
  ShoppingBag,
  Smartphone,
  Sparkles,
  Swords,
  Target,
  TestTube2,
  TrendingUp,
  Trophy,
  User,
  Zap,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLiveEventsOptional } from '../context/LiveEventsContext';
import MembershipStatusBadge from './membership/MembershipStatusBadge';
import { shouldShowAdminNav } from '../lib/adminAccess';
import { getNotificationSummary, markNotificationsRead } from '../lib/api';
import { ApiCoolingDownError } from '../lib/apiRequestGate';
import { DEAL_PHILOSOPHY_LANES } from '../lib/primaryNavigation';
import '../styles/PrimaryNavigation.css';

const NAV_ICON_SIZE = 17;
const NAV_ICON_STROKE = 2.25;

function isNavActive(pathname, path) {
  if (path === '/') return pathname === '/';
  return pathname === path || pathname.startsWith(`${path}/`);
}

const Navigation = () => {
  const location = useLocation();
  const [showBugReport, setShowBugReport] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [alertUnreadCount, setAlertUnreadCount] = useState(0);
  const { user } = useAuth() || {};
  const showAdminNav = shouldShowAdminNav(user);
  const liveEvents = useLiveEventsOptional();
  const eventsBadge = liveEvents?.claimableCount ?? 0;

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
  }, [location.pathname]);

  const primaryNavItems = useMemo(
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
      { name: 'Profile / Rewards', path: '/profile', Icon: User },
    ],
    []
  );

  const secondaryNavItems = useMemo(
    () => [
      { name: 'Savvy Wins', path: '/win-feed', Icon: Trophy },
      { name: 'Trending Feed', path: '/feed', Icon: Smartphone },
      { name: 'Scanner', path: '/scanner', Icon: ScanLine },
      { name: 'Sell signals', path: '/seller-trends', Icon: TrendingUp },
      { name: 'Promote', path: '/trending', Icon: Lightbulb },
      { name: 'Seller Dashboard', path: '/seller-dashboard', Icon: BarChart3 },
      ...(user
        ? [{ name: 'My Savvy Shop', path: '/savvy-shop/studio', Icon: ShoppingBag }]
        : []),
      { name: 'Savvy Offers', path: '/savvy-offers', Icon: Gift },
      { name: 'Life Optimizer', path: '/business-offers', Icon: Building2 },
      { name: 'Savvy Programs', path: '/savvy-programs', Icon: Shield },
      { name: 'Founding Tester', path: '/founding-tester', Icon: TestTube2 },
      { name: 'Leaderboard', path: '/leaderboard', Icon: Medal },
      { name: 'Build Wars', path: '/build-wars', Icon: Swords },
      { name: 'Battle Pass', path: '/battle-pass', Icon: Target },
      ...(user ? [{ name: 'Events', path: '/events', Icon: Sparkles, eventsBadge: true }] : []),
      { name: 'Daily Streak', path: '/daily-streak', Icon: Flame },
      { name: 'Perk Machine', path: '/perk-machine', Icon: Dices },
      { name: 'Customize', path: '/customization', Icon: Award },
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

  const renderNavLink = (item, { primary = false } = {}) => {
    const Icon = item.Icon;
    const active = isNavActive(location.pathname, item.path);

    return (
      <Link
        key={item.path}
        to={item.path}
        title={item.title || item.name}
        className={`nav-item ${primary ? 'nav-item--primary' : ''} ${active ? 'active' : ''}`}
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
            <>
              {Icon ? (
                <Icon className="nav-lucide-icon" size={NAV_ICON_SIZE} strokeWidth={NAV_ICON_STROKE} aria-hidden />
              ) : null}
              {item.eventsBadge && eventsBadge > 0 ? (
                <span className="nav-alert-badge" aria-label={`${eventsBadge} claimable event reward${eventsBadge === 1 ? '' : 's'}`}>
                  {eventsBadge > 99 ? '99+' : eventsBadge}
                </span>
              ) : null}
            </>
          )}
        </span>
        <span className="nav-label">{item.name}</span>
        {primary && item.philosophy ? (
          <span className="nav-philosophy">{item.philosophy}</span>
        ) : null}
      </Link>
    );
  };

  return (
    <nav className="main-navigation" aria-label="Final10 primary navigation">
      <div className="nav-brand" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <Link to="/" style={{ textDecoration: 'none', color: 'inherit' }}>
          <h2>Final10</h2>
        </Link>
        {user ? <MembershipStatusBadge user={user} /> : null}
      </div>

      <div className="nav-items nav-primary-items">
        {primaryNavItems.map((item) => renderNavLink(item, { primary: true }))}
      </div>

      <div className="nav-items nav-secondary-items">
        <button
          type="button"
          className="nav-more-toggle"
          aria-expanded={moreOpen}
          aria-controls="nav-secondary-panel"
          onClick={() => setMoreOpen((v) => !v)}
        >
          More
          <ChevronDown
            size={14}
            aria-hidden
            style={{ transform: moreOpen ? 'rotate(180deg)' : undefined, transition: 'transform 160ms ease' }}
          />
        </button>
        <button
          onClick={() => setShowBugReport(true)}
          className="nav-item bug-report-btn"
          title="Report a Bug"
          type="button"
        >
          <Bug className="nav-lucide-icon" size={NAV_ICON_SIZE} strokeWidth={NAV_ICON_STROKE} aria-hidden />
          <span className="nav-label">Report Bug</span>
        </button>
      </div>

      {moreOpen ? (
        <div id="nav-secondary-panel" className="nav-secondary-panel">
          {secondaryNavItems.map((item) => renderNavLink(item))}
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

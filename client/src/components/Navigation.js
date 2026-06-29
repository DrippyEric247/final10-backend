import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import BugReportModal from './BugReportModal';
import {
  Award,
  BarChart3,
  Bell,
  Bug,
  Building2,
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
  Store,
  Swords,
  Target,
  TestTube2,
  TrendingUp,
  Trophy,
  User,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLiveEventsOptional } from '../context/LiveEventsContext';
import MembershipStatusBadge from './membership/MembershipStatusBadge';
import { shouldShowAdminNav } from '../lib/adminAccess';
import { getNotificationSummary, markNotificationsRead } from '../lib/api';
import { ApiCoolingDownError } from '../lib/apiRequestGate';

const NAV_ICON_SIZE = 17;
const NAV_ICON_STROKE = 2.25;

const Navigation = () => {
  const location = useLocation();
  const [showBugReport, setShowBugReport] = useState(false);
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

  const navItems = [
    { name: 'Home (Community)', path: '/', Icon: Home },
    { name: 'Savvy Wins', path: '/win-feed', Icon: Trophy },
    { name: 'Auctions', path: '/auctions', Icon: Gavel },
    { name: 'Quick Snipes', path: '/local-deals', Icon: Store },
    { name: 'Alerts', path: '/alerts', bell: true },
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
    { name: 'Profile / Settings', path: '/profile', Icon: User },
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
  ];

  return (
    <nav className="main-navigation">
      <div className="nav-brand" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <Link to="/" style={{ textDecoration: 'none', color: 'inherit' }}>
          <h2>Final10</h2>
        </Link>
        {user ? <MembershipStatusBadge user={user} /> : null}
      </div>

      <div className="nav-items">
        {navItems.map((item) => {
          const Icon = item.Icon;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`nav-item ${location.pathname === item.path ? 'active' : ''}`}
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
            </Link>
          );
        })}

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

      <BugReportModal
        isOpen={showBugReport}
        onClose={() => setShowBugReport(false)}
      />
    </nav>
  );
};

export default Navigation;

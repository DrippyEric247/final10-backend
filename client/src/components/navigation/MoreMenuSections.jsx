import React, { useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Award,
  BarChart3,
  Bookmark,
  Bug,
  Building2,
  Crown,
  Dices,
  Gift,
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
  Users,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { shouldShowAdminNav } from '../../lib/adminAccess';
import { isNavActive } from '../../lib/navigationActive';
import {
  ADMIN_MORE_ITEMS,
  MORE_MENU_SECTIONS,
} from '../../lib/navigationMenuConfig';

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

function resolveMoreItemIcon(item) {
  if (item.Icon) return item.Icon;
  return MORE_ITEM_ICONS[item.key] || null;
}

/**
 * Shared More-menu sections — used by desktop inline panel and mobile full-screen overlay.
 */
export default function MoreMenuSections({ variant = 'more', onReportBug }) {
  const location = useLocation();
  const { user } = useAuth() || {};
  const showAdminNav = shouldShowAdminNav(user);

  const sections = useMemo(() => {
    const base = MORE_MENU_SECTIONS.map((section) => ({
      ...section,
      items: section.items
        .filter((item) => !item.requiresAuth || user)
        .map((item) => ({
          ...item,
          Icon: resolveMoreItemIcon(item),
        })),
    }));

    if (showAdminNav) {
      base.push({
        id: 'admin',
        title: 'Account / Admin tools',
        items: ADMIN_MORE_ITEMS.map((item) => ({
          ...item,
          Icon: resolveMoreItemIcon(item),
        })),
      });
    }

    return base;
  }, [showAdminNav, user]);

  return (
    <>
      {sections.map((section) => (
        <div
          key={section.id}
          className={`nav-more-section ${section.id === 'featured' ? 'nav-more-section--featured' : ''}`}
        >
          <div className="nav-more-section__title">{section.title}</div>
          <div className="nav-more-grid">
            {section.items.map((item) => {
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
                    {Icon ? (
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
                </Link>
              );
            })}
          </div>
        </div>
      ))}
      <div className="nav-more-section nav-more-section--utility">
        <button
          onClick={onReportBug}
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
    </>
  );
}

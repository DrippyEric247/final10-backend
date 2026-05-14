import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import BugReportModal from './BugReportModal';
import { Bug, Bell } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { isCosmeticsAdmin } from '../lib/adminCosmetics';

const Navigation = () => {
  const location = useLocation();
  const [showBugReport, setShowBugReport] = useState(false);
  const { user } = useAuth() || {};
  const canAdmin = isCosmeticsAdmin(user);

  const navItems = [
    { name: 'Home (Community)', path: '/', icon: '🏠' },
    { name: 'Savvy Wins', path: '/win-feed', icon: '🏆' },
    { name: 'Auctions', path: '/auctions', icon: '🔨' },
    { name: 'Quick Snipes', path: '/local-deals', icon: '🏪' },
    { name: 'Alerts', path: '/alerts', bell: true },
    { name: 'Trending Feed', path: '/feed', icon: '📱' },
    { name: 'Scanner', path: '/scanner', icon: '🤖' },
    { name: 'Sell signals', path: '/seller-trends', icon: '📈' },
    { name: 'Promote', path: '/trending', icon: '💡' },
    { name: 'Seller Dashboard', path: '/seller-dashboard', icon: '📊' },
    ...(user
      ? [{ name: 'My Savvy Shop', path: '/savvy-shop/studio', icon: '🛍️' }]
      : []),
    { name: 'Savvy Offers', path: '/savvy-offers', icon: '🎁' },
    { name: 'Life Optimizer', path: '/business-offers', icon: '🏢' },
    { name: 'Savvy Programs', path: '/savvy-programs', icon: '🛡️' },
    { name: 'Founding Tester', path: '/founding-tester', icon: '🧪' },
    { name: 'Profile / Settings', path: '/profile', icon: '👤' },
    { name: 'Leaderboard', path: '/leaderboard', icon: '🏆' },
    { name: 'Build Wars', path: '/build-wars', icon: '⚔️' },
    { name: 'Battle Pass', path: '/battle-pass', icon: '🎯' },
    { name: 'Customize', path: '/customization', icon: '🎖️' },
    ...(canAdmin
      ? [{ name: 'Grants', path: '/admin/cosmetics', icon: '👑' }]
      : []),
  ];

  return (
    <nav className="main-navigation">
      <div className="nav-brand">
        <Link to="/" style={{ textDecoration: 'none', color: 'inherit' }}>
          <h2>Final10</h2>
        </Link>
      </div>
      
      <div className="nav-items">
        {navItems.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            className={`nav-item ${location.pathname === item.path ? 'active' : ''}`}
          >
            <span className="nav-icon">
              {item.bell ? <Bell className="nav-lucide-icon" size={17} strokeWidth={2.25} aria-hidden /> : item.icon}
            </span>
            <span className="nav-label">{item.name}</span>
          </Link>
        ))}
        
        {/* Bug Report Button */}
        <button
          onClick={() => setShowBugReport(true)}
          className="nav-item bug-report-btn"
          title="Report a Bug"
        >
          <Bug className="nav-icon" size={16} />
          <span className="nav-label">Report Bug</span>
        </button>
      </div>
      
      {/* Bug Report Modal */}
      <BugReportModal 
        isOpen={showBugReport} 
        onClose={() => setShowBugReport(false)} 
      />
    </nav>
  );
};

export default Navigation;

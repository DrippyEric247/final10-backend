import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import BugReportModal from './BugReportModal';
import { Bug } from 'lucide-react';

const Navigation = () => {
  const location = useLocation();
  const [showBugReport, setShowBugReport] = useState(false);

  const navItems = [
    { name: 'Home', path: '/', icon: '🏠' },
    { name: 'Auctions', path: '/auctions', icon: '🔨' },
    { name: 'Product Feed', path: '/feed', icon: '📱' },
    { name: 'Local Deals', path: '/local-deals', icon: '🏪' },
    { name: 'Trending', path: '/trending', icon: '🔥' },
    { name: 'Scanner', path: '/scanner', icon: '🤖' },
    { name: 'Profile', path: '/profile', icon: '👤' }
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
            <span className="nav-icon">{item.icon}</span>
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

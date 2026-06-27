import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useLiveEventsOptional } from '../../context/LiveEventsContext';
import { formatTimer } from './MaxSupplyDropModal';
import '../../styles/UniversalEvents.css';

/**
 * Persistent floating Events tab — visible on all pages when logged in.
 */
export default function EventsFloatingTab() {
  const ctx = useLiveEventsOptional();
  const location = useLocation();

  if (!ctx) return null;

  const { claimableCount, dropMs, saleMs, hub } = ctx;
  const onEventsPage = location.pathname === '/events';

  const miniTimers = [];
  if (hub?.timers?.supplyDrop && dropMs > 0) {
    miniTimers.push({ icon: '📦', ms: dropMs });
  }
  if (hub?.timers?.savvySale && saleMs > 0) {
    miniTimers.push({ icon: '🔥', ms: saleMs });
  }

  return (
    <Link
      to="/events"
      className={`events-floating-tab ${onEventsPage ? 'events-floating-tab--active' : ''}`}
      aria-label={
        claimableCount > 0
          ? `Events — ${claimableCount} claimable reward${claimableCount === 1 ? '' : 's'}`
          : 'Events'
      }
    >
      <span className="events-floating-tab__icon" aria-hidden>
        🎪
      </span>
      <span className="events-floating-tab__label">Events</span>
      {claimableCount > 0 ? (
        <span className="events-floating-tab__badge">{claimableCount > 9 ? '9+' : claimableCount}</span>
      ) : null}
      {!onEventsPage && miniTimers.length > 0 ? (
        <span className="events-floating-tab__timers" aria-hidden>
          {miniTimers.map((t) => (
            <span key={t.icon} className="events-floating-tab__mini">
              {t.icon} {formatTimer(t.ms)}
            </span>
          ))}
        </span>
      ) : null}
    </Link>
  );
}

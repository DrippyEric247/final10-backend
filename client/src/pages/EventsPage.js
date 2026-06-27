import React, { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveEvents } from '../context/LiveEventsContext';
import { useAuth } from '../context/AuthContext';
import { shouldShowAdminNav } from '../lib/adminAccess';
import EventHubCard, { EventHistoryRow } from '../components/events/EventHubCard';
import ScoutSupportPanel from '../components/events/ScoutSupportPanel';
import LiveEventsAdminPanel from '../components/events/LiveEventsAdminPanel';
import LoadingState from '../components/ui/states/LoadingState';
import '../styles/UniversalEvents.css';
import '../styles/LiveEvents.css';

function EmptySection({ message }) {
  return <p className="events-empty">{message}</p>;
}

export default function EventsPage() {
  const { user } = useAuth();
  const {
    hub,
    loading,
    claimableCount,
    claimingId,
    claimSupplyDropById,
    claimScoutMilestone,
    refresh,
  } = useLiveEvents();
  const [toast, setToast] = useState('');

  const showAdmin = shouldShowAdminNav(user);

  const handleClaim = useCallback(
    async (event) => {
      try {
        const action = event.claimAction;
        if (!action) return;
        if (action.type === 'supply_drop') {
          const result = await claimSupplyDropById(action.dropId);
          setToast(result?.reward?.label ? `Claimed — ${result.reward.label}` : 'Supply Drop claimed!');
        } else if (action.type === 'scout_milestone') {
          const result = await claimScoutMilestone(action.milestone);
          setToast(result?.label ? `Called in — ${result.label}` : 'Scout Support activated!');
        }
        window.setTimeout(() => setToast(''), 3200);
      } catch (e) {
        setToast(e?.response?.data?.message || e?.message || 'Claim failed.');
        window.setTimeout(() => setToast(''), 4000);
      }
    },
    [claimSupplyDropById, claimScoutMilestone]
  );

  if (loading && !hub) {
    return (
      <div className="events-page">
        <LoadingState message="Scanning live events…" />
      </div>
    );
  }

  const active = hub?.activeEvents || [];
  const claimable = hub?.claimableRewards || [];
  const upcoming = hub?.upcomingEvents || [];
  const history = hub?.completedHistory || [];

  return (
    <div className="events-page">
      <header className="events-page__header">
        <div>
          <p className="events-page__kicker">Final10 Live</p>
          <h1 className="events-page__title">🎪 Events Hub</h1>
          <p className="events-page__subtitle">
            All active drops, sales, streaks, and rewards in one place.
          </p>
        </div>
        {claimableCount > 0 ? (
          <div className="events-page__claim-badge" aria-live="polite">
            {claimableCount} claimable
          </div>
        ) : null}
      </header>

      {toast ? (
        <div className="events-toast" role="status">
          {toast}
        </div>
      ) : null}

      <section className="events-section" aria-labelledby="events-active-heading">
        <h2 id="events-active-heading" className="events-section__title">
          Active Events
        </h2>
        {active.length ? (
          <div className="events-grid">
            {active.map((ev) => (
              <EventHubCard
                key={ev.id}
                event={ev}
                onClaim={handleClaim}
                claiming={claimingId}
              />
            ))}
          </div>
        ) : (
          <EmptySection message="No timed events running right now. Check upcoming rewards below." />
        )}
      </section>

      <section className="events-section" aria-labelledby="events-claimable-heading">
        <h2 id="events-claimable-heading" className="events-section__title">
          Claimable Rewards
        </h2>
        {claimable.length ? (
          <div className="events-grid">
            {claimable.map((ev) => (
              <EventHubCard
                key={ev.id}
                event={ev}
                onClaim={handleClaim}
                claiming={claimingId}
              />
            ))}
          </div>
        ) : (
          <EmptySection message="Nothing to claim yet — keep hunting deals and watch for Supply Drops." />
        )}
      </section>

      <section className="events-section" aria-labelledby="events-upcoming-heading">
        <h2 id="events-upcoming-heading" className="events-section__title">
          Upcoming Events
        </h2>
        {upcoming.length ? (
          <div className="events-grid events-grid--upcoming">
            {upcoming.map((ev) => (
              <EventHubCard key={ev.id} event={ev} compact />
            ))}
          </div>
        ) : (
          <EmptySection message="New seasonal and beta events will appear here." />
        )}
      </section>

      <section className="events-section" aria-labelledby="events-fusion-heading">
        <h2 id="events-fusion-heading" className="events-section__title">
          Long-Term Progression
        </h2>
        {hub?.eggExchange ? (
          <div className="events-grid">
            <EventHubCard
              event={{
                id: 'mythic_fusion_progress',
                type: 'seasonal',
                status: hub.eggExchange.canExchange ? 'claimable' : 'active',
                title: hub.eggExchange.title || 'Mythic Fusion Progress',
                icon: '🥚',
                description: `${hub.eggExchange.legendaryOwned}/${hub.eggExchange.legendaryRequired} Legendary eggs · ${hub.eggExchange.savvyBalance.toLocaleString()}/${hub.eggExchange.savvyRequired.toLocaleString()} Savvy`,
                timerLabel: `${hub.eggExchange.progressPercent}% ready`,
                claimable: false,
                ctaLabel: 'Open Egg Exchange',
                ctaPath: '/egg-exchange',
              }}
              compact
            />
          </div>
        ) : (
          <EmptySection message="Fuse eggs in the Egg Exchange Chamber to track Mythic progress." />
        )}
      </section>

      <section className="events-section" aria-labelledby="events-scout-heading">
        <h2 id="events-scout-heading" className="events-section__title">
          Scout Support
        </h2>
        <ScoutSupportPanel
          status={hub?.scoutSupport}
          onCallInReady={(m) => {
            void handleClaim({
              claimAction: { type: 'scout_milestone', milestone: m.milestone },
              ctaLabel: 'Call In Support',
            });
          }}
        />
        <p className="events-hint">
          Track deals via Best Move, saved watchlist items, and alert clicks.
        </p>
      </section>

      <section className="events-section" aria-labelledby="events-history-heading">
        <h2 id="events-history-heading" className="events-section__title">
          Completed / Claim History
        </h2>
        {history.length ? (
          <ul className="events-history-list">
            {history.map((row) => (
              <EventHistoryRow key={row.id} row={row} />
            ))}
          </ul>
        ) : (
          <EmptySection message="Your claimed drops and milestones will show up here." />
        )}
      </section>

      <section className="events-section events-section--links">
        <h2 className="events-section__title">Quick Links</h2>
        <div className="events-quick-links">
          <Link to="/perk-machine">🎰 Perk Machine</Link>
          <Link to="/egg-exchange">🧪 Egg Exchange</Link>
          <Link to="/scout-flight">🚀 Scout Flight</Link>
          <Link to="/daily-streak">🔥 Daily Streak</Link>
          <Link to="/battle-pass">🎯 Battle Pass</Link>
          <Link to="/local-deals">🏪 Quick Snipes</Link>
        </div>
      </section>

      {showAdmin ? <LiveEventsAdminPanel onRefresh={refresh} /> : null}
    </div>
  );
}

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  dismissEventSummary,
  dismissProfileXpRecap,
  getPendingEventSummary,
  getPendingProfileXpRecap,
} from '../../lib/api';
import { ANALYTICS_EVENTS, trackEvent } from '../../lib/analytics';
import EventSummaryModal from '../events/EventSummaryModal';
import ProfileXpRecapModal from './ProfileXpRecapModal';
import '../../styles/EventSummary.css';
import '../../styles/ProfileXpRecap.css';

const POLL_MS = 30000;

/**
 * Universal progression host — event value summary (screen 1) then profile XP recap (screen 2).
 */
export default function ProgressionRecapHost() {
  const { user } = useAuth() || {};
  const navigate = useNavigate();
  const [phase, setPhase] = useState(null);
  const [eventSummary, setEventSummary] = useState(null);
  const [profileRecap, setProfileRecap] = useState(null);
  const [linkedEventSummary, setLinkedEventSummary] = useState(null);
  const [bootReady, setBootReady] = useState(false);
  const showingRef = useRef(false);
  const linkedRecapRef = useRef(null);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const onBoot = () => setBootReady(true);
    window.addEventListener('f10:startup-boot-complete', onBoot);
    if (document.documentElement.classList.contains('f10-boot-done')) {
      setBootReady(true);
    }
    const t = window.setTimeout(() => setBootReady(true), 1600);
    return () => {
      window.removeEventListener('f10:startup-boot-complete', onBoot);
      window.clearTimeout(t);
    };
  }, []);

  const showProfileRecap = useCallback(async (recap, bridgeSummary = null) => {
    if (!recap) return;
    setPhase('profile');
    setProfileRecap(recap);
    setLinkedEventSummary(bridgeSummary);
    trackEvent(ANALYTICS_EVENTS.PROFILE_XP_RECAP_VIEWED, {
      recapId: recap.recapId,
      xpEarnedTotal: recap.xpEarnedTotal,
      trigger: recap.trigger,
    });
    await dismissProfileXpRecap({ recapId: recap.recapId, action: 'view' });
  }, []);

  const loadPending = useCallback(async () => {
    if (!user || showingRef.current) return;
    try {
      const [pendingEvent, pendingRecap] = await Promise.all([
        getPendingEventSummary(),
        getPendingProfileXpRecap(),
      ]);

      if (pendingEvent && !showingRef.current) {
        showingRef.current = true;
        setEventSummary(pendingEvent);
        setPhase('event');

        if (
          pendingRecap &&
          (pendingRecap.eventSummaryId === pendingEvent.summaryId ||
            pendingRecap.sessionId === pendingEvent.summaryId)
        ) {
          linkedRecapRef.current = pendingRecap;
        } else {
          linkedRecapRef.current = null;
        }

        trackEvent(ANALYTICS_EVENTS.EVENT_SUMMARY_VIEWED, {
          summaryId: pendingEvent.summaryId,
          eventKey: pendingEvent.eventKey,
          bonusEarned: pendingEvent.bonusEarned,
        });
        await dismissEventSummary({ summaryId: pendingEvent.summaryId, action: 'view' });
        return;
      }

      if (pendingRecap && !showingRef.current) {
        showingRef.current = true;
        await showProfileRecap(pendingRecap, null);
      }
    } catch {
      /* best-effort */
    }
  }, [user, showProfileRecap]);

  useEffect(() => {
    if (!user || !bootReady) return undefined;
    void loadPending();
    const id = window.setInterval(() => void loadPending(), POLL_MS);
    return () => window.clearInterval(id);
  }, [user, bootReady, loadPending]);

  const closeEventSummary = useCallback(
    async (action) => {
      const current = eventSummary;
      if (!current) return;
      try {
        await dismissEventSummary({ summaryId: current.summaryId, action });
      } catch {
        /* ignore */
      }
      if (action === 'dismiss') {
        trackEvent(ANALYTICS_EVENTS.EVENT_SUMMARY_DISMISSED, {
          summaryId: current.summaryId,
          eventKey: current.eventKey,
        });
      }
      if (action === 'leaderboard') {
        trackEvent(ANALYTICS_EVENTS.EVENT_SUMMARY_LEADERBOARD, {
          summaryId: current.summaryId,
          eventKey: current.eventKey,
        });
      }
      if (action === 'rewards') {
        trackEvent(ANALYTICS_EVENTS.EVENT_SUMMARY_REWARDS, {
          summaryId: current.summaryId,
          eventKey: current.eventKey,
        });
      }

      const linked = linkedRecapRef.current;
      setEventSummary(null);

      if (linked && action === 'dismiss') {
        linkedRecapRef.current = null;
        await showProfileRecap(linked, current);
        return;
      }

      setPhase(null);
      showingRef.current = false;
    },
    [eventSummary, showProfileRecap]
  );

  const handleEventDismiss = useCallback(() => {
    void closeEventSummary('dismiss');
  }, [closeEventSummary]);

  const handleEventLeaderboard = useCallback(() => {
    void closeEventSummary('leaderboard');
    navigate('/leaderboard');
  }, [closeEventSummary, navigate]);

  const handleEventRewards = useCallback(() => {
    void closeEventSummary('rewards');
  }, [closeEventSummary]);

  const handleProfileDismiss = useCallback(async () => {
    const current = profileRecap;
    if (!current) return;
    try {
      await dismissProfileXpRecap({ recapId: current.recapId, action: 'dismiss' });
    } catch {
      /* ignore */
    }
    trackEvent(ANALYTICS_EVENTS.PROFILE_XP_RECAP_DISMISSED, {
      recapId: current.recapId,
      xpEarnedTotal: current.xpEarnedTotal,
    });
    setProfileRecap(null);
    setLinkedEventSummary(null);
    setPhase(null);
    showingRef.current = false;
  }, [profileRecap]);

  const handleViewProfile = useCallback(() => {
    void handleProfileDismiss();
    navigate('/profile');
  }, [handleProfileDismiss, navigate]);

  if (!user) return null;

  if (phase === 'event' && eventSummary) {
    const linked = linkedRecapRef.current;
    return (
      <EventSummaryModal
        summary={eventSummary}
        profileXpEarned={linked?.xpEarnedTotal || 0}
        onDismiss={handleEventDismiss}
        onLeaderboard={handleEventLeaderboard}
        onRewards={handleEventRewards}
      />
    );
  }

  if (phase === 'profile' && profileRecap) {
    return (
      <ProfileXpRecapModal
        recap={profileRecap}
        eventSummary={linkedEventSummary}
        onDismiss={handleProfileDismiss}
        onViewProfile={handleViewProfile}
      />
    );
  }

  return null;
}

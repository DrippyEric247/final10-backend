import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { dismissEventSummary, getPendingEventSummary } from '../../lib/api';
import { ANALYTICS_EVENTS, trackEvent } from '../../lib/analytics';
import EventSummaryModal from './EventSummaryModal';
import '../../styles/EventSummary.css';

const POLL_MS = 30000;

/**
 * Polls for completed-event summaries and shows the one-time celebration screen.
 */
export default function EventSummaryHost() {
  const { user } = useAuth() || {};
  const navigate = useNavigate();
  const [summary, setSummary] = useState(null);
  const [bootReady, setBootReady] = useState(false);
  const showingRef = useRef(false);

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

  const loadPending = useCallback(async () => {
    if (!user || showingRef.current) return;
    try {
      const pending = await getPendingEventSummary();
      if (pending && !showingRef.current) {
        showingRef.current = true;
        setSummary(pending);
        trackEvent(ANALYTICS_EVENTS.EVENT_SUMMARY_VIEWED, {
          summaryId: pending.summaryId,
          eventKey: pending.eventKey,
          bonusEarned: pending.bonusEarned,
        });
        await dismissEventSummary({ summaryId: pending.summaryId, action: 'view' });
      }
    } catch {
      /* best-effort */
    }
  }, [user]);

  useEffect(() => {
    if (!user || !bootReady) return undefined;
    void loadPending();
    const id = window.setInterval(() => void loadPending(), POLL_MS);
    return () => window.clearInterval(id);
  }, [user, bootReady, loadPending]);

  const closeSummary = useCallback(
    async (action) => {
      const current = summary;
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
      setSummary(null);
      showingRef.current = false;
    },
    [summary]
  );

  const handleDismiss = useCallback(() => {
    void closeSummary('dismiss');
  }, [closeSummary]);

  const handleLeaderboard = useCallback(() => {
    void closeSummary('leaderboard');
    navigate('/leaderboard');
  }, [closeSummary, navigate]);

  const handleRewards = useCallback(() => {
    void closeSummary('rewards');
  }, [closeSummary]);

  if (!user || !summary) return null;

  return (
    <EventSummaryModal
      summary={summary}
      onDismiss={handleDismiss}
      onLeaderboard={handleLeaderboard}
      onRewards={handleRewards}
    />
  );
}

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useLiveEventsOptional } from '../../context/LiveEventsContext';
import { activateLiveEvent, dismissEventExplanation } from '../../lib/api';
import { EventActivationReveal } from './EventActivationReveal';
import { EventExplanationCard } from './EventExplanationCard';
import { EventHudBubbles } from './EventHudBubbles';
import { EventDetailModal } from './EventDetailModal';
import MaxSupplyDropModal from './MaxSupplyDropModal';
import '../../styles/EventActivation.css';

const BOOT_EVENT = 'f10:startup-boot-complete';

export default function EventActivationHost() {
  const { user } = useAuth();
  const ctx = useLiveEventsOptional();
  const location = useLocation();
  const [bootReady, setBootReady] = useState(false);
  const [current, setCurrent] = useState(null);
  const [bubbles, setBubbles] = useState([]);
  const [detailEvent, setDetailEvent] = useState(null);
  const [explanationEvent, setExplanationEvent] = useState(null);
  const [explanationFromHud, setExplanationFromHud] = useState(false);
  const [showDropModal, setShowDropModal] = useState(false);
  const queueRef = useRef([]);
  const processingRef = useRef(false);

  const onOnboarding = location.pathname.startsWith('/onboarding');
  const dropMs = ctx?.dropMs ?? 0;

  useEffect(() => {
    const onBoot = () => setBootReady(true);
    window.addEventListener(BOOT_EVENT, onBoot);
    const fallback = window.setTimeout(() => setBootReady(true), 2200);
    return () => {
      window.removeEventListener(BOOT_EVENT, onBoot);
      window.clearTimeout(fallback);
    };
  }, []);

  const activation = ctx?.hub?.activation;

  useEffect(() => {
    if (!activation) return;
    setBubbles(activation.activatedBubbles || []);
    queueRef.current = [...(activation.activationQueue || [])];
    if (!current && !processingRef.current && !explanationEvent && queueRef.current.length > 0) {
      setCurrent(queueRef.current[0]);
    }
  }, [activation, current, explanationEvent]);

  const canReveal = Boolean(
    user &&
      bootReady &&
      !onOnboarding &&
      current &&
      !processingRef.current &&
      !explanationEvent
  );

  const advanceToNextInQueue = useCallback(async () => {
    const next = queueRef.current[0] || null;
    setCurrent(next);
    await ctx?.refresh?.();
  }, [ctx]);

  const handleFlyComplete = useCallback(
    async (event) => {
      if (!event) return;
      processingRef.current = true;
      try {
        const state = await activateLiveEvent({
          activationId: event.activationId,
          eventKey: event.eventKey,
        });
        setBubbles(state.activatedBubbles || []);
        queueRef.current = [...(state.activationQueue || [])];
        setCurrent(null);
        setExplanationFromHud(false);
        setExplanationEvent(event);
      } catch {
        queueRef.current = queueRef.current.filter((e) => e.activationId !== event.activationId);
        setCurrent(null);
        await advanceToNextInQueue();
      } finally {
        processingRef.current = false;
      }
    },
    [advanceToNextInQueue]
  );

  const handleExplanationDismiss = useCallback(
    async (event) => {
      if (event?.activationId && !explanationFromHud) {
        try {
          const state = await dismissEventExplanation({ activationId: event.activationId });
          setBubbles(state.activatedBubbles || []);
          queueRef.current = [...(state.activationQueue || [])];
        } catch {
          /* best-effort — still close card */
        }
      }
      setExplanationEvent(null);
      setExplanationFromHud(false);
      if (!explanationFromHud) {
        await advanceToNextInQueue();
      }
    },
    [advanceToNextInQueue, explanationFromHud]
  );

  const handleViewDetails = useCallback((event) => {
    setDetailEvent(null);
    setExplanationFromHud(true);
    setExplanationEvent(event);
  }, []);

  const handleExplanationPrimary = useCallback(
    (event) => {
      setExplanationEvent(null);
      setExplanationFromHud(false);
      if (event?.eventKey === 'max_supply_drop') {
        setShowDropModal(true);
      }
    },
    []
  );

  const bubblesWithTimers = useMemo(() => {
    return (bubbles || []).map((b) => {
      if (b.eventKey === 'max_supply_drop' && ctx?.dropMs > 0) {
        return { ...b, msRemaining: ctx.dropMs };
      }
      if (b.eventKey === 'savvy_sale' && ctx?.saleMs > 0) {
        return { ...b, msRemaining: ctx.saleMs };
      }
      return b;
    });
  }, [bubbles, ctx?.dropMs, ctx?.saleMs]);

  if (!ctx || !user) return null;

  return (
    <>
      {canReveal ? (
        <EventActivationReveal event={current} onFlyComplete={handleFlyComplete} />
      ) : null}

      {explanationEvent ? (
        <EventExplanationCard
          event={explanationEvent}
          showFromHud={explanationFromHud}
          onDismiss={handleExplanationDismiss}
          onPrimaryAction={handleExplanationPrimary}
        />
      ) : null}

      <EventHudBubbles bubbles={bubblesWithTimers} onSelect={setDetailEvent} />

      <EventDetailModal
        event={detailEvent}
        onClose={() => setDetailEvent(null)}
        onViewDetails={handleViewDetails}
        onOpenSupplyDrop={() => {
          setDetailEvent(null);
          setShowDropModal(true);
        }}
      />

      {showDropModal && ctx.supplyDrop ? (
        <MaxSupplyDropModal
          drop={ctx.supplyDrop}
          msRemaining={dropMs}
          onClaim={ctx.claimSupplyDropById}
          onClose={() => setShowDropModal(false)}
          onViewEvents={() => setShowDropModal(false)}
        />
      ) : null}
    </>
  );
}

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useLiveEventsOptional } from '../../context/LiveEventsContext';
import { SAVVY_AUTH_REFRESH_REQUEST } from '../../store/savvyStore';
import MaxSupplyDropModal from './MaxSupplyDropModal';
import SupplyDropBanner from './SupplyDropBanner';
import SavvySaleBanner from './SavvySaleBanner';
import ScoutSupportCelebration from './ScoutSupportCelebration';
import '../../styles/LiveEvents.css';

export default function LiveEventsHost() {
  const { refreshProfile } = useAuth();
  const ctx = useLiveEventsOptional();
  const navigate = useNavigate();
  const location = useLocation();
  const onEventsPage = location.pathname === '/events';

  const [modalDismissed, setModalDismissed] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [celebration, setCelebration] = useState(null);
  const lastDropId = useRef(null);
  const dismissedMilestones = useRef(new Set());

  const supplyDrop = ctx?.supplyDrop ?? null;
  const savvySale = ctx?.savvySale ?? null;
  const dropMs = ctx?.dropMs ?? 0;
  const saleMs = ctx?.saleMs ?? 0;
  const scoutReady = useMemo(() => ctx?.hub?.scoutSupport?.milestonesReady ?? [], [ctx?.hub?.scoutSupport?.milestonesReady]);
  const milestonesClaimed = useMemo(
    () => ctx?.hub?.scoutSupport?.milestonesClaimed ?? [],
    [ctx?.hub?.scoutSupport?.milestonesClaimed]
  );

  const dropInActivationQueue = useMemo(() => {
    const queue = ctx?.hub?.activation?.activationQueue ?? [];
    return queue.some((e) => e.eventKey === 'max_supply_drop');
  }, [ctx?.hub?.activation?.activationQueue]);

  const pendingMilestones = useMemo(() => {
    const claimed = new Set((milestonesClaimed || []).map(Number));
    return (scoutReady || []).filter(
      (m) => !claimed.has(Number(m.milestone)) && !dismissedMilestones.current.has(Number(m.milestone))
    );
  }, [scoutReady, milestonesClaimed]);

  useEffect(() => {
    if (!supplyDrop?.dropId || supplyDrop.expired || supplyDrop.alreadyClaimed) return;
    if (dropInActivationQueue) return;
    if (lastDropId.current !== supplyDrop.dropId) {
      lastDropId.current = supplyDrop.dropId;
      setModalDismissed(false);
      setShowModal(true);
    }
  }, [supplyDrop, dropInActivationQueue]);

  useEffect(() => {
    if (pendingMilestones.length > 0 && !celebration && !onEventsPage) {
      setCelebration(pendingMilestones[0]);
    }
  }, [pendingMilestones, celebration, onEventsPage]);

  const handleClaim = useCallback(
    async (dropId) => {
      if (!ctx?.claimSupplyDropById) {
        throw new Error('Supply drop claim unavailable.');
      }
      const result = await ctx.claimSupplyDropById(dropId);
      window.dispatchEvent(new CustomEvent(SAVVY_AUTH_REFRESH_REQUEST));
      if (typeof refreshProfile === 'function') await refreshProfile();
      return result;
    },
    [ctx, refreshProfile]
  );

  const handleCelebrationClaimed = useCallback(
    async (result) => {
      if (result?.supplyDrop) {
        lastDropId.current = result.supplyDrop.dropId || null;
        setShowModal(true);
        setModalDismissed(false);
      }
      window.dispatchEvent(new CustomEvent(SAVVY_AUTH_REFRESH_REQUEST));
      if (typeof refreshProfile === 'function') await refreshProfile();
      await ctx?.refresh?.();
    },
    [ctx, refreshProfile]
  );

  const handleCelebrationComplete = useCallback(() => {
    if (celebration?.milestone != null) {
      dismissedMilestones.current.add(Number(celebration.milestone));
    }
    setCelebration(null);
  }, [celebration?.milestone]);

  const handleViewSupplyDrops = useCallback(() => {
    setModalDismissed(false);
    setShowModal(true);
    navigate('/events');
  }, [navigate]);

  if (!ctx) return null;

  const showDropBanner =
    !onEventsPage &&
    supplyDrop &&
    !supplyDrop.expired &&
    !supplyDrop.alreadyClaimed &&
    (modalDismissed || !showModal);

  return (
    <div className="live-events-host">
      {!onEventsPage && savvySale?.active ? (
        <SavvySaleBanner
          sale={savvySale}
          msRemaining={saleMs}
          onClick={() => navigate('/events')}
        />
      ) : null}

      {showDropBanner ? (
        <SupplyDropBanner
          drop={supplyDrop}
          msRemaining={dropMs}
          onOpen={() => {
            setModalDismissed(false);
            setShowModal(true);
          }}
        />
      ) : null}

      {showModal && supplyDrop && !modalDismissed && !onEventsPage ? (
        <MaxSupplyDropModal
          drop={supplyDrop}
          msRemaining={dropMs}
          onClaim={handleClaim}
          onClose={() => {
            setModalDismissed(true);
            setShowModal(false);
          }}
          onViewEvents={() => navigate('/events')}
        />
      ) : null}

      {celebration && !onEventsPage ? (
        <ScoutSupportCelebration
          milestone={celebration}
          milestonesClaimed={milestonesClaimed}
          onComplete={handleCelebrationComplete}
          onClaimed={handleCelebrationClaimed}
          onViewSupplyDrops={handleViewSupplyDrops}
        />
      ) : null}
    </div>
  );
}

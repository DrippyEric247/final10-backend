import React, { useCallback, useEffect, useRef, useState } from 'react';
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
  const [claiming, setClaiming] = useState(false);
  const [rewardBurst, setRewardBurst] = useState(null);
  const [celebration, setCelebration] = useState(null);
  const lastDropId = useRef(null);

  const supplyDrop = ctx?.supplyDrop ?? null;
  const savvySale = ctx?.savvySale ?? null;
  const dropMs = ctx?.dropMs ?? 0;
  const saleMs = ctx?.saleMs ?? 0;
  const scoutReady = ctx?.hub?.scoutSupport?.milestonesReady;

  useEffect(() => {
    if (!supplyDrop?.dropId || supplyDrop.expired || supplyDrop.alreadyClaimed) return;
    if (lastDropId.current !== supplyDrop.dropId) {
      lastDropId.current = supplyDrop.dropId;
      setModalDismissed(false);
      setShowModal(true);
    }
  }, [supplyDrop]);

  useEffect(() => {
    const ready = scoutReady || [];
    if (ready.length > 0 && !celebration && !onEventsPage) {
      setCelebration(ready[0]);
    }
  }, [scoutReady, celebration, onEventsPage]);

  const handleClaim = useCallback(
    async (dropId) => {
      if (!ctx?.claimSupplyDropById) return;
      setClaiming(true);
      try {
        const result = await ctx.claimSupplyDropById(dropId);
        setRewardBurst(result?.reward?.label || 'Reward claimed!');
        setShowModal(false);
        window.dispatchEvent(new CustomEvent(SAVVY_AUTH_REFRESH_REQUEST));
        if (typeof refreshProfile === 'function') await refreshProfile();
        setTimeout(() => setRewardBurst(null), 2400);
      } catch (e) {
        window.alert(e?.response?.data?.message || e?.message || 'Claim failed.');
      } finally {
        setClaiming(false);
      }
    },
    [ctx, refreshProfile]
  );

  const handleCelebrationClaimed = useCallback(
    async (result) => {
      if (result?.supplyDrop) {
        setShowModal(true);
        setModalDismissed(false);
      }
      window.dispatchEvent(new CustomEvent(SAVVY_AUTH_REFRESH_REQUEST));
      if (typeof refreshProfile === 'function') await refreshProfile();
      await ctx?.refresh?.();
    },
    [ctx, refreshProfile]
  );

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
          claiming={claiming}
          onClaim={handleClaim}
          onDismiss={() => {
            setModalDismissed(true);
            setShowModal(false);
            navigate('/events');
          }}
        />
      ) : null}

      {celebration && !onEventsPage ? (
        <ScoutSupportCelebration
          milestone={celebration}
          onComplete={() => setCelebration(null)}
          onClaimed={handleCelebrationClaimed}
        />
      ) : null}

      {rewardBurst ? (
        <div className="supply-drop-reward-burst" aria-live="polite">
          <div className="supply-drop-reward-burst__card">🎁 {rewardBurst}</div>
        </div>
      ) : null}
    </div>
  );
}

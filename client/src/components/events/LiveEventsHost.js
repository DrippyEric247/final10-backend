import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  claimSupplyDrop,
  getLiveEventsState,
  getScoutSupportStatus,
} from '../../lib/api';
import { SAVVY_AUTH_REFRESH_REQUEST } from '../../store/savvyStore';
import MaxSupplyDropModal from './MaxSupplyDropModal';
import SupplyDropBanner from './SupplyDropBanner';
import SavvySaleBanner from './SavvySaleBanner';
import ScoutSupportCelebration from './ScoutSupportCelebration';
import '../../styles/LiveEvents.css';

const POLL_MS = 5000;

export default function LiveEventsHost() {
  const { user, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [supplyDrop, setSupplyDrop] = useState(null);
  const [savvySale, setSavvySale] = useState(null);
  const [dropMs, setDropMs] = useState(0);
  const [saleMs, setSaleMs] = useState(0);
  const [modalDismissed, setModalDismissed] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [rewardBurst, setRewardBurst] = useState(null);
  const [celebration, setCelebration] = useState(null);
  const lastDropId = useRef(null);

  const refresh = useCallback(async () => {
    if (!user) return;
    try {
      const [live, scout] = await Promise.all([getLiveEventsState(), getScoutSupportStatus()]);
      setSupplyDrop(live?.supplyDrop || null);
      setSavvySale(live?.savvySale || null);
      setDropMs(live?.supplyDrop?.msRemaining || 0);
      setSaleMs(live?.savvySale?.msRemaining || 0);

      const ready = scout?.milestonesReady || [];
      if (ready.length > 0 && !celebration) {
        setCelebration(ready[0]);
      }
    } catch {
      /* ignore poll errors */
    }
  }, [user, celebration]);

  useEffect(() => {
    if (!user) return undefined;
    void refresh();
    const id = setInterval(() => void refresh(), POLL_MS);
    return () => clearInterval(id);
  }, [user, refresh]);

  useEffect(() => {
    if (!supplyDrop?.dropId || supplyDrop.expired || supplyDrop.alreadyClaimed) return;
    if (lastDropId.current !== supplyDrop.dropId) {
      lastDropId.current = supplyDrop.dropId;
      setModalDismissed(false);
      setShowModal(true);
    }
  }, [supplyDrop]);

  useEffect(() => {
    if (!supplyDrop || supplyDrop.expired) return undefined;
    const tick = setInterval(() => {
      setDropMs((ms) => Math.max(0, ms - 1000));
    }, 1000);
    return () => clearInterval(tick);
  }, [supplyDrop?.dropId, supplyDrop?.expired]);

  useEffect(() => {
    if (!savvySale?.active) return undefined;
    const tick = setInterval(() => {
      setSaleMs((ms) => Math.max(0, ms - 1000));
    }, 1000);
    return () => clearInterval(tick);
  }, [savvySale?.eventId, savvySale?.active]);

  const handleClaim = useCallback(
    async (dropId) => {
      setClaiming(true);
      try {
        const result = await claimSupplyDrop(dropId);
        setRewardBurst(result?.reward?.label || 'Reward claimed!');
        setShowModal(false);
        setSupplyDrop(null);
        window.dispatchEvent(new CustomEvent(SAVVY_AUTH_REFRESH_REQUEST));
        if (typeof refreshProfile === 'function') await refreshProfile();
        setTimeout(() => setRewardBurst(null), 2400);
        void refresh();
      } catch (e) {
        window.alert(e?.response?.data?.message || e?.message || 'Claim failed.');
      } finally {
        setClaiming(false);
      }
    },
    [refresh, refreshProfile]
  );

  const handleCelebrationClaimed = useCallback(
    (result) => {
      if (result?.supplyDrop) {
        setSupplyDrop(result.supplyDrop);
        setShowModal(true);
      }
      if (result?.savvySale) {
        setSavvySale(result.savvySale);
        setSaleMs(result.savvySale.msRemaining || 0);
      }
      window.dispatchEvent(new CustomEvent(SAVVY_AUTH_REFRESH_REQUEST));
      if (typeof refreshProfile === 'function') void refreshProfile();
      void refresh();
    },
    [refresh, refreshProfile]
  );

  if (!user) return null;

  const showDropBanner =
    supplyDrop && !supplyDrop.expired && !supplyDrop.alreadyClaimed && (modalDismissed || !showModal);

  return (
    <div className="live-events-host">
      {savvySale?.active ? (
        <SavvySaleBanner sale={savvySale} msRemaining={saleMs} onClick={() => navigate('/perk-machine')} />
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

      {showModal && supplyDrop && !modalDismissed ? (
        <MaxSupplyDropModal
          drop={supplyDrop}
          msRemaining={dropMs}
          claiming={claiming}
          onClaim={handleClaim}
          onDismiss={() => {
            setModalDismissed(true);
            setShowModal(false);
          }}
        />
      ) : null}

      {celebration ? (
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

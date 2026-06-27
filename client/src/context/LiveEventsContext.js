import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from './AuthContext';
import {
  claimSupplyDrop,
  claimScoutSupportMilestone,
  getEventsHub,
} from '../lib/api';
import { SAVVY_AUTH_REFRESH_REQUEST } from '../store/savvyStore';

const POLL_MS = 5000;
export const LIVE_EVENTS_HUB_UPDATED = 'f10:live-events-hub-updated';

const LiveEventsContext = createContext(null);

function patchEventTimers(events, dropMs, saleMs) {
  if (!events?.length) return events || [];
  return events.map((e) => {
    if (e.type === 'supply_drop' && dropMs != null) return { ...e, msRemaining: dropMs };
    if (e.type === 'savvy_sale' && saleMs != null) return { ...e, msRemaining: saleMs };
    return e;
  });
}

export function LiveEventsProvider({ children }) {
  const { user, refreshProfile } = useAuth();
  const [hub, setHub] = useState(null);
  const [loading, setLoading] = useState(false);
  const [dropMs, setDropMs] = useState(0);
  const [saleMs, setSaleMs] = useState(0);
  const [claimingId, setClaimingId] = useState(null);

  const refresh = useCallback(async () => {
    if (!user) {
      setHub(null);
      return null;
    }
    setLoading(true);
    try {
      const data = await getEventsHub();
      setHub(data);
      setDropMs(data?.timers?.supplyDrop?.msRemaining ?? 0);
      setSaleMs(data?.timers?.savvySale?.msRemaining ?? 0);
      window.dispatchEvent(new CustomEvent(LIVE_EVENTS_HUB_UPDATED, { detail: data }));
      return data;
    } catch {
      return null;
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!user) return undefined;
    void refresh();
    const id = setInterval(() => void refresh(), POLL_MS);
    return () => clearInterval(id);
  }, [user, refresh]);

  useEffect(() => {
    if (!hub?.timers?.supplyDrop) return undefined;
    const tick = setInterval(() => setDropMs((ms) => Math.max(0, ms - 1000)), 1000);
    return () => clearInterval(tick);
  }, [hub?.timers?.supplyDrop?.dropId, hub?.timers?.supplyDrop]);

  useEffect(() => {
    if (!hub?.timers?.savvySale) return undefined;
    const tick = setInterval(() => setSaleMs((ms) => Math.max(0, ms - 1000)), 1000);
    return () => clearInterval(tick);
  }, [hub?.timers?.savvySale?.eventId, hub?.timers?.savvySale]);

  const claimableCount = hub?.claimableCount ?? 0;

  const displayHub = useMemo(() => {
    if (!hub) return null;
    return {
      ...hub,
      activeEvents: patchEventTimers(hub.activeEvents, dropMs, saleMs),
      claimableRewards: patchEventTimers(hub.claimableRewards, dropMs, saleMs),
    };
  }, [hub, dropMs, saleMs]);

  const claimSupplyDropById = useCallback(
    async (dropId) => {
      setClaimingId(dropId);
      try {
        const result = await claimSupplyDrop(dropId);
        window.dispatchEvent(new CustomEvent(SAVVY_AUTH_REFRESH_REQUEST));
        if (typeof refreshProfile === 'function') await refreshProfile();
        await refresh();
        return result;
      } finally {
        setClaimingId(null);
      }
    },
    [refresh, refreshProfile]
  );

  const claimScoutMilestone = useCallback(
    async (milestone) => {
      setClaimingId(`scout_${milestone}`);
      try {
        const result = await claimScoutSupportMilestone(milestone);
        window.dispatchEvent(new CustomEvent(SAVVY_AUTH_REFRESH_REQUEST));
        if (typeof refreshProfile === 'function') await refreshProfile();
        await refresh();
        return result;
      } finally {
        setClaimingId(null);
      }
    },
    [refresh, refreshProfile]
  );

  const value = useMemo(
    () => ({
      hub: displayHub,
      rawHub: hub,
      loading,
      claimableCount,
      dropMs,
      saleMs,
      claimingId,
      refresh,
      claimSupplyDropById,
      claimScoutMilestone,
      supplyDrop: hub?.raw?.supplyDrop ?? null,
      savvySale: hub?.raw?.savvySale ?? null,
    }),
    [displayHub, hub, loading, claimableCount, dropMs, saleMs, claimingId, refresh, claimSupplyDropById, claimScoutMilestone]
  );

  return <LiveEventsContext.Provider value={value}>{children}</LiveEventsContext.Provider>;
}

export function useLiveEvents() {
  const ctx = useContext(LiveEventsContext);
  if (!ctx) {
    throw new Error('useLiveEvents must be used within LiveEventsProvider');
  }
  return ctx;
}

export function useLiveEventsOptional() {
  return useContext(LiveEventsContext);
}

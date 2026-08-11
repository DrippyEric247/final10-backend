import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { LIVE_EVENTS_HUB_UPDATED } from '../context/LiveEventsContext';
import { getSavvyMultiplier } from '../lib/api';

const DEFAULT_STATE = {
  effectiveMultiplier: 1,
  dealEffectiveMultiplier: 1,
  powerMultiplier: 1,
  coreMultiplier: 1,
  coreMultiplierCap: 3,
  capApplied: false,
  additiveBonuses: [],
  specialMultipliers: [],
  specialCombined: 1,
  subscriptionTierMultiplier: 1,
  eventActive: false,
  eventKey: null,
  eventLabel: null,
  eventMultiplier: 1,
  stackingFormula: '',
};

let sharedCache = null;
let inflight = null;

function normalizeState(raw) {
  if (!raw || typeof raw !== 'object') return DEFAULT_STATE;
  const effectiveMultiplier = Math.max(1, Number(raw.effectiveMultiplier) || 1);
  return {
    ...DEFAULT_STATE,
    ...raw,
    effectiveMultiplier,
    dealEffectiveMultiplier: Math.max(1, Number(raw.dealEffectiveMultiplier) || effectiveMultiplier),
    powerMultiplier: Math.max(1, Number(raw.powerMultiplier) || 1),
    coreMultiplier: Math.max(1, Number(raw.coreMultiplier) || 1),
    coreMultiplierCap: Math.max(1, Number(raw.coreMultiplierCap) || 3),
    specialCombined: Math.max(1, Number(raw.specialCombined) || 1),
    subscriptionTierMultiplier: Math.max(1, Number(raw.subscriptionTierMultiplier) || 1),
    additiveBonuses: Array.isArray(raw.additiveBonuses) ? raw.additiveBonuses : [],
    specialMultipliers: Array.isArray(raw.specialMultipliers) ? raw.specialMultipliers : [],
    capApplied: Boolean(raw.capApplied),
  };
}

async function fetchSavvyMultiplier() {
  if (inflight) return inflight;
  inflight = getSavvyMultiplier()
    .then((data) => {
      sharedCache = normalizeState(data);
      return sharedCache;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

/**
 * Authoritative Savvy earnings multiplier from the server.
 * Never compute totals locally — consume effectiveMultiplier only.
 */
export function useSavvyMultiplier(options = {}) {
  const { refreshEvents = true } = options;
  const { user } = useAuth() || {};
  const fromUser = user?.savvyMultiplier;
  const [remote, setRemote] = useState(() =>
    sharedCache || (fromUser ? normalizeState(fromUser) : null)
  );
  const [loading, setLoading] = useState(Boolean(user?.id && !sharedCache && !fromUser));

  const refresh = useCallback(async () => {
    if (!user?.id) {
      setRemote(null);
      setLoading(false);
      return null;
    }
    setLoading(true);
    try {
      const next = await fetchSavvyMultiplier();
      setRemote(next);
      return next;
    } catch {
      return null;
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) {
      setRemote(null);
      setLoading(false);
      return undefined;
    }
    if (fromUser) {
      const normalized = normalizeState(fromUser);
      sharedCache = normalized;
      setRemote(normalized);
    }
    if (refreshEvents) {
      void refresh();
    }
    const onEvents = () => void refresh();
    window.addEventListener(LIVE_EVENTS_HUB_UPDATED, onEvents);
    window.addEventListener('f10:subscription-tier-updated', onEvents);
    return () => {
      window.removeEventListener(LIVE_EVENTS_HUB_UPDATED, onEvents);
      window.removeEventListener('f10:subscription-tier-updated', onEvents);
    };
  }, [user?.id, fromUser, refreshEvents, refresh]);

  const state = useMemo(() => {
    if (remote) return remote;
    if (fromUser) return normalizeState(fromUser);
    return DEFAULT_STATE;
  }, [remote, fromUser]);

  return {
    ...state,
    loading,
    refresh,
  };
}

export function invalidateSavvyMultiplierCache() {
  sharedCache = null;
}

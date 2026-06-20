import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import {
  SCOUT_MISSION_SYNC_EVENT,
  claimScoutMission,
  getScoutMissionSnapshot,
  recordScoutMissionAction,
  surfaceContextualMissionPopup,
} from "../lib/savvyScoutMissions";

const SavvyScoutMissionsContext = createContext(null);

export function SavvyScoutMissionsProvider({ children }) {
  const location = useLocation();
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const bump = () => setTick((n) => n + 1);
    window.addEventListener(SCOUT_MISSION_SYNC_EVENT, bump);
    return () => window.removeEventListener(SCOUT_MISSION_SYNC_EVENT, bump);
  }, []);

  useEffect(() => {
    const t = window.setTimeout(() => surfaceContextualMissionPopup(location.pathname), 1600);
    return () => window.clearTimeout(t);
  }, [location.pathname]);

  const snapshot = useMemo(() => {
    void tick;
    return getScoutMissionSnapshot(location.pathname);
  }, [location.pathname, tick]);

  const trackAction = useCallback(
    (trigger, meta = {}) => {
      recordScoutMissionAction(trigger, {
        ...meta,
        pathname: meta.pathname || location.pathname,
      });
    },
    [location.pathname]
  );

  const claimMission = useCallback((missionId) => claimScoutMission(missionId), []);

  const value = useMemo(
    () => ({
      snapshot,
      trackAction,
      claimMission,
      refresh: () => setTick((n) => n + 1),
    }),
    [snapshot, trackAction, claimMission]
  );

  return (
    <SavvyScoutMissionsContext.Provider value={value}>
      {children}
    </SavvyScoutMissionsContext.Provider>
  );
}

export function useSavvyScoutMissions() {
  const ctx = useContext(SavvyScoutMissionsContext);
  if (!ctx) {
    throw new Error("useSavvyScoutMissions must be used within SavvyScoutMissionsProvider");
  }
  return ctx;
}

/** Safe hook for optional mission tracking outside provider boundaries. */
export function useSavvyScoutMissionsOptional() {
  return useContext(SavvyScoutMissionsContext);
}

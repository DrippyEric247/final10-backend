import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  createParty as apiCreateParty,
  getMyParty,
  joinParty as apiJoinParty,
  leaveParty as apiLeaveParty,
  startPartySession,
  endPartySession,
  getPartySummary,
  recordPartyEvent,
  invitePartyMember as apiInvite,
} from '../lib/api';
import { useAuth } from './AuthContext';
import { getPowerSnapshot } from '../lib/final10PowerEngine';

/**
 * PartyContext — "Squad Sync" client state.
 *
 * Responsibilities:
 *   • Hold the caller's current party + member list
 *   • Poll for state while a session is active
 *   • Expose mutation helpers (create/join/leave/start/end/invite)
 *   • Expose `reportPartyAction(eventType, baseSavvy, refId)` for other
 *     surfaces (feed, scanner, local-deals) to call after a valid action.
 */

const PartyCtx = createContext(null);
export const useParty = () => useContext(PartyCtx);

const PARTY_POLL_MS = 60_000;

export function PartyProvider({ children }) {
  const { user } = useAuth();
  const [party, setParty] = useState(null);
  const [members, setMembers] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const pollRef = useRef(null);

  const userId = user?.id || user?._id || null;

  const refresh = useCallback(async (options = {}) => {
    if (!userId) {
      setParty(null);
      setMembers([]);
      setLoading(false);
      return;
    }
    try {
      const res = await getMyParty(options);
      setParty(res?.party || null);
      setMembers(res?.members || []);
      setError('');
    } catch (e) {
      if (e?.isCoolingDown) {
        setError('');
      } else {
        setError(e?.message || 'Failed to load squad');
      }
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (!userId) return undefined;
    pollRef.current = setInterval(() => {
      void refresh();
    }, PARTY_POLL_MS);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [userId, refresh]);

  const createParty = useCallback(
    async (name) => {
      const res = await apiCreateParty(name || 'Squad');
      setParty(res?.party || null);
      setMembers(res?.members || []);
      return res;
    },
    []
  );

  const joinParty = useCallback(async (partyId) => {
    const res = await apiJoinParty(partyId);
    setParty(res?.party || null);
    setMembers(res?.members || []);
    return res;
  }, []);

  const leaveParty = useCallback(async () => {
    if (!party?.partyId) return null;
    const res = await apiLeaveParty(party.partyId);
    setParty(null);
    setMembers([]);
    setSummary(null);
    return res;
  }, [party?.partyId]);

  const startSession = useCallback(async () => {
    if (!party?.partyId) return null;
    const res = await startPartySession(party.partyId);
    setParty(res?.party || null);
    setMembers(res?.members || []);
    setSummary(null);
    return res;
  }, [party?.partyId]);

  const endSession = useCallback(async () => {
    if (!party?.partyId) return null;
    const res = await endPartySession(party.partyId);
    setParty(res?.party || null);
    setMembers(res?.members || []);
    setSummary(res?.summary || null);
    return res;
  }, [party?.partyId]);

  const loadSummary = useCallback(async () => {
    if (!party?.partyId) return null;
    const res = await getPartySummary(party.partyId);
    setSummary(res?.summary || null);
    return res?.summary || null;
  }, [party?.partyId]);

  const invite = useCallback(
    async (userId) => {
      if (!party?.partyId) return null;
      return apiInvite(party.partyId, userId);
    },
    [party?.partyId]
  );

  /**
   * Log a valid action against the active squad session. No-op when no
   * active session exists, so callers can fire-and-forget safely.
   */
  const reportPartyAction = useCallback(
    async (eventType, baseSavvy = 0, refId = null) => {
      if (!party?.partyId || party.status !== 'active') return null;
      try {
        const snapshot = getPowerSnapshot();
        const personalMultiplier = Number(snapshot?.currentMultiplier) || 1;
        const res = await recordPartyEvent(party.partyId, {
          eventType,
          personalMultiplier,
          baseSavvy,
          refId,
        });
        if (res?.partyState) {
          setParty((prev) =>
            prev ? { ...prev, ...res.partyState } : prev
          );
        }
        return res;
      } catch (e) {
        if (process.env.NODE_ENV !== 'production') {
          console.warn('reportPartyAction failed', e?.message);
        }
        return null;
      }
    },
    [party?.partyId, party?.status]
  );

  const value = useMemo(
    () => ({
      party,
      members,
      summary,
      loading,
      error,
      refresh,
      createParty,
      joinParty,
      leaveParty,
      startSession,
      endSession,
      loadSummary,
      invite,
      reportPartyAction,
    }),
    [
      party,
      members,
      summary,
      loading,
      error,
      refresh,
      createParty,
      joinParty,
      leaveParty,
      startSession,
      endSession,
      loadSummary,
      invite,
      reportPartyAction,
    ]
  );

  return <PartyCtx.Provider value={value}>{children}</PartyCtx.Provider>;
}

export default PartyCtx;

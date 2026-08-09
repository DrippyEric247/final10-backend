import { useCallback, useEffect, useRef, useState } from 'react';
import { claimContractReward, getContractsHub, recordContractAppOpen } from '../lib/api';
import { CONTRACTS_SYNC_EVENT, DEFAULT_CONTRACTS_APP_ID } from '../lib/contractsBus';
import { notifyWalletFromLegacyReward } from '../lib/pointsEngine';

/**
 * Universal Savvy Contracts data hook.
 * @param {{ appId?: string, enabled?: boolean }} [options]
 */
export default function useContracts({ appId = DEFAULT_CONTRACTS_APP_ID, enabled = true } = {}) {
  const [loading, setLoading] = useState(false);
  const [claimingId, setClaimingId] = useState(null);
  const [hub, setHub] = useState(null);
  const [error, setError] = useState(null);
  const mounted = useRef(true);

  const reload = useCallback(
    async ({ silent = false } = {}) => {
      if (!enabled) return null;
      if (!silent) setLoading(true);
      try {
        const data = await getContractsHub(appId);
        if (mounted.current) {
          setHub(data);
          setError(null);
        }
        return data;
      } catch (err) {
        if (mounted.current) setError(err);
        return null;
      } finally {
        if (mounted.current && !silent) setLoading(false);
      }
    },
    [appId, enabled]
  );

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (!enabled) return undefined;
    reload({ silent: false });
    recordContractAppOpen(appId).catch(() => {});
    const onSync = () => reload({ silent: true });
    window.addEventListener(CONTRACTS_SYNC_EVENT, onSync);
    return () => window.removeEventListener(CONTRACTS_SYNC_EVENT, onSync);
  }, [enabled, reload, appId]);

  const claim = useCallback(
    async (contractId) => {
      if (!contractId) return null;
      setClaimingId(contractId);
      try {
        const result = await claimContractReward(contractId, appId);
        if (result?.granted && result.added > 0) {
          notifyWalletFromLegacyReward({
            amount: result.added,
            type: 'contract_reward',
            rarity: 'epic',
            label: result.message || 'Contract reward',
          });
        }
        await reload({ silent: true });
        return result;
      } finally {
        if (mounted.current) setClaimingId(null);
      }
    },
    [appId, reload]
  );

  return {
    loading,
    error,
    hub,
    summary: hub?.summary || null,
    appContracts: hub?.appContracts || [],
    universeContracts: hub?.universeContracts || [],
    completedRecent: hub?.completedRecent || [],
    claimableCount: hub?.summary?.claimableCount || 0,
    claimingId,
    reload,
    claim,
  };
}

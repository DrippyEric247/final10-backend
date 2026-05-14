import { useCallback, useEffect, useState } from "react";
import { api } from "../lib/api";
import type { BattlePassActionEvent } from "../types/battlePassActionEvents";
import { hydrateProgressionClientCache, type ProgressionApiState } from "../lib/progressionHydration";
import { parseApiError } from "../lib/apiErrorParsing";
import { devDiagApiFailure } from "../lib/devApiDiagnostics";

function stripProgressionMeta(payload: Record<string, unknown>): ProgressionApiState {
  const { meta: _m, ...rest } = payload;
  return rest as unknown as ProgressionApiState;
}

export function useProgression(enabled: boolean) {
  const [state, setState] = useState<ProgressionApiState | null>(null);
  const [loading, setLoading] = useState(Boolean(enabled));
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!enabled) {
      setState(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get<ProgressionApiState & { meta?: unknown }>("/progression/me");
      const clean = stripProgressionMeta(data as Record<string, unknown>);
      setState(clean);
      hydrateProgressionClientCache(clean);
    } catch (e: unknown) {
      const { message } = parseApiError(e);
      devDiagApiFailure("progression_load_me", { ...parseApiError(e) });
      setError(message);
      setState(null);
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    void load();
  }, [load]);

  const submitBattlePassEvent = useCallback(
    async (event: BattlePassActionEvent) => {
      try {
        const { data } = await api.post<ProgressionApiState & { meta?: unknown }>("/progression/events", { event });
        const clean = stripProgressionMeta(data as Record<string, unknown>);
        setState(clean);
        hydrateProgressionClientCache(clean);
        return clean;
      } catch (e: unknown) {
        devDiagApiFailure("progression_submit_event", parseApiError(e));
        const ax = e as { response?: { data?: ProgressionApiState & { state?: ProgressionApiState } } };
        const body = ax.response?.data;
        const snap = body?.state ?? body;
        if (snap && typeof snap === "object" && (snap as ProgressionApiState).battlePass) {
          const clean = stripProgressionMeta(snap as Record<string, unknown>);
          hydrateProgressionClientCache(clean);
          setState(clean);
        }
        throw e;
      }
    },
    []
  );

  const initProgression = useCallback(async (reset = false) => {
    const { data } = await api.post<ProgressionApiState & { meta?: unknown }>("/progression/init", { reset });
    const clean = stripProgressionMeta(data as Record<string, unknown>);
    setState(clean);
    hydrateProgressionClientCache(clean);
    return clean;
  }, []);

  /** Re-sync battle pass premium from server entitlement (Stripe webhook truth). */
  const syncPremiumFromServer = useCallback(async () => {
    const { data } = await api.post<ProgressionApiState & { meta?: unknown }>("/progression/premium", {});
    const clean = stripProgressionMeta(data as Record<string, unknown>);
    setState(clean);
    hydrateProgressionClientCache(clean);
    return clean;
  }, []);

  return {
    state,
    loading,
    error,
    reload: load,
    submitBattlePassEvent,
    initProgression,
    syncPremiumFromServer,
    /** @deprecated use syncPremiumFromServer — client cannot set premium to true */
    setPremiumUnlockedRemote: syncPremiumFromServer,
  };
}

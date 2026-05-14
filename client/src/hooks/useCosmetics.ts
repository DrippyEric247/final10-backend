import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";
import { hydrateProgressionClientCache, type ProgressionApiState } from "../lib/progressionHydration";
import { parseApiError } from "../lib/apiErrorParsing";

export type CosmeticsPayload = {
  unlockedItemIds: string[];
  newItemIds: string[];
  equipped: {
    emblemId: string;
    callingCardId: string;
    titleId: string | null;
  };
};

export function useCosmetics(enabled: boolean) {
  const [data, setData] = useState<CosmeticsPayload | null>(null);
  const [loading, setLoading] = useState(Boolean(enabled));
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!enabled) {
      setData(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { data: d } = await api.get<CosmeticsPayload>("/cosmetics/me");
      setData(d);
      const synthetic: ProgressionApiState = {
        user: {},
        battlePass: {
          seasonId: "",
          xp: 0,
          tier: 0,
          premiumUnlocked: false,
          completedTaskIds: [],
          claimedRewardIds: [],
          taskStates: [],
        },
        cosmetics: d,
      };
      hydrateProgressionClientCache(synthetic, { skipBattlePass: true });
    } catch (e: unknown) {
      setError(parseApiError(e).message);
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    void load();
  }, [load]);

  const unlockedSet = useMemo(() => new Set(data?.unlockedItemIds || []), [data]);

  const equip = useCallback(
    async (type: "emblem" | "calling_card" | "title", itemId: string) => {
      const { data: d } = await api.post<CosmeticsPayload>("/cosmetics/equip", { type, itemId });
      setData(d);
      const synthetic: ProgressionApiState = {
        user: {},
        battlePass: {
          seasonId: "",
          xp: 0,
          tier: 0,
          premiumUnlocked: false,
          completedTaskIds: [],
          claimedRewardIds: [],
          taskStates: [],
        },
        cosmetics: d,
      };
      hydrateProgressionClientCache(synthetic, { skipBattlePass: true });
      return d;
    },
    []
  );

  return {
    useServer: enabled,
    data,
    unlockedSet,
    loading,
    error,
    reload: load,
    equip,
  };
}

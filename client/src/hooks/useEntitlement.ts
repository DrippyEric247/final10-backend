import { useCallback, useEffect, useState } from "react";
import { api } from "../lib/api";
import { parseApiError } from "../lib/apiErrorParsing";
import { getDevEntitlementOverlay, isDev } from "../lib/devOverride";
import { normalizeSubscriptionTier, setCurrentSubscriptionTier } from "../lib/tierMultiplier";

export type EntitlementMe = {
  isPremium: boolean;
  premiumStatus: string;
  premiumTier: string;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  trialEndsAt: string | null;
  provider: string;
  foundingTesterAccess?: boolean;
  betaTester?: boolean;
  foundingAccess?: boolean;
  betaAccessExpiresAt?: string | null;
};

const DEFAULT_ENTITLEMENT: EntitlementMe = {
  isPremium: false,
  premiumStatus: "inactive",
  premiumTier: "free",
  currentPeriodEnd: null,
  cancelAtPeriodEnd: false,
  trialEndsAt: null,
  provider: "stripe",
  foundingTesterAccess: false,
  betaTester: false,
  foundingAccess: false,
  betaAccessExpiresAt: null,
};

export type UseEntitlementResult = EntitlementMe & {
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
  raw: EntitlementMe | null;
};

export function useEntitlement(enabled: boolean): UseEntitlementResult {
  const [data, setData] = useState<EntitlementMe | null>(null);
  const [loading, setLoading] = useState(Boolean(enabled));
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!enabled) {
      setData(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { data: d } = await api.get<EntitlementMe>("/entitlements/me");
      setData(d);
      const normalized = normalizeSubscriptionTier(d?.premiumTier, Boolean(d?.isPremium));
      setCurrentSubscriptionTier(normalized);
    } catch (e: unknown) {
      setError(parseApiError(e).message);
      setData(null);
      setCurrentSubscriptionTier("free");
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const mergedBase = data ?? DEFAULT_ENTITLEMENT;
  const overlay = isDev ? getDevEntitlementOverlay() : null;
  const merged = overlay
    ? {
        ...mergedBase,
        isPremium: overlay.isPremium,
        premiumTier: overlay.premiumTier,
        premiumStatus: overlay.premiumStatus,
      }
    : mergedBase;

  return {
    ...merged,
    loading,
    error,
    reload,
    raw: data,
  } as UseEntitlementResult;
}

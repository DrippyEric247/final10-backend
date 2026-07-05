import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
} from "react";
import { useAuth } from "./AuthContext";
import { useCosmetics } from "../hooks/useCosmetics";
import {
  getEquippedCallingCardId,
  getEquippedEmblemId,
} from "../lib/customizationCatalog";

const CosmeticsContext = createContext(null);

export function CosmeticsProvider({ children }) {
  const { token, patchUser } = useAuth();
  const enabled = Boolean(token);
  const {
    data,
    equip: serverEquip,
    reload,
    loading,
    error,
    unlockedSet,
  } = useCosmetics(enabled);

  const equippedEmblemId = data?.equipped?.emblemId || getEquippedEmblemId();
  const equippedCallingCardId =
    data?.equipped?.callingCardId || getEquippedCallingCardId();

  useEffect(() => {
    if (!data?.equipped) return;
    patchUser({
      equippedEmblemId: data.equipped.emblemId,
      equippedCallingCardId: data.equipped.callingCardId,
      equippedCosmetics: data.equipped,
    });
  }, [data?.equipped, patchUser]);

  const equip = useCallback(
    async (type, itemId) => {
      const result = await serverEquip(type, itemId);
      if (result?.equipped) {
        patchUser({
          equippedEmblemId: result.equipped.emblemId,
          equippedCallingCardId: result.equipped.callingCardId,
          equippedCosmetics: result.equipped,
        });
      }
      return result;
    },
    [serverEquip, patchUser]
  );

  const value = useMemo(
    () => ({
      equippedEmblemId,
      equippedCallingCardId,
      equipped: data?.equipped || null,
      data,
      useServer: enabled,
      unlockedSet,
      loading,
      error,
      reload,
      equip,
    }),
    [
      equippedEmblemId,
      equippedCallingCardId,
      data,
      unlockedSet,
      loading,
      error,
      reload,
      equip,
      enabled,
    ]
  );

  return (
    <CosmeticsContext.Provider value={value}>{children}</CosmeticsContext.Provider>
  );
}

export function useCosmeticsLoadout() {
  const ctx = useContext(CosmeticsContext);
  if (!ctx) {
    return {
      equippedEmblemId: getEquippedEmblemId(),
      equippedCallingCardId: getEquippedCallingCardId(),
      equipped: null,
      data: null,
      useServer: false,
      equip: async () => null,
      reload: async () => {},
      loading: false,
      error: null,
      unlockedSet: new Set(),
    };
  }
  return ctx;
}

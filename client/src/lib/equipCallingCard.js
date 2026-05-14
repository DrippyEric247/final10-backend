/**
 * Equip calling card: server when authed + cosmetics API, else localStorage.
 */

import toast from "react-hot-toast";
import { api, STORAGE_KEY } from "./api";
import { findCallingCard, setEquippedCallingCardId } from "./customizationCatalog";
import { hydrateProgressionClientCache } from "./progressionHydration";

const EMPTY_BP = {
  seasonId: "",
  xp: 0,
  tier: 0,
  premiumUnlocked: false,
  completedTaskIds: [],
  claimedRewardIds: [],
  taskStates: [],
};

/**
 * @param {string} cardId
 * @returns {Promise<boolean>}
 */
export async function equipCallingCardAndSync(cardId) {
  const id = String(cardId || "").trim();
  if (!id) return false;
  const card = findCallingCard(id);
  const token = typeof localStorage !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;

  if (token) {
    try {
      const { data } = await api.post("/cosmetics/equip", { type: "calling_card", itemId: id });
      hydrateProgressionClientCache(
        {
          user: {},
          battlePass: EMPTY_BP,
          cosmetics: data,
        },
        { skipBattlePass: true }
      );
      toast.success(`Equipped: ${card.name}`);
      return true;
    } catch {
      toast.error("Could not equip calling card. Try again.");
      return false;
    }
  }

  setEquippedCallingCardId(id);
  toast.success(`Equipped: ${card.name}`);
  return true;
}

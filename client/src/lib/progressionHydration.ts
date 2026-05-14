import { hydrateBattlePassFromServer, hydrateCosmeticUnlocksFromServer } from "./battlePassEngine";
import { setEquippedCallingCardId, setEquippedEmblemId } from "./customizationCatalog";

export type ProgressionApiState = {
  user: Record<string, unknown>;
  battlePass: {
    seasonId: string;
    xp: number;
    tier: number;
    premiumUnlocked: boolean;
    completedTaskIds: string[];
    claimedRewardIds: string[];
    taskStates: unknown[];
  };
  cosmetics: {
    unlockedItemIds: string[];
    newItemIds: string[];
    equipped: {
      emblemId?: string;
      callingCardId?: string;
      titleId?: string | null;
    };
  };
};

const TITLE_LS = "f10_equipped_title";

export function hydrateProgressionClientCache(
  state: ProgressionApiState | null | undefined,
  opts?: { skipBattlePass?: boolean }
) {
  if (typeof window === "undefined" || !state) return;
  if (!opts?.skipBattlePass && state.battlePass?.seasonId) {
    hydrateBattlePassFromServer(state.battlePass);
  }
  if (state.cosmetics?.unlockedItemIds) {
    hydrateCosmeticUnlocksFromServer(state.cosmetics.unlockedItemIds);
  }
  const eq = state.cosmetics?.equipped;
  if (eq?.emblemId) setEquippedEmblemId(String(eq.emblemId));
  if (eq?.callingCardId) setEquippedCallingCardId(String(eq.callingCardId));
  if (eq?.titleId) {
    try {
      localStorage.setItem(TITLE_LS, String(eq.titleId));
    } catch {
      /* ignore */
    }
  }
}

import { hydrateBattlePassFromServer, hydrateCosmeticUnlocksFromServer } from "./battlePassEngine";
import { setEquippedCallingCardId, setEquippedEmblemId } from "./customizationCatalog";
import { setServerPowerMultiplier } from "./final10PowerEngine";

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
  soundtracks?: {
    unlockedTrackIds: string[];
    menuMusicTrackId?: string | null;
  };
};

const TITLE_LS = "f10_equipped_title";
const SOUNDTRACKS_LS = "f10_unlocked_soundtracks";
const MENU_MUSIC_TRACK_LS = "f10_menu_music_track_server";

export function hydrateSoundtracksFromServer(soundtracks?: ProgressionApiState["soundtracks"]) {
  if (typeof window === "undefined" || !soundtracks) return;
  try {
    localStorage.setItem(SOUNDTRACKS_LS, JSON.stringify(soundtracks.unlockedTrackIds || []));
    if (soundtracks.menuMusicTrackId) {
      localStorage.setItem(MENU_MUSIC_TRACK_LS, soundtracks.menuMusicTrackId);
    }
  } catch {
    /* ignore */
  }
}

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
  if (state.soundtracks) {
    hydrateSoundtracksFromServer(state.soundtracks);
  }
  const pm = Number(state.user?.powerMultiplier);
  if (Number.isFinite(pm) && pm >= 1) {
    setServerPowerMultiplier(pm);
  }
}

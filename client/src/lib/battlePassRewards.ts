/**
 * Battle Pass beta — shared reward presentation + claim helpers (client).
 * Pairs with config in `battlePassConfig.js` and server `battlePassClaimService`.
 */

export type BPRarity = "common" | "uncommon" | "rare" | "epic" | "legendary" | "mythic";

export type BPRewardType =
  | "savvy"
  | "egg"
  | "free_spin"
  | "streak_shield"
  | "token"
  | "calling_card"
  | "cosmetic"
  | "mythic_chance";

export type BPReward = {
  type: BPRewardType;
  rarity: BPRarity;
  label: string;
  icon: string;
  amount?: number;
  eggTier?: string;
  count?: number;
  tokenKey?: string;
  cosmeticId?: string;
  cosmeticType?: string;
  chance?: number;
  consolationEggTier?: string;
};

export type BPTier = { level: number; free: BPReward; premium: BPReward };

export type BPClaimGrant = {
  kind?: string;
  savvyGranted?: number;
  newBalance?: number;
  eggTier?: string;
  freeSpins?: number;
  shields?: number;
  tokenKey?: string;
  count?: number;
  cosmeticId?: string | null;
  cosmeticType?: string | null;
  mythicWon?: boolean;
};

/** Hex palette for rarity glow/borders. */
export const RARITY_COLORS: Record<BPRarity, { base: string; glow: string; text: string }> = {
  common: { base: "#cbd5e1", glow: "rgba(203,213,225,0.35)", text: "#e2e8f0" },
  uncommon: { base: "#34d399", glow: "rgba(52,211,153,0.4)", text: "#a7f3d0" },
  rare: { base: "#3b82f6", glow: "rgba(59,130,246,0.5)", text: "#bfdbfe" },
  epic: { base: "#a855f7", glow: "rgba(168,85,247,0.55)", text: "#e9d5ff" },
  legendary: { base: "#fbbf24", glow: "rgba(251,191,36,0.6)", text: "#fde68a" },
  mythic: { base: "#f472b6", glow: "rgba(244,114,182,0.6)", text: "#fbcfe8" },
};

export const RARITY_LABELS: Record<BPRarity, string> = {
  common: "Common",
  uncommon: "Uncommon",
  rare: "Rare",
  epic: "Epic",
  legendary: "Legendary",
  mythic: "Mythic",
};

const REWARD_KIND_LABELS: Record<BPRewardType, string> = {
  savvy: "Savvy",
  egg: "Egg",
  free_spin: "Free Spin",
  streak_shield: "Streak Shield",
  token: "Token",
  calling_card: "Calling Card",
  cosmetic: "Cosmetic",
  mythic_chance: "Mystery",
};

export function rewardKindLabel(reward: BPReward): string {
  return REWARD_KIND_LABELS[reward.type] ?? "Reward";
}

export function isMilestoneTier(level: number): boolean {
  return level === 10 || level === 15 || level === 20 || level === 25;
}

export function tierClaimKey(track: "free" | "premium", level: number): string {
  return `tier2:${track}:${level}`;
}

export function isTierClaimed(claimedIds: string[] | Set<string> | undefined, track: "free" | "premium", level: number): boolean {
  if (!claimedIds) return false;
  const key = tierClaimKey(track, level);
  return claimedIds instanceof Set ? claimedIds.has(key) : claimedIds.includes(key);
}

/** Friendly success copy for the claim popup, refined by the server grant result. */
export function claimSuccessMessage(reward: BPReward, grant?: BPClaimGrant): string {
  switch (reward.type) {
    case "egg":
      return "Egg added to your Perk Machine inventory.";
    case "free_spin":
      return "Free spin added to your Perk Machine.";
    case "savvy": {
      const amt = grant?.savvyGranted ?? reward.amount ?? 0;
      return `${amt.toLocaleString()} Savvy added to your balance.`;
    }
    case "streak_shield":
      return `Streak Shield${(reward.count ?? 1) > 1 ? "s" : ""} added to your streak.`;
    case "token":
      return "Token added to your Perk Machine.";
    case "calling_card":
      return "Calling Card unlocked — equip it in Customize.";
    case "cosmetic":
      return "Cosmetic unlocked — equip it in Customize.";
    case "mythic_chance":
      if (grant?.mythicWon) return "MYTHIC EGG secured! Added to your Perk Machine inventory.";
      return "Egg added to your Perk Machine inventory.";
    default:
      return "Reward claimed.";
  }
}

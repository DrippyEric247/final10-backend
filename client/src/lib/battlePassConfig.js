/**
 * Battle Pass — season layout, XP grants, rewards (tune here).
 * Integrates with Power via f10_bp_power_lint (read in final10PowerEngine).
 *
 * Beta upgrade: 25 tiers, two tracks, rewards wired to the Final10 ecosystem
 * (Savvy, Eggs, Perk Machine spins/tokens, Streak Shields, Calling Cards,
 * cosmetics). Tier rewards are claimed manually (server-authoritative).
 * Keep this file in sync with `server/lib/battlePassConfig.js`.
 */

export const BATTLE_PASS_SEASON = {
  id: "neon_hunt_s1",
  name: "Neon Hunt",
  subtitle: "Season 1 · Beta · 25 tiers",
  /** CSS variable seeds for BattlePassPage */
  theme: {
    "--bp-accent": "#22d3ee",
    "--bp-accent-2": "#a855f7",
    "--bp-gold": "#fbbf24",
    "--bp-track": "rgba(15, 23, 42, 0.92)",
    "--bp-premium-glow": "rgba(251, 191, 36, 0.45)",
  },
};

/**
 * Cumulative XP required to **unlock** tier N (index 0 = tier 1).
 */
export const BATTLE_PASS_CUMULATIVE_XP = [
  50, 120, 210, 320, 450, 600, 780, 980, 1200, 1450,
  1730, 2040, 2380, 2750, 3150, 3580, 4040, 4530, 5050, 5600,
  6180, 6790, 7430, 8100, 8800,
];

/**
 * @typedef {Object} BPReward
 * @property {'savvy'|'egg'|'free_spin'|'streak_shield'|'token'|'calling_card'|'cosmetic'|'mythic_chance'} type
 * @property {'common'|'uncommon'|'rare'|'epic'|'legendary'|'mythic'} rarity
 * @property {string} label
 * @property {string} icon
 * @property {number} [amount]
 * @property {string} [eggTier]
 * @property {number} [count]
 * @property {string} [tokenKey]
 * @property {string} [cosmeticId]
 * @property {string} [cosmeticType]
 * @property {number} [chance]
 * @property {string} [consolationEggTier]
 */

/** @type {{ level: number; free: BPReward; premium: BPReward }[]} */
export const BATTLE_PASS_TIERS = [
  { level: 1, free: { type: "savvy", amount: 100, rarity: "common", label: "+100 Savvy", icon: "💰" }, premium: { type: "egg", eggTier: "rare", rarity: "rare", label: "Rare Egg", icon: "🥚" } },
  { level: 2, free: { type: "egg", eggTier: "common", rarity: "common", label: "Common Egg", icon: "🥚" }, premium: { type: "token", tokenKey: "battlePassXp15", count: 1, rarity: "rare", label: "2x Battle Pass XP Token", icon: "⚡" } },
  { level: 3, free: { type: "calling_card", cosmeticId: "card_bp_s1_t3", rarity: "rare", label: "Calling Card", icon: "🎴" }, premium: { type: "savvy", amount: 250, rarity: "uncommon", label: "+250 Savvy", icon: "💰" } },
  { level: 4, free: { type: "streak_shield", count: 1, rarity: "uncommon", label: "Streak Shield", icon: "🛡️" }, premium: { type: "egg", eggTier: "epic", rarity: "epic", label: "Epic Egg", icon: "🥚" } },
  { level: 5, free: { type: "savvy", amount: 250, rarity: "uncommon", label: "+250 Savvy", icon: "💰" }, premium: { type: "cosmetic", cosmeticType: "theme", cosmeticId: "theme_perk_neon", rarity: "epic", label: "Exclusive Perk Machine Theme", icon: "🎨" } },
  { level: 6, free: { type: "egg", eggTier: "common", rarity: "common", label: "Common Egg", icon: "🥚" }, premium: { type: "egg", eggTier: "extraFreeSpin", rarity: "rare", label: "Extra Free Spin Egg", icon: "🎰" } },
  { level: 7, free: { type: "cosmetic", cosmeticType: "border", cosmeticId: "border_bp_s1", rarity: "uncommon", label: "Profile Border", icon: "🖼️" }, premium: { type: "savvy", amount: 500, rarity: "rare", label: "+500 Savvy", icon: "💎" } },
  { level: 8, free: { type: "free_spin", rarity: "rare", label: "Free Perk Machine Spin", icon: "🎰" }, premium: { type: "calling_card", cosmeticId: "card_bp_epic", rarity: "epic", label: "Epic Calling Card", icon: "🎴" } },
  { level: 9, free: { type: "egg", eggTier: "rare", rarity: "rare", label: "Rare Egg", icon: "🥚" }, premium: { type: "token", tokenKey: "savvyMultiplier15", count: 1, rarity: "rare", label: "2x Savvy Token", icon: "✨" } },
  { level: 10, free: { type: "cosmetic", cosmeticType: "emblem", cosmeticId: "sigil_bp_animated_t10", rarity: "epic", label: "Animated Emblem", icon: "◈" }, premium: { type: "egg", eggTier: "legendary", rarity: "legendary", label: "Legendary Egg", icon: "🥚" } },
  { level: 11, free: { type: "savvy", amount: 300, rarity: "uncommon", label: "+300 Savvy", icon: "💰" }, premium: { type: "cosmetic", cosmeticType: "skin", cosmeticId: "skin_perk_s1", rarity: "epic", label: "Perk Machine Skin", icon: "🧩" } },
  { level: 12, free: { type: "streak_shield", count: 2, rarity: "uncommon", label: "Streak Shield x2", icon: "🛡️" }, premium: { type: "egg", eggTier: "epic", rarity: "epic", label: "Epic Egg", icon: "🥚" } },
  { level: 13, free: { type: "calling_card", cosmeticId: "card_bp_s1_t13", rarity: "rare", label: "Calling Card", icon: "🎴" }, premium: { type: "free_spin", rarity: "rare", label: "Free Perk Machine Spin", icon: "🎰" } },
  { level: 14, free: { type: "egg", eggTier: "rare", rarity: "rare", label: "Rare Egg", icon: "🥚" }, premium: { type: "cosmetic", cosmeticType: "dialogue", cosmeticId: "dialogue_scout_s1", rarity: "rare", label: "Exclusive Scout Dialogue Pack", icon: "💬" } },
  { level: 15, free: { type: "savvy", amount: 500, rarity: "rare", label: "+500 Savvy", icon: "💎" }, premium: { type: "mythic_chance", chance: 0.15, consolationEggTier: "legendary", rarity: "mythic", label: "Mythic Egg Chance Reward", icon: "🌈" } },
  { level: 16, free: { type: "token", tokenKey: "battlePassXp15", count: 1, rarity: "rare", label: "XP Token", icon: "⚡" }, premium: { type: "cosmetic", cosmeticType: "frame", cosmeticId: "frame_premium_s1", rarity: "epic", label: "Premium Profile Frame", icon: "🖼️" } },
  { level: 17, free: { type: "egg", eggTier: "common", rarity: "common", label: "Common Egg", icon: "🥚" }, premium: { type: "savvy", amount: 750, rarity: "epic", label: "+750 Savvy", icon: "💎" } },
  { level: 18, free: { type: "cosmetic", cosmeticType: "emblem", cosmeticId: "sigil_bp_animated_t18", rarity: "epic", label: "Animated Emblem", icon: "◈" }, premium: { type: "egg", eggTier: "epic", rarity: "epic", label: "Epic Egg", icon: "🥚" } },
  { level: 19, free: { type: "free_spin", rarity: "rare", label: "Free Perk Machine Spin", icon: "🎰" }, premium: { type: "calling_card", cosmeticId: "card_bp_legendary", rarity: "legendary", label: "Legendary Calling Card", icon: "🎴" } },
  { level: 20, free: { type: "egg", eggTier: "legendary", rarity: "legendary", label: "Legendary Egg", icon: "🥚" }, premium: { type: "cosmetic", cosmeticType: "badge", cosmeticId: "badge_perk_animated", rarity: "legendary", label: "Animated Perk Machine Badge", icon: "🏅" } },
  { level: 21, free: { type: "egg", eggTier: "rare", rarity: "rare", label: "Rare Egg", icon: "🥚" }, premium: { type: "cosmetic", cosmeticType: "boost", cosmeticId: "boost_egg_slot_s1", rarity: "epic", label: "Extra Egg Slot Season Boost", icon: "🥚" } },
  { level: 22, free: { type: "savvy", amount: 750, rarity: "epic", label: "+750 Savvy", icon: "💎" }, premium: { type: "cosmetic", cosmeticType: "skin", cosmeticId: "skin_scout_premium", rarity: "legendary", label: "Premium Scout Skin", icon: "🤖" } },
  { level: 23, free: { type: "egg", eggTier: "epic", rarity: "epic", label: "Epic Egg", icon: "🥚" }, premium: { type: "token", tokenKey: "battlePassXp15", count: 1, rarity: "epic", label: "3x Battle Pass XP Token", icon: "⚡" } },
  { level: 24, free: { type: "cosmetic", cosmeticType: "banner", cosmeticId: "banner_bp_s1", rarity: "epic", label: "Exclusive Banner", icon: "🏳️" }, premium: { type: "savvy", amount: 1000, rarity: "legendary", label: "+1000 Savvy", icon: "💎" } },
  { level: 25, free: { type: "cosmetic", cosmeticType: "badge", cosmeticId: "badge_founder_animated", rarity: "legendary", label: "Animated Founder Badge", icon: "🏅" }, premium: { type: "egg", eggTier: "mythic", rarity: "mythic", label: "Season Finale Mythic Egg", icon: "🥚" } },
];

/** Milestone tiers get special UI treatment. */
export const BATTLE_PASS_MILESTONES = [10, 15, 20, 25];

/** Beta manual-claim key namespace for tier rewards (matches server). */
export function tierClaimKeyV2(track, level) {
  return `tier2:${track}:${level}`;
}

/** XP per action source (additive when event fires) */
export const BATTLE_PASS_XP = {
  save_item: 15,
  scan: 25,
  task_step: 20,
  tasks_complete_bonus: 55,
  daily_login: 10,
  auction_win: 45,
  promote: 12,
  deal_view: 5,
  bundle_snipe: 35,
  /** Profile weekly task streak increased (cleared all dailies for another week). */
  streak_week: 28,
  /** Season mission rewards pass explicit XP via overrideAmount. */
  bp_season_task: 0,
};

export const BP_STORAGE_KEY = "f10_battle_pass_state_v1";
export const BP_COSMETIC_KEY = "f10_bp_unlocked_cosmetics";
export const BP_POWER_LINT_KEY = "f10_bp_power_lint";
export const BP_PREMIUM_KEY_PREFIX = "f10_bp_premium_";

export const BP_UPDATE_EVENT = "f10-battlepass-update";
export const BP_TIER_COMPLETE_EVENT = "f10-battlepass-tier-complete";

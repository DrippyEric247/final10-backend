/**
 * Mirrors client `client/src/lib/battlePassConfig.js` for server-side tier math.
 *
 * Beta upgrade: 25 tiers, two tracks (free + premium), rewards wired to the
 * Final10 reward ecosystem (Savvy, Eggs, Perk Machine spins/tokens, Streak
 * Shields, Calling Cards, cosmetics). Tier rewards are MANUALLY CLAIMED via
 * `battlePassClaimService` using `tier2:` claim keys (legacy `tier:` keys from
 * the old auto-claim system are preserved but no longer block new claims).
 */

const BATTLE_PASS_SEASON_ID = 'neon_hunt_s1';

/** Cumulative XP required to UNLOCK tier N (index 0 = tier 1). */
const BATTLE_PASS_CUMULATIVE_XP = [
  50, 120, 210, 320, 450, 600, 780, 980, 1200, 1450, // 1-10
  1730, 2040, 2380, 2750, 3150, 3580, 4040, 4530, 5050, 5600, // 11-20
  6180, 6790, 7430, 8100, 8800, // 21-25
];

/**
 * Reward schema (per track):
 * { type, rarity, label, icon, ...payload }
 *  - savvy:        { amount }
 *  - egg:          { eggTier: common|rare|epic|legendary|mythic|extraFreeSpin }
 *  - free_spin:    {}                          -> perkMachine.extraFreeSpins++
 *  - streak_shield:{ count }                   -> dailyStreak.scoutShields
 *  - token:        { tokenKey, count }         -> perkMachine.tokens[tokenKey]
 *  - calling_card: { cosmeticId }              -> cosmetic inventory + drop count
 *  - cosmetic:     { cosmeticType, cosmeticId} -> cosmetic inventory
 *  - mythic_chance:{ chance, consolationEggTier } (placeholder, never guarantees)
 * rarity ∈ common | uncommon | rare | epic | legendary | mythic
 */
const BATTLE_PASS_TIERS = [
  {
    level: 1,
    free: { type: 'savvy', amount: 100, rarity: 'common', label: '+100 Savvy', icon: '💰' },
    premium: { type: 'egg', eggTier: 'rare', rarity: 'rare', label: 'Rare Egg', icon: '🥚' },
  },
  {
    level: 2,
    free: { type: 'egg', eggTier: 'common', rarity: 'common', label: 'Common Egg', icon: '🥚' },
    premium: { type: 'token', tokenKey: 'battlePassXp15', count: 1, rarity: 'rare', label: '2x Battle Pass XP Token', icon: '⚡' },
  },
  {
    level: 3,
    free: { type: 'calling_card', cosmeticId: 'card_bp_s1_t3', rarity: 'rare', label: 'Calling Card', icon: '🎴' },
    premium: { type: 'savvy', amount: 250, rarity: 'uncommon', label: '+250 Savvy', icon: '💰' },
  },
  {
    level: 4,
    free: { type: 'streak_shield', count: 1, rarity: 'uncommon', label: 'Streak Shield', icon: '🛡️' },
    premium: { type: 'egg', eggTier: 'epic', rarity: 'epic', label: 'Epic Egg', icon: '🥚' },
  },
  {
    level: 5,
    free: { type: 'savvy', amount: 250, rarity: 'uncommon', label: '+250 Savvy', icon: '💰' },
    premium: { type: 'cosmetic', cosmeticType: 'theme', cosmeticId: 'theme_perk_neon', rarity: 'epic', label: 'Exclusive Perk Machine Theme', icon: '🎨' },
  },
  {
    level: 6,
    free: { type: 'egg', eggTier: 'common', rarity: 'common', label: 'Common Egg', icon: '🥚' },
    premium: { type: 'egg', eggTier: 'extraFreeSpin', rarity: 'rare', label: 'Extra Free Spin Egg', icon: '🎰' },
  },
  {
    level: 7,
    free: { type: 'cosmetic', cosmeticType: 'border', cosmeticId: 'border_bp_s1', rarity: 'uncommon', label: 'Profile Border', icon: '🖼️' },
    premium: { type: 'savvy', amount: 500, rarity: 'rare', label: '+500 Savvy', icon: '💎' },
  },
  {
    level: 8,
    free: { type: 'free_spin', rarity: 'rare', label: 'Free Perk Machine Spin', icon: '🎰' },
    premium: { type: 'calling_card', cosmeticId: 'card_bp_epic', rarity: 'epic', label: 'Epic Calling Card', icon: '🎴' },
  },
  {
    level: 9,
    free: { type: 'egg', eggTier: 'rare', rarity: 'rare', label: 'Rare Egg', icon: '🥚' },
    premium: { type: 'token', tokenKey: 'savvyMultiplier15', count: 1, rarity: 'rare', label: '2x Savvy Token', icon: '✨' },
  },
  {
    level: 10,
    free: { type: 'cosmetic', cosmeticType: 'emblem', cosmeticId: 'sigil_bp_animated_t10', rarity: 'epic', label: 'Animated Emblem', icon: '◈' },
    premium: { type: 'egg', eggTier: 'legendary', rarity: 'legendary', label: 'Legendary Egg', icon: '🥚' },
  },
  {
    level: 11,
    free: { type: 'savvy', amount: 300, rarity: 'uncommon', label: '+300 Savvy', icon: '💰' },
    premium: { type: 'cosmetic', cosmeticType: 'skin', cosmeticId: 'skin_perk_s1', rarity: 'epic', label: 'Perk Machine Skin', icon: '🧩' },
  },
  {
    level: 12,
    free: { type: 'streak_shield', count: 2, rarity: 'uncommon', label: 'Streak Shield x2', icon: '🛡️' },
    premium: { type: 'egg', eggTier: 'epic', rarity: 'epic', label: 'Epic Egg', icon: '🥚' },
  },
  {
    level: 13,
    free: { type: 'calling_card', cosmeticId: 'card_bp_s1_t13', rarity: 'rare', label: 'Calling Card', icon: '🎴' },
    premium: { type: 'free_spin', rarity: 'rare', label: 'Free Perk Machine Spin', icon: '🎰' },
  },
  {
    level: 14,
    free: { type: 'egg', eggTier: 'rare', rarity: 'rare', label: 'Rare Egg', icon: '🥚' },
    premium: { type: 'cosmetic', cosmeticType: 'dialogue', cosmeticId: 'dialogue_scout_s1', rarity: 'rare', label: 'Exclusive Scout Dialogue Pack', icon: '💬' },
  },
  {
    level: 15,
    free: { type: 'savvy', amount: 500, rarity: 'rare', label: '+500 Savvy', icon: '💎' },
    premium: { type: 'mythic_chance', chance: 0.15, consolationEggTier: 'legendary', rarity: 'mythic', label: 'Mythic Egg Chance Reward', icon: '🌈' },
  },
  {
    level: 16,
    free: { type: 'token', tokenKey: 'battlePassXp15', count: 1, rarity: 'rare', label: 'XP Token', icon: '⚡' },
    premium: { type: 'cosmetic', cosmeticType: 'frame', cosmeticId: 'frame_premium_s1', rarity: 'epic', label: 'Premium Profile Frame', icon: '🖼️' },
  },
  {
    level: 17,
    free: { type: 'egg', eggTier: 'common', rarity: 'common', label: 'Common Egg', icon: '🥚' },
    premium: { type: 'savvy', amount: 750, rarity: 'epic', label: '+750 Savvy', icon: '💎' },
  },
  {
    level: 18,
    free: { type: 'cosmetic', cosmeticType: 'emblem', cosmeticId: 'sigil_bp_animated_t18', rarity: 'epic', label: 'Animated Emblem', icon: '◈' },
    premium: { type: 'egg', eggTier: 'epic', rarity: 'epic', label: 'Epic Egg', icon: '🥚' },
  },
  {
    level: 19,
    free: { type: 'free_spin', rarity: 'rare', label: 'Free Perk Machine Spin', icon: '🎰' },
    premium: { type: 'calling_card', cosmeticId: 'card_bp_legendary', rarity: 'legendary', label: 'Legendary Calling Card', icon: '🎴' },
  },
  {
    level: 20,
    free: { type: 'egg', eggTier: 'legendary', rarity: 'legendary', label: 'Legendary Egg', icon: '🥚' },
    premium: { type: 'cosmetic', cosmeticType: 'badge', cosmeticId: 'badge_perk_animated', rarity: 'legendary', label: 'Animated Perk Machine Badge', icon: '🏅' },
  },
  {
    level: 21,
    free: { type: 'egg', eggTier: 'rare', rarity: 'rare', label: 'Rare Egg', icon: '🥚' },
    premium: { type: 'cosmetic', cosmeticType: 'boost', cosmeticId: 'boost_egg_slot_s1', rarity: 'epic', label: 'Extra Egg Slot Season Boost', icon: '🥚' },
  },
  {
    level: 22,
    free: { type: 'savvy', amount: 750, rarity: 'epic', label: '+750 Savvy', icon: '💎' },
    premium: { type: 'cosmetic', cosmeticType: 'skin', cosmeticId: 'skin_scout_premium', rarity: 'legendary', label: 'Premium Scout Skin', icon: '🤖' },
  },
  {
    level: 23,
    free: { type: 'egg', eggTier: 'epic', rarity: 'epic', label: 'Epic Egg', icon: '🥚' },
    premium: { type: 'token', tokenKey: 'battlePassXp15', count: 1, rarity: 'epic', label: '3x Battle Pass XP Token', icon: '⚡' },
  },
  {
    level: 24,
    free: { type: 'cosmetic', cosmeticType: 'banner', cosmeticId: 'banner_bp_s1', rarity: 'epic', label: 'Exclusive Banner', icon: '🏳️' },
    premium: { type: 'savvy', amount: 1000, rarity: 'legendary', label: '+1000 Savvy', icon: '💎' },
  },
  {
    level: 25,
    free: { type: 'cosmetic', cosmeticType: 'badge', cosmeticId: 'badge_founder_animated', rarity: 'legendary', label: 'Animated Founder Badge', icon: '🏅' },
    premium: { type: 'egg', eggTier: 'mythic', rarity: 'mythic', label: 'Season Finale Mythic Egg', icon: '🥚' },
  },
];

/** Milestone tiers get special UI treatment. */
const BATTLE_PASS_MILESTONES = Object.freeze([10, 15, 20, 25]);

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}

function getBattlePassMaxXp() {
  const last = BATTLE_PASS_CUMULATIVE_XP[BATTLE_PASS_CUMULATIVE_XP.length - 1];
  return last || 1;
}

function computeTierFromXp(xp) {
  let completedCount = 0;
  for (let i = 0; i < BATTLE_PASS_CUMULATIVE_XP.length; i += 1) {
    if (xp >= BATTLE_PASS_CUMULATIVE_XP[i]) completedCount = i + 1;
  }
  return Math.min(completedCount, BATTLE_PASS_TIERS.length);
}

/** Legacy auto-claim key (still honored for duplicate detection of old grants). */
function tierRewardClaimKey(track, level) {
  return `tier:${track}:${level}`;
}

/** Beta manual-claim key namespace for the 25-tier reward layout. */
function tierClaimKeyV2(track, level) {
  return `tier2:${track}:${level}`;
}

function missionRewardClaimKey(seasonId, taskId) {
  const sid = String(seasonId || '').trim() || BATTLE_PASS_SEASON_ID;
  return `mission:${sid}:${String(taskId).trim()}`;
}

/** Legacy keys before season scoping — still honored for duplicate detection. */
function legacyMissionRewardClaimKey(taskId) {
  return `mission:${String(taskId).trim()}`;
}

module.exports = {
  BATTLE_PASS_SEASON_ID,
  BATTLE_PASS_CUMULATIVE_XP,
  BATTLE_PASS_TIERS,
  BATTLE_PASS_MILESTONES,
  getBattlePassMaxXp,
  computeTierFromXp,
  clamp,
  tierRewardClaimKey,
  tierClaimKeyV2,
  missionRewardClaimKey,
  legacyMissionRewardClaimKey,
};

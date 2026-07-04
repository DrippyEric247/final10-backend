/**
 * Mirrors client `client/src/lib/battlePassConfig.js` for server-side tier math.
 *
 * Beta upgrade: 60 tiers, two tracks (free + premium), rewards wired to the
 * Final10 reward ecosystem (Savvy, Eggs, Perk Machine spins/tokens, Streak
 * Shields, Calling Cards, cosmetics, soundtracks). Tier rewards are MANUALLY
 * CLAIMED via `battlePassClaimService` using `tier2:` claim keys.
 */

const BATTLE_PASS_SEASON_ID = 'neon_hunt_s1';

/** Cumulative XP required to UNLOCK tier N (index 0 = tier 1). */
const BATTLE_PASS_CUMULATIVE_XP = [
  50,
  120,
  210,
  320,
  450,
  600,
  780,
  980,
  1200,
  1450,
  1730,
  2040,
  2380,
  2750,
  3150,
  3580,
  4040,
  4530,
  5050,
  5600,
  6180,
  6790,
  7430,
  8100,
  8800,
  9600,
  10450,
  11350,
  12300,
  13050,
  13850,
  14700,
  15600,
  16550,
  17300,
  18100,
  18950,
  19850,
  20800,
  21550,
  22350,
  23200,
  24100,
  25050,
  25800,
  26600,
  27450,
  28350,
  29300,
  30050,
  30850,
  31700,
  32600,
  33550,
  34300,
  35100,
  35950,
  36850,
  37800,
  38550
];

/**
 * Reward schema (per track):
 * { type, rarity, label, icon, ...payload }
 *  - soundtrack:   { trackId } | { packKey: beta|founder_season }
 * rarity ∈ common | uncommon | rare | epic | legendary | mythic
 */
const BATTLE_PASS_TIERS = [
  {
    level: 1,
    free: {'type':'savvy','amount':100,'rarity':'common','label':'+100 Savvy','icon':'💰'},
    premium: {'type':'egg','eggTier':'rare','rarity':'rare','label':'Rare Egg','icon':'🥚'},
  },
  {
    level: 2,
    free: {'type':'egg','eggTier':'common','rarity':'common','label':'Common Egg','icon':'🥚'},
    premium: {'type':'token','tokenKey':'battlePassXp15','count':1,'rarity':'rare','label':'2x Battle Pass XP Token','icon':'⚡'},
  },
  {
    level: 3,
    free: {'type':'calling_card','cosmeticId':'card_bp_s1_t3','rarity':'rare','label':'Calling Card','icon':'🎴'},
    premium: {'type':'savvy','amount':250,'rarity':'uncommon','label':'+250 Savvy','icon':'💰'},
  },
  {
    level: 4,
    free: {'type':'streak_shield','count':1,'rarity':'uncommon','label':'Streak Shield','icon':'🛡️'},
    premium: {'type':'egg','eggTier':'epic','rarity':'epic','label':'Epic Egg','icon':'🥚'},
  },
  {
    level: 5,
    free: {'type':'soundtrack','trackId':'final10_menu_theme_v1','rarity':'rare','label':'Final10 Menu Theme V1','icon':'🎵'},
    premium: {'type':'cosmetic','cosmeticType':'theme','cosmeticId':'theme_perk_neon','rarity':'epic','label':'Exclusive Perk Machine Theme','icon':'🎨'},
  },
  {
    level: 6,
    free: {'type':'egg','eggTier':'common','rarity':'common','label':'Common Egg','icon':'🥚'},
    premium: {'type':'egg','eggTier':'extraFreeSpin','rarity':'rare','label':'Extra Free Spin Egg','icon':'🎰'},
  },
  {
    level: 7,
    free: {'type':'cosmetic','cosmeticType':'border','cosmeticId':'border_bp_s1','rarity':'uncommon','label':'Profile Border','icon':'🖼️'},
    premium: {'type':'savvy','amount':500,'rarity':'rare','label':'+500 Savvy','icon':'💎'},
  },
  {
    level: 8,
    free: {'type':'free_spin','rarity':'rare','label':'Free Perk Machine Spin','icon':'🎰'},
    premium: {'type':'calling_card','cosmeticId':'card_bp_epic','rarity':'epic','label':'Epic Calling Card','icon':'🎴'},
  },
  {
    level: 9,
    free: {'type':'egg','eggTier':'rare','rarity':'rare','label':'Rare Egg','icon':'🥚'},
    premium: {'type':'token','tokenKey':'savvyMultiplier15','count':1,'rarity':'rare','label':'2x Savvy Token','icon':'✨'},
  },
  {
    level: 10,
    free: {'type':'soundtrack','trackId':'double_points_event_stinger','rarity':'epic','label':'Double Points Event Stinger','icon':'🎵'},
    premium: {'type':'egg','eggTier':'legendary','rarity':'legendary','label':'Legendary Egg','icon':'🥚'},
  },
  {
    level: 11,
    free: {'type':'savvy','amount':300,'rarity':'uncommon','label':'+300 Savvy','icon':'💰'},
    premium: {'type':'cosmetic','cosmeticType':'skin','cosmeticId':'skin_perk_s1','rarity':'epic','label':'Perk Machine Skin','icon':'🧩'},
  },
  {
    level: 12,
    free: {'type':'streak_shield','count':2,'rarity':'uncommon','label':'Streak Shield x2','icon':'🛡️'},
    premium: {'type':'egg','eggTier':'epic','rarity':'epic','label':'Epic Egg','icon':'🥚'},
  },
  {
    level: 13,
    free: {'type':'calling_card','cosmeticId':'card_bp_s1_t13','rarity':'rare','label':'Calling Card','icon':'🎴'},
    premium: {'type':'free_spin','rarity':'rare','label':'Free Perk Machine Spin','icon':'🎰'},
  },
  {
    level: 14,
    free: {'type':'egg','eggTier':'rare','rarity':'rare','label':'Rare Egg','icon':'🥚'},
    premium: {'type':'cosmetic','cosmeticType':'dialogue','cosmeticId':'dialogue_scout_s1','rarity':'rare','label':'Exclusive Scout Dialogue Pack','icon':'💬'},
  },
  {
    level: 15,
    free: {'type':'soundtrack','trackId':'savvy_sale_event_stinger','rarity':'rare','label':'Savvy Sale Event Stinger','icon':'🎵'},
    premium: {'type':'mythic_chance','chance':0.15,'consolationEggTier':'legendary','rarity':'mythic','label':'Mythic Egg Chance Reward','icon':'🌈'},
  },
  {
    level: 16,
    free: {'type':'token','tokenKey':'battlePassXp15','count':1,'rarity':'rare','label':'XP Token','icon':'⚡'},
    premium: {'type':'cosmetic','cosmeticType':'frame','cosmeticId':'frame_premium_s1','rarity':'epic','label':'Premium Profile Frame','icon':'🖼️'},
  },
  {
    level: 17,
    free: {'type':'egg','eggTier':'common','rarity':'common','label':'Common Egg','icon':'🥚'},
    premium: {'type':'savvy','amount':750,'rarity':'epic','label':'+750 Savvy','icon':'💎'},
  },
  {
    level: 18,
    free: {'type':'cosmetic','cosmeticType':'emblem','cosmeticId':'sigil_bp_animated_t18','rarity':'epic','label':'Animated Emblem','icon':'◈'},
    premium: {'type':'egg','eggTier':'epic','rarity':'epic','label':'Epic Egg','icon':'🥚'},
  },
  {
    level: 19,
    free: {'type':'free_spin','rarity':'rare','label':'Free Perk Machine Spin','icon':'🎰'},
    premium: {'type':'calling_card','cosmeticId':'card_bp_legendary','rarity':'legendary','label':'Legendary Calling Card','icon':'🎴'},
  },
  {
    level: 20,
    free: {'type':'soundtrack','trackId':'perk_machine_theme','rarity':'legendary','label':'Perk Machine Theme','icon':'🎵'},
    premium: {'type':'cosmetic','cosmeticType':'badge','cosmeticId':'badge_perk_animated','rarity':'legendary','label':'Animated Perk Machine Badge','icon':'🏅'},
  },
  {
    level: 21,
    free: {'type':'egg','eggTier':'rare','rarity':'rare','label':'Rare Egg','icon':'🥚'},
    premium: {'type':'cosmetic','cosmeticType':'boost','cosmeticId':'boost_egg_slot_s1','rarity':'epic','label':'Extra Egg Slot Season Boost','icon':'🥚'},
  },
  {
    level: 22,
    free: {'type':'savvy','amount':750,'rarity':'epic','label':'+750 Savvy','icon':'💎'},
    premium: {'type':'cosmetic','cosmeticType':'skin','cosmeticId':'skin_scout_premium','rarity':'legendary','label':'Premium Scout Skin','icon':'🤖'},
  },
  {
    level: 23,
    free: {'type':'egg','eggTier':'epic','rarity':'epic','label':'Epic Egg','icon':'🥚'},
    premium: {'type':'token','tokenKey':'battlePassXp15','count':1,'rarity':'epic','label':'3x Battle Pass XP Token','icon':'⚡'},
  },
  {
    level: 24,
    free: {'type':'cosmetic','cosmeticType':'banner','cosmeticId':'banner_bp_s1','rarity':'epic','label':'Exclusive Banner','icon':'🏳️'},
    premium: {'type':'savvy','amount':1000,'rarity':'legendary','label':'+1000 Savvy','icon':'💎'},
  },
  {
    level: 25,
    free: {'type':'soundtrack','trackId':'scout_flight_theme','rarity':'legendary','label':'Scout Flight Theme','icon':'🎵'},
    premium: {'type':'egg','eggTier':'mythic','rarity':'mythic','label':'Season Finale Mythic Egg','icon':'🥚'},
  },
  {
    level: 26,
    free: {'type':'streak_shield','count':1,'rarity':'uncommon','label':'Streak Shield','icon':'🛡️'},
    premium: {'type':'cosmetic','cosmeticType':'border','cosmeticId':'border_bp_s1_t26','rarity':'epic','label':'Profile Border','icon':'🖼️'},
  },
  {
    level: 27,
    free: {'type':'free_spin','rarity':'rare','label':'Free Perk Machine Spin','icon':'🎰'},
    premium: {'type':'egg','eggTier':'epic','rarity':'epic','label':'Epic Egg','icon':'🥚'},
  },
  {
    level: 28,
    free: {'type':'token','tokenKey':'battlePassXp15','count':1,'rarity':'rare','label':'XP Token','icon':'⚡'},
    premium: {'type':'cosmetic','cosmeticType':'border','cosmeticId':'border_bp_s1_t28','rarity':'epic','label':'Profile Border','icon':'🖼️'},
  },
  {
    level: 29,
    free: {'type':'calling_card','cosmeticId':'card_bp_s1_t29','rarity':'rare','label':'Calling Card','icon':'🎴'},
    premium: {'type':'cosmetic','cosmeticType':'border','cosmeticId':'border_bp_s1_t29','rarity':'epic','label':'Profile Border','icon':'🖼️'},
  },
  {
    level: 30,
    free: {'type':'soundtrack','trackId':'max_supply_drop_event_stinger','rarity':'epic','label':'Max Supply Drop Event Stinger','icon':'🎵'},
    premium: {'type':'egg','eggTier':'legendary','rarity':'legendary','label':'Legendary Egg','icon':'🥚'},
  },
  {
    level: 31,
    free: {'type':'egg','eggTier':'rare','rarity':'rare','label':'Rare Egg','icon':'🥚'},
    premium: {'type':'cosmetic','cosmeticType':'border','cosmeticId':'border_bp_s1_t31','rarity':'epic','label':'Profile Border','icon':'🖼️'},
  },
  {
    level: 32,
    free: {'type':'streak_shield','count':1,'rarity':'uncommon','label':'Streak Shield','icon':'🛡️'},
    premium: {'type':'cosmetic','cosmeticType':'border','cosmeticId':'border_bp_s1_t32','rarity':'epic','label':'Profile Border','icon':'🖼️'},
  },
  {
    level: 33,
    free: {'type':'free_spin','rarity':'rare','label':'Free Perk Machine Spin','icon':'🎰'},
    premium: {'type':'egg','eggTier':'epic','rarity':'epic','label':'Epic Egg','icon':'🥚'},
  },
  {
    level: 34,
    free: {'type':'token','tokenKey':'battlePassXp15','count':1,'rarity':'rare','label':'XP Token','icon':'⚡'},
    premium: {'type':'cosmetic','cosmeticType':'border','cosmeticId':'border_bp_s1_t34','rarity':'epic','label':'Profile Border','icon':'🖼️'},
  },
  {
    level: 35,
    free: {'type':'calling_card','cosmeticId':'card_bp_s1_t35','rarity':'rare','label':'Calling Card','icon':'🎴'},
    premium: {'type':'savvy','amount':1025,'rarity':'epic','label':'+1025 Savvy','icon':'💎'},
  },
  {
    level: 36,
    free: {'type':'savvy','amount':760,'rarity':'uncommon','label':'+760 Savvy','icon':'💰'},
    premium: {'type':'egg','eggTier':'epic','rarity':'epic','label':'Epic Egg','icon':'🥚'},
  },
  {
    level: 37,
    free: {'type':'egg','eggTier':'rare','rarity':'rare','label':'Rare Egg','icon':'🥚'},
    premium: {'type':'cosmetic','cosmeticType':'border','cosmeticId':'border_bp_s1_t37','rarity':'epic','label':'Profile Border','icon':'🖼️'},
  },
  {
    level: 38,
    free: {'type':'streak_shield','count':1,'rarity':'uncommon','label':'Streak Shield','icon':'🛡️'},
    premium: {'type':'cosmetic','cosmeticType':'border','cosmeticId':'border_bp_s1_t38','rarity':'epic','label':'Profile Border','icon':'🖼️'},
  },
  {
    level: 39,
    free: {'type':'free_spin','rarity':'rare','label':'Free Perk Machine Spin','icon':'🎰'},
    premium: {'type':'egg','eggTier':'epic','rarity':'epic','label':'Epic Egg','icon':'🥚'},
  },
  {
    level: 40,
    free: {'type':'soundtrack','trackId':'triple_points_event_stinger','rarity':'epic','label':'Triple Points Event Stinger','icon':'🎵'},
    premium: {'type':'cosmetic','cosmeticType':'badge','cosmeticId':'badge_bp_t40','rarity':'legendary','label':'Legendary Badge','icon':'🏅'},
  },
  {
    level: 41,
    free: {'type':'calling_card','cosmeticId':'card_bp_s1_t41','rarity':'rare','label':'Calling Card','icon':'🎴'},
    premium: {'type':'cosmetic','cosmeticType':'border','cosmeticId':'border_bp_s1_t41','rarity':'epic','label':'Profile Border','icon':'🖼️'},
  },
  {
    level: 42,
    free: {'type':'savvy','amount':820,'rarity':'uncommon','label':'+820 Savvy','icon':'💰'},
    premium: {'type':'egg','eggTier':'epic','rarity':'epic','label':'Epic Egg','icon':'🥚'},
  },
  {
    level: 43,
    free: {'type':'egg','eggTier':'rare','rarity':'rare','label':'Rare Egg','icon':'🥚'},
    premium: {'type':'cosmetic','cosmeticType':'border','cosmeticId':'border_bp_s1_t43','rarity':'epic','label':'Profile Border','icon':'🖼️'},
  },
  {
    level: 44,
    free: {'type':'streak_shield','count':1,'rarity':'uncommon','label':'Streak Shield','icon':'🛡️'},
    premium: {'type':'cosmetic','cosmeticType':'border','cosmeticId':'border_bp_s1_t44','rarity':'epic','label':'Profile Border','icon':'🖼️'},
  },
  {
    level: 45,
    free: {'type':'free_spin','rarity':'rare','label':'Free Perk Machine Spin','icon':'🎰'},
    premium: {'type':'savvy','amount':1175,'rarity':'epic','label':'+1175 Savvy','icon':'💎'},
  },
  {
    level: 46,
    free: {'type':'token','tokenKey':'battlePassXp15','count':1,'rarity':'rare','label':'XP Token','icon':'⚡'},
    premium: {'type':'cosmetic','cosmeticType':'border','cosmeticId':'border_bp_s1_t46','rarity':'epic','label':'Profile Border','icon':'🖼️'},
  },
  {
    level: 47,
    free: {'type':'calling_card','cosmeticId':'card_bp_s1_t47','rarity':'rare','label':'Calling Card','icon':'🎴'},
    premium: {'type':'cosmetic','cosmeticType':'border','cosmeticId':'border_bp_s1_t47','rarity':'epic','label':'Profile Border','icon':'🖼️'},
  },
  {
    level: 48,
    free: {'type':'savvy','amount':880,'rarity':'uncommon','label':'+880 Savvy','icon':'💰'},
    premium: {'type':'egg','eggTier':'epic','rarity':'epic','label':'Epic Egg','icon':'🥚'},
  },
  {
    level: 49,
    free: {'type':'egg','eggTier':'epic','rarity':'epic','label':'Epic Egg','icon':'🥚'},
    premium: {'type':'cosmetic','cosmeticType':'border','cosmeticId':'border_bp_s1_t49','rarity':'epic','label':'Profile Border','icon':'🖼️'},
  },
  {
    level: 50,
    free: {'type':'soundtrack','packKey':'beta','rarity':'legendary','label':'Savvy Universe Beta Soundtrack Pack','icon':'🎵'},
    premium: {'type':'savvy','amount':1500,'rarity':'legendary','label':'+1500 Savvy','icon':'💎'},
  },
  {
    level: 51,
    free: {'type':'free_spin','rarity':'rare','label':'Free Perk Machine Spin','icon':'🎰'},
    premium: {'type':'egg','eggTier':'legendary','rarity':'legendary','label':'Legendary Egg','icon':'🥚'},
  },
  {
    level: 52,
    free: {'type':'token','tokenKey':'battlePassXp15','count':1,'rarity':'rare','label':'XP Token','icon':'⚡'},
    premium: {'type':'cosmetic','cosmeticType':'border','cosmeticId':'border_bp_s1_t52','rarity':'epic','label':'Profile Border','icon':'🖼️'},
  },
  {
    level: 53,
    free: {'type':'calling_card','cosmeticId':'card_bp_s1_t53','rarity':'rare','label':'Calling Card','icon':'🎴'},
    premium: {'type':'cosmetic','cosmeticType':'border','cosmeticId':'border_bp_s1_t53','rarity':'epic','label':'Profile Border','icon':'🖼️'},
  },
  {
    level: 54,
    free: {'type':'savvy','amount':940,'rarity':'uncommon','label':'+940 Savvy','icon':'💰'},
    premium: {'type':'egg','eggTier':'legendary','rarity':'legendary','label':'Legendary Egg','icon':'🥚'},
  },
  {
    level: 55,
    free: {'type':'egg','eggTier':'epic','rarity':'epic','label':'Epic Egg','icon':'🥚'},
    premium: {'type':'savvy','amount':1325,'rarity':'epic','label':'+1325 Savvy','icon':'💎'},
  },
  {
    level: 56,
    free: {'type':'streak_shield','count':1,'rarity':'uncommon','label':'Streak Shield','icon':'🛡️'},
    premium: {'type':'cosmetic','cosmeticType':'border','cosmeticId':'border_bp_s1_t56','rarity':'epic','label':'Profile Border','icon':'🖼️'},
  },
  {
    level: 57,
    free: {'type':'free_spin','rarity':'rare','label':'Free Perk Machine Spin','icon':'🎰'},
    premium: {'type':'egg','eggTier':'legendary','rarity':'legendary','label':'Legendary Egg','icon':'🥚'},
  },
  {
    level: 58,
    free: {'type':'token','tokenKey':'battlePassXp15','count':1,'rarity':'rare','label':'XP Token','icon':'⚡'},
    premium: {'type':'cosmetic','cosmeticType':'border','cosmeticId':'border_bp_s1_t58','rarity':'epic','label':'Profile Border','icon':'🖼️'},
  },
  {
    level: 59,
    free: {'type':'calling_card','cosmeticId':'card_bp_s1_t59','rarity':'rare','label':'Calling Card','icon':'🎴'},
    premium: {'type':'cosmetic','cosmeticType':'border','cosmeticId':'border_bp_s1_t59','rarity':'epic','label':'Profile Border','icon':'🖼️'},
  },
  {
    level: 60,
    free: {'type':'soundtrack','packKey':'founder_season','rarity':'mythic','label':'Founder Season Complete Soundtrack Pack','icon':'🎵'},
    premium: {'type':'egg','eggTier':'mythic','rarity':'mythic','label':'Founder Finale Mythic Egg','icon':'🥚'},
  },
];

/** Milestone tiers get special UI treatment. */
const BATTLE_PASS_MILESTONES = Object.freeze([10, 15, 20, 25, 30, 40, 50, 60]);

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

/** Beta manual-claim key namespace for the 60-tier reward layout. */
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

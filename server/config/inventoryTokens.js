/**
 * Canonical inventory token definitions — server source of truth.
 */

const TOKEN_DURATION_MS = 30 * 60 * 1000; // 30 minutes

const INVENTORY_TOKENS = Object.freeze({
  battle_pass_xp_token: {
    itemType: 'battle_pass_xp_token',
    itemKey: 'battlePassXp15',
    boostKey: 'battlePassXp15',
    kind: 'boost',
    source: 'tokens',
    label: '1.5× Battle Pass XP Token',
    activeLabel: '1.5× Battle Pass XP Active',
    icon: '⚡',
    multiplier: 1.5,
    durationMs: TOKEN_DURATION_MS,
    instantBpXp: 250,
    navigationTarget: '/battle-pass',
    confirmTitle: 'Activate 1.5× Battle Pass XP?',
    confirmBody:
      'Battle Pass XP earned during the next 30 minutes will receive a 1.5× boost.',
    presentationTitle: 'BATTLE PASS XP TOKEN ACTIVATED',
    presentationSubtitle: '1.5× XP — 30:00',
  },
  savvy_level_xp_token: {
    itemType: 'savvy_level_xp_token',
    itemKey: 'savvyLevelXp15',
    legacyItemKey: 'savvyMultiplier15',
    boostKey: 'savvyLevelXp15',
    kind: 'boost',
    source: 'tokens',
    label: '1.5× Savvy Level XP Token',
    activeLabel: '1.5× Savvy Level XP Active',
    icon: '✨',
    multiplier: 1.5,
    durationMs: TOKEN_DURATION_MS,
    instantProfileXp: 200,
    navigationTarget: '/profile',
    confirmTitle: 'Activate 1.5× Savvy Level XP?',
    confirmBody:
      'Profile level XP earned during the next 30 minutes will receive a 1.5× boost. Savvy Points are not affected.',
    presentationTitle: 'SAVVY LEVEL XP TOKEN ACTIVATED',
    presentationSubtitle: '1.5× PROFILE XP — 30:00',
  },
  extra_free_spin_egg: {
    itemType: 'extra_free_spin_egg',
    itemKey: 'extraFreeSpin',
    kind: 'free_spin',
    source: 'eggInventory',
    label: 'Extra Free Spin Egg',
    icon: '🎰',
    navigationTarget: '/perk-machine',
    confirmTitle: 'Use Extra Free Spin Egg?',
    confirmBody: 'Adds one free Perk Machine spin to your account.',
    presentationTitle: 'FREE SPIN ADDED',
    presentationSubtitle: 'The Perk Machine is ready.',
    autoSpin: true,
  },
  streak_shield: {
    itemType: 'streak_shield',
    itemKey: 'streakShield',
    kind: 'streak_shield',
    source: 'dailyStreak',
    label: 'Streak Shield',
    icon: '🛡️',
    durationMs: 24 * 60 * 60 * 1000,
    navigationTarget: '/daily-streak',
    confirmTitle: 'Activate Streak Shield?',
    confirmBody: 'Protect your login streak for the next 24 hours.',
    presentationTitle: 'SHIELD ACTIVATED',
    presentationSubtitle: 'Your streak is protected for 24 hours.',
  },
  scout_flight_ticket: {
    itemType: 'scout_flight_ticket',
    itemKey: 'scoutFlightTicket',
    kind: 'scout_flight_ticket',
    source: 'eventInventory',
    label: 'Scout Flight Ticket',
    icon: '🎫',
    navigationTarget: '/scout-flight',
    confirmTitle: 'Launch Scout Flight?',
    confirmBody: 'Use a ticket to launch Scout Flight instantly.',
    presentationTitle: 'SCOUT FLIGHT READY',
    presentationSubtitle: 'Launching Scout Flight…',
  },
});

/** Map legacy perk-machine keys to canonical item types. */
const LEGACY_KEY_TO_ITEM_TYPE = Object.freeze({
  battlePassXp15: 'battle_pass_xp_token',
  savvyMultiplier15: 'savvy_level_xp_token',
  savvyLevelXp15: 'savvy_level_xp_token',
  extraFreeSpin: 'extra_free_spin_egg',
  streakShield: 'streak_shield',
  scoutFlightTicket: 'scout_flight_ticket',
});

function resolveInventoryToken(input) {
  const raw = String(input || '').trim();
  if (INVENTORY_TOKENS[raw]) return INVENTORY_TOKENS[raw];
  const viaLegacy = LEGACY_KEY_TO_ITEM_TYPE[raw];
  if (viaLegacy) return INVENTORY_TOKENS[viaLegacy];
  return null;
}

function tokenCountForUser(user, def) {
  const pm = user?.perkMachine || {};
  if (def.kind === 'free_spin') {
    return Number(pm.eggInventory?.[def.itemKey]) || 0;
  }
  if (def.kind === 'streak_shield') {
    return Number(user?.dailyStreak?.scoutShields) || 0;
  }
  if (def.kind === 'scout_flight_ticket') {
    return Number(user?.eventInventory?.scoutFlightTicket) || 0;
  }
  let count = Number(pm.tokens?.[def.itemKey]) || 0;
  if (def.legacyItemKey) {
    count += Number(pm.tokens?.[def.legacyItemKey]) || 0;
  }
  return count;
}

function consumeTokenFromUser(user, def) {
  const pm = user.perkMachine;
  if (def.kind === 'free_spin') {
    const have = Number(pm.eggInventory?.[def.itemKey]) || 0;
    if (have < 1) return false;
    pm.eggInventory[def.itemKey] = have - 1;
    return true;
  }
  if (def.kind === 'streak_shield') {
    if (!user.dailyStreak) user.dailyStreak = {};
    const have = Number(user.dailyStreak.scoutShields) || 0;
    if (have < 1) return false;
    user.dailyStreak.scoutShields = have - 1;
    user.markModified('dailyStreak');
    return true;
  }
  if (def.kind === 'scout_flight_ticket') {
    if (!user.eventInventory) user.eventInventory = {};
    const have = Number(user.eventInventory.scoutFlightTicket) || 0;
    if (have < 1) return false;
    user.eventInventory.scoutFlightTicket = have - 1;
    user.markModified('eventInventory');
    return true;
  }
  const primary = Number(pm.tokens?.[def.itemKey]) || 0;
  if (primary >= 1) {
    pm.tokens[def.itemKey] = primary - 1;
    return true;
  }
  if (def.legacyItemKey) {
    const legacy = Number(pm.tokens?.[def.legacyItemKey]) || 0;
    if (legacy >= 1) {
      pm.tokens[def.legacyItemKey] = legacy - 1;
      return true;
    }
  }
  return false;
}

module.exports = {
  TOKEN_DURATION_MS,
  INVENTORY_TOKENS,
  LEGACY_KEY_TO_ITEM_TYPE,
  resolveInventoryToken,
  tokenCountForUser,
  consumeTokenFromUser,
};

/** Client mirror of server inventory token definitions. */

export const INVENTORY_USE_KIND = Object.freeze({
  TOKEN: 'token',
  HATCH_EVENT: 'hatch_event',
  MAX_SUPPLY_DROP: 'max_supply_drop',
  TIER_SKIP: 'tier_skip',
});

export const INVENTORY_TOKEN_DEFS = Object.freeze([
  {
    itemType: 'battle_pass_xp_token',
    itemKey: 'battlePassXp15',
    icon: '⚡',
    label: '1.5× Battle Pass XP Token',
    activeLabel: '1.5× Battle Pass XP Active',
    confirmTitle: 'Activate 1.5× Battle Pass XP?',
    confirmBody:
      'Battle Pass XP earned during the next 30 minutes will receive a 1.5× boost.',
    navigationTarget: '/battle-pass',
    scoutVoiceLine: 'scanning',
    countFrom: (s) => Number(s?.tokens?.battlePassXp15) || 0,
    boostKey: 'battlePassXp15',
  },
  {
    itemType: 'savvy_level_xp_token',
    itemKey: 'savvyLevelXp15',
    legacyKey: 'savvyMultiplier15',
    icon: '✨',
    label: '1.5× Savvy Level XP Token',
    activeLabel: '1.5× Savvy Level XP Active',
    confirmTitle: 'Activate 1.5× Savvy Level XP?',
    confirmBody:
      'Profile level XP earned during the next 30 minutes will receive a 1.5× boost. Savvy Points are not affected.',
    navigationTarget: '/profile',
    scoutVoiceLine: 'reward_confirmed',
    countFrom: (s) =>
      (Number(s?.tokens?.savvyLevelXp15) || 0) + (Number(s?.tokens?.savvyMultiplier15) || 0),
    boostKey: 'savvyLevelXp15',
  },
  {
    itemType: 'extra_free_spin_egg',
    itemKey: 'extraFreeSpin',
    icon: '🎰',
    label: 'Extra Free Spin Egg',
    confirmTitle: 'Use Extra Free Spin Egg?',
    confirmBody: 'Adds one free Perk Machine spin and opens the wheel.',
    navigationTarget: '/perk-machine',
    scoutVoiceLine: 'supply_drop',
    countFrom: (s) => Number(s?.eggInventory?.extraFreeSpin) || 0,
    autoSpin: true,
  },
  {
    itemType: 'streak_shield',
    itemKey: 'streakShield',
    icon: '🛡️',
    label: 'Streak Shield',
    confirmTitle: 'Activate Streak Shield?',
    confirmBody: 'Protect your login streak for the next 24 hours.',
    navigationTarget: '/daily-streak',
    scoutVoiceLine: 'reward_confirmed',
    countFrom: (s) => Number(s?.streakShields) || 0,
  },
  {
    itemType: 'scout_flight_ticket',
    itemKey: 'scoutFlightTicket',
    icon: '🎫',
    label: 'Scout Flight Ticket',
    confirmTitle: 'Launch Scout Flight?',
    confirmBody: 'Use a ticket to launch Scout Flight instantly.',
    navigationTarget: '/scout-flight',
    scoutVoiceLine: 'scanning',
    countFrom: (s) => Number(s?.tournamentTicketProgress?.ticketsOwned) || 0,
  },
]);

export const LEGACY_KEY_TO_ITEM_TYPE = Object.freeze({
  battlePassXp15: 'battle_pass_xp_token',
  savvyMultiplier15: 'savvy_level_xp_token',
  savvyLevelXp15: 'savvy_level_xp_token',
  extraFreeSpin: 'extra_free_spin_egg',
  streakShield: 'streak_shield',
  scoutFlightTicket: 'scout_flight_ticket',
});

export function resolveInventoryTokenDef(input) {
  const raw = String(input || '').trim();
  const byType = INVENTORY_TOKEN_DEFS.find((d) => d.itemType === raw || d.itemKey === raw);
  if (byType) return byType;
  const mapped = LEGACY_KEY_TO_ITEM_TYPE[raw];
  return INVENTORY_TOKEN_DEFS.find((d) => d.itemType === mapped) || null;
}

export function isBoostActiveForDef(status, def) {
  if (!def?.boostKey || !status?.activeBoosts) return false;
  const boost = status.activeBoosts.find(
    (b) => b.key === def.boostKey || b.type === def.boostKey
  );
  if (!boost?.expiresAt) return false;
  return new Date(boost.expiresAt).getTime() > Date.now();
}

export function buildTokenUseConfirmation(def, { count, isActive }) {
  return {
    useKind: INVENTORY_USE_KIND.TOKEN,
    itemType: def.itemType,
    ...def,
    count,
    isActive,
    requiresStock: true,
  };
}

export function buildHatchEventUseConfirmation(token) {
  const label = token?.label || 'Event Token';
  return {
    useKind: INVENTORY_USE_KIND.HATCH_EVENT,
    tokenId: token.id,
    icon: token.icon || '🎁',
    label,
    confirmTitle: `Activate ${label}?`,
    confirmBody: 'This will start your timed personal event immediately.',
    confirmButtonLabel: 'Activate',
    count: 1,
    requiresStock: false,
  };
}

export function buildMaxSupplyDropUseConfirmation(count) {
  return {
    useKind: INVENTORY_USE_KIND.MAX_SUPPLY_DROP,
    icon: '📦',
    label: 'Max Supply Drop Token',
    confirmTitle: 'Deploy Max Supply Drop?',
    confirmBody: 'Deploys a supply drop reward on your next eligible spin.',
    confirmButtonLabel: 'Deploy',
    count: Math.max(1, Number(count) || 1),
    requiresStock: true,
  };
}

export function buildTierSkipUseConfirmation(count) {
  return {
    useKind: INVENTORY_USE_KIND.TIER_SKIP,
    icon: '⏭️',
    label: 'Battle Pass Tier Skip',
    confirmTitle: 'Skip Battle Pass Tier?',
    confirmBody: 'Instantly advance one tier on your Battle Pass track.',
    confirmButtonLabel: 'Skip Tier',
    count: Math.max(1, Number(count) || 1),
    requiresStock: true,
  };
}

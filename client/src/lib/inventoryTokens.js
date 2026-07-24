/** Client mirror of server inventory token definitions. */

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
    confirmBody: 'Adds one free Perk Machine spin to your account.',
    navigationTarget: '/perk-machine',
    scoutVoiceLine: 'supply_drop',
    countFrom: (s) => Number(s?.eggInventory?.extraFreeSpin) || 0,
  },
]);

export const LEGACY_KEY_TO_ITEM_TYPE = Object.freeze({
  battlePassXp15: 'battle_pass_xp_token',
  savvyMultiplier15: 'savvy_level_xp_token',
  savvyLevelXp15: 'savvy_level_xp_token',
  extraFreeSpin: 'extra_free_spin_egg',
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

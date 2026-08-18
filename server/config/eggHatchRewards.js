/**
 * Egg Hatch reward design — server source of truth.
 *
 * These pools define EXACTLY what each egg tier can drop. Wording, amounts,
 * and durations are intentionally kept verbatim from the product spec — do not
 * change labels/values here without a matching product change.
 *
 * Every reward object is a full definition (not a reference), so the grant
 * logic in perkMachineService.applyReward can act on it directly and the
 * client reveal can display the exact reward name.
 */

const MIN = 60 * 1000;
const HOUR = 60 * MIN;

/** Duration presets for timed personal event tokens. */
const DURATIONS = Object.freeze({
  FIVE_MIN: 5 * MIN,
  TEN_MIN: 10 * MIN,
  ONE_HOUR: HOUR,
});

/**
 * Per-egg-tier hatch tables. Weights are relative (not specified by product),
 * chosen so every listed reward is reachable.
 */
const EGG_HATCH_POOLS = Object.freeze({
  common: [
    { id: 'hatch_scout_ticket_1', type: 'scout_flight_ticket', quantity: 1, label: 'Scout Flight Ticket', icon: '🎟', rarity: 'uncommon', weight: 16 },
    { id: 'hatch_bp_xp_15', type: 'token', tokenKey: 'battlePassXp15', label: '1.5× Battle Pass XP', icon: '⚡', rarity: 'uncommon', weight: 12 },
    { id: 'hatch_free_spin_1', type: 'egg', eggTier: 'extraFreeSpin', quantity: 1, label: 'Free Perk Machine Spin', icon: '🎰', rarity: 'uncommon', weight: 12 },
    { id: 'hatch_savvy_25', type: 'savvy', amount: 25, label: '+25 Savvy', icon: '🪙', rarity: 'common', weight: 18 },
    { id: 'hatch_savvy_50', type: 'savvy', amount: 50, label: '+50 Savvy', icon: '🪙', rarity: 'common', weight: 14 },
    { id: 'hatch_guaranteed_2x', type: 'guaranteed_multiplier', multiplierValue: 2, label: 'Guaranteed 2× Next Spin', icon: '⭐', rarity: 'rare', weight: 6 },
    { id: 'hatch_streak_shield_1', type: 'streak_shield', quantity: 1, label: 'Streak Shield', icon: '🛡️', rarity: 'uncommon', weight: 12 },
    { id: 'hatch_calling_card', type: 'calling_card', label: 'Calling Card Drop', icon: '🎖️', rarity: 'rare', weight: 6 },
  ],
  rare: [
    { id: 'hatch_double_xp_5m', type: 'timed_event_token', eventKind: 'doubleXp', durationMs: DURATIONS.FIVE_MIN, label: '5-Minute Double XP Token', icon: '⚡', rarity: 'rare', weight: 12 },
    { id: 'hatch_guaranteed_2x_rare', type: 'guaranteed_multiplier', multiplierValue: 2, label: 'Guaranteed 2× Next Spin', icon: '⭐', rarity: 'rare', weight: 10 },
    { id: 'hatch_login_skip_1', type: 'login_streak_advance', days: 1, label: 'Advance Login Streak by 1 Day', icon: '📅', rarity: 'rare', weight: 10 },
    { id: 'hatch_perm_mult_01', type: 'permanent_multiplier', permanentBonus: 0.1, label: '+0.1 Permanent Multiplier', icon: '📈', rarity: 'rare', weight: 8 },
    { id: 'hatch_savvy_sale_5m', type: 'timed_event_token', eventKind: 'savvySale', durationMs: DURATIONS.FIVE_MIN, label: '5-Minute Savvy Sale Token', icon: '🏷️', rarity: 'rare', weight: 12 },
    { id: 'hatch_scout_ticket_5', type: 'scout_flight_ticket', quantity: 5, label: '5 Scout Flight Tickets', icon: '🎟', rarity: 'rare', weight: 10 },
    { id: 'hatch_streak_shield_5', type: 'streak_shield', quantity: 5, label: '5 Streak Shields', icon: '🛡️', rarity: 'rare', weight: 10 },
    { id: 'hatch_free_spin_5', type: 'egg', eggTier: 'extraFreeSpin', quantity: 5, label: '5 Free Perk Machine Spins', icon: '🎰', rarity: 'rare', weight: 10 },
    { id: 'hatch_supply_drop_token_1', type: 'supply_drop_token', quantity: 1, label: 'Max Supply Drop Token', icon: '📦', rarity: 'rare', weight: 8 },
    { id: 'hatch_faster_alert_1h', type: 'faster_alert_perk', durationMs: DURATIONS.ONE_HOUR, label: '1-Hour Faster Alerts', icon: '🔔', rarity: 'rare', weight: 10 },
  ],
  epic: [
    { id: 'hatch_double_xp_10m', type: 'timed_event_token', eventKind: 'doubleXp', durationMs: DURATIONS.TEN_MIN, label: '10-Minute Double XP Token', icon: '⚡', rarity: 'rare', weight: 14 },
    { id: 'hatch_guaranteed_2x_epic', type: 'guaranteed_multiplier', multiplierValue: 2, label: 'Guaranteed 2× Next Spin', icon: '⭐', rarity: 'rare', weight: 12 },
    { id: 'hatch_savvy_sale_10m', type: 'timed_event_token', eventKind: 'savvySale', durationMs: DURATIONS.TEN_MIN, label: '10-Minute Savvy Sale Token', icon: '🏷️', rarity: 'rare', weight: 14 },
    { id: 'hatch_scout_ticket_10', type: 'scout_flight_ticket', quantity: 10, label: '10 Scout Flight Tickets', icon: '🎟', rarity: 'rare', weight: 12 },
    { id: 'hatch_streak_shield_10', type: 'streak_shield', quantity: 10, label: '10 Streak Shields', icon: '🛡️', rarity: 'rare', weight: 12 },
    { id: 'hatch_two_slot_spins_10', type: 'spin_token_2slot', quantity: 10, label: '10 Two-Slot Perk Machine Spins', icon: '🎰', rarity: 'rare', weight: 12 },
    { id: 'hatch_bp_tier_skip_1', type: 'bp_tier_skip', quantity: 1, label: 'Battle Pass Tier Skip', icon: '⏭️', rarity: 'legendary', weight: 8 },
  ],
  legendary: [
    { id: 'hatch_guaranteed_3x', type: 'guaranteed_multiplier', multiplierValue: 3, label: 'Guaranteed 3× Next Spin', icon: '🌟', rarity: 'legendary', weight: 14 },
    { id: 'hatch_login_skip_5', type: 'login_streak_advance', days: 5, label: 'Advance Login Streak by 5 Days', icon: '📅', rarity: 'legendary', weight: 12 },
    { id: 'hatch_double_supply_drop', type: 'supply_drop_double', label: 'Max Supply Drop (Double Value)', icon: '📦', rarity: 'legendary', weight: 10 },
    { id: 'hatch_savvy_sale_1h', type: 'timed_event_token', eventKind: 'savvySale', durationMs: DURATIONS.ONE_HOUR, label: '1-Hour Savvy Sale Token', icon: '🏷️', rarity: 'legendary', weight: 12 },
    { id: 'hatch_double_xp_1h', type: 'timed_event_token', eventKind: 'doubleXp', durationMs: DURATIONS.ONE_HOUR, label: '1-Hour Double XP Token', icon: '⚡', rarity: 'legendary', weight: 12 },
    { id: 'hatch_perm_mult_03', type: 'permanent_multiplier', permanentBonus: 0.3, label: '+0.3 Permanent Multiplier', icon: '📈', rarity: 'legendary', weight: 10 },
    { id: 'hatch_bp_tier_skip_5', type: 'bp_tier_skip', quantity: 5, label: '5 Battle Pass Tier Skips', icon: '⏭️', rarity: 'legendary', weight: 10 },
  ],
  mythic: [
    { id: 'mythic_3x_5h', type: 'timed_savvy_multiplier', multiplierValue: 3, durationMs: 5 * HOUR, label: 'Mythic 3× Savvy Earnings (5 Hours)', icon: '🌈', rarity: 'mythic', weight: 14 },
    { id: 'mythic_free_perk_hour', type: 'free_perk_spin_hour', durationMs: HOUR, label: 'Free Perk Machine Spins — 1 Hour', icon: '🎰', rarity: 'mythic', weight: 14 },
    { id: 'mythic_bp_skip_20', type: 'bp_tier_skip_bulk', tiers: 20, label: 'Skip 20 Battle Pass Tiers', icon: '⏭️', rarity: 'mythic', weight: 12 },
    { id: 'mythic_easter_challenge', type: 'easter_challenge_activator', challengeId: 'wave3_placeholder', label: 'Easter Egg Challenge Activator', icon: '🥚', rarity: 'mythic', weight: 8 },
    { id: 'mythic_egg_haul', type: 'egg_haul', label: 'Egg Haul', icon: '🧺', rarity: 'mythic', weight: 12 },
    { id: 'mythic_guaranteed_3x', type: 'guaranteed_multiplier', multiplierValue: 3, label: 'Guaranteed 3× Next Spin', icon: '🌟', rarity: 'mythic', weight: 10 },
    { id: 'mythic_double_supply_drop', type: 'supply_drop_double', label: 'Max Supply Drop (Double Value)', icon: '📦', rarity: 'mythic', weight: 8 },
    { id: 'mythic_perm_mult_03', type: 'permanent_multiplier', permanentBonus: 0.3, label: '+0.3 Permanent Multiplier', icon: '📈', rarity: 'mythic', weight: 8 },
  ],
});

/** Egg tiers that use the authoritative hatch design tables. */
const EGG_HATCH_TIERS = Object.freeze(['common', 'rare', 'epic', 'legendary', 'mythic']);

/** Build the weighted reward pool for a given egg tier. */
function buildEggHatchPool(eggTier) {
  const key = String(eggTier || 'common').trim();
  const table = EGG_HATCH_POOLS[key] || EGG_HATCH_POOLS.common;
  return table.map((def) => ({ ...def })).filter((r) => r.weight > 0);
}

module.exports = {
  DURATIONS,
  EGG_HATCH_POOLS,
  EGG_HATCH_TIERS,
  buildEggHatchPool,
};

/** Known Final10 cosmetics for server-side equip validation */

const EMBLEM_IDS = new Set([
  'sigil_starter',
  'sigil_first_save',
  'sigil_streak',
  'sigil_silver',
  'sigil_promo',
  'sigil_closer',
  'sigil_bp_neon',
  'sigil_bp_hunter',
  'sigil_bp_apex',
  // Battle Pass beta · season 1 (25-tier)
  'sigil_bp_animated_t10',
  'sigil_bp_animated_t18',
  // Savvy / business progression
  'sigil_coupon_scissor',
  'sigil_gift_box',
  'sigil_lightning_deal',
  'sigil_dollar_spark',
  'sigil_storefront',
  'sigil_verified_badge',
  'sigil_growth_chart',
  'sigil_network',
  // Exclusive · manual grant
  'sigil_savvy_creator',
  'sigil_viral_engine',
  'sigil_deal_amplifier',
  'sigil_system_architect',
  'sigil_savvy_core',
  'sigil_debug_king',
  'sigil_founders_circle',
  'sigil_savvy_elite',
  'sigil_the_signal',
  'sigil_founding_tester',
  'sigil_founding_legacy',
  // Scout Flight World Championship
  'sigil_scout_flight_beta_champion',
  'sigil_scout_flight_beta_silver',
  'sigil_scout_flight_beta_bronze',
  'sigil_scout_flight_beta_top10',
  'sigil_scout_flight_silver',
  'sigil_scout_flight_bronze',
  'sigil_scout_flight_top10',
  // Classified / Master Collection
  'sigil_master_classified',
]);

const CALLING_CARD_IDS = new Set([
  'card_default',
  'card_sniper',
  'card_promo_king',
  'card_marathon',
  'card_vault',
  'card_bp_neon_lane',
  'card_bp_strike',
  'card_bp_finale',
  // Battle Pass beta · season 1 (25-tier)
  'card_bp_s1_t3',
  'card_bp_s1_t13',
  'card_bp_epic',
  'card_bp_legendary',
  // Savvy / business progression
  'card_coupon_sniper',
  'card_stack_master',
  'card_savvy_saver',
  'card_hidden_discount',
  'card_deal_partner',
  'card_verified_buyer',
  'card_brand_insider',
  'card_savvy_affiliate',
  'first_in_last_out',
  // Exclusive · manual grant
  'card_savvy_creator',
  'card_viral_engine',
  'card_deal_amplifier',
  'card_system_architect',
  'card_savvy_core',
  'card_debug_king',
  'card_founders_circle',
  'card_savvy_elite',
  'card_the_signal',
  // Daily streak rewards
  'card_streak_30',
  'card_welcome_back',
  'card_legacy_loyalist',
  'card_founding_tester',
  'card_founding_beta',
  'card_beta_hunter',
  // Scout Flight World Championship
  'card_scout_flight_beta_champion',
  'card_scout_flight_monthly_champion',
  'card_scout_flight_seasonal_top10',
  // Perk Machine calling card drops
  'card_pm_signal_scout',
  'card_pm_deal_runner',
  'card_pm_neon_operator',
  'card_pm_gold_standard',
  'card_pm_apex_closer',
  'card_pm_jackpot_royalty',
  // Classified / Master Collection
  'card_master_classified',
]);

const TITLE_IDS = new Set(['title_operator', 'title_neon_hunter', 'title_closer']);

/**
 * Battle Pass beta · season 1 misc cosmetics (borders, banners, frames,
 * themes, skins, dialogue packs, badges, season boosts). Stored in the
 * cosmetic inventory as free-form unlock IDs.
 */
const BATTLE_PASS_S1_COSMETIC_IDS = new Set([
  'border_bp_s1',
  'banner_bp_s1',
  'frame_premium_s1',
  'theme_perk_neon',
  'skin_perk_s1',
  'skin_scout_premium',
  'dialogue_scout_s1',
  'badge_perk_animated',
  'badge_founder_animated',
  'badge_founding_tester',
  'badge_scout_flight_beta_participation',
  'badge_scout_flight_participation',
  'border_founding_beta',
  'boost_egg_slot_s1',
  // Classified / Master Collection entitlements
  'lobby_anim_master_classified',
]);

/**
 * Savvy Camo Locker apparel unlocks (`camo_<category>_<camo>_<rewardType>`).
 * Generated from the universal catalog so a new camo or category only needs a
 * config edit — never a change here.
 */
const CAMO_ITEM_IDS = new Set(require('../config/camoLocker').CAMO_ITEM_IDS);
const MASTER_CLASSIFIED_ITEM_IDS = new Set(
  require('../config/masterClassifiedCollection').MASTER_CLASSIFIED_ITEM_IDS
);

/** Role-based auto-unlocks (mirrors client adminCosmetics ROLE_AUTO_GRANTS). */
const ROLE_AUTO_GRANTS = {
  influencer: ['card_savvy_creator', 'sigil_savvy_creator'],
  developer: ['card_savvy_core', 'sigil_savvy_core'],
  dev: ['card_savvy_core', 'sigil_savvy_core'],
  superadmin: [
    'card_founders_circle',
    'sigil_founders_circle',
    'card_savvy_elite',
    'sigil_savvy_elite',
    'card_the_signal',
    'sigil_the_signal',
    'card_savvy_core',
    'sigil_savvy_core',
    'card_debug_king',
    'sigil_debug_king',
  ],
};

function isKnownCosmeticId(id) {
  return (
    EMBLEM_IDS.has(id) ||
    CALLING_CARD_IDS.has(id) ||
    TITLE_IDS.has(id) ||
    BATTLE_PASS_S1_COSMETIC_IDS.has(id) ||
    CAMO_ITEM_IDS.has(id) ||
    MASTER_CLASSIFIED_ITEM_IDS.has(id)
  );
}

function roleAutoUnlockIds(role) {
  const key = String(role || '').toLowerCase();
  return ROLE_AUTO_GRANTS[key] || [];
}

module.exports = {
  EMBLEM_IDS,
  CALLING_CARD_IDS,
  TITLE_IDS,
  BATTLE_PASS_S1_COSMETIC_IDS,
  CAMO_ITEM_IDS,
  ROLE_AUTO_GRANTS,
  isKnownCosmeticId,
  roleAutoUnlockIds,
};

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
]);

const TITLE_IDS = new Set(['title_operator', 'title_neon_hunter', 'title_closer']);

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
  return EMBLEM_IDS.has(id) || CALLING_CARD_IDS.has(id) || TITLE_IDS.has(id);
}

function roleAutoUnlockIds(role) {
  const key = String(role || '').toLowerCase();
  return ROLE_AUTO_GRANTS[key] || [];
}

module.exports = {
  EMBLEM_IDS,
  CALLING_CARD_IDS,
  TITLE_IDS,
  ROLE_AUTO_GRANTS,
  isKnownCosmeticId,
  roleAutoUnlockIds,
};

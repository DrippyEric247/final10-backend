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
]);

const TITLE_IDS = new Set(['title_operator', 'title_neon_hunter', 'title_closer']);

function isKnownCosmeticId(id) {
  return EMBLEM_IDS.has(id) || CALLING_CARD_IDS.has(id) || TITLE_IDS.has(id);
}

module.exports = { EMBLEM_IDS, CALLING_CARD_IDS, TITLE_IDS, isKnownCosmeticId };

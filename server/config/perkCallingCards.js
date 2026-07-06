/**
 * Perk Machine calling card drops.
 *
 * A spin that lands "Calling Card Drop" awards one specific card from this
 * weighted pool (server-authoritative). Owning it already converts the drop
 * into Savvy so the player is never given "nothing".
 *
 * IDs here MUST also exist in:
 *   - server/data/cosmeticIds.js  → CALLING_CARD_IDS (equip validation)
 *   - client/src/lib/customizationCatalog.js → CALLING_CARDS (art + reveal)
 */

const PERK_CALLING_CARD_DUPLICATE_SAVVY = 150;

const PERK_CALLING_CARDS = Object.freeze([
  {
    id: 'card_pm_signal_scout',
    name: 'Signal Scout',
    tagline: 'First to the drop, every time.',
    rarity: 'rare',
    weight: 26,
  },
  {
    id: 'card_pm_deal_runner',
    name: 'Deal Runner',
    tagline: 'Always one step ahead of the lane.',
    rarity: 'rare',
    weight: 24,
  },
  {
    id: 'card_pm_neon_operator',
    name: 'Neon Operator',
    tagline: 'Runs the board after dark.',
    rarity: 'epic',
    weight: 18,
  },
  {
    id: 'card_pm_gold_standard',
    name: 'Gold Standard',
    tagline: 'Set the bar. Then own it.',
    rarity: 'epic',
    weight: 16,
  },
  {
    id: 'card_pm_apex_closer',
    name: 'Apex Closer',
    tagline: 'Top of the board. End of the conversation.',
    rarity: 'legendary',
    weight: 9,
  },
  {
    id: 'card_pm_jackpot_royalty',
    name: 'Jackpot Royalty',
    tagline: 'The machine bows to you.',
    rarity: 'legendary',
    weight: 7,
  },
]);

const PERK_CALLING_CARD_BY_ID = Object.freeze(
  PERK_CALLING_CARDS.reduce((acc, card) => {
    acc[card.id] = card;
    return acc;
  }, {})
);

/** Weighted pick of a specific calling card for a spin drop. */
function pickPerkCallingCard(rng = Math.random) {
  const total = PERK_CALLING_CARDS.reduce((sum, c) => sum + c.weight, 0);
  if (total <= 0) return { ...PERK_CALLING_CARDS[0] };
  let roll = rng() * total;
  for (const card of PERK_CALLING_CARDS) {
    roll -= card.weight;
    if (roll <= 0) return { ...card };
  }
  return { ...PERK_CALLING_CARDS[PERK_CALLING_CARDS.length - 1] };
}

module.exports = {
  PERK_CALLING_CARDS,
  PERK_CALLING_CARD_BY_ID,
  PERK_CALLING_CARD_DUPLICATE_SAVVY,
  pickPerkCallingCard,
};

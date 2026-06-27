/**
 * Egg Exchange Chamber — fuse lower-tier eggs + Savvy into higher rarity.
 * NOT Pack-a-Punch (future season feature).
 */

const EXCHANGE_TYPES = Object.freeze([
  'rare_to_epic',
  'epic_to_legendary',
  'legendary_to_mythic',
]);

const EGG_EXCHANGE_RECIPES = Object.freeze({
  rare_to_epic: {
    exchangeType: 'rare_to_epic',
    fromTier: 'rare',
    toTier: 'epic',
    eggsRequired: 25,
    savvyRequired: 2500,
    title: 'Rare → Epic',
    icon: '🥚',
    outputLabel: 'Epic Egg',
  },
  epic_to_legendary: {
    exchangeType: 'epic_to_legendary',
    fromTier: 'epic',
    toTier: 'legendary',
    eggsRequired: 25,
    savvyRequired: 8000,
    title: 'Epic → Legendary',
    icon: '🥚',
    outputLabel: 'Legendary Egg',
  },
  legendary_to_mythic: {
    exchangeType: 'legendary_to_mythic',
    fromTier: 'legendary',
    toTier: 'mythic',
    eggsRequired: 10,
    savvyRequired: 20000,
    title: 'Legendary → Mythic',
    icon: '🥚',
    outputLabel: 'Mythic Egg',
  },
});

const EXCHANGE_COOLDOWN_MS = 4000;
const MAX_EXCHANGE_HISTORY = 50;

function getRecipe(exchangeType) {
  return EGG_EXCHANGE_RECIPES[String(exchangeType || '').trim()] || null;
}

module.exports = {
  EXCHANGE_TYPES,
  EGG_EXCHANGE_RECIPES,
  EXCHANGE_COOLDOWN_MS,
  MAX_EXCHANGE_HISTORY,
  getRecipe,
};

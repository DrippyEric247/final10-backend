/**
 * Egg Exchange config and option builder tests.
 */

const { EGG_EXCHANGE_RECIPES, getRecipe } = require('../config/eggExchangeConfig');
const { buildExchangeOption } = require('../services/eggExchangeService');

describe('eggExchangeConfig', () => {
  test('recipes match spec costs', () => {
    expect(EGG_EXCHANGE_RECIPES.rare_to_epic.eggsRequired).toBe(25);
    expect(EGG_EXCHANGE_RECIPES.rare_to_epic.savvyRequired).toBe(2500);
    expect(EGG_EXCHANGE_RECIPES.epic_to_legendary.savvyRequired).toBe(8000);
    expect(EGG_EXCHANGE_RECIPES.legendary_to_mythic.eggsRequired).toBe(10);
    expect(EGG_EXCHANGE_RECIPES.legendary_to_mythic.savvyRequired).toBe(20000);
  });

  test('getRecipe returns null for invalid type', () => {
    expect(getRecipe('invalid')).toBeNull();
  });
});

describe('buildExchangeOption', () => {
  test('canExchange when eggs and savvy sufficient', () => {
    const recipe = getRecipe('rare_to_epic');
    const opt = buildExchangeOption(recipe, { rare: 30, epic: 0 }, 3000);
    expect(opt.canExchange).toBe(true);
    expect(opt.progressPercent).toBe(100);
  });

  test('cannot exchange with insufficient eggs', () => {
    const recipe = getRecipe('legendary_to_mythic');
    const opt = buildExchangeOption(recipe, { legendary: 5 }, 25000);
    expect(opt.canExchange).toBe(false);
    expect(opt.missingEggs).toBe(5);
  });

  test('cannot exchange with insufficient savvy', () => {
    const recipe = getRecipe('rare_to_epic');
    const opt = buildExchangeOption(recipe, { rare: 25 }, 1000);
    expect(opt.canExchange).toBe(false);
    expect(opt.missingSavvy).toBe(1500);
  });
});

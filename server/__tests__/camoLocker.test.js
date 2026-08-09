const {
  CAMO_ITEMS,
  CAMO_ITEM_IDS,
  CAMO_CATEGORY_IDS,
  buildCamoItemId,
  getCamoItem,
  isCamoItemId,
  isKnownCamoItemId,
  evaluateCamoRequirement,
  toPercent,
} = require('../config/camoLocker');
const { isKnownCosmeticId } = require('../data/cosmeticIds');

describe('camo locker catalog', () => {
  test('generates the starter reward slots', () => {
    expect(CAMO_ITEMS).toHaveLength(36);
    expect(CAMO_CATEGORY_IDS).toEqual([
      'retail',
      'outdoor',
      'fitness',
      'automotive',
      'electronics',
      'luxury',
    ]);
  });

  test('item IDs are unique and stable', () => {
    expect(new Set(CAMO_ITEM_IDS).size).toBe(CAMO_ITEM_IDS.length);
    expect(buildCamoItemId('fitness', 'darkNebula', 'shorts')).toBe(
      'camo_fitness_dark-nebula_shorts'
    );
    expect(getCamoItem('camo_fitness_tiger_shorts')).toMatchObject({
      camo: 'tiger',
      category: 'fitness',
      rewardType: 'shorts',
      rarity: 'uncommon',
      threshold: 75,
    });
  });

  test('camo IDs are accepted by the shared cosmetic validator', () => {
    for (const id of CAMO_ITEM_IDS) {
      expect(isKnownCosmeticId(id)).toBe(true);
    }
    expect(isKnownCamoItemId('camo_fitness_tiger_pants')).toBe(false);
    expect(isCamoItemId('sigil_starter')).toBe(false);
  });

  test('unlock requires both the category count and every gate', () => {
    const item = getCamoItem('camo_fitness_tiger_shorts');

    const countOnly = evaluateCamoRequirement(item, {
      categoryCount: 75,
      metrics: { profileLevel: 1 },
    });
    expect(countOnly.progress).toBe(100);
    expect(countOnly.gatesMet).toBe(false);
    expect(countOnly.requirementsMet).toBe(false);

    const gateOnly = evaluateCamoRequirement(item, {
      categoryCount: 10,
      metrics: { profileLevel: 9 },
    });
    expect(gateOnly.gatesMet).toBe(true);
    expect(gateOnly.requirementsMet).toBe(false);

    const both = evaluateCamoRequirement(item, {
      categoryCount: 80,
      metrics: { profileLevel: 9 },
    });
    expect(both.requirementsMet).toBe(true);
    // Displayed progress never exceeds the target.
    expect(both.current).toBe(75);
  });

  test('progress percentages are clamped', () => {
    expect(toPercent(0, 350)).toBe(0);
    expect(toPercent(245, 350)).toBe(70);
    expect(toPercent(900, 350)).toBe(100);
    expect(toPercent(-5, 350)).toBe(0);
    expect(toPercent(5, 0)).toBe(100);
  });

  test('the first camo in every category is reachable without gates', () => {
    const starters = CAMO_ITEMS.filter((i) => i.camo === 'woodland');
    expect(starters).toHaveLength(6);
    for (const item of starters) {
      expect(item.gates).toHaveLength(0);
      expect(
        evaluateCamoRequirement(item, { categoryCount: item.threshold }).requirementsMet
      ).toBe(true);
    }
  });

  test('luxury shiesty ladder is complete woodland through dark nebula', () => {
    const luxury = CAMO_ITEMS.filter((i) => i.category === 'luxury').sort(
      (a, b) => a.order - b.order
    );
    expect(luxury).toHaveLength(6);
    expect(luxury.map((i) => i.id)).toEqual([
      'camo_luxury_woodland_shiesty',
      'camo_luxury_tiger_shiesty',
      'camo_luxury_arctic_shiesty',
      'camo_luxury_gold_shiesty',
      'camo_luxury_diamond_shiesty',
      'camo_luxury_dark-nebula_shiesty',
    ]);
    expect(luxury[5]).toMatchObject({
      camo: 'darkNebula',
      rewardType: 'shiesty',
      order: 6,
      threshold: 500,
      rarity: 'mythic',
    });
    expect(luxury[5].gates).toHaveLength(3);
  });
});

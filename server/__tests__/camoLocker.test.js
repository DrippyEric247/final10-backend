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
    expect(CAMO_ITEMS).toHaveLength(42);
    expect(CAMO_ITEMS.filter((i) => i.visibility === 'admin_owner')).toHaveLength(6);
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

  test('luxury shiesty ladder is complete woodland through dark nebula plus private nuke streak', () => {
    const luxury = CAMO_ITEMS.filter((i) => i.category === 'luxury' && i.rewardType === 'shiesty').sort(
      (a, b) => a.order - b.order
    );
    expect(luxury).toHaveLength(7);
    expect(luxury.map((i) => i.id)).toEqual([
      'camo_luxury_woodland_shiesty',
      'camo_luxury_tiger_shiesty',
      'camo_luxury_arctic_shiesty',
      'camo_luxury_gold_shiesty',
      'camo_luxury_diamond_shiesty',
      'camo_luxury_dark-nebula_shiesty',
      'camo_luxury_nuke-streak_shiesty',
    ]);
    expect(luxury[5]).toMatchObject({
      camo: 'darkNebula',
      rewardType: 'shiesty',
      order: 6,
      threshold: 500,
      rarity: 'mythic',
    });
    expect(luxury[5].gates).toHaveLength(3);
    expect(luxury[6]).toMatchObject({
      camo: 'nukeStreak',
      rewardType: 'shiesty',
      order: 7,
      visibility: 'admin_owner',
      grantOnly: true,
    });
    expect(luxury[6].gates).toHaveLength(0);
  });

  test('automotive gloves ladder is complete woodland through dark nebula plus private nuke gloves', () => {
    const automotiveGloves = CAMO_ITEMS.filter((i) => i.category === 'automotive').sort(
      (a, b) => a.order - b.order
    );
    expect(automotiveGloves).toHaveLength(7);
    expect(automotiveGloves.map((i) => i.id)).toEqual([
      'camo_automotive_woodland_gloves',
      'camo_automotive_tiger_gloves',
      'camo_automotive_arctic_gloves',
      'camo_automotive_gold_gloves',
      'camo_automotive_diamond_gloves',
      'camo_automotive_dark-nebula_gloves',
      'camo_automotive_nuke-streak_gloves',
    ]);
    expect(automotiveGloves[6]).toMatchObject({
      camo: 'nukeStreak',
      rewardType: 'gloves',
      order: 7,
      visibility: 'admin_owner',
      grantOnly: true,
    });
  });

  test('electronics socks ladder is complete woodland through dark nebula plus private nuke socks', () => {
    const electronicsSocks = CAMO_ITEMS.filter((i) => i.category === 'electronics').sort(
      (a, b) => a.order - b.order
    );
    expect(electronicsSocks).toHaveLength(7);
    expect(electronicsSocks.map((i) => i.id)).toEqual([
      'camo_electronics_woodland_socks',
      'camo_electronics_tiger_socks',
      'camo_electronics_arctic_socks',
      'camo_electronics_gold_socks',
      'camo_electronics_diamond_socks',
      'camo_electronics_dark-nebula_socks',
      'camo_electronics_nuke-streak_socks',
    ]);
    expect(electronicsSocks[6]).toMatchObject({
      camo: 'nukeStreak',
      rewardType: 'socks',
      order: 7,
      visibility: 'admin_owner',
      grantOnly: true,
    });
  });

  test('retail t-shirt ladder is complete woodland through dark nebula plus private nuke streak', () => {
    const retailTshirts = CAMO_ITEMS.filter(
      (i) => i.category === 'retail' && i.rewardType === 'tshirt'
    ).sort((a, b) => a.order - b.order);
    expect(retailTshirts).toHaveLength(7);
    expect(retailTshirts.map((i) => i.id)).toEqual([
      'camo_retail_woodland_tshirt',
      'camo_retail_tiger_tshirt',
      'camo_retail_arctic_tshirt',
      'camo_retail_gold_tshirt',
      'camo_retail_diamond_tshirt',
      'camo_retail_dark-nebula_tshirt',
      'camo_retail_nuke-streak_tshirt',
    ]);
    expect(retailTshirts[6]).toMatchObject({
      camo: 'nukeStreak',
      rewardType: 'tshirt',
      order: 7,
      visibility: 'admin_owner',
      grantOnly: true,
    });
  });

  test('retail hoodie is private nuke streak only', () => {
    const retailHoodies = CAMO_ITEMS.filter(
      (i) => i.category === 'retail' && i.rewardType === 'hoodie'
    );
    expect(retailHoodies).toHaveLength(1);
    expect(retailHoodies[0]).toMatchObject({
      id: 'camo_retail_nuke-streak_hoodie',
      camo: 'nukeStreak',
      rewardType: 'hoodie',
      order: 7,
      visibility: 'admin_owner',
      grantOnly: true,
    });
  });

  test('fitness shorts ladder is complete woodland through dark nebula plus private nuke streak', () => {
    const fitnessShorts = CAMO_ITEMS.filter((i) => i.category === 'fitness').sort(
      (a, b) => a.order - b.order
    );
    expect(fitnessShorts).toHaveLength(7);
    expect(fitnessShorts.map((i) => i.id)).toEqual([
      'camo_fitness_woodland_shorts',
      'camo_fitness_tiger_shorts',
      'camo_fitness_arctic_shorts',
      'camo_fitness_gold_shorts',
      'camo_fitness_diamond_shorts',
      'camo_fitness_dark-nebula_shorts',
      'camo_fitness_nuke-streak_shorts',
    ]);
    expect(fitnessShorts[6]).toMatchObject({
      camo: 'nukeStreak',
      rewardType: 'shorts',
      order: 7,
      visibility: 'admin_owner',
      grantOnly: true,
    });
  });
});

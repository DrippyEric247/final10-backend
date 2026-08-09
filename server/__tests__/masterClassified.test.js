const {
  MASTER_CLASSIFIED_ITEM_IDS,
  MASTER_REQUIRED_CAMO_IDS,
  isMasterClassifiedEligible,
  evaluateMasterCamoProgress,
  summarizeMasterClassifiedCollection,
  listMasterRequiredItemsForCamo,
} = require('../config/masterClassifiedCollection');
const { CAMO_ITEMS } = require('../config/camoLocker');

describe('Master Classified Collection', () => {
  test('registers ten master outfit item IDs', () => {
    expect(MASTER_CLASSIFIED_ITEM_IDS).toHaveLength(10);
    expect(MASTER_CLASSIFIED_ITEM_IDS).toContain('master_classified_hat');
    expect(MASTER_CLASSIFIED_ITEM_IDS).toContain('master_classified_custom_shoe_ticket');
  });

  test('requires six public camo families excluding nuke', () => {
    expect(MASTER_REQUIRED_CAMO_IDS).toEqual([
      'woodland',
      'tiger',
      'arctic',
      'gold',
      'diamond',
      'darkNebula',
    ]);
    expect(MASTER_REQUIRED_CAMO_IDS).not.toContain('nukeStreak');
  });

  test('master eligibility uses only public non-grant camo items', () => {
    for (const camoId of MASTER_REQUIRED_CAMO_IDS) {
      const items = listMasterRequiredItemsForCamo(camoId);
      expect(items.length).toBeGreaterThan(0);
      for (const item of items) {
        expect(item.camo).toBe(camoId);
        expect(item.visibility).toBe('public');
        expect(item.grantOnly).not.toBe(true);
        expect(item.camo).not.toBe('nukeStreak');
      }
    }
  });

  test('isMasterClassifiedEligible true only when every family is complete', () => {
    const allPublicIds = CAMO_ITEMS.filter(
      (i) => i.visibility === 'public' && !i.grantOnly
    ).map((i) => i.id);
    expect(isMasterClassifiedEligible(allPublicIds)).toBe(true);

    const woodlandOnly = listMasterRequiredItemsForCamo('woodland').map((i) => i.id);
    expect(isMasterClassifiedEligible(woodlandOnly)).toBe(false);
  });

  test('summarizeMasterClassifiedCollection reports mastered when eligible and items owned', () => {
    const camoIds = CAMO_ITEMS.filter((i) => i.visibility === 'public' && !i.grantOnly).map(
      (i) => i.id
    );
    const summary = summarizeMasterClassifiedCollection({
      camoUnlockedIds: camoIds,
      masterUnlockedIds: MASTER_CLASSIFIED_ITEM_IDS,
    });
    expect(summary.eligible).toBe(true);
    expect(summary.mastered).toBe(true);
    expect(summary.status).toBe('MASTERED');
  });

  test('evaluateMasterCamoProgress matches unlocked IDs', () => {
    const woodlandIds = listMasterRequiredItemsForCamo('woodland').map((i) => i.id);
    const rows = evaluateMasterCamoProgress(woodlandIds);
    const woodlandRow = rows.find((r) => r.camoId === 'woodland');
    expect(woodlandRow.complete).toBe(true);
    expect(rows.find((r) => r.camoId === 'tiger').complete).toBe(false);
  });
});

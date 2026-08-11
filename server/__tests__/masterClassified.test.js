const {
  MASTER_CLASSIFIED_ITEM_IDS,
  MASTER_REQUIRED_CAMO_IDS,
  MASTER_CLASSIFIED_ITEMS,
  isMasterClassifiedEligible,
  evaluateMasterCamoProgress,
  summarizeMasterClassifiedCollection,
  listMasterRequiredItemsForCamo,
} = require('../config/masterClassifiedCollection');
const { CAMO_ITEMS } = require('../config/camoLocker');
const {
  canAccessClassifiedAdminPreview,
} = require('../services/masterClassifiedService');

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

  test('canAccessClassifiedAdminPreview allows admin roles only', () => {
    expect(canAccessClassifiedAdminPreview({ role: 'admin', email: 'admin@example.com' })).toBe(true);
    expect(canAccessClassifiedAdminPreview({ role: 'superadmin', email: 'owner@example.com' })).toBe(true);
    expect(canAccessClassifiedAdminPreview({ role: 'user', email: 'ericvasquez012@gmail.com' })).toBe(true);
    expect(canAccessClassifiedAdminPreview({ role: 'user', email: 'player@example.com' })).toBe(false);
    expect(canAccessClassifiedAdminPreview(null)).toBe(false);
  });

  test('every master item has a configured asset path', () => {
    expect(MASTER_CLASSIFIED_ITEMS).toHaveLength(10);
    for (const item of MASTER_CLASSIFIED_ITEMS) {
      expect(item.assetPath).toMatch(/^\/assets\/classified\//);
    }
  });

  test('master gloves use fusion weave metadata and official artwork path', () => {
    const gloves = MASTER_CLASSIFIED_ITEMS.find((i) => i.id === 'master_classified_gloves');
    expect(gloves).toMatchObject({
      slug: 'master-gloves',
      name: 'MASTER GLOVES',
      assetPath: '/assets/classified/master-gloves.jpeg',
      camo: 'fusion-weave',
      camoName: 'FUSION WEAVE',
      previewWhenLocked: true,
      earnedNotBought: true,
      unlockRequirementLabel: 'CLASSIFIED REQUIREMENT',
    });
  });

  test('master gloves are separate from automotive nuke gloves', () => {
    const nukeGloves = CAMO_ITEMS.find((i) => i.id === 'camo_automotive_nuke-streak_gloves');
    expect(nukeGloves).toBeTruthy();
    expect(nukeGloves.camo).toBe('nukeStreak');
    expect(MASTER_CLASSIFIED_ITEM_IDS).toContain('master_classified_gloves');
    expect(MASTER_CLASSIFIED_ITEM_IDS).not.toContain(nukeGloves.id);
  });
});

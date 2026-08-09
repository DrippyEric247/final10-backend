const {
  canAccessNukeCollection,
  isNukeCollectionReleased,
  stripNukeFromRecord,
} = require('../services/nukeAccessService');
const {
  NUKE_COLLECTION_ID,
  NUKE_NEAR_THRESHOLD,
  deriveNukeProgressStatus,
  isNukeCamoItemId,
  isNukeRequirementId,
} = require('../config/nukeCollection');
const { CAMO_CATALOG_VERSION } = require('../config/camoLocker');

describe('Nuke Collection foundation', () => {
  test('catalog version bumped for secret nuke category', () => {
    expect(CAMO_CATALOG_VERSION).toBe(15);
  });

  test('normal user cannot access nuke collection', () => {
    expect(canAccessNukeCollection({ role: 'user', email: 'player@example.com' })).toBe(false);
    expect(canAccessNukeCollection(null)).toBe(false);
  });

  test('admin and founder can access nuke collection', () => {
    expect(canAccessNukeCollection({ role: 'admin', email: 'admin@example.com' })).toBe(true);
    expect(
      canAccessNukeCollection({ role: 'user', email: 'ericvasquez012@gmail.com' })
    ).toBe(true);
  });

  test('nuke collection is unreleased by default', () => {
    expect(isNukeCollectionReleased()).toBe(false);
  });

  test('stripNukeFromRecord removes nuke category keys', () => {
    expect(stripNukeFromRecord({ retail: 5, [NUKE_COLLECTION_ID]: 99 })).toEqual({ retail: 5 });
  });

  test('near completion threshold at 80%', () => {
    expect(
      deriveNukeProgressStatus({
        currentValue: 800,
        targetValue: 1000,
        nearThreshold: NUKE_NEAR_THRESHOLD,
      })
    ).toBe('near_completion');
    expect(
      deriveNukeProgressStatus({
        currentValue: 1000,
        targetValue: 1000,
      })
    ).toBe('qualified');
  });

  test('nuke item and requirement id helpers', () => {
    expect(isNukeCamoItemId('camo_nuke_woodland_tshirt')).toBe(true);
    expect(isNukeCamoItemId('camo_retail_woodland_tshirt')).toBe(false);
    expect(isNukeRequirementId('nuke_mastery_core')).toBe(true);
    expect(isNukeRequirementId('unknown')).toBe(false);
  });
});

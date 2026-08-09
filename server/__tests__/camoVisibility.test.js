const { CAMO_ITEMS } = require('../config/camoLocker');
const {
  isAdminOwnerOnlyItem,
  canViewCamoItem,
  filterCamoItemsForUser,
  filterVisibleItemIdsForUser,
} = require('../services/camoVisibilityService');

const NUKE_MASK_ID = 'camo_luxury_nuke-streak_shiesty';
const NUKE_GLOVES_ID = 'camo_automotive_nuke-streak_gloves';
const NUKE_SOCKS_ID = 'camo_electronics_nuke-streak_socks';
const NUKE_TSHIRT_ID = 'camo_retail_nuke-streak_tshirt';
const NUKE_HOODIE_ID = 'camo_retail_nuke-streak_hoodie';
const NUKE_SHORTS_ID = 'camo_fitness_nuke-streak_shorts';
const PUBLIC_ID = 'camo_luxury_woodland_shiesty';

describe('camo visibility (admin_owner)', () => {
  test('nuke streak shiesty is admin_owner only', () => {
    const item = CAMO_ITEMS.find((i) => i.id === NUKE_MASK_ID);
    expect(item).toBeTruthy();
    expect(isAdminOwnerOnlyItem(item)).toBe(true);
    expect(isAdminOwnerOnlyItem(PUBLIC_ID)).toBe(false);
  });

  test('nuke gloves are admin_owner only', () => {
    const item = CAMO_ITEMS.find((i) => i.id === NUKE_GLOVES_ID);
    expect(item).toBeTruthy();
    expect(isAdminOwnerOnlyItem(item)).toBe(true);
  });

  test('nuke socks are admin_owner only', () => {
    const item = CAMO_ITEMS.find((i) => i.id === NUKE_SOCKS_ID);
    expect(item).toBeTruthy();
    expect(isAdminOwnerOnlyItem(item)).toBe(true);
  });

  test('nuke streak t-shirt is admin_owner only', () => {
    const item = CAMO_ITEMS.find((i) => i.id === NUKE_TSHIRT_ID);
    expect(item).toBeTruthy();
    expect(isAdminOwnerOnlyItem(item)).toBe(true);
  });

  test('nuke streak shorts are admin_owner only', () => {
    const item = CAMO_ITEMS.find((i) => i.id === NUKE_SHORTS_ID);
    expect(item).toBeTruthy();
    expect(isAdminOwnerOnlyItem(item)).toBe(true);
  });

  test('nuke hoodie is admin_owner only', () => {
    const item = CAMO_ITEMS.find((i) => i.id === NUKE_HOODIE_ID);
    expect(item).toBeTruthy();
    expect(isAdminOwnerOnlyItem(item)).toBe(true);
  });

  test('normal users cannot view private camo items', () => {
    const normal = { role: 'user', email: 'player@example.com', _id: '507f1f77bcf86cd799439011' };
    expect(canViewCamoItem(normal, NUKE_MASK_ID)).toBe(false);
    expect(canViewCamoItem(normal, NUKE_GLOVES_ID)).toBe(false);
    expect(canViewCamoItem(normal, NUKE_SOCKS_ID)).toBe(false);
    expect(canViewCamoItem(normal, NUKE_TSHIRT_ID)).toBe(false);
    expect(canViewCamoItem(normal, NUKE_HOODIE_ID)).toBe(false);
    expect(canViewCamoItem(normal, NUKE_SHORTS_ID)).toBe(false);
    expect(canViewCamoItem(normal, PUBLIC_ID)).toBe(true);
  });

  test('admin and founder can view private camo items', () => {
    const admin = { role: 'admin', email: 'admin@example.com', _id: '507f1f77bcf86cd799439012' };
    const founder = { role: 'user', email: 'ericvasquez012@gmail.com', _id: '507f1f77bcf86cd799439013' };
    expect(canViewCamoItem(admin, NUKE_MASK_ID)).toBe(true);
    expect(canViewCamoItem(founder, NUKE_MASK_ID)).toBe(true);
    expect(canViewCamoItem(admin, NUKE_GLOVES_ID)).toBe(true);
    expect(canViewCamoItem(founder, NUKE_GLOVES_ID)).toBe(true);
    expect(canViewCamoItem(admin, NUKE_SOCKS_ID)).toBe(true);
    expect(canViewCamoItem(founder, NUKE_SOCKS_ID)).toBe(true);
    expect(canViewCamoItem(admin, NUKE_TSHIRT_ID)).toBe(true);
    expect(canViewCamoItem(founder, NUKE_TSHIRT_ID)).toBe(true);
    expect(canViewCamoItem(admin, NUKE_HOODIE_ID)).toBe(true);
    expect(canViewCamoItem(founder, NUKE_HOODIE_ID)).toBe(true);
    expect(canViewCamoItem(admin, NUKE_SHORTS_ID)).toBe(true);
    expect(canViewCamoItem(founder, NUKE_SHORTS_ID)).toBe(true);
  });

  test('filterCamoItemsForUser hides nuke rewards from public locker payloads', () => {
    const normal = { role: 'user', email: 'player@example.com', _id: '507f1f77bcf86cd799439011' };
    const admin = { role: 'admin', email: 'admin@example.com', _id: '507f1f77bcf86cd799439012' };
    const publicItems = filterCamoItemsForUser(CAMO_ITEMS, normal);
    const adminItems = filterCamoItemsForUser(CAMO_ITEMS, admin);
    expect(publicItems).toHaveLength(36);
    expect(adminItems).toHaveLength(42);
    expect(publicItems.filter((i) => i.visibility === 'admin_owner')).toHaveLength(0);
    expect(publicItems.some((i) => i.id === NUKE_MASK_ID)).toBe(false);
    expect(publicItems.some((i) => i.id === NUKE_GLOVES_ID)).toBe(false);
    expect(publicItems.some((i) => i.id === NUKE_SOCKS_ID)).toBe(false);
    expect(publicItems.some((i) => i.id === NUKE_TSHIRT_ID)).toBe(false);
    expect(publicItems.some((i) => i.id === NUKE_HOODIE_ID)).toBe(false);
    expect(publicItems.some((i) => i.id === NUKE_SHORTS_ID)).toBe(false);
    expect(adminItems.some((i) => i.id === NUKE_MASK_ID)).toBe(true);
    expect(adminItems.some((i) => i.id === NUKE_GLOVES_ID)).toBe(true);
    expect(adminItems.some((i) => i.id === NUKE_SOCKS_ID)).toBe(true);
    expect(adminItems.some((i) => i.id === NUKE_TSHIRT_ID)).toBe(true);
    expect(adminItems.some((i) => i.id === NUKE_HOODIE_ID)).toBe(true);
    expect(adminItems.some((i) => i.id === NUKE_SHORTS_ID)).toBe(true);
  });

  test('filterVisibleItemIdsForUser strips private IDs from cosmetic payloads', () => {
    const normal = { role: 'user', email: 'player@example.com', _id: '507f1f77bcf86cd799439011' };
    const filtered = filterVisibleItemIdsForUser(
      [PUBLIC_ID, NUKE_MASK_ID, NUKE_GLOVES_ID, NUKE_SOCKS_ID, NUKE_TSHIRT_ID, NUKE_HOODIE_ID, NUKE_SHORTS_ID],
      normal
    );
    expect(filtered).toEqual([PUBLIC_ID]);
  });
});

/**
 * Centralized camo item visibility — admin/owner-only rewards must never
 * leak through locker APIs, search, counts, or direct item access.
 */

const { getCamoItem } = require('../config/camoLocker');
const { canAccessNukeCollection, denyNukeNotFound } = require('./nukeAccessService');

const ADMIN_OWNER_VISIBILITY = 'admin_owner';

function resolveItem(itemOrId) {
  if (!itemOrId) return null;
  return typeof itemOrId === 'string' ? getCamoItem(itemOrId) : itemOrId;
}

/** True when the item is hidden from normal users until released. */
function isAdminOwnerOnlyItem(itemOrId) {
  const item = resolveItem(itemOrId);
  return item?.visibility === ADMIN_OWNER_VISIBILITY;
}

/**
 * Whether this user may see a private catalog item in locker payloads.
 * Reuses the same admin/founder/owner gate as the Nuke Collection preview.
 */
function canViewCamoItem(user, itemOrId) {
  if (!isAdminOwnerOnlyItem(itemOrId)) return true;
  return canAccessNukeCollection(user);
}

function filterCamoItemsForUser(items, user) {
  return (items || []).filter((item) => canViewCamoItem(user, item));
}

/** Strip private camo IDs from generic cosmetic inventory payloads. */
function filterVisibleItemIdsForUser(itemIds, user) {
  return (itemIds || []).filter((id) => canViewCamoItem(user, id));
}

/** Hard deny — returns 404 so existence is not leaked. */
function assertCanViewCamoItem(user, itemOrId) {
  if (!canViewCamoItem(user, itemOrId)) throw denyNukeNotFound();
}

module.exports = {
  ADMIN_OWNER_VISIBILITY,
  isAdminOwnerOnlyItem,
  canViewCamoItem,
  filterCamoItemsForUser,
  filterVisibleItemIdsForUser,
  assertCanViewCamoItem,
};

/**
 * Fast owner-panel user lookup — indexed equality on email or username only.
 * No regex scans, no ObjectId $or, no background jobs.
 */

const OWNER_SEARCH_LIMIT = 10;
const OWNER_SEARCH_MAX_TIME_MS = 4500;

const OWNER_SEARCH_SELECT =
  'username email role membershipTier isPremium points savvyPoints pointsBalance lifetimePointsEarned subscriptionExpires createdAt lastActive betaTester foundingAccess betaAccessExpiresAt';

/**
 * @param {string} rawQuery
 * @returns {{ email: string } | { username: string } | null}
 */
function buildFastOwnerUserSearchFilter(rawQuery) {
  const query = String(rawQuery || '').trim();
  if (!query) return null;

  if (query.includes('@')) {
    return { email: query.toLowerCase() };
  }

  return { username: query };
}

/**
 * Indexed find by exact email or username (case-insensitive username via collation).
 * @param {import('mongoose').Model} User
 * @param {string} rawQuery
 */
async function findOwnerUsersFast(User, rawQuery) {
  const filter = buildFastOwnerUserSearchFilter(rawQuery);
  if (!filter) return [];

  const base = User.find(filter)
    .select(OWNER_SEARCH_SELECT)
    .limit(OWNER_SEARCH_LIMIT)
    .maxTimeMS(OWNER_SEARCH_MAX_TIME_MS)
    .lean();

  if (filter.email) {
    return base;
  }

  return base.collation({ locale: 'en', strength: 2 });
}

module.exports = {
  OWNER_SEARCH_LIMIT,
  OWNER_SEARCH_SELECT,
  OWNER_SEARCH_MAX_TIME_MS,
  buildFastOwnerUserSearchFilter,
  findOwnerUsersFast,
  /** @deprecated use buildFastOwnerUserSearchFilter */
  buildOwnerUserSearchFilter: buildFastOwnerUserSearchFilter,
};

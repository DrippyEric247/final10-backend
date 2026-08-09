/**
 * Server-side Nuke Collection access control.
 * Never rely on client-only hiding — all Nuke APIs must call these checks.
 */

const { isFounderAdminEmail } = require('../lib/founderAdminAccess');
const {
  NUKE_COLLECTION,
  NUKE_COLLECTION_ID,
} = require('../config/nukeCollection');

/** Comma-separated stable Mongo user IDs from env. */
function envAllowedUserIds() {
  const raw = String(process.env.NUKE_FOUNDER_USER_IDS || process.env.NUKE_FOUNDER_USER_ID || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return raw;
}

function resolveAllowedUserIds() {
  const fromEnv = envAllowedUserIds();
  const fromConfig = NUKE_COLLECTION.allowedUserIds || [];
  return [...new Set([...fromConfig, ...fromEnv])];
}

/**
 * @param {object|null|undefined} user Mongoose doc or lean user with _id, role, email
 */
function canAccessNukeCollection(user) {
  if (!user) return false;
  const role = String(user.role || '').toLowerCase();
  const allowedRoles = (NUKE_COLLECTION.allowedRoles || []).map((r) => r.toLowerCase());
  if (allowedRoles.includes(role)) return true;
  if (isFounderAdminEmail(user.email)) return true;
  const userId = String(user._id || user.id || '');
  if (userId && resolveAllowedUserIds().includes(userId)) return true;
  return false;
}

/** Hard deny for public endpoints — returns 404 to avoid leaking existence. */
function denyNukeNotFound() {
  const err = new Error('Not found');
  err.status = 404;
  err.code = 'NOT_FOUND';
  return err;
}

function assertNukeCollectionAccess(user) {
  if (!canAccessNukeCollection(user)) throw denyNukeNotFound();
}

function isNukeCollectionReleased() {
  return NUKE_COLLECTION.releaseStatus === 'active';
}

/** Strip nuke category keys from a plain object (category progress, etc.). */
function stripNukeFromRecord(record) {
  if (!record || typeof record !== 'object') return record;
  const out = { ...record };
  delete out[NUKE_COLLECTION_ID];
  return out;
}

module.exports = {
  canAccessNukeCollection,
  assertNukeCollectionAccess,
  denyNukeNotFound,
  isNukeCollectionReleased,
  resolveAllowedUserIds,
  stripNukeFromRecord,
};

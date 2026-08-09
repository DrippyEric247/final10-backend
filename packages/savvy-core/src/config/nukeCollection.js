/**
 * Nuke Collection — secret/unreleased Camo Locker collection infrastructure.
 *
 * Pure data + helpers. No network, no DOM. Server mirror:
 * `server/config/nukeCollection.js`
 *
 * @module @savvy/core/config/nukeCollection
 */

/** Bump when requirements/visibility change. */
export const NUKE_COLLECTION_VERSION = 1;

/** Internal collection identifier. */
export const NUKE_COLLECTION_ID = 'nuke';

/** Configurable near-completion threshold (0–1). */
export const NUKE_NEAR_THRESHOLD = 0.8;

/** Progress row statuses. */
export const NUKE_PROGRESS_STATUSES = Object.freeze([
  'not_started',
  'in_progress',
  'near_completion',
  'qualified',
  'unlocked',
  'flagged',
]);

/** Append-only audit event types. */
export const NUKE_EVENT_TYPES = Object.freeze([
  'NUKE_PROGRESS_STARTED',
  'NUKE_PROGRESS_UPDATED',
  'NUKE_NEAR_COMPLETION',
  'NUKE_REQUIREMENT_COMPLETED',
  'NUKE_QUALIFIED',
  'NUKE_UNLOCK_GRANTED',
  'NUKE_UNLOCK_REVOKED',
  'NUKE_PROGRESS_FLAGGED',
  'NUKE_ADMIN_OVERRIDE',
]);

/** Eligibility labels shown in admin player detail. */
export const NUKE_ELIGIBILITY = Object.freeze({
  NOT_ELIGIBLE: 'NOT ELIGIBLE',
  IN_PROGRESS: 'IN PROGRESS',
  NEAR_NUKE: 'NEAR NUKE',
  QUALIFIED: 'QUALIFIED',
  UNLOCKED: 'UNLOCKED',
  FLAGGED: 'FLAGGED',
});

/**
 * Secret collection definition. Items are added later via catalog `camoIds`
 * + `rewardType` once art and requirements are finalized.
 */
export const NUKE_COLLECTION = Object.freeze({
  id: NUKE_COLLECTION_ID,
  name: 'Nuke Collection',
  icon: '☢️',
  accentColor: '#a3e635',
  accentColorAlt: '#3f6212',
  blurb: 'The endgame. Not public. Not easy. Not for everyone.',
  activityLabel: 'Nuke Qualifying Actions',
  visibility: 'secret',
  releaseStatus: 'unreleased',
  allowedRoles: Object.freeze(['admin', 'superadmin']),
  /** Stable user IDs — server resolves founder email → ID at runtime when unset. */
  allowedUserIds: Object.freeze([]),
  /** Future reward types this collection may host (not populated until art ships). */
  plannedRewardTypes: Object.freeze([
    'tshirt',
    'hoodie',
    'gloves',
    'socks',
    'shiesty',
    'shorts',
    'pants',
    'jacket',
    'hat',
  ]),
});

/**
 * Requirement scaffolding — no rewards wired yet. Progress is tracked against
 * these IDs from authoritative server events only.
 */
export const NUKE_REQUIREMENTS = Object.freeze([
  Object.freeze({
    id: 'nuke_mastery_core',
    name: 'Nuke Mastery Core',
    description:
      'Placeholder mastery requirement. Wire to authoritative metrics when Nuke rewards ship.',
    targetValue: 1000,
    order: 1,
    metricKey: 'nukeQualifyingActions',
  }),
]);

const REQUIREMENTS_BY_ID = Object.freeze(
  NUKE_REQUIREMENTS.reduce((acc, req) => {
    acc[req.id] = req;
    return acc;
  }, /** @type {Record<string, typeof NUKE_REQUIREMENTS[number]>} */ ({}))
);

export function getNukeRequirement(requirementId) {
  return REQUIREMENTS_BY_ID[requirementId] || null;
}

export function isNukeRequirementId(id) {
  return typeof id === 'string' && Boolean(REQUIREMENTS_BY_ID[id]);
}

/** True when a category belongs to the secret Nuke collection. */
export function isNukeCollectionCategory(categoryId) {
  return categoryId === NUKE_COLLECTION_ID;
}

/** True when a camo item ID belongs to the Nuke collection (`camo_nuke_*`). */
export function isNukeCamoItemId(itemId) {
  return typeof itemId === 'string' && itemId.startsWith('camo_nuke_');
}

/**
 * Derive progress status from current/target values and flags.
 * @param {object} params
 * @param {number} params.currentValue
 * @param {number} params.targetValue
 * @param {boolean} [params.unlocked]
 * @param {boolean} [params.flagged]
 * @param {number} [params.nearThreshold]
 */
export function deriveNukeProgressStatus({
  currentValue,
  targetValue,
  unlocked = false,
  flagged = false,
  nearThreshold = NUKE_NEAR_THRESHOLD,
}) {
  if (flagged) return 'flagged';
  if (unlocked) return 'unlocked';
  const target = Math.max(1, Number(targetValue) || 1);
  const current = Math.max(0, Number(currentValue) || 0);
  const ratio = current / target;
  if (ratio >= 1) return 'qualified';
  if (ratio >= nearThreshold) return 'near_completion';
  if (current > 0) return 'in_progress';
  return 'not_started';
}

/**
 * Map progress status to admin eligibility label.
 * @param {string} status
 */
export function nukeEligibilityFromStatus(status) {
  switch (status) {
    case 'unlocked':
      return NUKE_ELIGIBILITY.UNLOCKED;
    case 'qualified':
      return NUKE_ELIGIBILITY.QUALIFIED;
    case 'near_completion':
      return NUKE_ELIGIBILITY.NEAR_NUKE;
    case 'flagged':
      return NUKE_ELIGIBILITY.FLAGGED;
    case 'in_progress':
      return NUKE_ELIGIBILITY.IN_PROGRESS;
    default:
      return NUKE_ELIGIBILITY.NOT_ELIGIBLE;
  }
}

export function nukeProgressPercent(currentValue, targetValue) {
  const target = Math.max(1, Number(targetValue) || 1);
  const current = Math.max(0, Number(currentValue) || 0);
  return Math.max(0, Math.min(100, Math.round((current / target) * 100)));
}

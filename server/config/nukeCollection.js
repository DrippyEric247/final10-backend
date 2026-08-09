/**
 * Nuke Collection — server mirror of @savvy/core/config/nukeCollection.js
 */

const NUKE_COLLECTION_VERSION = 1;
const NUKE_COLLECTION_ID = 'nuke';
const NUKE_NEAR_THRESHOLD = 0.8;

const NUKE_PROGRESS_STATUSES = Object.freeze([
  'not_started',
  'in_progress',
  'near_completion',
  'qualified',
  'unlocked',
  'flagged',
]);

const NUKE_EVENT_TYPES = Object.freeze([
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

const NUKE_ELIGIBILITY = Object.freeze({
  NOT_ELIGIBLE: 'NOT ELIGIBLE',
  IN_PROGRESS: 'IN PROGRESS',
  NEAR_NUKE: 'NEAR NUKE',
  QUALIFIED: 'QUALIFIED',
  UNLOCKED: 'UNLOCKED',
  FLAGGED: 'FLAGGED',
});

const NUKE_COLLECTION = Object.freeze({
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
  allowedUserIds: Object.freeze([]),
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

const NUKE_REQUIREMENTS = Object.freeze([
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
  }, {})
);

function getNukeRequirement(requirementId) {
  return REQUIREMENTS_BY_ID[requirementId] || null;
}

function isNukeRequirementId(id) {
  return typeof id === 'string' && Boolean(REQUIREMENTS_BY_ID[id]);
}

function isNukeCollectionCategory(categoryId) {
  return categoryId === NUKE_COLLECTION_ID;
}

function isNukeCamoItemId(itemId) {
  return typeof itemId === 'string' && itemId.startsWith('camo_nuke_');
}

function deriveNukeProgressStatus({
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

function nukeEligibilityFromStatus(status) {
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

function nukeProgressPercent(currentValue, targetValue) {
  const target = Math.max(1, Number(targetValue) || 1);
  const current = Math.max(0, Number(currentValue) || 0);
  return Math.max(0, Math.min(100, Math.round((current / target) * 100)));
}

module.exports = {
  NUKE_COLLECTION_VERSION,
  NUKE_COLLECTION_ID,
  NUKE_NEAR_THRESHOLD,
  NUKE_PROGRESS_STATUSES,
  NUKE_EVENT_TYPES,
  NUKE_ELIGIBILITY,
  NUKE_COLLECTION,
  NUKE_REQUIREMENTS,
  getNukeRequirement,
  isNukeRequirementId,
  isNukeCollectionCategory,
  isNukeCamoItemId,
  deriveNukeProgressStatus,
  nukeEligibilityFromStatus,
  nukeProgressPercent,
};

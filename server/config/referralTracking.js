/**
 * Emergency referral audit trail — expected manual-grant amount during beta.
 * Separate from live REFERRAL_SAVVY_REFERRER auto-grant amounts.
 */
const REFERRAL_TRACKING_POINTS_EXPECTED = Number(
  process.env.REFERRAL_TRACKING_POINTS_EXPECTED || 5000
);

const REFERRAL_TRACKING_COOKIE = 'f10_referral_code';

const REFERRAL_TRACKING_EVENT_TYPES = Object.freeze([
  'LINK_VISIT',
  'SIGNUP_STARTED',
  'SIGNUP_COMPLETED',
  'POINT_GRANT_ATTEMPT',
  'POINT_GRANT_SUCCESS',
  'POINT_GRANT_FAILED',
]);

const REFERRAL_TRACKING_GRANT_STATUSES = Object.freeze([
  'pending',
  'success',
  'failed',
  'manual_needed',
]);

module.exports = {
  REFERRAL_TRACKING_POINTS_EXPECTED,
  REFERRAL_TRACKING_COOKIE,
  REFERRAL_TRACKING_EVENT_TYPES,
  REFERRAL_TRACKING_GRANT_STATUSES,
};

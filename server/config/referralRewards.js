/**
 * Referral reward amounts (Savvy wallet via savvyBalanceService).
 * Legacy env REFERRAL_POINTS is honored as referrer default when REFERRAL_SAVVY_REFERRER unset.
 */
const REFERRAL_SAVVY_REFERRER = Number(
  process.env.REFERRAL_SAVVY_REFERRER || process.env.REFERRAL_POINTS || 250
);
const REFERRAL_SAVVY_REFEREE = Number(process.env.REFERRAL_SAVVY_REFEREE || 50);
const REFERRAL_DAILY_CAP = Number(process.env.REFERRAL_DAILY_CAP || 10);

/** Reserved marketing code — signup perks only, not a user referrer. */
const WELCOME_REFERRAL_CODE = 'welcome';

module.exports = {
  REFERRAL_SAVVY_REFERRER,
  REFERRAL_SAVVY_REFEREE,
  REFERRAL_DAILY_CAP,
  WELCOME_REFERRAL_CODE,
};

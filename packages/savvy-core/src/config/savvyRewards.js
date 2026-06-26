/**
 * Savvy reward display constants — amounts must match server `server/config/savvyRewards.js`.
 * Wallet balance is always authoritative from `GET /auth/me` (`user.savvyPoints`).
 */
export const SAVVY_REWARDS = Object.freeze({
  daily_login: {
    baseSavvy: 20,
    legacyPoints: 50,
  },
  onboarding_first_move: {
    baseSavvy: 25,
  },
  streak_milestones: Object.freeze([
    { minDays: 3, bonusSavvy: 5 },
    { minDays: 7, bonusSavvy: 15 },
    { minDays: 14, bonusSavvy: 30 },
    { minDays: 30, bonusSavvy: 75 },
  ]),
});

export const DAILY_LOGIN_BASE_SAVVY = SAVVY_REWARDS.daily_login.baseSavvy;
export const ONBOARDING_FIRST_MOVE_SAVVY = SAVVY_REWARDS.onboarding_first_move.baseSavvy;

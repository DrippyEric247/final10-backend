import {
  DAILY_LOGIN_BASE_SAVVY,
  ONBOARDING_FIRST_MOVE_SAVVY,
  SAVVY_REWARDS,
} from "./savvyRewards";

describe("savvyRewards config", () => {
  it("exports daily login and onboarding constants used by reward engines", () => {
    expect(DAILY_LOGIN_BASE_SAVVY).toBe(20);
    expect(ONBOARDING_FIRST_MOVE_SAVVY).toBe(25);
    expect(SAVVY_REWARDS.daily_login.baseSavvy).toBe(DAILY_LOGIN_BASE_SAVVY);
    expect(SAVVY_REWARDS.streak_milestones).toHaveLength(4);
  });
});

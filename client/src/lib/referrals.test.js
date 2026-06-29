import { getReferralUserId, makeReferralLink } from "./referrals";

describe("referrals", () => {
  it("getReferralUserId prefers id over _id", () => {
    expect(getReferralUserId({ id: "abc123", _id: "legacy" })).toBe("abc123");
    expect(getReferralUserId({ _id: "legacy-only" })).toBe("legacy-only");
    expect(getReferralUserId(null)).toBeNull();
  });

  it("makeReferralLink encodes user id in register URL", () => {
    expect(makeReferralLink("user-42")).toMatch(/\/register\?ref=user-42$/);
  });
});

/**
 * End-to-end (integration) alert pipeline against a real MongoDB.
 *
 * Flow exercised:
 *   Alert in DB → marketScanner.checkAlerts(auction) → match row + in-app notification + SavvyPoint ledger + user balances.
 *
 * Run:   cd server && MONGODB_URI=mongodb://localhost:27017/final10 npm test -- alert-flow.e2e.test.js
 * Skip:  omits all tests when MONGODB_URI is unset.
 */

const mongoose = require("mongoose");

const User = require("../models/User");
const Alert = require("../models/Alert");
const Auction = require("../models/Auction");
const SavvyPoint = require("../models/SavvyPoint");
const marketScanner = require("../services/marketScanner");

const MONGODB_URI = process.env.MONGODB_URI || "";

const describeReal = MONGODB_URI ? describe : describe.skip;

describeReal("Alert flow E2E (MongoDB)", () => {
  const suffix = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
  let user;
  let alert;
  let auction;

  beforeAll(async () => {
    await mongoose.connect(MONGODB_URI);

    user = await User.create({
      username: `e2e_alert_${suffix}`,
      email: `e2e_alert_${suffix}@test.local`,
      savvyPoints: 0,
      pointsBalance: 0,
      lifetimePointsEarned: 0,
      points: 0,
    });

    alert = await Alert.create({
      user: user._id,
      name: "E2E pipeline alert",
      keywords: ["f10e2e", "gadgettoken"],
      sources: ["ebay"],
      isActive: true,
      minConfidence: 0,
    });
  }, 60000);

  afterAll(async () => {
    if (!MONGODB_URI) return;
    try {
      if (auction?._id) await Auction.deleteOne({ _id: auction._id });
      if (alert?._id) await Alert.deleteOne({ _id: alert._id });
      if (user?._id) {
        await SavvyPoint.deleteMany({ user_id: user._id });
        await User.deleteOne({ _id: user._id });
      }
    } finally {
      await mongoose.disconnect();
    }
  }, 30000);

  it("matches listing, persists hit, notifies user, awards savvy", async () => {
    auction = await Auction.create({
      title: "Rare f10e2e gadgettoken auction test listing",
      description: "e2e",
      category: "electronics",
      condition: "good",
      startingPrice: 10,
      currentBid: 25,
      startTime: new Date(Date.now() - 3600000),
      endTime: new Date(Date.now() + 600000),
      timeRemaining: 600,
      status: "active",
      source: {
        platform: "ebay",
        url: `https://ebay.test/e2e-${suffix}`,
      },
      aiScore: {
        dealPotential: 85,
        competitionLevel: "low",
        trendingScore: 40,
      },
    });

    expect(alert.matchesAuction(auction)).toBe(true);

    await marketScanner.checkAlerts(auction);

    const alertReload = await Alert.findById(alert._id);
    expect(alertReload.matches.length).toBe(1);
    expect(String(alertReload.matches[0].auction)).toBe(String(auction._id));
    expect(alertReload.triggerCount).toBe(1);

    const userReload = await User.findById(user._id);
    expect(userReload.notifications.some((n) => n.kind === "alert_match")).toBe(true);
    expect(Number(userReload.savvyPoints)).toBeGreaterThanOrEqual(5);
    expect(Number(userReload.pointsBalance)).toBeGreaterThanOrEqual(5);

    const ledger = await SavvyPoint.findOne({
      user_id: user._id,
      type: "alert_trigger",
    }).sort({ createdAt: -1 });
    expect(ledger).toBeTruthy();
    expect(Number(ledger.amount)).toBe(5);

    await marketScanner.checkAlerts(auction);

    const alertAfterDup = await Alert.findById(alert._id);
    expect(alertAfterDup.matches.length).toBe(1);
    expect(alertAfterDup.triggerCount).toBe(1);

    const userAfterDup = await User.findById(user._id);
    expect(Number(userAfterDup.savvyPoints)).toBe(Number(userReload.savvyPoints));
  }, 30000);
});

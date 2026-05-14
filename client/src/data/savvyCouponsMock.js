export const couponCategories = ["all", "food", "groceries", "retail", "electronics", "services"];

export const couponBusinesses = [
  {
    id: "biz-c1",
    name: "ByteMart Electronics",
    logo: "https://logo.clearbit.com/bestbuy.com",
    verificationStatus: "verified",
    trustScore: 92,
    location: "Online",
  },
  {
    id: "biz-c2",
    name: "FreshCart Local",
    logo: "https://logo.clearbit.com/instacart.com",
    verificationStatus: "verified",
    trustScore: 87,
    location: "Dallas, TX",
  },
  {
    id: "biz-c3",
    name: "Metro Eats",
    logo: "https://logo.clearbit.com/doordash.com",
    verificationStatus: "pending",
    trustScore: 73,
    location: "Austin, TX",
  },
  {
    id: "biz-c4",
    name: "Prime Fix Auto",
    logo: "https://logo.clearbit.com/jiffylube.com",
    verificationStatus: "verified",
    trustScore: 84,
    location: "Houston, TX",
  },
];

const now = Date.now();
const h = 60 * 60 * 1000;

export const savvyCouponsMock = [
  {
    id: "cpn-1",
    businessId: "biz-c1",
    category: "electronics",
    offerText: "$30 off $150+ order",
    savingsValue: 30,
    expiresAt: now + 6 * h,
    demand: "high",
    reward: { rewardAmount: 220, rewardType: "clickReward", trackingStatus: "tracking_live" },
    promotionTier: "featured",
    popularity: { clicks: 980, redemptions: 210 },
  },
  {
    id: "cpn-2",
    businessId: "biz-c2",
    category: "groceries",
    offerText: "$10 off $25 pickup",
    savingsValue: 10,
    expiresAt: now + 18 * h,
    demand: "high",
    reward: { rewardAmount: 160, rewardType: "signupReward", trackingStatus: "tracking_live" },
    promotionTier: "boosted",
    popularity: { clicks: 720, redemptions: 190 },
  },
  {
    id: "cpn-3",
    businessId: "biz-c3",
    category: "food",
    offerText: "25% off first order",
    savingsValue: 18,
    expiresAt: now + 3 * h,
    demand: "medium",
    reward: { rewardAmount: 130, rewardType: "clickReward", trackingStatus: "tracking_limited" },
    promotionTier: "basic",
    popularity: { clicks: 450, redemptions: 80 },
  },
  {
    id: "cpn-4",
    businessId: "biz-c4",
    category: "services",
    offerText: "$20 off oil change bundle",
    savingsValue: 20,
    expiresAt: now + 30 * h,
    demand: "medium",
    reward: { rewardAmount: 200, rewardType: "signupReward", trackingStatus: "tracking_live" },
    promotionTier: "featured",
    popularity: { clicks: 390, redemptions: 130 },
  },
  {
    id: "cpn-5",
    businessId: "biz-c1",
    category: "retail",
    offerText: "15% off accessories",
    savingsValue: 14,
    expiresAt: now + 12 * h,
    demand: "low",
    reward: { rewardAmount: 110, rewardType: "clickReward", trackingStatus: "tracking_live" },
    promotionTier: "boosted",
    popularity: { clicks: 210, redemptions: 44 },
  },
];


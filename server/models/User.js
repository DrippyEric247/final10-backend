const mongoose = require('mongoose');
const { getTierConfig, normalizeTier, normalizeBilling } = require('../config/subscriptionPlans');

const userSchema = new mongoose.Schema({
  firstName: String,
  lastName: String,
  username: { type: String, unique: true },
  email:    { type: String, unique: true },
  password: String,

  // your existing fields
  points: { type: Number, default: 0 },
  savvyPoints: { type: Number, default: 0 },          // community savvy points
  pointsBalance: { type: Number, default: 0 },        // spendable points balance
  lifetimePointsEarned: { type: Number, default: 0 }, // total points ever earned
  badges: [{ type: String }],                         // user badges/achievements
  trial: {                                            // trial information
    isActive: { type: Boolean, default: false },
    endsAt: Date
  },
  lastDailyClaim: { type: String, default: null },    // YYYY-MM-DD format
  lastLoginDay: { type: String, default: null },      // UTC YYYY-MM-DD for streak
  loginStreakDays: { type: Number, default: 0 },
  longestStreak: { type: Number, default: 0 },
  /** Daily streak inventory: shields, eggs, milestone history */
  dailyStreak: {
    scoutShields: { type: Number, default: 0 },
    scoutEggs: {
      common: { type: Number, default: 0 },
      rare: { type: Number, default: 0 },
      epic: { type: Number, default: 0 },
      legendary: { type: Number, default: 0 },
    },
    claimedMilestoneDays: [{ type: Number }],
    claimedComebackTiers: [{ type: String }],
    legacyLoyalistUnlocked: { type: Boolean, default: false },
    shieldsConsumed: { type: Number, default: 0 },
  },
  /** Savvy Perk Machine — spins, egg inventory, tokens */
  perkMachine: {
    lastFreeSpinDay: { type: String, default: null },
    lastSpinAt: { type: Date, default: null },
    lastHatchAt: { type: Date, default: null },
    extraFreeSpins: { type: Number, default: 0 },
    scoutUpgrades: { type: Number, default: 0 },
    eggInventory: {
      common: { type: Number, default: 0 },
      rare: { type: Number, default: 0 },
      epic: { type: Number, default: 0 },
      legendary: { type: Number, default: 0 },
      mythic: { type: Number, default: 0 },
      extraFreeSpin: { type: Number, default: 0 },
    },
    tokens: {
      battlePassXp15: { type: Number, default: 0 },
      savvyMultiplier15: { type: Number, default: 0 },
    },
    /** Timed boosts activated from inventory tokens: { [key]: { activatedAt, expiresAt } } */
    activeBoosts: { type: mongoose.Schema.Types.Mixed, default: {} },
    callingCardDrops: { type: Number, default: 0 },
    spinHistory: {
      type: [
        {
          spinId: String,
          mode: String,
          slots: Number,
          savvyCost: Number,
          rewards: mongoose.Schema.Types.Mixed,
          createdAt: { type: Date, default: Date.now },
        },
      ],
      default: [],
    },
  },
  lastActive: Date,

  // ---- referrals ----
  referralCode: { type: String, unique: true },                 // the code they share (we set to their _id as string)
  referralCodeUsed: { type: String, default: null },            // the referral code they used when signing up
  referredBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

  // simple daily cap counters for referrer
  referralDay:         { type: String, default: null },          // 'YYYY-MM-DD'
  referralCountToday:  { type: Number, default: 0 },

  // Savvy Points — flip rewards daily cap (free tier), UTC day key
  flipRewardsDay: { type: String, default: null },
  flipRewardsPointsToday: { type: Number, default: 0 },

  /** Savvy Shop / creator rewards daily cap (UTC), free tier */
  creatorRewardsDay: { type: String, default: null },
  creatorRewardsPointsToday: { type: Number, default: 0 },

  /** Flip Score gamification (Savvy flip rewards) */
  flipBestScoreEver: { type: Number, default: null },
  flipTotalCompleted: { type: Number, default: 0 },
  flipScoreLifetimeSum: { type: Number, default: 0 },

  // ---- creator attribution (Phase B) ----
  // creatorId: server-side User._id of the creator that drove this signup.
  creatorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
  // creatorHandle: cached username/handle for cheap rendering.
  creatorHandle: { type: String, default: null },
  // referralSource: bucket for analytics (creator|referral|campaign|deeplink|organic).
  referralSource: { type: String, default: 'organic', index: true },
  // attributedTo: free-form attribution slug for funnels (overrides bucket if set).
  attributedTo: { type: String, default: null, index: true },
  // creatorCodeApplied: the auto-applied creator code at signup, if any.
  creatorCodeApplied: { type: String, default: null },
  // attributionCampaign: utm_campaign / campaign tag at first touch.
  attributionCampaign: { type: String, default: null },
  // attributionLandingPath: first URL the user hit during attribution capture.
  attributionLandingPath: { type: String, default: null },
  // attributionCapturedAt: when attribution was first stamped.
  attributionCapturedAt: { type: Date, default: null },

  // ---- social fabric (Phase C) ----
  following: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  followers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  // Buyer-side watch + private-offer controls.
  watchlist: [{
    listingId: { type: String, index: true },
    title: { type: String, default: '' },
    image: { type: String, default: '' },
    url: { type: String, default: '' },
    sellerId: { type: String, default: '' },
    watchedAt: { type: Date, default: Date.now },
    mutedOffers: { type: Boolean, default: false },
    savvyAwardedAt: { type: Date, default: null },
  }],
  privateOfferInbox: [{
    offerId: { type: String, index: true },
    listingId: { type: String, index: true },
    promotionId: { type: mongoose.Schema.Types.ObjectId, ref: 'PromotedListing', default: null },
    sellerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    title: { type: String, default: '' },
    image: { type: String, default: '' },
    discountPercent: { type: Number, default: 0 },
    quantityLimit: { type: Number, default: null },
    expiresAt: { type: Date, required: true },
    sentAt: { type: Date, default: Date.now },
    claimedAt: { type: Date, default: null },
    status: { type: String, enum: ['sent', 'claimed', 'expired'], default: 'sent' },
  }],
  notifications: [{
    kind: { type: String, default: 'system' },
    title: { type: String, default: '' },
    body: { type: String, default: '' },
    listingId: { type: String, default: '' },
    offerId: { type: String, default: '' },
    createdAt: { type: Date, default: Date.now },
    readAt: { type: Date, default: null },
  }],
  /** Email when Savvy Scout matches an alert (requires ALERT_EMAIL_ENABLED + SMTP on server). */
  alertEmailOnMatch: { type: Boolean, default: false },
  // pinnedWins: ordered list of Auction ids the user has chosen to showcase.
  pinnedWins: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Auction' }],
  // weeklyStats: rolling weekly totals for compare cards. Reset by cron/usage.
  weeklyStats: {
    weekKey: { type: String, default: null },     // ISO week key e.g. '2026-W16'
    savvyEarned: { type: Number, default: 0 },
    winsCount: { type: Number, default: 0 },
    bestMovesFollowed: { type: Number, default: 0 },
  },

  // ---- subscription & search limits ----
  betaTester: { type: Boolean, default: false },
  foundingAccess: { type: Boolean, default: false },
  betaAccessExpiresAt: { type: Date, default: null },
  /** One-time Savvy bonus for quality beta feedback (bug report). */
  betaFeedbackBonusGrantedAt: { type: Date, default: null },
  membershipTier: { 
    type: String, 
    enum: ['free', 'premium', 'pro'], 
    default: 'free' 
  },
  /** Mirrors membershipTier for legacy clients */
  tier: { type: String, default: null },
  plan: { type: String, default: null },
  subscriptionTier: { type: String, default: null },
  premium: { type: Boolean, default: false },
  membershipExpiresAt: { type: Date, default: null },
  subscription: {
    tier: { type: String, enum: ['free', 'core', 'pro', 'elite'], default: 'free' },
    billing: { type: String, enum: ['monthly', 'yearly'], default: 'monthly' },
    multiplier: { type: Number, default: 1.0 },
    monthlyPriceLocked: { type: Number, default: 0 },
    yearlyPriceLocked: { type: Number, default: 0 },
    renewalDate: { type: Date, default: null },
    earlyAdopter: { type: Boolean, default: false },
    badge: { type: String, default: '' },
  },
  earlyAdopterLocked: { type: Boolean, default: false },
  earlyAdopterOriginalPrice: {
    monthlyPrice: { type: Number, default: 0 },
    yearlyPrice: { type: Number, default: 0 },
    tier: { type: String, default: '' },
  },
  subscriptionMetrics: [{
    event: { type: String, default: '' },
    tier: { type: String, default: '' },
    billing: { type: String, default: '' },
    meta: { type: mongoose.Schema.Types.Mixed, default: {} },
    createdAt: { type: Date, default: Date.now },
  }],
  subscriptionExpires: Date,
  /** Last Stripe payment intent applied to premium (idempotent confirm). */
  lastProcessedPremiumPaymentIntentId: { type: String, default: null },
  subscriptionEnd: Date,  // Alternative subscription end date
  isPremium: { type: Boolean, default: false },
  hasClaimedCommunityReward: { type: Boolean, default: false },
  
  /** Savvy Scout monthly goals — completion bonus claim tracking (one per month). */
  scoutMonthlyGoals: {
    completionBonusClaimedMonths: [{ type: String }],
    lastCompletionBonusMonthKey: { type: String, default: null },
    lastCompletionBonusAt: { type: Date, default: null },
    lastCompletionBonusAmount: { type: Number, default: 0 },
    lastActivitySnapshot: { type: mongoose.Schema.Types.Mixed, default: null },
  },

  /** Rolling monthly activity counters for Scout Goals (UTC month key). */
  monthlyActivity: {
    monthKey: { type: String, default: null },
    alertsCreated: { type: Number, default: 0 },
    bestMovesUsed: { type: Number, default: 0 },
    bestMoveActiveDays: { type: Number, default: 0 },
    savvyEarned: { type: Number, default: 0 },
    battlePassTier: { type: Number, default: 0 },
    streakDaysClaimed: { type: Number, default: 0 },
    eggsActivated: { type: Number, default: 0 },
    loginDays: { type: Number, default: 0 },
    reportOpened: { type: Boolean, default: false },
  },

  // ---- community stats ----
  totalTransactions: { type: Number, default: 0 },  // For time saved calculation
  
  // search usage tracking
  searchUsage: {
    day: { type: String, default: null },           // 'YYYY-MM-DD'
    searchesToday: { type: Number, default: 0 },
    lastSearchReset: { type: Date, default: Date.now }
  },
  
  // search limits per tier
  dailySearchLimit: { type: Number, default: 5 },   // free users get 5 searches per day
  
  // ad-watching system
  adWatching: {
    day: { type: String, default: null },           // 'YYYY-MM-DD'
    adsWatchedToday: { type: Number, default: 0 },
    maxAdsPerDay: { type: Number, default: 3 },     // max 3 ads per day
    searchesPerAd: { type: Number, default: 5 },    // 5 searches per ad watched
    lastAdReset: { type: Date, default: Date.now() }
  },

  // daily tasks system
  dailyTasks: {
    day: { type: String, default: null },           // 'YYYY-MM-DD'
    lastReset: { type: Date, default: Date.now() },
    completed: {
      dailyLogin: { type: Boolean, default: false },
      searchProduct: { type: Boolean, default: false },
      watchAds: { type: Number, default: 0 },       // track ads watched for task
      shareApp: { type: Number, default: 0 },       // track app shares
      shareProduct: { type: Number, default: 0 },   // track product shares
      socialPost: { type: Boolean, default: false }
    },
    pointsEarned: { type: Number, default: 0 },
    allTasksCompleted: { type: Boolean, default: false }
  },

  // ---- eBay OAuth integration ----
  ebayAuth: {
    refreshToken: { type: String, default: null },           // eBay OAuth refresh token
    accessToken: { type: String, default: null },            // Current access token (temporary)
    tokenExpiresAt: { type: Date, default: null },           // When access token expires
    scopes: [{ type: String }],                              // Granted OAuth scopes
    lastTokenRefresh: { type: Date, default: null },         // Last time token was refreshed
    isConnected: { type: Boolean, default: false },          // Whether eBay account is connected
    connectedAt: { type: Date, default: null }               // When eBay account was connected
  },

  // ---- Admin & Role Management ----
  role: { 
    type: String, 
    enum: ['user', 'admin', 'superadmin'], 
    default: 'user' 
  },
  adminPermissions: {
    canManageShield: { type: Boolean, default: false },
    canManageUsers: { type: Boolean, default: false },
    canManagePromotions: { type: Boolean, default: false },
    canManagePayments: { type: Boolean, default: false },
    canViewAnalytics: { type: Boolean, default: false }
  },

  // ---- Final10 progression / cosmetics (server source of truth) ----
  premiumTier: {
    type: String,
    enum: ['free', 'premium', 'pro'],
    default: 'free',
  },
  leaderboardScore: { type: Number, default: 0 },
  currentStreak: { type: Number, default: 0 },
  /** Season-style power multiplier (1 = baseline). */
  powerMultiplier: { type: Number, default: 1 },
  equippedCosmetics: {
    emblemId: { type: String, default: 'sigil_starter' },
    callingCardId: { type: String, default: 'card_default' },
    titleId: { type: String, default: null },
  },

  // ---- Owner moderation ----
  isBanned: { type: Boolean, default: false },
  bannedAt: { type: Date, default: null },
  banReason: { type: String, default: null },

  // ---- Owner Grants (Owner Perks) ----
  ownerGrants: [{
    type: {
      type: String,
      enum: ['points', 'lifetime_subscription', 'premium_subscription', 'revoke_lifetime_subscription']
    },
    amount: Number,
    reason: String,
    grantedBy: String,
    grantedAt: { type: Date, default: Date.now }
  }],
}, { timestamps: true });

userSchema.pre('save', function syncPremiumTier(next) {
  if (this.isModified('membershipTier')) {
    this.premiumTier = this.membershipTier;
  }
  next();
});

userSchema.methods.hasFoundingTesterAccess = function hasFoundingTesterAccess() {
  const hasFlag = Boolean(this.betaTester || this.foundingAccess);
  if (!hasFlag) return false;
  if (!this.betaAccessExpiresAt) return true;
  return new Date(this.betaAccessExpiresAt) > new Date();
};

// Method to check if user can perform a search
userSchema.methods.canSearch = function() {
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  if (this.hasFoundingTesterAccess()) {
    return { canSearch: true, remaining: 'unlimited' };
  }
  
  // Premium and Pro users have unlimited searches
  if (this.membershipTier === 'premium' || this.membershipTier === 'pro') {
    return { canSearch: true, remaining: 'unlimited' };
  }
  
  // Check if it's a new day (reset counters)
  if (this.searchUsage.day !== today) {
    this.searchUsage.day = today;
    this.searchUsage.searchesToday = 0;
    this.searchUsage.lastSearchReset = new Date();
  }
  
  if (this.adWatching.day !== today) {
    this.adWatching.day = today;
    this.adWatching.adsWatchedToday = 0;
    this.adWatching.lastAdReset = new Date();
  }
  
  // Calculate total available searches (base + ad-earned)
  const baseSearches = this.dailySearchLimit;
  const adEarnedSearches = this.adWatching.adsWatchedToday * this.adWatching.searchesPerAd;
  const totalAvailable = baseSearches + adEarnedSearches;
  const remaining = totalAvailable - this.searchUsage.searchesToday;
  
  return { 
    canSearch: remaining > 0, 
    remaining: Math.max(0, remaining),
    limit: totalAvailable,
    used: this.searchUsage.searchesToday,
    baseLimit: baseSearches,
    adEarned: adEarnedSearches,
    canWatchAds: this.adWatching.adsWatchedToday < this.adWatching.maxAdsPerDay
  };
};

// Method to increment search count
userSchema.methods.incrementSearchCount = function() {
  const today = new Date().toISOString().split('T')[0];
  if (this.hasFoundingTesterAccess()) {
    return;
  }
  
  // Don't increment for premium users
  if (this.membershipTier === 'premium' || this.membershipTier === 'pro') {
    return;
  }
  
  if (this.searchUsage.day !== today) {
    this.searchUsage.day = today;
    this.searchUsage.searchesToday = 0;
  }
  
  this.searchUsage.searchesToday += 1;
  return this.save();
};

// Method to upgrade to premium
userSchema.methods.upgradeToPremium = function(durationMonths = 1) {
  this.membershipTier = 'premium';
  const expirationDate = new Date();
  expirationDate.setMonth(expirationDate.getMonth() + durationMonths);
  this.subscriptionExpires = expirationDate;
  return this.save();
};

// Method to check if subscription is active
userSchema.methods.isSubscriptionActive = function() {
  if (this.membershipTier === 'free') return false;
  if (!this.subscriptionExpires) return true; // Legacy premium users
  return new Date() < this.subscriptionExpires;
};

// Method to check if user can watch ads
userSchema.methods.canWatchAd = function() {
  const today = new Date().toISOString().split('T')[0];
  if (this.hasFoundingTesterAccess()) {
    return { canWatch: false, reason: 'Founding testers already have full unlimited access' };
  }
  
  // Premium users don't need to watch ads
  if (this.membershipTier === 'premium' || this.membershipTier === 'pro') {
    return { canWatch: false, reason: 'Premium users have unlimited searches' };
  }
  
  // Check if it's a new day (reset counter)
  if (this.adWatching.day !== today) {
    this.adWatching.day = today;
    this.adWatching.adsWatchedToday = 0;
    this.adWatching.lastAdReset = new Date();
  }
  
  const remainingAds = this.adWatching.maxAdsPerDay - this.adWatching.adsWatchedToday;
  
  return {
    canWatch: remainingAds > 0,
    remainingAds: Math.max(0, remainingAds),
    maxAdsPerDay: this.adWatching.maxAdsPerDay,
    adsWatchedToday: this.adWatching.adsWatchedToday,
    searchesPerAd: this.adWatching.searchesPerAd
  };
};

// Method to record ad completion
userSchema.methods.completeAdWatch = function() {
  const today = new Date().toISOString().split('T')[0];
  if (this.hasFoundingTesterAccess()) {
    this.adWatching.adsWatchedToday += 1;
    return this.save();
  }
  
  // Check if it's a new day (reset counter)
  if (this.adWatching.day !== today) {
    this.adWatching.day = today;
    this.adWatching.adsWatchedToday = 0;
    this.adWatching.lastAdReset = new Date();
  }
  
  // For premium users, allow ad watching for daily tasks but don't give search benefits
  if (this.membershipTier === 'premium' || this.membershipTier === 'pro') {
    // Just increment the counter for daily task tracking
    this.adWatching.adsWatchedToday += 1;
    return this.save();
  }
  
  // Check if user can watch more ads (for free users)
  if (this.adWatching.adsWatchedToday >= this.adWatching.maxAdsPerDay) {
    throw new Error('Daily ad limit reached');
  }
  
  // Increment ad count
  this.adWatching.adsWatchedToday += 1;
  
  return this.save();
};

// Method to reset daily tasks (called at midnight)
userSchema.methods.resetDailyTasks = function() {
  const today = new Date().toISOString().split('T')[0];
  
  if (this.dailyTasks.day !== today) {
    this.dailyTasks.day = today;
    this.dailyTasks.lastReset = new Date();
    this.dailyTasks.completed = {
      dailyLogin: false,
      searchProduct: false,
      watchAds: 0,
      shareApp: 0,
      shareProduct: 0,
      socialPost: false,
      useVideoScanner: false,
      searchLocalDeals: false
    };
    this.dailyTasks.pointsEarned = 0;
    this.dailyTasks.allTasksCompleted = false;
  }
  
  return this;
};

// Method to get daily tasks status
userSchema.methods.getDailyTasks = function() {
  this.resetDailyTasks();
  
  const tasks = {
    dailyLogin: {
      name: 'Daily Login',
      description: 'Log in to claim your daily points',
      points: 50,
      completed: this.dailyTasks.completed.dailyLogin,
      icon: '🏠'
    },
    searchProduct: {
      name: 'Search for a Product',
      description: 'Search for any product to earn points',
      points: 25,
      completed: this.dailyTasks.completed.searchProduct,
      icon: '🔍'
    },
    watchAds: {
      name: 'Watch 5 Ads',
      description: 'Watch 5 ads to earn bonus points',
      points: 100,
      completed: this.dailyTasks.completed.watchAds >= 5,
      progress: this.dailyTasks.completed.watchAds,
      target: 5,
      icon: '📺'
    },
    shareApp: {
      name: 'Share App with 3 Users',
      description: 'Share the app with 3 different users',
      points: 300,
      completed: this.dailyTasks.completed.shareApp >= 3,
      progress: this.dailyTasks.completed.shareApp,
      target: 3,
      icon: '📱'
    },
    shareProduct: {
      name: 'Share a Product',
      description: 'Share a product you searched with someone',
      points: 75,
      completed: this.dailyTasks.completed.shareProduct >= 1,
      progress: this.dailyTasks.completed.shareProduct,
      target: 1,
      icon: '🔗'
    },
    socialPost: {
      name: 'Post on Social Media',
      description: 'Post a #StayEarning #StaySavvy win on social media',
      points: 300,
      completed: this.dailyTasks.completed.socialPost,
      icon: '📢'
    },
    useVideoScanner: {
      name: 'Use AI Video Scanner',
      description: 'Use the AI video scanner to identify products',
      points: 20,
      completed: this.dailyTasks.completed.useVideoScanner,
      icon: '🤖'
    },
    searchLocalDeals: {
      name: 'Search for a Local Deal',
      description: 'Search for local deals on OfferUp and local marketplaces',
      points: 25,
      completed: this.dailyTasks.completed.searchLocalDeals,
      icon: '🏪'
    }
  };
  
  // Check if all tasks are completed
  const allCompleted = Object.values(tasks).every(task => task.completed);
  if (allCompleted && !this.dailyTasks.allTasksCompleted) {
    this.dailyTasks.allTasksCompleted = true;
    this.dailyTasks.pointsEarned += 1000; // Bonus points
    this.points += 1000;
    // Note: We don't save here to avoid async issues, the caller should save if needed
  }
  
  return {
    tasks,
    totalPointsEarned: this.dailyTasks.pointsEarned,
    allTasksCompleted: this.dailyTasks.allTasksCompleted,
    bonusEligible: allCompleted
  };
};

// Method to complete daily login task (Savvy grants via savvyRewardService)
userSchema.methods.completeDailyLogin = async function() {
  const { claimDailyLoginReward } = require('../services/savvyRewardService');
  await claimDailyLoginReward(this);
  return this;
};

userSchema.methods.getSubscriptionTierConfig = function() {
  const tier = normalizeTier(this.subscription?.tier || this.membershipTier || 'free');
  const billing = normalizeBilling(this.subscription?.billing || 'monthly');
  const cfg = getTierConfig(tier);
  return { ...cfg, tier, billing };
};

// Method to complete search product task
userSchema.methods.completeSearchTask = async function() {
  this.resetDailyTasks();
  
  if (!this.dailyTasks.completed.searchProduct) {
    this.dailyTasks.completed.searchProduct = true;
    this.dailyTasks.pointsEarned += 25;
    this.points += 25;
    
    // Award XP for search task
    await this.awardXP(15, 'search_task');
    await this.updateLevelStats('totalSearches');
    
    return this.save();
  }
  return Promise.resolve(this);
};

// Method to track ad watching for task
userSchema.methods.trackAdForTask = async function() {
  this.resetDailyTasks();
  
  // Check if user can watch ads (for daily task purposes)
  const adCheck = this.canWatchAd();
  if (!adCheck.canWatch && this.membershipTier !== 'premium' && this.membershipTier !== 'pro') {
    throw new Error(adCheck.reason);
  }
  
  if (this.dailyTasks.completed.watchAds < 5) {
    this.dailyTasks.completed.watchAds += 1;
    
    // Award points when reaching milestones
    if (this.dailyTasks.completed.watchAds === 5) {
      this.dailyTasks.pointsEarned += 50;
      this.points += 50;
    }
    
    // Award XP for watching ads
    await this.awardXP(10, 'ad_watch');
    await this.updateLevelStats('totalAdsWatched');
    
    return this.save();
  }
  return Promise.resolve(this);
};

// Method to track app sharing
userSchema.methods.trackAppShare = async function() {
  this.resetDailyTasks();
  
  if (this.dailyTasks.completed.shareApp < 3) {
    this.dailyTasks.completed.shareApp += 1;
    
    // Award points when reaching milestones
    if (this.dailyTasks.completed.shareApp === 3) {
      this.dailyTasks.pointsEarned += 300;
      this.points += 300;
    }
    
    // Award XP for sharing app
    await this.awardXP(20, 'app_share');
    await this.updateLevelStats('totalShares');
    
    return this.save();
  }
  return Promise.resolve(this);
};

// Method to track product sharing
userSchema.methods.trackProductShare = async function() {
  this.resetDailyTasks();
  
  if (this.dailyTasks.completed.shareProduct < 1) {
    this.dailyTasks.completed.shareProduct += 1;
    this.dailyTasks.pointsEarned += 75;
    this.points += 75;
    
    // Award XP for sharing product
    await this.awardXP(15, 'product_share');
    await this.updateLevelStats('totalShares');
    
    return this.save();
  }
  return Promise.resolve(this);
};

// Method to complete social media post task
userSchema.methods.completeSocialPost = async function() {
  this.resetDailyTasks();
  
  if (!this.dailyTasks.completed.socialPost) {
    this.dailyTasks.completed.socialPost = true;
    this.dailyTasks.pointsEarned += 300;
    this.points += 300;
    
    // Award XP for social media post
    await this.awardXP(30, 'social_post');
    await this.updateLevelStats('totalSocialPosts');
    
    return this.save();
  }
  return Promise.resolve(this);
};

// Method to complete video scanner task
userSchema.methods.completeVideoScannerTask = async function() {
  this.resetDailyTasks();
  
  if (!this.dailyTasks.completed.useVideoScanner) {
    this.dailyTasks.completed.useVideoScanner = true;
    this.dailyTasks.pointsEarned += 20;
    this.points += 20;
    
    // Award XP for using video scanner
    await this.awardXP(10, 'video_scanner');
    await this.updateLevelStats('totalVideoScans');
    
    return this.save();
  }
  return Promise.resolve(this);
};

// Method to complete local deals search task
userSchema.methods.completeLocalDealsTask = async function() {
  this.resetDailyTasks();
  
  if (!this.dailyTasks.completed.searchLocalDeals) {
    this.dailyTasks.completed.searchLocalDeals = true;
    this.dailyTasks.pointsEarned += 25;
    this.points += 25;
    
    // Award XP for searching local deals
    await this.awardXP(12, 'local_deals_search');
    await this.updateLevelStats('totalLocalDealsSearches');
    
    return this.save();
  }
  return Promise.resolve(this);
};

// Method to generate referral link
userSchema.methods.generateReferralLink = async function() {
  // Ensure user has a referral code
  if (!this.referralCode) {
    this.referralCode = this._id.toString();
    await this.save();
  }
  
  const baseUrl = process.env.CLIENT_URL || 'http://localhost:3000';
  return `${baseUrl}/signup?ref=${this.referralCode}`;
};

// Method to get referral stats
userSchema.methods.getReferralStats = async function() {
  const referralLink = await this.generateReferralLink();
  return {
    referralCode: this.referralCode,
    referralLink: referralLink,
    totalReferrals: this.referralCountToday || 0,
    dailyReferrals: this.referralCountToday || 0,
    referredBy: this.referredBy
  };
};

  // Method to track referral
  userSchema.methods.trackReferral = function() {
    const today = new Date().toISOString().split('T')[0];

    if (this.referralDay !== today) {
      this.referralDay = today;
      this.referralCountToday = 0;
    }

    this.referralCountToday += 1;
    return this.save();
  };

  // Method to award XP for task completion
  userSchema.methods.awardXP = async function(xpAmount, source = 'task_completion') {
    const UserLevel = require('./UserLevel');
    const userLevel = await UserLevel.getUserLevelInfo(this._id);
    return await userLevel.awardXP(xpAmount, source);
  };

  // Method to get level information
  userSchema.methods.getLevelInfo = async function() {
    const UserLevel = require('./UserLevel');
    const userLevel = await UserLevel.getUserLevelInfo(this._id);
    return {
      currentLevel: userLevel.currentLevel,
      totalXP: userLevel.totalXP,
      xpToNextLevel: userLevel.xpToNextLevel,
      xpProgress: userLevel.xpProgress,
      xpInfo: userLevel.getXPForCurrentLevel(),
      milestones: userLevel.milestones,
      stats: userLevel.stats
    };
  };

  // Method to update level stats
  userSchema.methods.updateLevelStats = async function(statType, increment = 1) {
    const UserLevel = require('./UserLevel');
    const userLevel = await UserLevel.getUserLevelInfo(this._id);
    return await userLevel.updateStats(statType, increment);
  };

  // ---- eBay OAuth Helper Methods ----

  // Method to set eBay OAuth tokens
  userSchema.methods.setEbayTokens = function(tokenData) {
    // Handle both object parameter and individual parameters for backward compatibility
    const { accessToken, refreshToken, expiresIn, scopes = [] } = tokenData;
    
    this.ebayAuth.accessToken = accessToken;
    this.ebayAuth.refreshToken = refreshToken;
    this.ebayAuth.tokenExpiresAt = new Date(Date.now() + (expiresIn * 1000));
    this.ebayAuth.scopes = scopes;
    this.ebayAuth.lastTokenRefresh = new Date();
    this.ebayAuth.isConnected = true;
    this.ebayAuth.connectedAt = this.ebayAuth.connectedAt || new Date();
    return this.save();
  };

  // Method to check if eBay access token is valid (not expired)
  userSchema.methods.isEbayTokenValid = function() {
    if (!this.ebayAuth.accessToken || !this.ebayAuth.tokenExpiresAt) {
      return false;
    }
    // Add 5 minute buffer to account for clock skew
    const bufferTime = 5 * 60 * 1000; // 5 minutes in milliseconds
    return new Date() < new Date(this.ebayAuth.tokenExpiresAt.getTime() - bufferTime);
  };

  // Method to check if user has eBay connected
  userSchema.methods.hasEbayConnected = function() {
    return this.ebayAuth.isConnected && !!this.ebayAuth.refreshToken;
  };

  // Method to check if user has required eBay scopes
  userSchema.methods.hasEbayScope = function(requiredScope) {
    if (!this.ebayAuth.scopes || this.ebayAuth.scopes.length === 0) {
      return false;
    }
    return this.ebayAuth.scopes.includes(requiredScope);
  };

  // Method to check if user has buy/browse permissions
  userSchema.methods.hasEbayBuyBrowsePermissions = function() {
    const requiredScopes = ['https://api.ebay.com/oauth/api_scope', 'https://api.ebay.com/oauth/api_scope/buy.item.feed'];
    return requiredScopes.every(scope => this.hasEbayScope(scope));
  };

  // Method to get eBay auth status
  userSchema.methods.getEbayAuthStatus = function() {
    return {
      isConnected: this.hasEbayConnected(),
      hasValidToken: this.isEbayTokenValid(),
      scopes: this.ebayAuth.scopes || [],
      hasBuyBrowsePermissions: this.hasEbayBuyBrowsePermissions(),
      tokenExpiresAt: this.ebayAuth.tokenExpiresAt,
      lastTokenRefresh: this.ebayAuth.lastTokenRefresh,
      connectedAt: this.ebayAuth.connectedAt,
      needsRefresh: this.hasEbayConnected() && !this.isEbayTokenValid()
    };
  };

  // Method to clear eBay auth (disconnect)
  userSchema.methods.clearEbayAuth = function() {
    this.ebayAuth = {
      refreshToken: null,
      accessToken: null,
      tokenExpiresAt: null,
      scopes: [],
      lastTokenRefresh: null,
      isConnected: false,
      connectedAt: null
    };
    return this.save();
  };

  // Method to update access token (for token refresh)
  userSchema.methods.updateEbayAccessToken = function(accessToken, expiresIn) {
    this.ebayAuth.accessToken = accessToken;
    this.ebayAuth.tokenExpiresAt = new Date(Date.now() + (expiresIn * 1000));
    this.ebayAuth.lastTokenRefresh = new Date();
    return this.save();
  };

// Static method to find user by eBay refresh token
userSchema.statics.findByEbayRefreshToken = function(refreshToken) {
  return this.findOne({ 'ebayAuth.refreshToken': refreshToken });
};

// Static method to find users with expired eBay tokens that need refresh
userSchema.statics.findUsersWithExpiredEbayTokens = function() {
  return this.find({
    'ebayAuth.isConnected': true,
    'ebayAuth.refreshToken': { $exists: true, $ne: null },
    'ebayAuth.tokenExpiresAt': { $lt: new Date() }
  });
};

// Static method to process referral signup
userSchema.statics.processReferralSignup = async function(userId, referralCode) {
  try {
    // Find the referrer
    const referrer = await this.findOne({ referralCode });
    if (!referrer) {
      throw new Error('Invalid referral code');
    }
    
    // Find the new user
    const newUser = await this.findById(userId);
    if (!newUser) {
      throw new Error('User not found');
    }
    
    // Set referral relationship
    newUser.referredBy = referrer._id;
    await newUser.save();
    
    // Track referral for referrer
    await referrer.trackReferral();
    
    // Award points to both users
    const SavvyPoint = require('./SavvyPoint');
    
    // Award points to referrer
    await SavvyPoint.awardPoints(
      referrer._id,
      100,
      'referral',
      `Referred ${newUser.username}`,
      newUser._id,
      'User',
      1
    );
    
    // Award points to new user
    await SavvyPoint.awardPoints(
      newUser._id,
      50,
      'signup_referral',
      `Signed up with referral from ${referrer.username}`,
      referrer._id,
      'User',
      1
    );
    
    return {
      referrer: referrer.username,
      newUser: newUser.username,
      referrerPoints: 100,
      newUserPoints: 50
    };
  } catch (error) {
    throw error;
  }
};

// Admin helper methods
userSchema.methods.isAdmin = function() {
  return this.role === 'admin' || this.role === 'superadmin';
};

userSchema.methods.isSuperAdmin = function() {
  return this.role === 'superadmin';
};

userSchema.methods.canManageShield = function() {
  return this.role === 'superadmin' || (this.role === 'admin' && Boolean(this.adminPermissions?.canManageShield));
};

userSchema.methods.canManageUsers = function() {
  return this.role === 'superadmin' || (this.role === 'admin' && Boolean(this.adminPermissions?.canManageUsers));
};

userSchema.methods.canManagePromotions = function() {
  return this.role === 'superadmin' || (this.role === 'admin' && Boolean(this.adminPermissions?.canManagePromotions));
};

userSchema.methods.canManagePayments = function() {
  return this.role === 'superadmin' || (this.role === 'admin' && Boolean(this.adminPermissions?.canManagePayments));
};

userSchema.methods.canViewAnalytics = function() {
  return this.role === 'superadmin' || (this.role === 'admin' && Boolean(this.adminPermissions?.canViewAnalytics));
};

// Static method to create superadmin
userSchema.statics.createSuperAdmin = async function(username, email, password) {
  const bcrypt = require('bcryptjs');
  
  const existingAdmin = await this.findOne({ 
    $or: [{ role: 'superadmin' }, { email }] 
  });
  
  if (existingAdmin) {
    throw new Error('Superadmin already exists or email is taken');
  }
  
  const hashedPassword = await bcrypt.hash(password, 12);
  
  const superAdmin = new this({
    username,
    email,
    password: hashedPassword,
    role: 'superadmin',
    adminPermissions: {
      canManageShield: true,
      canManageUsers: true,
      canManagePromotions: true,
      canManagePayments: true,
      canViewAnalytics: true
    },
    membershipTier: 'pro',
    isPremium: true
  });
  
  return superAdmin.save();
};

// Static method to get superadmin
userSchema.statics.getSuperAdmin = function() {
  return this.findOne({ role: 'superadmin' });
};

// ---- Phase B: attribution helpers ------------------------------------------

/**
 * Resolve the creator user from a handle/username/code, return their _id and
 * canonical handle. Returns { id, handle } or { id: null, handle: null }.
 */
userSchema.statics.resolveCreatorIdentity = async function (handleOrCode) {
  if (!handleOrCode) return { id: null, handle: null };
  const raw = String(handleOrCode).trim();
  if (!raw) return { id: null, handle: null };

  // Match against username (case-insensitive) first.
  let candidate = await this.findOne({
    username: { $regex: '^' + raw.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&') + '$', $options: 'i' }
  }).select('_id username').lean();

  if (!candidate) {
    // Fall back to looking up by referralCode (which we set to the user _id).
    candidate = await this.findOne({ referralCode: raw }).select('_id username').lean();
  }

  if (!candidate) return { id: null, handle: null };
  return { id: candidate._id, handle: candidate.username || null };
};

/**
 * Apply Phase B attribution payload to a user document. Safe to call with
 * partial / null payloads — only writes fields when provided.
 */
userSchema.methods.applyAttribution = async function (payload) {
  if (!payload || typeof payload !== 'object') return this;
  const User = this.constructor;
  const handle = payload.creatorHandle ? String(payload.creatorHandle).trim() : null;
  if (handle) {
    const ident = await User.resolveCreatorIdentity(handle);
    if (ident.id && String(ident.id) !== String(this._id)) {
      this.creatorId = ident.id;
      this.creatorHandle = ident.handle || handle;
    } else {
      // Still capture the handle even if we couldn't resolve the user yet.
      this.creatorHandle = handle;
    }
  }
  if (payload.creatorCode) this.creatorCodeApplied = String(payload.creatorCode);
  if (payload.campaign) this.attributionCampaign = String(payload.campaign);
  if (payload.source) this.referralSource = String(payload.source);
  if (payload.landingPath) this.attributionLandingPath = String(payload.landingPath).slice(0, 512);
  if (payload.capturedAt) {
    const ts = new Date(Number(payload.capturedAt));
    if (!Number.isNaN(ts.getTime())) this.attributionCapturedAt = ts;
  }
  // attributedTo defaults to the creator handle when present, else campaign.
  this.attributedTo = this.creatorHandle || this.attributionCampaign || this.attributedTo || null;
  return this.save();
};

// ---- Phase C: weekly stat helpers ------------------------------------------

function isoWeekKey(date = new Date()) {
  // ISO 8601 week-numbering year + week, e.g. "2026-W16".
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

userSchema.statics.isoWeekKey = isoWeekKey;

userSchema.methods.bumpWeeklyStat = async function (statName, increment = 1) {
  const key = isoWeekKey();
  if (!this.weeklyStats || this.weeklyStats.weekKey !== key) {
    this.weeklyStats = {
      weekKey: key,
      savvyEarned: 0,
      winsCount: 0,
      bestMovesFollowed: 0,
    };
  }
  if (typeof this.weeklyStats[statName] !== 'number') {
    this.weeklyStats[statName] = 0;
  }
  this.weeklyStats[statName] += Number(increment) || 0;
  return this.save();
};

module.exports = mongoose.model('User', userSchema);
























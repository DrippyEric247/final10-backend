const mongoose = require('mongoose');
const {
  ACCOUNT_MAX_LEVEL,
  ACCOUNT_MAX_PRESTIGE,
  deriveAccountProgression,
  applyAccountProgressionToDoc,
} = require('../config/accountProgression');

const userLevelSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  /** Visible account level within the current prestige cycle (1–55). */
  currentLevel: {
    type: Number,
    default: 1,
    min: 1,
    max: ACCOUNT_MAX_LEVEL,
  },
  /** Lifetime profile XP — never decreases. Prestige + level derive from this. */
  totalXP: {
    type: Number,
    default: 0,
    min: 0
  },
  xpToNextLevel: {
    type: Number,
    default: 100
  },
  xpProgress: {
    type: Number,
    default: 0,
    min: 0
  },
  levelUpRewards: [{
    level: Number,
    pointsAwarded: Number,
    awardedAt: Date,
    type: {
      type: String,
      enum: ['level_up', 'milestone', 'achievement', 'prestige_up'],
      default: 'level_up'
    }
  }],
  milestones: [{
    milestone: String,
    description: String,
    achievedAt: Date,
    reward: Number
  }],
  stats: {
    totalTasksCompleted: { type: Number, default: 0 },
    totalDaysActive: { type: Number, default: 0 },
    totalSearches: { type: Number, default: 0 },
    totalAdsWatched: { type: Number, default: 0 },
    totalShares: { type: Number, default: 0 },
    totalSocialPosts: { type: Number, default: 0 },
    streakDays: { type: Number, default: 0 },
    longestStreak: { type: Number, default: 0 }
  },
  /** Account prestige 0–10 (COD-style). Derived from lifetime XP, stored for queries. */
  prestige: { type: Number, default: 0, min: 0, max: ACCOUNT_MAX_PRESTIGE },
  lastLevelUpAt: { type: Date, default: null },
  claimedMilestoneRewards: [{
    milestoneId: String,
    level: Number,
    claimedAt: { type: Date, default: Date.now },
  }],
  xpHistory: [{
    amount: Number,
    source: String,
    sourceId: String,
    eventId: String,
    sessionId: String,
    metadata: mongoose.Schema.Types.Mixed,
    idempotencyKey: String,
    createdAt: { type: Date, default: Date.now },
  }],
  activeXpRecapSessions: [{
    sessionId: String,
    title: String,
    trigger: String,
    eventId: String,
    eventSummaryId: String,
    startedAt: { type: Date, default: Date.now },
    xpBreakdown: [{
      source: String,
      label: String,
      amount: Number,
    }],
    beforeSnapshot: mongoose.Schema.Types.Mixed,
  }],
  xpRecaps: [{
    recapId: String,
    sessionId: String,
    title: String,
    trigger: String,
    eventId: String,
    eventSummaryId: String,
    xpEarnedTotal: Number,
    breakdown: [{
      source: String,
      label: String,
      amount: Number,
    }],
    topSource: mongoose.Schema.Types.Mixed,
    lowestSource: mongoose.Schema.Types.Mixed,
    categoryPercentages: mongoose.Schema.Types.Mixed,
    educationMessage: String,
    suggestedNextAction: String,
    scoutMessage: String,
    beforeSnapshot: mongoose.Schema.Types.Mixed,
    afterSnapshot: mongoose.Schema.Types.Mixed,
    levelUpsCrossed: [{
      fromLevel: Number,
      toLevel: Number,
      rewards: mongoose.Schema.Types.Mixed,
    }],
    milestoneUnlocks: mongoose.Schema.Types.Mixed,
    recapShownAt: { type: Date, default: null },
    dismissedAt: { type: Date, default: null },
    createdAt: { type: Date, default: Date.now },
  }],
}, {
  timestamps: true
});

userLevelSchema.index({ currentLevel: -1 });
userLevelSchema.index({ totalXP: -1 });
userLevelSchema.index({ prestige: -1 });

/** Reconcile stored level/prestige from lifetime XP (legacy migration). */
userLevelSchema.methods.syncAccountProgression = async function syncAccountProgression() {
  const beforeLevel = this.currentLevel;
  const beforePrestige = this.prestige || 0;
  const derived = applyAccountProgressionToDoc(this);
  const changed = this.currentLevel !== beforeLevel || (this.prestige || 0) !== beforePrestige;
  if (changed) await this.save();
  return derived;
};

userLevelSchema.methods.getXPForCurrentLevel = function getXPForCurrentLevel() {
  const derived = deriveAccountProgression(this.totalXP);
  return {
    currentLevelStart: derived.xpProgress > 0 ? this.totalXP - derived.xpProgress : this.totalXP,
    nextLevelStart: this.totalXP + derived.xpToNext,
    xpNeeded: derived.xpToNext,
    xpProgress: derived.xpProgress,
    xpRange: derived.xpRange,
  };
};

userLevelSchema.methods.awardXP = async function awardXP(xpAmount, source = 'task_completion') {
  const before = deriveAccountProgression(this.totalXP);
  this.totalXP += xpAmount;
  const after = applyAccountProgressionToDoc(this);

  const levelsGained = Math.max(0, after.level - before.level);
  const prestiged = after.prestige > before.prestige;
  const leveledUp = levelsGained > 0 || prestiged;

  if (leveledUp) {
    this.lastLevelUpAt = new Date();
    const totalReward = (levelsGained + (prestiged ? 1 : 0)) * 500;
    this.levelUpRewards.push({
      level: after.level,
      pointsAwarded: totalReward,
      awardedAt: new Date(),
      type: prestiged && levelsGained === 0 ? 'prestige_up' : 'level_up',
    });

    if (totalReward > 0) {
      const User = mongoose.model('User');
      const user = await User.findById(this.userId);
      if (user) {
        const { grantSavvyReward } = require('../services/savvyRewardService');
        await grantSavvyReward(user, {
          rewardType: 'level_up',
          amount: totalReward,
          baseAmount: totalReward,
          idempotencyKey: `level_up:${this.userId}:${after.level}:${after.prestige}`,
          note: `Level up reward (L${after.level})`,
          meta: { level: after.level, prestige: after.prestige, source: 'user_level' },
        });
      }
    }

    await this.checkMilestones(after);
  }

  await this.save();

  return {
    leveledUp,
    prestiged,
    newLevel: after.level,
    newPrestige: after.prestige,
    levelsGained: levelsGained + (prestiged ? 1 : 0),
    pointsAwarded: leveledUp ? (levelsGained + (prestiged ? 1 : 0)) * 500 : 0,
    xpInfo: this.getXPForCurrentLevel(),
    accountProgression: after,
  };
};

userLevelSchema.methods.checkMilestones = async function checkMilestones(derived) {
  const prog = derived || deriveAccountProgression(this.totalXP);
  const milestones = [
    { level: 5, name: 'Rookie Trader', description: 'Reached level 5', reward: 250 },
    { level: 10, name: 'Smart Shopper', description: 'Reached level 10', reward: 500 },
    { level: 15, name: 'Auction Expert', description: 'Reached level 15', reward: 750 },
    { level: 20, name: 'Deal Hunter', description: 'Reached level 20', reward: 1000 },
    { level: 25, name: 'Bargain Master', description: 'Reached level 25', reward: 1500 },
    { level: 30, name: 'Final10 Legend', description: 'Reached level 30', reward: 2000 },
    { level: 50, name: 'Auction God', description: 'Reached level 50', reward: 5000 },
  ];

  const newMilestones = [];
  const visibleLevel = prog.level + prog.prestige * ACCOUNT_MAX_LEVEL;

  for (const milestone of milestones) {
    if (visibleLevel >= milestone.level &&
        !this.milestones.some((m) => m.milestone === milestone.name)) {
      this.milestones.push({
        milestone: milestone.name,
        description: milestone.description,
        achievedAt: new Date(),
        reward: milestone.reward,
      });
      newMilestones.push(milestone);
      const User = mongoose.model('User');
      const user = await User.findById(this.userId);
      if (user) {
        const { grantSavvyReward } = require('../services/savvyRewardService');
        await grantSavvyReward(user, {
          rewardType: 'level_milestone',
          amount: milestone.reward,
          baseAmount: milestone.reward,
          idempotencyKey: `level_milestone:${this.userId}:${milestone.level}`,
          note: `Milestone: ${milestone.name}`,
          meta: { milestone: milestone.name, level: milestone.level, source: 'user_level' },
        });
      }
    }
  }

  if (newMilestones.length > 0) await this.save();
  return newMilestones;
};

userLevelSchema.methods.updateStats = function updateStats(statType, increment = 1) {
  if (this.stats[statType] !== undefined) {
    this.stats[statType] += increment;
  }
  return this.save();
};

userLevelSchema.statics.getLevelLeaderboard = async function getLevelLeaderboard(limit = 50) {
  return this.find()
    .populate('userId', 'username profileImage firstName lastName')
    .sort({ prestige: -1, currentLevel: -1, totalXP: -1 })
    .limit(limit);
};

userLevelSchema.statics.getUserLevelInfo = async function getUserLevelInfo(userId) {
  let userLevel = await this.findOne({ userId });
  if (!userLevel) {
    userLevel = new this({ userId });
    await userLevel.save();
  }
  await userLevel.syncAccountProgression();
  return userLevel;
};

module.exports = mongoose.model('UserLevel', userLevelSchema);

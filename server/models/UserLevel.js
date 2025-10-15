const mongoose = require('mongoose');

const userLevelSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  currentLevel: {
    type: Number,
    default: 1,
    min: 1
  },
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
      enum: ['level_up', 'milestone', 'achievement'],
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
  }
}, {
  timestamps: true
});

// Index for efficient queries
// Note: userId index is automatically created by unique: true
userLevelSchema.index({ currentLevel: -1 });
userLevelSchema.index({ totalXP: -1 });

// Calculate XP required for next level (exponential growth)
userLevelSchema.methods.calculateXPForLevel = function(level) {
  // Level 1: 0-99 XP
  // Level 2: 100-249 XP  
  // Level 3: 250-449 XP
  // Level 4: 450-699 XP
  // Level 5: 700-999 XP
  // Level 6+: 1000 + (level-6) * 500 XP per level
  
  if (level <= 1) return 0;
  if (level <= 5) {
    return Math.floor(50 * Math.pow(level, 2) - 50 * level);
  }
  return 1000 + (level - 6) * 500;
};

// Calculate XP range for current level
userLevelSchema.methods.getXPForCurrentLevel = function() {
  const currentLevelStart = this.calculateXPForLevel(this.currentLevel);
  const nextLevelStart = this.calculateXPForLevel(this.currentLevel + 1);
  return {
    currentLevelStart,
    nextLevelStart,
    xpNeeded: nextLevelStart - this.totalXP,
    xpProgress: this.totalXP - currentLevelStart,
    xpRange: nextLevelStart - currentLevelStart
  };
};

// Award XP and check for level up
userLevelSchema.methods.awardXP = async function(xpAmount, source = 'task_completion') {
  const beforeLevel = this.currentLevel;
  this.totalXP += xpAmount;
  
  // Check for level up
  let leveledUp = false;
  let newLevel = this.currentLevel;
  
  while (this.totalXP >= this.calculateXPForLevel(newLevel + 1)) {
    newLevel++;
    leveledUp = true;
  }
  
  this.currentLevel = newLevel;
  
  // Update XP progress
  const xpInfo = this.getXPForCurrentLevel();
  this.xpToNextLevel = xpInfo.xpNeeded;
  this.xpProgress = xpInfo.xpProgress;
  
  // Award level up rewards
  if (leveledUp) {
    const levelsGained = newLevel - beforeLevel;
    const totalReward = levelsGained * 500; // 500 points per level
    
    this.levelUpRewards.push({
      level: newLevel,
      pointsAwarded: totalReward,
      awardedAt: new Date(),
      type: 'level_up'
    });
    
    // Update user's points using mongoose directly to avoid circular dependency
    await mongoose.model('User').findByIdAndUpdate(this.userId, {
      $inc: { points: totalReward }
    });
    
    // Check for milestones
    await this.checkMilestones();
  }
  
  await this.save();
  
  return {
    leveledUp,
    newLevel,
    levelsGained: leveledUp ? newLevel - beforeLevel : 0,
    pointsAwarded: leveledUp ? (newLevel - beforeLevel) * 500 : 0,
    xpInfo: this.getXPForCurrentLevel()
  };
};

// Check for milestone achievements
userLevelSchema.methods.checkMilestones = async function() {
  const milestones = [
    { level: 5, name: 'Rookie Trader', description: 'Reached level 5', reward: 250 },
    { level: 10, name: 'Smart Shopper', description: 'Reached level 10', reward: 500 },
    { level: 15, name: 'Auction Expert', description: 'Reached level 15', reward: 750 },
    { level: 20, name: 'Deal Hunter', description: 'Reached level 20', reward: 1000 },
    { level: 25, name: 'Bargain Master', description: 'Reached level 25', reward: 1500 },
    { level: 30, name: 'Final10 Legend', description: 'Reached level 30', reward: 2000 },
    { level: 50, name: 'Auction God', description: 'Reached level 50', reward: 5000 }
  ];
  
  const newMilestones = [];
  
  for (const milestone of milestones) {
    // Check if milestone is achieved and not already recorded
    if (this.currentLevel >= milestone.level && 
        !this.milestones.some(m => m.milestone === milestone.name)) {
      
      this.milestones.push({
        milestone: milestone.name,
        description: milestone.description,
        achievedAt: new Date(),
        reward: milestone.reward
      });
      
      newMilestones.push(milestone);
      
      // Award milestone points using mongoose directly to avoid circular dependency
      await mongoose.model('User').findByIdAndUpdate(this.userId, {
        $inc: { points: milestone.reward }
      });
    }
  }
  
  if (newMilestones.length > 0) {
    await this.save();
  }
  
  return newMilestones;
};

// Update stats
userLevelSchema.methods.updateStats = function(statType, increment = 1) {
  if (this.stats[statType] !== undefined) {
    this.stats[statType] += increment;
  }
  return this.save();
};

// Get level leaderboard
userLevelSchema.statics.getLevelLeaderboard = async function(limit = 50) {
  return this.find()
    .populate('userId', 'username profileImage firstName lastName')
    .sort({ currentLevel: -1, totalXP: -1 })
    .limit(limit);
};

// Get user's level info
userLevelSchema.statics.getUserLevelInfo = async function(userId) {
  let userLevel = await this.findOne({ userId });
  
  if (!userLevel) {
    // Create new level record
    userLevel = new this({ userId });
    await userLevel.save();
  }
  
  return userLevel;
};

module.exports = mongoose.model('UserLevel', userLevelSchema);


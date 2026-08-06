const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const User = require('../models/User');
const { claimCommunityMissionReward } = require('../services/communityMissionService');
const { creditSavvy } = require('../services/savvyBalanceService');
const Alert = require('../models/Alert');
const Auction = require('../models/Auction');

// Community goals configuration
const COMMUNITY_GOALS = {
  savvyPoints: {
    target: 1000000,
    reward: {
      points: 10000,
      subscription: 1 // months
    }
  },
  followers: {
    target: 10000,
    reward: {
      points: 10000,
      subscription: 1
    }
  },
  shares: {
    target: 5000,
    reward: {
      points: 10000,
      subscription: 1
    }
  },
  betaSignups: {
    target: 2500,
    reward: {
      points: 10000,
      subscription: 1
    }
  },
  activeAlerts: {
    target: 100000,
    reward: {
      points: 10000,
      subscription: 1
    }
  },
  auctionsWon: {
    target: 100000,
    reward: {
      points: 10000,
      subscription: 1
    }
  },
  timeSaved: {
    target: 8760, // 1 year in hours
    reward: {
      points: 10000,
      subscription: 1
    }
  }
};

async function computeCommunityProgress() {
  const totalSavvyPoints = await User.aggregate([
    { $group: { _id: null, total: { $sum: '$savvyPoints' } } }
  ]);

  const activeAlertsCount = await Alert.countDocuments({ isActive: true });
  const auctionsWonCount = await Auction.countDocuments({ status: 'completed' });

  const totalTransactions = await User.aggregate([
    { $group: { _id: null, total: { $sum: '$totalTransactions' } } }
  ]);
  const timeSaved = (totalTransactions[0]?.total || 0) * 1;

  const followersAgg = await User.aggregate([
    { $project: { followerCount: { $size: { $ifNull: ['$followers', []] } } } },
    { $group: { _id: null, total: { $sum: '$followerCount' } } }
  ]);

  const sharesAgg = await User.aggregate([
    {
      $group: {
        _id: null,
        total: {
          $sum: {
            $add: [
              { $ifNull: ['$dailyTasks.completed.shareApp', 0] },
              { $ifNull: ['$dailyTasks.completed.shareProduct', 0] }
            ]
          }
        }
      }
    }
  ]);

  const betaSignupsCount = await User.countDocuments({
    $or: [{ betaTester: true }, { foundingAccess: true }]
  });

  return {
    savvyPoints: totalSavvyPoints[0]?.total || 0,
    followers: followersAgg[0]?.total || 0,
    shares: sharesAgg[0]?.total || 0,
    betaSignups: betaSignupsCount,
    activeAlerts: activeAlertsCount,
    auctionsWon: auctionsWonCount,
    timeSaved
  };
}

// GET /api/community/goals - Get community goals
router.get('/goals', (req, res) => {
  try {
    res.json(COMMUNITY_GOALS);
  } catch (error) {
    console.error('Error fetching community goals:', error);
    res.status(500).json({ message: 'Failed to fetch community goals' });
  }
});

// GET /api/community/progress - Get current community progress
router.get('/progress', async (req, res) => {
  try {
    const baseProgress = await computeCommunityProgress();

    // Check if user can claim reward (if any goal is completed and user hasn't claimed)
    let canClaimReward = false;
    if (req.user) {
      const user = await User.findById(req.user.id);
      if (user && !user.hasClaimedCommunityReward) {
        const goals = Object.keys(COMMUNITY_GOALS);
        canClaimReward = goals.some(goalKey => {
          const goal = COMMUNITY_GOALS[goalKey];
          const current = baseProgress[goalKey];
          return current >= goal.target;
        });
      }
    }

    res.json({ ...baseProgress, canClaimReward });
  } catch (error) {
    console.error('Error fetching community progress:', error);
    res.status(500).json({ message: 'Failed to fetch community progress' });
  }
});

// POST /api/community/claim-reward - Claim community reward
router.post('/claim-reward', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (user.hasClaimedCommunityReward) {
      return res.status(400).json({ message: 'Reward already claimed' });
    }

    const currentProgress = await computeCommunityProgress();

    // Check if any goal is completed
    const goals = Object.keys(COMMUNITY_GOALS);
    const completedGoal = goals.find(goalKey => {
      const goal = COMMUNITY_GOALS[goalKey];
      const current = currentProgress[goalKey];
      return current >= goal.target;
    });

    if (!completedGoal) {
      return res.status(400).json({ message: 'No community goals have been completed yet' });
    }

    // Award the reward
    const reward = COMMUNITY_GOALS[completedGoal].reward;

    await creditSavvy(user, {
      amount: reward.points,
      source: 'community_goal',
      idempotencyKey: `community_goal_${user._id}_${completedGoal}`,
      meta: { completedGoal },
    });
    
    // Add subscription months
    const currentDate = new Date();
    const subscriptionEnd = user.subscriptionEnd ? new Date(user.subscriptionEnd) : currentDate;
    if (subscriptionEnd < currentDate) {
      subscriptionEnd.setTime(currentDate.getTime());
    }
    subscriptionEnd.setMonth(subscriptionEnd.getMonth() + reward.subscription);
    user.subscriptionEnd = subscriptionEnd;
    user.isPremium = true;
    
    // Mark as claimed
    user.hasClaimedCommunityReward = true;
    
    await user.save();

    res.json({
      message: 'Reward claimed successfully!',
      points: reward.points,
      subscription: reward.subscription,
      completedGoal: completedGoal,
      currentProgress
    });

  } catch (error) {
    console.error('Error claiming community reward:', error);
    res.status(500).json({ message: 'Failed to claim reward' });
  }
});

// GET /api/community/milestones - Recent community milestones for the hub feed
router.get('/milestones', async (req, res) => {
  try {
    const limit = Math.min(20, Math.max(1, parseInt(req.query.limit, 10) || 12));
    const progress = await computeCommunityProgress();
    const milestones = [];

    const goalLabels = {
      followers: { icon: '👥', label: 'Community followers' },
      shares: { icon: '📣', label: 'Content shares' },
      betaSignups: { icon: '🚀', label: 'Beta signups' },
      savvyPoints: { icon: '✨', label: 'Savvy Points pool' },
    };

    for (const [key, meta] of Object.entries(goalLabels)) {
      const goal = COMMUNITY_GOALS[key];
      if (!goal) continue;
      const current = progress[key] || 0;
      const pct = Math.round((current / goal.target) * 100);
      if (pct >= 25) {
        milestones.push({
          id: `goal-${key}-${Math.floor(pct / 25) * 25}`,
          type: 'goal_progress',
          headline: `${meta.label} at ${pct}%`,
          detail: `${current.toLocaleString()} toward ${goal.target.toLocaleString()} — keep pushing!`,
          icon: meta.icon,
          createdAt: new Date(Date.now() - (4 - Math.min(4, Math.floor(pct / 25))) * 3600000),
        });
      }
    }

    const recentReferrals = await User.find({ referralCodeUsed: { $ne: null } })
      .sort({ createdAt: -1 })
      .limit(5)
      .select('username firstName createdAt')
      .lean();

    for (const u of recentReferrals) {
      const name = u.username || u.firstName || 'A new scout';
      milestones.push({
        id: `referral-${u._id}`,
        type: 'referral',
        headline: `${name} joined via referral`,
        detail: 'The Savvy Universe is growing — welcome aboard!',
        icon: '🤝',
        createdAt: u.createdAt || new Date(),
      });
    }

    const recentBeta = await User.find({ betaTester: true })
      .sort({ createdAt: -1 })
      .limit(3)
      .select('username createdAt')
      .lean();

    for (const u of recentBeta) {
      milestones.push({
        id: `beta-${u._id}`,
        type: 'beta_signup',
        headline: `@${u.username || 'scout'} joined the beta`,
        detail: 'Another hunter in the Savvy Universe.',
        icon: '🎯',
        createdAt: u.createdAt || new Date(),
      });
    }

    milestones.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json(milestones.slice(0, limit));
  } catch (error) {
    console.error('Error fetching community milestones:', error);
    res.status(500).json({ message: 'Failed to fetch milestones' });
  }
});

// GET /api/community/leaderboard - Get community leaderboard
router.get('/leaderboard', async (req, res) => {
  try {
    const { type = 'points', limit = 50 } = req.query;

    let leaderboard = [];

    switch (type) {
      case 'points':
        leaderboard = await User.find({})
          .select('username firstName savvyPoints')
          .sort({ savvyPoints: -1 })
          .limit(parseInt(limit));
        break;
      
      case 'alerts':
        leaderboard = await User.aggregate([
          { $lookup: { from: 'alerts', localField: '_id', foreignField: 'userId', as: 'alerts' } },
          { $project: { username: 1, firstName: 1, alertCount: { $size: '$alerts' } } },
          { $sort: { alertCount: -1 } },
          { $limit: parseInt(limit) }
        ]);
        break;
      
      case 'auctions':
        leaderboard = await User.aggregate([
          { $lookup: { from: 'auctions', localField: '_id', foreignField: 'sellerId', as: 'auctions' } },
          { $project: { username: 1, firstName: 1, auctionCount: { $size: '$auctions' } } },
          { $sort: { auctionCount: -1 } },
          { $limit: parseInt(limit) }
        ]);
        break;
      
      default:
        return res.status(400).json({ message: 'Invalid leaderboard type' });
    }

    res.json(leaderboard);
  } catch (error) {
    console.error('Error fetching community leaderboard:', error);
    res.status(500).json({ message: 'Failed to fetch leaderboard' });
  }
});

/** POST /api/community/missions/claim — idempotent Savvy for social missions */
router.post('/missions/claim', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ ok: false, message: 'User not found' });

    const result = await claimCommunityMissionReward(user, {
      missionId: req.body?.missionId,
      periodKey: req.body?.periodKey,
      idempotencyKey: req.body?.idempotencyKey,
    });
    await user.save();

    res.json({
      success: true,
      ok: true,
      granted: result.granted || result.amount > 0,
      duplicate: result.duplicate,
      alreadyClaimed: result.alreadyClaimed,
      amount: result.amount,
      added: result.added,
      savvyEarned: result.added,
      newBalance: result.newBalance,
      missionId: result.missionId,
      periodKey: result.periodKey,
    });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({
        ok: false,
        success: false,
        message: err.message,
        code: err.code,
      });
    }
    console.error('[community/missions/claim]', err);
    res.status(500).json({ ok: false, success: false, message: 'Claim failed' });
  }
});

module.exports = router;

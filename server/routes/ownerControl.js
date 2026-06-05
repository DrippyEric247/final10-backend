const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const User = require('../models/User');
const authModule = require('../middleware/auth');
const auth = authModule;
const { authOwnerPanel } = authModule;
const { requireOwnerAccess } = require('../middleware/requireRole');
const { isFounderAdminEmail } = require('../lib/founderAdminAccess');
const { buildOwnerUserRegexFilter } = require('../lib/ownerUserSearch');
const { logOwnerPanel, actorFromReq } = require('../lib/ownerPanelLog');
const {
  buildOwnerMembershipMongoSet,
  serializeMembershipForClient,
} = require('../lib/membershipFields');
const { syncEntitlementFromOwnerMembership } = require('../services/premiumEntitlementService');

function canAccessOwnerPanel(user) {
  if (!user) return false;
  if (user.role === 'superadmin') return true;
  if (isFounderAdminEmail(user.email)) return true;
  return Boolean(user.adminPermissions?.canManageUsers);
}

const OWNER_SEARCH_SELECT =
  'username email role membershipTier isPremium points savvyPoints pointsBalance lifetimePointsEarned totalTransactions subscriptionExpires createdAt lastActive betaTester foundingAccess betaAccessExpiresAt isBanned bannedAt';

function mapOwnerSearchUser(user) {
  const totalSavvyEarned =
    Number(user.lifetimePointsEarned) || Number(user.savvyPoints) || 0;
  return {
    id: user._id,
    username: user.username,
    email: user.email,
    role: user.role,
    membershipTier: user.membershipTier,
    isPremium: user.isPremium,
    points: user.points,
    savvyPoints: user.savvyPoints,
    pointsBalance: user.pointsBalance ?? 0,
    lifetimePointsEarned: user.lifetimePointsEarned,
    totalSavvyEarned,
    totalPurchases: Number(user.totalTransactions) || 0,
    accountCreatedAt: user.createdAt,
    betaTester: Boolean(user.betaTester),
    foundingAccess: Boolean(user.foundingAccess),
    betaAccessExpiresAt: user.betaAccessExpiresAt || null,
    memberSince: user.createdAt,
    lastActive: user.lastActive,
    isBanned: Boolean(user.isBanned),
    hasLifetimeSub: user.subscriptionExpires == null && Boolean(user.isPremium),
  };
}

const OWNER_MONGO_MAX_MS = 5000;

function isValidObjectIdString(value) {
  const s = String(value || '').trim();
  if (!s || !mongoose.Types.ObjectId.isValid(s)) return false;
  return String(new mongoose.Types.ObjectId(s)) === s;
}

const OWNER_MEMBERSHIP_SELECT =
  'username email membershipTier isPremium premiumTier subscriptionExpires lifetimePointsEarned savvyPoints pointsBalance totalTransactions createdAt lastActive betaTester foundingAccess';

function ownerRouteError(res, err, context) {
  console.error(`[owner/${context}]`, err?.message || err);
  if (res.headersSent) return;
  const isCast = err?.name === 'CastError';
  const isValidation = err?.name === 'ValidationError';
  return res.status(isCast || isValidation ? 400 : 500).json({
    success: false,
    code: err?.code || 'OWNER_ROUTE_ERROR',
    message:
      isCast
        ? 'Invalid search query'
        : err?.message || `Failed to complete owner ${context}`,
    ...(process.env.NODE_ENV !== 'production' ? { detail: String(err?.message || err) } : {}),
  });
}

// grant-founding-access is mounted in server/index.js (before this router) so
// OWNER_GRANT_SECRET bypass is never blocked by router.use(auth) below.

/**
 * GET /api/owner/search-users — lean auth only; always finishes with res.status().json().
 * Registered before router.use(auth) so heavy user documents are not loaded.
 */
router.get('/search-users', authOwnerPanel, async (req, res) => {
  const route = 'GET /api/owner/search-users';
  const query = String(req.query.query || req.query.q || '').trim();

  try {
    if (!canAccessOwnerPanel(req.user)) {
      return res.status(403).json({
        success: false,
        message: 'Owner panel access required',
      });
    }

    logOwnerPanel(route, { phase: 'hit', ...actorFromReq(req), query });

    if (!query || query.length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Search query must be at least 2 characters long',
      });
    }

    const users = await User.find(buildOwnerUserRegexFilter(query))
      .select(OWNER_SEARCH_SELECT)
      .limit(10)
      .maxTimeMS(8000)
      .lean();

    logOwnerPanel(route, {
      ...actorFromReq(req),
      query,
      resultCount: users.length,
    });

    return res.status(200).json({
      success: true,
      users: users.map((row) => ({
        ...mapOwnerSearchUser(row),
        id: String(row._id),
      })),
      total: users.length,
    });
  } catch (error) {
    const message = error?.message || 'User search failed';
    logOwnerPanel(route, {
      ...actorFromReq(req),
      query,
      resultCount: null,
      error: message,
    });
    console.error('[owner/search-users]', message);
    if (res.headersSent) return;
    return res.status(500).json({
      success: false,
      message,
    });
  }
});

/**
 * POST /api/owner/update-membership — lean auth + atomic findByIdAndUpdate (fast path).
 * Registered before router.use(auth) to avoid loading huge owner user documents.
 */
router.post('/update-membership', authOwnerPanel, async (req, res) => {
  const step = (label, extra) => {
    console.log(`[owner/update-membership] ${label}`, extra !== undefined ? extra : '');
  };

  step('route hit', {
    userId: req.body?.userId,
    email: req.body?.email,
    membershipTier: req.body?.membershipTier,
  });

  try {
    if (!canAccessOwnerPanel(req.user)) {
      step('auth failed');
      return res.status(403).json({
        success: false,
        message: 'Owner panel access required',
      });
    }
    step('auth passed');

    const {
      userId,
      email,
      membershipTier = 'free',
      durationMonths = 12,
      reason = 'Owner membership update',
    } = req.body || {};

    const id = String(userId || '').trim();
    const normalizedEmail = String(email || '').trim().toLowerCase();
    if (!id && !normalizedEmail) {
      return res.status(400).json({
        success: false,
        message: 'userId or email is required',
      });
    }

    const { tier, $set } = buildOwnerMembershipMongoSet(membershipTier, durationMonths);
    if (!['free', 'premium', 'pro'].includes(tier)) {
      return res.status(400).json({ success: false, message: 'Invalid membership tier' });
    }

    const updateOpts = {
      new: true,
      runValidators: false,
      maxTimeMS: OWNER_MONGO_MAX_MS,
    };

    step('user lookup started', { id: id || null, email: normalizedEmail || null });
    step('update started', { tier, reason: String(reason).slice(0, 120) });

    let updated = null;
    if (id && isValidObjectIdString(id)) {
      updated = await User.findByIdAndUpdate(id, { $set }, updateOpts)
        .select(OWNER_MEMBERSHIP_SELECT)
        .lean()
        .maxTimeMS(OWNER_MONGO_MAX_MS);
    }

    if (!updated && normalizedEmail) {
      step('user id miss — email lookup');
      updated = await User.findOneAndUpdate({ email: normalizedEmail }, { $set }, updateOpts)
        .select(OWNER_MEMBERSHIP_SELECT)
        .lean()
        .maxTimeMS(OWNER_MONGO_MAX_MS);
    }

    if (!updated) {
      step('user not found');
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    step('user found', { username: updated.username, id: String(updated._id) });
    step('update complete');

    try {
      await syncEntitlementFromOwnerMembership(updated._id, updated);
      step('entitlement synced');
    } catch (entErr) {
      step('entitlement sync skipped', entErr?.message || entErr);
    }

    const membership = serializeMembershipForClient(updated);

    const payload = {
      success: true,
      message: `Updated membership for ${updated.username} to ${tier}`,
      user: {
        ...mapOwnerSearchUser(updated),
        ...membership,
        id: String(updated._id),
        membershipReason: String(reason || '').slice(0, 500),
      },
    };

    step('response sent');
    return res.status(200).json(payload);
  } catch (error) {
    step('error', error?.message || error);
    if (res.headersSent) return;
    return res.status(500).json({
      success: false,
      message: error?.message || 'Failed to update membership',
    });
  }
});

// Full auth for mutating owner routes
router.use(auth);

/**
 * GET /api/owner/user/:userId
 * Get detailed user information
 */
router.get('/user/:userId', requireOwnerAccess, async (req, res) => {
  try {
    const { userId } = req.params;
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    res.json({
      success: true,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        membershipTier: user.membershipTier,
        isPremium: user.isPremium,
        subscriptionExpires: user.subscriptionExpires,
        points: user.points,
        savvyPoints: user.savvyPoints,
        pointsBalance: user.pointsBalance,
        lifetimePointsEarned: user.lifetimePointsEarned,
        badges: user.badges,
        referralCode: user.referralCode,
        referralCodeUsed: user.referralCodeUsed,
        totalTransactions: user.totalTransactions,
        totalPurchases: Number(user.totalTransactions) || 0,
        totalSavvyEarned:
          Number(user.lifetimePointsEarned) || Number(user.savvyPoints) || 0,
        accountCreatedAt: user.createdAt,
        isBanned: Boolean(user.isBanned),
        memberSince: user.createdAt,
        lastActive: user.lastActive,
        ebayConnected: user.ebayAuth?.isConnected || false,
        betaTester: Boolean(user.betaTester),
        foundingAccess: Boolean(user.foundingAccess),
        betaAccessExpiresAt: user.betaAccessExpiresAt || null,
        hasLifetimeSub: user.subscriptionExpires === null && user.isPremium
      }
    });
    
  } catch (error) {
    console.error('Error fetching user details:', error);
    res.status(500).json({ message: 'Failed to fetch user details' });
  }
});

/**
 * POST /api/owner/grant-points
 * Grant points to a user (Owner Perk)
 */
router.post('/grant-points', requireOwnerAccess, async (req, res) => {
  try {
    const { userId, points, reason = 'Owner grant' } = req.body;
    
    if (!userId || !points || points <= 0) {
      return res.status(400).json({ 
        message: 'Valid user ID and positive points amount required' 
      });
    }
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Grant points
    user.points += points;
    user.savvyPoints += points;
    user.pointsBalance += points;
    user.lifetimePointsEarned += points;
    
    // Add to audit trail
    user.ownerGrants = user.ownerGrants || [];
    user.ownerGrants.push({
      type: 'points',
      amount: points,
      reason: reason,
      grantedBy: req.superAdmin.username,
      grantedAt: new Date()
    });
    
    await user.save();
    
    console.log(`🎯 Owner granted ${points} points to user ${user.username} (${userId})`);
    
    res.json({
      success: true,
      message: `Successfully granted ${points} points to ${user.username}`,
      user: {
        id: user._id,
        username: user.username,
        newPointsBalance: user.pointsBalance,
        newLifetimePoints: user.lifetimePointsEarned
      }
    });
    
  } catch (error) {
    console.error('Error granting points:', error);
    res.status(500).json({ message: 'Failed to grant points' });
  }
});

/**
 * POST /api/owner/grant-lifetime-subscription
 * Grant lifetime subscription to a user (Owner Perk)
 */
router.post('/grant-lifetime-subscription', requireOwnerAccess, async (req, res) => {
  try {
    const { userId, reason = 'Owner grant - Lifetime subscription' } = req.body;
    
    if (!userId) {
      return res.status(400).json({ message: 'User ID required' });
    }
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Grant lifetime subscription
    user.membershipTier = 'pro';
    user.isPremium = true;
    user.subscriptionExpires = null; // null = lifetime
    user.subscriptionEnd = null; // null = lifetime
    
    // Add to audit trail
    user.ownerGrants = user.ownerGrants || [];
    user.ownerGrants.push({
      type: 'lifetime_subscription',
      amount: null,
      reason: reason,
      grantedBy: req.superAdmin.username,
      grantedAt: new Date()
    });
    
    await user.save();
    
    console.log(`👑 Owner granted lifetime subscription to user ${user.username} (${userId})`);
    
    res.json({
      success: true,
      message: `Successfully granted lifetime subscription to ${user.username}`,
      user: {
        id: user._id,
        username: user.username,
        membershipTier: user.membershipTier,
        isPremium: user.isPremium,
        subscriptionExpires: user.subscriptionExpires
      }
    });
    
  } catch (error) {
    console.error('Error granting lifetime subscription:', error);
    res.status(500).json({ message: 'Failed to grant lifetime subscription' });
  }
});

/**
 * POST /api/owner/revoke-lifetime-subscription
 * Revoke lifetime subscription from a user (Owner Perk)
 */
router.post('/revoke-lifetime-subscription', requireOwnerAccess, async (req, res) => {
  try {
    const { userId, reason = 'Owner revoke - Lifetime subscription' } = req.body;
    
    if (!userId) {
      return res.status(400).json({ message: 'User ID required' });
    }
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Revoke lifetime subscription
    user.membershipTier = 'free';
    user.isPremium = false;
    user.subscriptionExpires = new Date(); // Set to past date
    user.subscriptionEnd = new Date(); // Set to past date
    
    // Add to audit trail
    user.ownerGrants = user.ownerGrants || [];
    user.ownerGrants.push({
      type: 'revoke_lifetime_subscription',
      amount: null,
      reason: reason,
      grantedBy: req.superAdmin.username,
      grantedAt: new Date()
    });
    
    await user.save();
    
    console.log(`🚫 Owner revoked lifetime subscription from user ${user.username} (${userId})`);
    
    res.json({
      success: true,
      message: `Successfully revoked lifetime subscription from ${user.username}`,
      user: {
        id: user._id,
        username: user.username,
        membershipTier: user.membershipTier,
        isPremium: user.isPremium,
        subscriptionExpires: user.subscriptionExpires
      }
    });
    
  } catch (error) {
    console.error('Error revoking lifetime subscription:', error);
    res.status(500).json({ message: 'Failed to revoke lifetime subscription' });
  }
});

/**
 * POST /api/owner/grant-premium-subscription
 * Grant premium subscription for specific duration (Owner Perk)
 */
router.post('/grant-premium-subscription', requireOwnerAccess, async (req, res) => {
  try {
    const { userId, durationMonths = 12, reason = 'Owner grant - Premium subscription' } = req.body;
    
    if (!userId || !durationMonths || durationMonths <= 0) {
      return res.status(400).json({ 
        message: 'Valid user ID and positive duration required' 
      });
    }
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Grant premium subscription
    user.membershipTier = 'premium';
    user.isPremium = true;
    
    const subscriptionEnd = new Date();
    subscriptionEnd.setMonth(subscriptionEnd.getMonth() + durationMonths);
    
    user.subscriptionExpires = subscriptionEnd;
    user.subscriptionEnd = subscriptionEnd;
    
    // Add to audit trail
    user.ownerGrants = user.ownerGrants || [];
    user.ownerGrants.push({
      type: 'premium_subscription',
      amount: durationMonths,
      reason: reason,
      grantedBy: req.superAdmin.username,
      grantedAt: new Date()
    });
    
    await user.save();
    
    console.log(`⭐ Owner granted ${durationMonths}-month premium subscription to user ${user.username} (${userId})`);
    
    res.json({
      success: true,
      message: `Successfully granted ${durationMonths}-month premium subscription to ${user.username}`,
      user: {
        id: user._id,
        username: user.username,
        membershipTier: user.membershipTier,
        isPremium: user.isPremium,
        subscriptionExpires: user.subscriptionExpires
      }
    });
    
  } catch (error) {
    console.error('Error granting premium subscription:', error);
    res.status(500).json({ message: 'Failed to grant premium subscription' });
  }
});

/**
 * POST /api/owner/revoke-founding-access
 * Disable Founding Tester / beta status for a user.
 */
router.post('/revoke-founding-access', requireOwnerAccess, async (req, res) => {
  try {
    const { email = '', userId = '', reason = 'Owner revoked Founding Tester access' } = req.body || {};
    const normalizedEmail = String(email || '').trim().toLowerCase();
    if (!normalizedEmail && !userId) {
      return res.status(400).json({ message: 'Email or userId is required' });
    }
    const query = normalizedEmail ? { email: normalizedEmail } : { _id: userId };
    const user = await User.findOne(query);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.betaTester = false;
    user.foundingAccess = false;
    user.betaAccessExpiresAt = null;
    user.ownerGrants = user.ownerGrants || [];
    user.ownerGrants.push({
      type: 'beta_revoked',
      amount: null,
      reason,
      grantedBy: req.superAdmin.username,
      grantedAt: new Date(),
    });
    await user.save();

    return res.json({
      success: true,
      message: `Founding Tester access revoked for ${user.username}`,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        betaTester: false,
        foundingAccess: false,
        isBetaTester: false,
      },
    });
  } catch (error) {
    console.error('Error revoking founding access:', error);
    return res.status(500).json({ message: 'Failed to revoke founding access' });
  }
});

/**
 * POST /api/owner/ban-user
 */
router.post('/ban-user', requireOwnerAccess, async (req, res) => {
  try {
    const { userId, reason = 'Owner ban' } = req.body || {};
    if (!userId) {
      return res.status(400).json({ success: false, message: 'userId is required' });
    }
    const target = await User.findById(userId);
    if (!target) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    target.isBanned = true;
    target.bannedAt = new Date();
    target.banReason = String(reason).slice(0, 500);
    await target.save();
    return res.status(200).json({
      success: true,
      message: `Banned ${target.username}`,
      user: { id: String(target._id), isBanned: true },
    });
  } catch (error) {
    console.error('Error banning user:', error);
    return res.status(500).json({ success: false, message: 'Failed to ban user' });
  }
});

/**
 * POST /api/owner/unban-user
 */
router.post('/unban-user', requireOwnerAccess, async (req, res) => {
  try {
    const { userId } = req.body || {};
    if (!userId) {
      return res.status(400).json({ success: false, message: 'userId is required' });
    }
    const target = await User.findById(userId);
    if (!target) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    target.isBanned = false;
    target.bannedAt = null;
    target.banReason = null;
    await target.save();
    return res.status(200).json({
      success: true,
      message: `Unbanned ${target.username}`,
      user: { id: String(target._id), isBanned: false },
    });
  } catch (error) {
    console.error('Error unbanning user:', error);
    return res.status(500).json({ success: false, message: 'Failed to unban user' });
  }
});

/**
 * GET /api/owner/user/:userId/grants
 * Get owner grants history for a user
 */
router.get('/user/:userId/grants', requireOwnerAccess, async (req, res) => {
  try {
    const { userId } = req.params;
    
    const user = await User.findById(userId).select('username ownerGrants');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    res.json({
      success: true,
      username: user.username,
      grants: user.ownerGrants || []
    });
    
  } catch (error) {
    console.error('Error fetching user grants:', error);
    res.status(500).json({ message: 'Failed to fetch user grants' });
  }
});

/**
 * GET /api/owner/stats
 * Get owner control panel statistics
 */
router.get('/stats', requireOwnerAccess, async (req, res) => {
  const route = 'GET /api/owner/stats';
  logOwnerPanel(route, { phase: 'hit', ...actorFromReq(req), query: null });

  try {
    const [totalUsers, premiumUsers, lifetimeUsers] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ isPremium: true }),
      User.countDocuments({ isPremium: true, subscriptionExpires: null }),
    ]);

    let totalOwnerGrants = 0;
    const recentGrantsList = [];

    const usersWithGrants = await User.find({
      ownerGrants: { $exists: true, $ne: [] },
    })
      .select('username ownerGrants')
      .limit(200)
      .lean();

    for (const user of usersWithGrants) {
      const grants = Array.isArray(user.ownerGrants) ? user.ownerGrants : [];
      for (const grant of grants) {
        if (!grant || typeof grant !== 'object') continue;
        if (grant.type === 'points') {
          totalOwnerGrants += Number(grant.amount) || 0;
        }
        recentGrantsList.push({
          username: user.username,
          type: grant.type,
          amount: grant.amount,
          reason: grant.reason,
          grantedBy: grant.grantedBy,
          grantedAt: grant.grantedAt,
        });
      }
    }

    recentGrantsList.sort(
      (a, b) => new Date(b.grantedAt || 0).getTime() - new Date(a.grantedAt || 0).getTime()
    );

    logOwnerPanel(route, {
      ...actorFromReq(req),
      query: null,
      resultCount: totalUsers,
    });

    return res.json({
      success: true,
      stats: {
        totalUsers,
        premiumUsers,
        lifetimeUsers,
        totalOwnerGrants,
        recentGrants: recentGrantsList.slice(0, 10),
      },
    });
  } catch (error) {
    logOwnerPanel(route, {
      ...actorFromReq(req),
      query: null,
      resultCount: null,
      error: error?.message || String(error),
    });
    return ownerRouteError(res, error, 'stats');
  }
});

module.exports = router;







const User = require('../models/User');

const FULL_ADMIN_PERMISSIONS = {
  canManageShield: true,
  canManageUsers: true,
  canManagePromotions: true,
  canManagePayments: true,
  canViewAnalytics: true,
};

/**
 * Apply founder admin flags on an existing User document (existing schema only).
 */
async function applyFounderAdminGrant(user, { grantedBy = 'system', reason = 'Founder admin grant' } = {}) {
  user.role = 'superadmin';
  user.adminPermissions = FULL_ADMIN_PERMISSIONS;
  user.betaTester = true;
  user.foundingAccess = true;
  user.betaAccessExpiresAt = null;
  if (user.membershipTier === 'free') user.membershipTier = 'pro';
  if (user.premiumTier === 'free') user.premiumTier = 'pro';
  user.isPremium = true;

  user.ownerGrants = user.ownerGrants || [];
  user.ownerGrants.push({
    type: 'premium_subscription',
    amount: null,
    reason,
    grantedBy,
    grantedAt: new Date(),
  });

  await user.save();
  return user;
}

function toFounderAdminPayload(user) {
  const foundingTesterActive = user.hasFoundingTesterAccess();
  return {
    id: user._id,
    username: user.username,
    email: user.email,
    role: user.role,
    adminPermissions: user.adminPermissions,
    betaTester: Boolean(user.betaTester),
    foundingAccess: Boolean(user.foundingAccess),
    betaAccessExpiresAt: user.betaAccessExpiresAt || null,
    foundingTesterActive,
    isBetaTester: foundingTesterActive,
    isSuperAdmin: user.isSuperAdmin(),
    membershipTier: user.membershipTier,
    premiumTier: user.premiumTier,
    isPremium: Boolean(user.isPremium),
  };
}

/**
 * Grant founder admin by email or userId.
 */
async function grantFounderAdminByEmailOrId({ email = '', userId = '', grantedBy = 'system' } = {}) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  if (!normalizedEmail && !userId) {
    const err = new Error('Email or userId is required');
    err.status = 400;
    throw err;
  }

  const query = normalizedEmail ? { email: normalizedEmail } : { _id: userId };
  const user = await User.findOne(query);
  if (!user) {
    const err = new Error('User not found');
    err.status = 404;
    throw err;
  }

  await applyFounderAdminGrant(user, {
    grantedBy,
    reason: 'Founder admin grant — superadmin + founding tester',
  });

  return toFounderAdminPayload(user);
}

module.exports = {
  FULL_ADMIN_PERMISSIONS,
  applyFounderAdminGrant,
  grantFounderAdminByEmailOrId,
  toFounderAdminPayload,
};

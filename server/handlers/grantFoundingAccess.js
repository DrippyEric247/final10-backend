const User = require('../models/User');

/**
 * POST /api/owner/grant-founding-access
 * Grant Founding Tester flags on a user by email (or userId).
 */
async function grantFoundingAccessHandler(req, res) {
  try {
    const {
      email = '',
      userId = '',
      betaTester = true,
      foundingAccess = true,
      expiresAt = null,
      reason = 'Owner grant - Founding Tester Access',
    } = req.body || {};

    const normalizedEmail = String(email || '').trim().toLowerCase();
    if (!normalizedEmail && !userId) {
      return res.status(400).json({ message: 'Email or userId is required' });
    }

    const query = normalizedEmail ? { email: normalizedEmail } : { _id: userId };
    const user = await User.findOne(query);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    let nextExpiresAt = null;
    if (expiresAt) {
      const dt = new Date(expiresAt);
      if (Number.isNaN(dt.getTime())) {
        return res.status(400).json({ message: 'Invalid expiresAt value' });
      }
      nextExpiresAt = dt;
    }

    user.betaTester = Boolean(betaTester);
    user.foundingAccess = Boolean(foundingAccess);
    user.betaAccessExpiresAt = nextExpiresAt;

    user.ownerGrants = user.ownerGrants || [];
    user.ownerGrants.push({
      type: 'premium_subscription',
      amount: null,
      reason,
      grantedBy: req.superAdmin?.username || 'owner-grant',
      grantedAt: new Date(),
    });

    await user.save();

    const foundingTesterActive = user.hasFoundingTesterAccess();

    return res.json({
      success: true,
      message: `Founding Tester Access updated for ${user.username}`,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        betaTester: Boolean(user.betaTester),
        foundingAccess: Boolean(user.foundingAccess),
        betaAccessExpiresAt: user.betaAccessExpiresAt || null,
        foundingTesterActive,
        isBetaTester: foundingTesterActive,
      },
    });
  } catch (error) {
    console.error('Error granting founding access:', error);
    return res.status(500).json({ message: 'Failed to grant founding access' });
  }
}

module.exports = { grantFoundingAccessHandler };

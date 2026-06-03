const User = require('../models/User');
const { HttpError } = require('./apiErrors');
const { ensureFounderAdminRole, isFounderAdminEmail } = require('../lib/founderAdminAccess');

/**
 * Require one of the given roles (string match on `user.role`).
 * @param {...string} roles
 */
function requireRole(...roles) {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return next(new HttpError(401, 'UNAUTHORIZED', 'Authentication required'));
      }
      const user = await User.findById(req.user._id || req.user.id);
      if (!user) {
        return next(new HttpError(401, 'UNAUTHORIZED', 'Authentication required'));
      }
      if (!roles.includes(user.role)) {
        return next(new HttpError(403, 'FORBIDDEN', 'Insufficient permissions'));
      }
      req.roleUser = user;
      next();
    } catch (err) {
      next(err);
    }
  };
}

/**
 * Legacy owner routes: `superadmin` only.
 */
function requireSuperAdmin() {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return next(new HttpError(401, 'UNAUTHORIZED', 'Authentication required'));
      }
      const user = await User.findById(req.user._id || req.user.id);
      if (!user || typeof user.isSuperAdmin !== 'function' || !user.isSuperAdmin()) {
        return next(new HttpError(403, 'FORBIDDEN', 'Superadmin access required'));
      }
      req.superAdmin = user;
      next();
    } catch (err) {
      next(err);
    }
  };
}

/**
 * Owner Control Panel — superadmin, admin with canManageUsers, or founder account.
 */
function requireOwnerAccess() {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return next(new HttpError(401, 'UNAUTHORIZED', 'Authentication required'));
      }
      let user = await User.findById(req.user._id || req.user.id);
      if (!user) {
        return next(new HttpError(401, 'UNAUTHORIZED', 'Authentication required'));
      }
      await ensureFounderAdminRole(user);
      user = await User.findById(user._id || user.id);

      const allowed =
        (typeof user.isSuperAdmin === 'function' && user.isSuperAdmin()) ||
        (typeof user.canManageUsers === 'function' && user.canManageUsers()) ||
        isFounderAdminEmail(user.email);

      if (!allowed) {
        return next(new HttpError(403, 'FORBIDDEN', 'Owner panel access required'));
      }
      req.ownerUser = user;
      req.superAdmin = user;
      next();
    } catch (err) {
      next(err);
    }
  };
}

module.exports = { requireRole, requireSuperAdmin, requireOwnerAccess };

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
      try {
        await ensureFounderAdminRole(user);
      } catch (founderErr) {
        console.error('[requireOwnerAccess] ensureFounderAdminRole failed:', founderErr);
      }
      user = await User.findById(user._id || user.id);
      if (!user) {
        return next(new HttpError(401, 'UNAUTHORIZED', 'Authentication required'));
      }

      const isSuper =
        typeof user.isSuperAdmin === 'function' && user.isSuperAdmin();
      const isFounder = isFounderAdminEmail(user.email);
      let canManage = false;
      try {
        canManage =
          typeof user.canManageUsers === 'function' && user.canManageUsers();
      } catch (permErr) {
        console.error('[requireOwnerAccess] canManageUsers check failed:', permErr);
      }

      const allowed = isSuper || isFounder || canManage;

      if (!allowed) {
        return next(new HttpError(403, 'FORBIDDEN', 'Owner panel access required'));
      }
      req.ownerUser = user;
      req.superAdmin = user;
      next();
    } catch (err) {
      console.error('[requireOwnerAccess] unexpected error:', err);
      next(err);
    }
  };
}

/**
 * Lightweight owner gate for read-only owner routes (no full user hydrate / double fetch).
 */
function requireOwnerAccessFast() {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return next(new HttpError(401, 'UNAUTHORIZED', 'Authentication required'));
      }
      const user = await User.findById(req.user._id || req.user.id)
        .select('email role adminPermissions username')
        .lean();

      if (!user) {
        return next(new HttpError(401, 'UNAUTHORIZED', 'Authentication required'));
      }

      const isSuper = user.role === 'superadmin';
      const isFounder = isFounderAdminEmail(user.email);
      const canManage = Boolean(user.adminPermissions?.canManageUsers);

      if (!isSuper && !isFounder && !canManage) {
        return next(new HttpError(403, 'FORBIDDEN', 'Owner panel access required'));
      }

      req.ownerUser = user;
      req.superAdmin = user;
      next();
    } catch (err) {
      console.error('[requireOwnerAccessFast] unexpected error:', err?.message || err);
      next(err);
    }
  };
}

module.exports = {
  requireRole,
  requireSuperAdmin,
  requireOwnerAccess,
  requireOwnerAccessFast,
};

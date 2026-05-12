const User = require('../models/User');
const { HttpError } = require('./apiErrors');

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
 * Same behavior as legacy owner routes: only `superadmin` role.
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

module.exports = { requireRole, requireSuperAdmin };

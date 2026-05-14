const jwt = require('jsonwebtoken');

/**
 * Soft-parse Bearer JWT for telemetry only — never treats failures as auth errors.
 * Sets `req.telemetryUserId` when a valid token decodes.
 */
function optionalAuth(req, res, next) {
  req.telemetryUserId = null;
  try {
    const header = req.header('Authorization') || '';
    const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
    if (!token || !process.env.JWT_SECRET) return next();

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const id = decoded.sub || decoded.userId || decoded.id;
    if (id) req.telemetryUserId = String(id);
  } catch {
    /* ignore invalid/expired tokens */
  }
  next();
}

module.exports = optionalAuth;

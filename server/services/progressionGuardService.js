const { HttpError } = require('../middleware/apiErrors');

/**
 * Ensures a requested user id matches the authenticated user (defense in depth).
 * Progression routes should always use req.user._id; use this if a route ever accepts userId in the body.
 */
function assertAuthenticatedUserId(req, claimedUserId) {
  if (claimedUserId == null || claimedUserId === '') return;
  const sessionId = String(req.user._id || req.user.id || '');
  if (String(claimedUserId) !== sessionId) {
    throw new HttpError(403, 'USER_MISMATCH', 'Cannot act on behalf of another user.');
  }
}

module.exports = { assertAuthenticatedUserId };

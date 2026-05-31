const auth = require('./auth');
const { requireSuperAdmin } = require('./requireRole');

function readGrantSecretHeader(req) {
  return String(
    req.headers['x-owner-grant-secret'] ||
      req.get('X-Owner-Grant-Secret') ||
      req.get('x-owner-grant-secret') ||
      ''
  ).trim();
}

/**
 * Bootstrap secret is checked first — JWT auth is never invoked when it matches.
 * Superadmin Bearer token is the fallback when no secret header is sent.
 */
function requireOwnerGrantAccess(req, res, next) {
  const expected = String(process.env.OWNER_GRANT_SECRET || '').trim();
  const provided = readGrantSecretHeader(req);

  if (expected && provided && provided === expected) {
    req.superAdmin = { username: 'owner-grant-secret' };
    return next();
  }

  if (provided) {
    return res.status(403).json({
      code: 'FORBIDDEN',
      message: 'Invalid owner grant secret',
    });
  }

  return auth(req, res, () => requireSuperAdmin()(req, res, next));
}

module.exports = { requireOwnerGrantAccess, readGrantSecretHeader };

/**
 * Trusted Savvy app authentication for write endpoints.
 */
const {
  validateAppId,
  isSavvyCoreExternalWritesEnabled,
} = require('../config/savvyCoreConfig');

function parseAppKeys() {
  try {
    const raw = process.env.SAVVY_CORE_APP_KEYS;
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function resolveAppFromRequest(req) {
  const appId = String(req.headers['x-savvy-app-id'] || req.body?.appId || '').trim().toLowerCase();
  const appKey = String(req.headers['x-savvy-app-key'] || req.body?.appKey || '').trim();
  if (!appId) return null;
  validateAppId(appId);
  return { appId, appKey };
}

function requireTrustedApp(req, res, next) {
  if (!isSavvyCoreExternalWritesEnabled()) {
    return res.status(503).json({
      code: 'SAVVY_CORE_WRITES_DISABLED',
      message: 'Savvy Core external app writes are not enabled.',
    });
  }

  const app = resolveAppFromRequest(req);
  if (!app) {
    return res.status(400).json({ code: 'APP_ID_REQUIRED', message: 'X-Savvy-App-Id header is required.' });
  }

  const keys = parseAppKeys();
  const expected = keys[app.appId];
  if (!expected || app.appKey !== expected) {
    return res.status(403).json({ code: 'APP_AUTH_FAILED', message: 'Invalid Savvy app credentials.' });
  }

  req.savvyApp = { appId: app.appId };
  return next();
}

module.exports = {
  requireTrustedApp,
  resolveAppFromRequest,
  parseAppKeys,
};

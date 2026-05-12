const SecurityAuditLog = require('../models/SecurityAuditLog');

function clientIp(req) {
  if (!req) return null;
  const xf = req.headers['x-forwarded-for'];
  if (typeof xf === 'string' && xf.length) return xf.split(',')[0].trim().slice(0, 64);
  if (req.socket?.remoteAddress) return String(req.socket.remoteAddress).slice(0, 64);
  return null;
}

/**
 * Best-effort audit write — never throws to callers.
 * @param {string} action
 * @param {{ userId?: import('mongoose').Types.ObjectId|string|null, req?: import('express').Request, meta?: object, severity?: 'info'|'warn'|'critical' }} opts
 */
async function audit(action, opts = {}) {
  const { userId, req, meta, severity = 'info' } = opts;
  const doc = {
    action,
    userId: userId || null,
    ip: clientIp(req),
    path: req?.originalUrl ? String(req.originalUrl).slice(0, 512) : null,
    method: req?.method || null,
    severity,
    meta: meta && typeof meta === 'object' ? meta : {},
  };
  try {
    await SecurityAuditLog.create(doc);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[securityAudit]', action, err.message);
  }
}

function auditFireAndForget(action, opts) {
  void audit(action, opts);
}

module.exports = {
  audit,
  auditFireAndForget,
  clientIp,
};

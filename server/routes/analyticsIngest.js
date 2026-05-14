const express = require('express');
const optionalAuth = require('../middleware/optionalAuth');
const { isProduction } = require('../config/envValidation');
const {
  logClientAnalytics,
  logClientCrash,
  logClientApiFailure,
  logClientAuthError,
  logClientEbayFailure,
} = require('../services/structuredLog');

const router = express.Router();

function sanitizeProps(obj, depth = 0) {
  if (obj == null || depth > 4) return {};
  if (typeof obj !== 'object') return {};
  const out = {};
  const blocked = /password|secret|token|authorization|cookie|card/i;
  Object.entries(obj).forEach(([k, v]) => {
    if (blocked.test(k)) return;
    if (typeof v === 'string') out[k] = v.slice(0, 240);
    else if (typeof v === 'number' && Number.isFinite(v)) out[k] = v;
    else if (typeof v === 'boolean') out[k] = v;
    else if (v && typeof v === 'object' && !Array.isArray(v)) out[k] = sanitizeProps(v, depth + 1);
    else if (Array.isArray(v)) out[k] = v.slice(0, 12).map((x) => (typeof x === 'string' ? x.slice(0, 120) : x));
  });
  return out;
}

/**
 * POST /api/analytics/event
 * Body: { name: string, props?: object } OR { events: [{ name, props? }] }
 */
router.post('/event', optionalAuth, (req, res) => {
  const body = req.body || {};
  const anonId = typeof body.anonId === 'string' ? body.anonId.slice(0, 64) : '';
  const sessionId = typeof body.sessionId === 'string' ? body.sessionId.slice(0, 64) : '';

  let events = [];
  if (Array.isArray(body.events)) {
    events = body.events
      .filter((e) => e && typeof e.name === 'string')
      .map((e) => ({
        name: String(e.name).slice(0, 120),
        props: sanitizeProps(e.props || {}),
      }));
  } else if (typeof body.name === 'string') {
    events = [{ name: String(body.name).slice(0, 120), props: sanitizeProps(body.props || {}) }];
  }

  if (events.length === 0) {
    return res.status(400).json({ ok: false, code: 'INVALID_PAYLOAD' });
  }

  logClientAnalytics(events, {
    userId: req.telemetryUserId || undefined,
    anonId: anonId || undefined,
    sessionId: sessionId || undefined,
    ip: req.ip,
    ua: typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'].slice(0, 400) : '',
  });

  // Route high-value client failure signals into dedicated structured log events.
  events.forEach((evt) => {
    const name = String(evt?.name || '');
    const props = evt?.props || {};
    const meta = {
      userId: req.telemetryUserId || undefined,
      ip: req.ip,
    };
    if (name === 'api_failure') {
      logClientApiFailure(props, meta);
    } else if (name === 'auth_error') {
      logClientAuthError(props, meta);
    } else if (name === 'ebay_failure') {
      logClientEbayFailure(props, meta);
    }
  });

  res.status(204).end();
});

/**
 * POST /api/analytics/crash
 */
router.post('/crash', optionalAuth, (req, res) => {
  const body = req.body || {};
  const prod = isProduction();
  const payload = {
    message: typeof body.message === 'string' ? body.message.slice(0, 2000) : 'unknown',
    ...(prod
      ? {}
      : {
          stack: typeof body.stack === 'string' ? body.stack.slice(0, 12000) : undefined,
          componentStack:
            typeof body.componentStack === 'string' ? body.componentStack.slice(0, 8000) : undefined,
        }),
    url: typeof body.url === 'string' ? body.url.slice(0, 2000) : undefined,
    userAgent: typeof body.userAgent === 'string' ? body.userAgent.slice(0, 500) : undefined,
    name: typeof body.name === 'string' ? body.name.slice(0, 200) : undefined,
    extra: sanitizeProps(body.extra || {}),
    source: body.source === 'server' ? 'server' : 'client',
  };

  logClientCrash(payload, {
    userId: req.telemetryUserId || undefined,
    ip: req.ip,
  });

  res.status(204).end();
});

module.exports = router;

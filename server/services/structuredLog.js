const { isProduction } = require('../config/envValidation');

/**
 * JSON-ish structured logs for operations / monitoring hooks.
 * Never pass secrets, tokens, or full card data in `meta`.
 */
function emit(level, event, meta = {}) {
  const row = {
    ts: new Date().toISOString(),
    level,
    event,
    ...meta,
  };
  const line = JSON.stringify(row);
  if (level === 'error' || level === 'critical') {
    // eslint-disable-next-line no-console
    console.error(line);
  } else if (level === 'warn') {
    // eslint-disable-next-line no-console
    console.warn(line);
  } else {
    // eslint-disable-next-line no-console
    console.log(line);
  }
}

function info(event, meta) {
  emit('info', event, meta);
}

function warn(event, meta) {
  emit('warn', event, meta);
}

function error(event, meta) {
  emit('error', event, meta);
}

/** Express route error (safe fields only; stack only outside production). */
function logRouteError(req, err, status, code) {
  const base = {
    event: 'HTTP_ROUTE_ERROR',
    path: req.originalUrl,
    method: req.method,
    status,
    code,
    message: err && err.message,
  };
  if (!isProduction()) {
    base.stack = err && err.stack;
  }
  error('HTTP_ROUTE_ERROR', base);
}

function logAuthFailure(req, reason, extra = {}) {
  warn('AUTH_FAILURE', {
    path: req.originalUrl,
    method: req.method,
    reason,
    ...extra,
  });
}

function logProgressionFailure(userId, reason, meta = {}) {
  error('PROGRESSION_FAILURE', {
    userId: userId && String(userId),
    reason,
    ...meta,
  });
}

const ebayErrorLastLog = new Map();

function logEbayProviderError(path, status, message) {
  const { ebayLogThrottleMs, isEbayVerboseLogEnabled } = require('../lib/backgroundJobFlags');
  const safeMessage = String(message || '')
    .replace(/\s+/g, ' ')
    .slice(0, 220);

  if (!isEbayVerboseLogEnabled()) {
    const key = `${path}:${status}`;
    const now = Date.now();
    const throttle = ebayLogThrottleMs();
    const last = ebayErrorLastLog.get(key) || 0;
    if (now - last < throttle) return;
    ebayErrorLastLog.set(key, now);
  }

  warn('EBAY_PROVIDER_ERROR', { path, status, message: safeMessage });
}

function logPaymentFailure(route, message, code) {
  error('PAYMENT_FAILURE', { route, message, code });
}

/** Browser / mobile client telemetry (sanitized; never store secrets). */
function logClientAnalytics(events, meta = {}) {
  const list = Array.isArray(events) ? events.slice(0, 25) : [];
  info('CLIENT_ANALYTICS_BATCH', {
    count: list.length,
    events: list,
    ...meta,
  });
}

function logClientCrash(payload, meta = {}) {
  const safePayload =
    isProduction() && payload && typeof payload === 'object'
      ? { ...payload, stack: undefined, componentStack: undefined }
      : payload;
  error('CLIENT_CRASH_REPORT', {
    ...safePayload,
    ...meta,
  });
}

function logClientApiFailure(payload = {}, meta = {}) {
  warn('CLIENT_API_FAILURE', {
    path: payload.path,
    method: payload.method,
    status: payload.status,
    code: payload.code,
    message: payload.message,
    category: payload.category || 'general',
    ...meta,
  });
}

function logClientAuthError(payload = {}, meta = {}) {
  warn('CLIENT_AUTH_ERROR', {
    path: payload.path,
    method: payload.method,
    status: payload.status,
    code: payload.code,
    message: payload.message,
    ...meta,
  });
}

const clientEbayFailureLastLog = new Map();

function logClientEbayFailure(payload = {}, meta = {}) {
  const { ebayLogThrottleMs, isEbayVerboseLogEnabled } = require('../lib/backgroundJobFlags');
  const safeMessage = String(payload.message || '')
    .replace(/\s+/g, ' ')
    .slice(0, 220);
  const key = `${payload.path || '?'}:${payload.status || '?'}`;

  if (!isEbayVerboseLogEnabled()) {
    const now = Date.now();
    const last = clientEbayFailureLastLog.get(key) || 0;
    if (now - last < ebayLogThrottleMs()) return;
    clientEbayFailureLastLog.set(key, now);
  }

  warn('CLIENT_EBAY_FAILURE', {
    path: payload.path,
    method: payload.method,
    status: payload.status,
    code: payload.code,
    message: safeMessage,
    ...meta,
  });
}

function logProcessCrash(kind, errOrReason) {
  const isErr = errOrReason instanceof Error;
  const row = {
    message: isErr ? errOrReason.message : String(errOrReason),
    name: isErr ? errOrReason.name : undefined,
  };
  // Always include stack for process-level crashes — required for Railway diagnosis.
  if (isErr && errOrReason.stack) {
    row.stack = errOrReason.stack;
  }
  emit('critical', kind, row);
}

module.exports = {
  emit,
  info,
  warn,
  error,
  logRouteError,
  logAuthFailure,
  logProgressionFailure,
  logEbayProviderError,
  logPaymentFailure,
  logClientAnalytics,
  logClientCrash,
  logClientApiFailure,
  logClientAuthError,
  logClientEbayFailure,
  logProcessCrash,
};

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

function logEbayProviderError(path, status, message) {
  warn('EBAY_PROVIDER_ERROR', { path, status, message });
}

function logPaymentFailure(route, message, code) {
  error('PAYMENT_FAILURE', { route, message, code });
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
};

const crypto = require('crypto');

const HEADER = 'x-request-id';
const MAX_INCOMING_LEN = 128;
const SAFE_INCOMING = /^[a-zA-Z0-9._-]+$/;

function normalizeIncomingId(value) {
  const raw = String(value || '').trim();
  if (!raw || raw.length > MAX_INCOMING_LEN) return null;
  if (!SAFE_INCOMING.test(raw)) return null;
  return raw;
}

function generateRequestId() {
  return crypto.randomUUID();
}

/**
 * Attach a stable request ID for logging and error responses.
 * Accepts X-Request-Id when safe; otherwise generates server-side.
 */
function requestIdMiddleware(req, res, next) {
  const incoming =
    normalizeIncomingId(req.headers[HEADER]) ||
    normalizeIncomingId(req.headers['x-correlation-id']);
  const requestId = incoming || generateRequestId();
  req.requestId = requestId;
  res.setHeader(HEADER, requestId);
  next();
}

module.exports = {
  requestIdMiddleware,
  REQUEST_ID_HEADER: HEADER,
};

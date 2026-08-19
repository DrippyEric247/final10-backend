/**
 * Canonical API error JSON helper for legacy route migration.
 */

const { isProduction } = require('../config/envValidation');

function sendApiError(res, req, status, code, message, extra = {}) {
  const body = {
    code: code || 'REQUEST_FAILED',
    message: message || 'Request could not be completed.',
    ...(req?.requestId ? { requestId: req.requestId } : {}),
    ...extra,
  };
  if (!isProduction() && extra.detail) {
    body.detail = extra.detail;
  }
  return res.status(status).json(body);
}

module.exports = { sendApiError };

const { isHttpError } = require('./apiErrors');
const { isProduction } = require('../config/envValidation');
const { logRouteError } = require('../services/structuredLog');

/**
 * Express error-handling middleware — must be registered after all routes.
 */
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  const status = isHttpError(err)
    ? err.status
    : err.status && err.status >= 400 && err.status < 600
      ? err.status
      : 500;
  const code = isHttpError(err) ? err.code : err.code && typeof err.code === 'string' ? err.code : 'INTERNAL_ERROR';
  const safeMessage = isHttpError(err)
    ? err.message
    : isProduction()
      ? 'Request could not be completed.'
      : err.message || 'Internal server error';

  logRouteError(req, err, status, code);

  const body = {
    code,
    message: safeMessage,
    ...(isHttpError(err) ? err.extra : {}),
  };

  if (!isProduction() && err && !isHttpError(err) && err.message) {
    body.detail = err.message;
  }

  if (res.headersSent) {
    return;
  }
  res.status(status).json(body);
}

module.exports = { errorHandler };

/**
 * Typed API errors — handlers call next(err); error middleware maps to safe JSON.
 */
class HttpError extends Error {
  /**
   * @param {number} status HTTP status
   * @param {string} code Machine-readable code
   * @param {string} message Safe client message
   * @param {object} [extra] Extra fields merged into JSON (no secrets)
   */
  constructor(status, code, message, extra = {}) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.code = code;
    this.extra = extra;
    this.isOperational = true;
  }
}

function isHttpError(err) {
  return err && err instanceof HttpError;
}

module.exports = { HttpError, isHttpError };

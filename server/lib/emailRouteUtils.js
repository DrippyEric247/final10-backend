const { isProduction } = require('../config/envValidation');
const { getEmailConfigStatus, getEmailEnvPresence } = require('../services/emailService');

/**
 * Email delivery failures are returned as HTTP 200 + ok:false so Railway/Vercel
 * proxies always pass the JSON body to the browser (avoid bare 502 gateway pages).
 */
function emailRouteHttpStatus(result = {}) {
  if (!result.sent) return 200;
  return 200;
}

function maskEmail(email) {
  const value = String(email || '').trim().toLowerCase();
  if (!value || !value.includes('@')) return null;
  const [local, domain] = value.split('@');
  return `${local.slice(0, 3)}***@${domain}`;
}

function buildEmailRouteFailureBody(result = {}, meta = {}) {
  const isDev = !isProduction();
  const failureReason =
    result.errorReason ||
    result.resendValidationHint ||
    result.message ||
    result.reason ||
    'email_send_failed';

  const body = {
    ok: false,
    ...result,
    ...meta,
    failureReason,
    message: failureReason,
  };

  if (isDev) {
    body.devDetail = {
      reason: result.reason || null,
      errorCode: result.errorCode || null,
      errorReason: result.errorReason || null,
      responseCode: result.responseCode || null,
      resendValidationHint: result.resendValidationHint || null,
      resendError: result.resendError || null,
      provider: result.provider || null,
      envPresent: getEmailEnvPresence(),
      config: getEmailConfigStatus(),
    };
  }

  return body;
}

function buildEmailRouteExceptionBody(err, meta = {}) {
  const isDev = !isProduction();
  const message = err?.message || 'Email route failed.';
  return {
    ok: false,
    code: meta.code || 'EMAIL_ROUTE_EXCEPTION',
    reason: meta.reason || 'email_route_exception',
    message,
    failureReason: message,
    ...meta,
    ...(isDev && {
      stack: err?.stack || null,
      errorName: err?.name || null,
      devDetail: {
        envPresent: getEmailEnvPresence(),
        config: getEmailConfigStatus(),
      },
    }),
  };
}

function sendEmailRouteResult(res, result, meta = {}) {
  const status = emailRouteHttpStatus(result);
  if (!result?.sent && result?.ok !== true) {
    return res.status(status).json(buildEmailRouteFailureBody(result, meta));
  }
  if (result?.ok === false) {
    return res.status(status).json(buildEmailRouteFailureBody(result, meta));
  }
  return res.status(status).json({
    ok: true,
    ...result,
    ...meta,
  });
}

module.exports = {
  emailRouteHttpStatus,
  maskEmail,
  buildEmailRouteFailureBody,
  buildEmailRouteExceptionBody,
  sendEmailRouteResult,
};

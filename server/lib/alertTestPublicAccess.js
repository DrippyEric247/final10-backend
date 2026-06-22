const crypto = require('crypto');

function readAlertTestSecretHeader(req) {
  return String(
    req.headers['x-alert-test-secret'] ||
      req.get('X-Alert-Test-Secret') ||
      req.headers['x-owner-grant-secret'] ||
      req.get('X-Owner-Grant-Secret') ||
      ''
  ).trim();
}

function secretMatches(expected, provided) {
  if (!expected || !provided) return false;
  try {
    const a = Buffer.from(expected);
    const b = Buffer.from(provided);
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/**
 * Public alert/email test routes accept X-Alert-Test-Secret or X-Owner-Grant-Secret.
 */
function isAlertTestPublicAccess(req) {
  const provided = readAlertTestSecretHeader(req);
  if (!provided) return false;

  const alertSecret = String(process.env.ALERT_TEST_PUBLIC_SECRET || '').trim();
  if (secretMatches(alertSecret, provided)) return true;

  const ownerSecret = String(process.env.OWNER_GRANT_SECRET || '').trim();
  return secretMatches(ownerSecret, provided);
}

function alertTestPublicSecretConfigured() {
  return (
    String(process.env.ALERT_TEST_PUBLIC_SECRET || '').trim().length >= 16 ||
    String(process.env.OWNER_GRANT_SECRET || '').trim().length >= 16
  );
}

module.exports = {
  readAlertTestSecretHeader,
  isAlertTestPublicAccess,
  alertTestPublicSecretConfigured,
};

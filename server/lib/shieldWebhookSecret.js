/**
 * Canonical Shield webhook secret — fail closed in production.
 * Never log secret values.
 */

const { isProduction, looksLikePlaceholder } = require('../config/envValidation');

/**
 * Shield webhooks stay on unless the flag is exactly false.
 * Railway and pasted .env values often include a trailing newline or quotes.
 * Unset, blank, and every other value stay enabled so production fails closed.
 */
function isShieldWebhookEnabled() {
  let raw = String(process.env.SHIELD_WEBHOOK_ENABLED ?? '')
    .replace(/^\uFEFF/, '')
    .trim()
    .toLowerCase();
  if (
    raw.length >= 2 &&
    ((raw.startsWith('"') && raw.endsWith('"')) || (raw.startsWith("'") && raw.endsWith("'")))
  ) {
    raw = raw.slice(1, -1).trim();
  }
  if (!raw) return true;
  return raw !== 'false';
}

function validateShieldWebhookSecretAtBoot() {
  if (!isProduction() || !isShieldWebhookEnabled()) return;

  const secret = String(process.env.SHIELD_WEBHOOK_SECRET || '').trim();
  if (!secret) {
    throw new Error(
      'SHIELD_WEBHOOK_SECRET is required in production when Shield webhooks are enabled (set SHIELD_WEBHOOK_ENABLED=false to disable).'
    );
  }
  if (secret === 'default_secret' || looksLikePlaceholder(secret)) {
    throw new Error('SHIELD_WEBHOOK_SECRET must not use placeholder or default_secret in production.');
  }
}

/**
 * Returns configured secret or null in non-production when unset.
 * Throws in production when Shield is enabled but secret missing/invalid.
 */
function getShieldWebhookSecret() {
  const secret = String(process.env.SHIELD_WEBHOOK_SECRET || '').trim();
  if (!secret) {
    if (isProduction() && isShieldWebhookEnabled()) {
      throw new Error('SHIELD_WEBHOOK_SECRET is not configured.');
    }
    return null;
  }
  if (secret === 'default_secret' || looksLikePlaceholder(secret)) {
    if (isProduction()) {
      throw new Error('SHIELD_WEBHOOK_SECRET is invalid.');
    }
    return null;
  }
  return secret;
}

module.exports = {
  isShieldWebhookEnabled,
  validateShieldWebhookSecretAtBoot,
  getShieldWebhookSecret,
};

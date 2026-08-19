/**
 * Canonical Shield webhook secret — fail closed in production.
 * Never log secret values.
 */

const { isProduction, looksLikePlaceholder } = require('../config/envValidation');

function isShieldWebhookEnabled() {
  return String(process.env.SHIELD_WEBHOOK_ENABLED || 'true').toLowerCase() !== 'false';
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

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
const SHIELD_WEBHOOK_FLAG = 'SHIELD_WEBHOOK_ENABLED';

function readShieldWebhookFlag() {
  const present = Object.prototype.hasOwnProperty.call(process.env, SHIELD_WEBHOOK_FLAG);
  return {
    present,
    raw: present ? String(process.env[SHIELD_WEBHOOK_FLAG]) : '',
  };
}

function normalizeShieldWebhookFlag(raw) {
  let value = String(raw ?? '')
    .replace(/^\uFEFF/, '')
    .trim()
    .toLowerCase();
  if (
    value.length >= 2 &&
    ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'")))
  ) {
    value = value.slice(1, -1).trim();
  }
  return value;
}

function isShieldWebhookEnabled() {
  const normalized = normalizeShieldWebhookFlag(readShieldWebhookFlag().raw);
  if (!normalized) return true;
  return normalized !== 'false';
}

function describeShieldWebhookFlag() {
  const { present, raw } = readShieldWebhookFlag();
  const trimmed = raw.trim();
  const quoteWrapped = (
    (trimmed.startsWith('"') && trimmed.endsWith('"'))
    || (trimmed.startsWith("'") && trimmed.endsWith("'"))
  );
  const nonAscii = Array.from(raw).some((ch) => ch.codePointAt(0) > 126);
  return {
    present,
    length: present ? raw.length : 0,
    quoteWrapped,
    nonAscii,
    enabled: isShieldWebhookEnabled(),
  };
}

function logShieldWebhookFlagDecision() {
  const info = describeShieldWebhookFlag();
  // stderr is unbuffered enough to survive the process.exit that follows a failed boot.
  // The raw flag is never written; it is not a credential, but it can be padded or quoted.
  console.error(
    `[security] shield webhook flag present=${info.present} length=${info.length} quoteWrapped=${info.quoteWrapped} nonAscii=${info.nonAscii} enabled=${info.enabled}`
  );
}

function validateShieldWebhookSecretAtBoot() {
  logShieldWebhookFlagDecision();
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
  describeShieldWebhookFlag,
  validateShieldWebhookSecretAtBoot,
  getShieldWebhookSecret,
};

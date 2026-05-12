/**
 * Fail-fast checks for secrets and core config.
 *
 * Philosophy:
 *  - In production the server REFUSES to boot when a secret is missing,
 *    looks like a placeholder, or when a dev-only bypass flag is enabled.
 *  - In development we log loud warnings but never exit, so the team can
 *    iterate with relaxed security.
 *  - Secret VALUES are never logged. We only surface names + lengths +
 *    pattern matches.
 */

const MIN_JWT_SECRET_LEN = 32;

/**
 * Case-insensitive substrings that indicate a value is a placeholder the
 * developer forgot to replace. If any of these appear in a secret, we
 * treat the secret as unset.
 */
const PLACEHOLDER_PATTERNS = [
  'supersecretchangeme',
  'changeme',
  'change-me',
  'your_',
  'your-',
  'replace_me',
  'replace-me',
  'todo',
  'xxx',
  'example',
  'placeholder',
  'sk-your_',
  'pk_test_replace',
  'sk_test_replace',
];

/**
 * Secrets that must be present and real for a production boot.
 * Stripe / eBay are handled conditionally via FINAL10_REQUIRE_* flags.
 */
const PRODUCTION_REQUIRED_SECRETS = [
  { name: 'JWT_SECRET', minLength: MIN_JWT_SECRET_LEN },
  { name: 'MONGODB_URI' },
];

function isProduction() {
  return process.env.NODE_ENV === 'production';
}

function envFlag(name) {
  return (
    String(process.env[name] || '').toLowerCase() === 'true' ||
    process.env[name] === '1'
  );
}

function looksLikePlaceholder(value) {
  if (!value) return true;
  const lower = String(value).toLowerCase();
  return PLACEHOLDER_PATTERNS.some((pat) => lower.includes(pat));
}

function validateSecret({ name, minLength = 0 }) {
  const value = process.env[name];
  if (!value) return `${name} is required in production.`;
  if (minLength > 0 && String(value).length < minLength) {
    return `${name} must be at least ${minLength} characters (high-entropy random recommended).`;
  }
  if (looksLikePlaceholder(value)) {
    return `${name} still contains a placeholder pattern. Rotate it and set the real value in Railway env.`;
  }
  return null;
}

function validateCoreEnv() {
  const errors = [];
  const warnings = [];

  if (isProduction()) {
    for (const spec of PRODUCTION_REQUIRED_SECRETS) {
      const err = validateSecret(spec);
      if (err) errors.push(err);
    }

    // Dev-only bypass flags must NEVER be enabled in production. These
    // would silently disable auth or anti-abuse on deployed traffic.
    const bannedProdFlags = [
      'DISABLE_EBAY_AUTH',
      'ALLOW_PROGRESSION_TRUST_BYPASS',
      'ALLOW_BP_CLIENT_PREMIUM_UNLOCK',
    ];
    for (const flag of bannedProdFlags) {
      if (envFlag(flag)) {
        errors.push(
          `${flag} is enabled. This flag is development-only and must be unset in production.`
        );
      }
    }

    if (envFlag('FINAL10_REQUIRE_EBAY_APP_CREDENTIALS')) {
      const idErr = validateSecret({ name: 'EBAY_CLIENT_ID' });
      const secretErr = validateSecret({ name: 'EBAY_CLIENT_SECRET' });
      if (idErr) errors.push(idErr);
      if (secretErr) errors.push(secretErr);
    }
    if (envFlag('FINAL10_REQUIRE_STRIPE')) {
      const sk = String(process.env.STRIPE_SECRET_KEY || '');
      if (!sk.startsWith('sk_') || looksLikePlaceholder(sk)) {
        errors.push(
          'FINAL10_REQUIRE_STRIPE is true but STRIPE_SECRET_KEY is missing / placeholder.'
        );
      }
      const whs = String(process.env.STRIPE_WEBHOOK_SECRET || '');
      if (!whs || looksLikePlaceholder(whs)) {
        errors.push(
          'FINAL10_REQUIRE_STRIPE is true but STRIPE_WEBHOOK_SECRET is missing / placeholder.'
        );
      }
    }
  } else {
    // Dev mode — warn loudly but never block startup.
    if (!process.env.JWT_SECRET) {
      warnings.push(
        '[security] JWT_SECRET is unset — auth will fail until you add one to server/.env'
      );
    } else if (looksLikePlaceholder(process.env.JWT_SECRET)) {
      warnings.push(
        '[security] JWT_SECRET still contains a placeholder string. This would block a production boot.'
      );
    } else if (String(process.env.JWT_SECRET).length < MIN_JWT_SECRET_LEN) {
      warnings.push(
        `[security] JWT_SECRET is shorter than ${MIN_JWT_SECRET_LEN} chars — acceptable for local dev only.`
      );
    }
  }

  if (warnings.length) {
    // eslint-disable-next-line no-console
    console.warn(warnings.join('\n'));
  }
  if (errors.length) {
    // eslint-disable-next-line no-console
    console.error(
      '[security] Environment validation failed — refusing to start:\n' +
        errors.map((e) => '  - ' + e).join('\n')
    );
    process.exit(1);
  }
}

/**
 * Dev-only startup checklist (no secrets logged).
 */
function printSecurityStartupReport() {
  const dev = !isProduction();
  const lines = [
    '[Final10 security checklist]',
    `- NODE_ENV: ${process.env.NODE_ENV || 'undefined'}`,
    `- JWT_SECRET configured: ${Boolean(process.env.JWT_SECRET)} (length ${process.env.JWT_SECRET ? String(process.env.JWT_SECRET).length : 0}${looksLikePlaceholder(process.env.JWT_SECRET) ? ', PLACEHOLDER DETECTED' : ''})`,
    `- MONGODB_URI configured: ${Boolean(process.env.MONGODB_URI)}`,
    `- Global API rate limit: enabled (see middleware/security rateLimitConfig)`,
    `- Stricter route limiters: auth, progression/events, ebay search, ebay bids (see middleware/rateLimits.js)`,
    `- Request body/query validation: Joi on auth, progression, cosmetics, ebay (see validation/schemas.js)`,
    `- Central error handler: ${isProduction() ? 'production-safe responses' : 'includes message detail'}`,
    `- Battle pass premium self-unlock in production: ${envFlag('ALLOW_BP_CLIENT_PREMIUM_UNLOCK') ? (isProduction() ? 'WILL BLOCK BOOT' : 'ALLOWED (dev override)') : 'requires membership / subscription / isPremium'}`,
    `- eBay auth bypass: ${envFlag('DISABLE_EBAY_AUTH') ? (isProduction() ? 'WILL BLOCK BOOT' : 'WARNING: DISABLE_EBAY_AUTH is true (dev only)') : 'disabled (JWT required)'}`,
    `- Progression trust bypass: ${envFlag('ALLOW_PROGRESSION_TRUST_BYPASS') ? (isProduction() ? 'WILL BLOCK BOOT' : 'WARNING: scan-deck / bid tokens not enforced (dev only)') : 'enforced (eBay search + bid API issue tokens)'}`,
    `- SHIELD_WEBHOOK_SECRET configured: ${Boolean(process.env.SHIELD_WEBHOOK_SECRET)}`,
    `- RENDER_API_KEY configured: ${Boolean(process.env.RENDER_API_KEY)}`,
    `- eBay app credentials (Browse): ${Boolean(process.env.EBAY_CLIENT_ID && process.env.EBAY_CLIENT_SECRET)}`,
    `- Stripe secret key: ${String(process.env.STRIPE_SECRET_KEY || '').startsWith('sk_') && !looksLikePlaceholder(process.env.STRIPE_SECRET_KEY)}`,
    `- FINAL10_REQUIRE_EBAY_APP_CREDENTIALS: ${envFlag('FINAL10_REQUIRE_EBAY_APP_CREDENTIALS')}`,
    `- FINAL10_REQUIRE_STRIPE: ${envFlag('FINAL10_REQUIRE_STRIPE')}`,
    `- STRIPE_WEBHOOK_SECRET configured: ${Boolean(process.env.STRIPE_WEBHOOK_SECRET) && !looksLikePlaceholder(process.env.STRIPE_WEBHOOK_SECRET)}`,
    `- STRIPE_PREMIUM_PRICE_ID configured: ${Boolean(process.env.STRIPE_PREMIUM_PRICE_ID)}`,
    `- FRONTEND_URL configured: ${Boolean(process.env.FRONTEND_URL)}`,
    dev ? '- Secure mode: development (verbose errors where enabled)' : '- Secure mode: production',
  ];
  // eslint-disable-next-line no-console
  console.log(lines.join('\n'));
}

module.exports = {
  validateCoreEnv,
  printSecurityStartupReport,
  envFlag,
  isProduction,
  looksLikePlaceholder,
};

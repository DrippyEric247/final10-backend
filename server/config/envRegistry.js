/**
 * Wave 7 — canonical environment variable registry (names + metadata only; no secret values).
 * Used for boot validation docs and production-hardening tests.
 */

const { isProduction } = require('./envValidation');

/** @typedef {'server'|'client'} EnvScope */
/** @typedef {'required'|'optional'|'conditional'} EnvRequirement */

const SERVER_ENV_REGISTRY = [
  { name: 'NODE_ENV', scope: 'server', requirement: 'required', secret: false, prod: true, consumer: 'boot', failure: 'Defaults to development behavior' },
  { name: 'PORT', scope: 'server', requirement: 'optional', secret: false, prod: true, default: '8080', consumer: 'HTTP listen', failure: 'Uses 8080' },
  { name: 'MONGODB_URI', scope: 'server', requirement: 'required', secret: true, prod: true, consumer: 'mongoBoot', failure: 'Prod boot exit(1); API stays up but DB routes fail' },
  { name: 'JWT_SECRET', scope: 'server', requirement: 'required', secret: true, prod: true, consumer: 'auth', failure: 'Prod boot exit(1)' },
  { name: 'CLIENT_URL', scope: 'server', requirement: 'optional', secret: false, prod: true, consumer: 'cors,oauth,email', failure: 'OAuth redirect / CORS may misroute' },
  { name: 'FRONTEND_URL', scope: 'server', requirement: 'optional', secret: false, prod: true, consumer: 'cors,payments', failure: 'Stripe redirect fallback only' },
  { name: 'ALLOWED_ORIGINS', scope: 'server', requirement: 'optional', secret: false, prod: true, consumer: 'cors', failure: 'Uses built-in final10.app + vercel preview allowlist' },
  { name: 'STRIPE_SECRET_KEY', scope: 'server', requirement: 'conditional', secret: true, prod: true, consumer: 'payments', failure: 'Mock payment path if unset; required when FINAL10_REQUIRE_STRIPE=1' },
  { name: 'STRIPE_WEBHOOK_SECRET', scope: 'server', requirement: 'conditional', secret: true, prod: true, consumer: 'stripeWebhook', failure: 'Webhook returns 503 WEBHOOK_MISCONFIGURED' },
  { name: 'EBAY_CLIENT_ID', scope: 'server', requirement: 'conditional', secret: true, prod: true, consumer: 'ebayAuth', failure: 'Mock/stale cache fallback for Browse API' },
  { name: 'EBAY_CLIENT_SECRET', scope: 'server', requirement: 'conditional', secret: true, prod: true, consumer: 'ebayAuth', failure: 'Mock/stale cache fallback' },
  { name: 'RESEND_API_KEY', scope: 'server', requirement: 'optional', secret: true, prod: true, consumer: 'emailService', failure: 'Email delivery skipped; alerts may not email' },
  { name: 'ALERT_EMAIL_ENABLED', scope: 'server', requirement: 'optional', secret: false, prod: true, consumer: 'alertDelivery', failure: 'Alert email delivery disabled' },
  { name: 'DISABLE_SAVVY_SCOUT_SCAN', scope: 'server', requirement: 'optional', secret: false, prod: true, consumer: 'background jobs', failure: 'Disables alert scanner cron when true' },
  { name: 'DISABLE_AUCTION_CRON_REFRESH', scope: 'server', requirement: 'optional', secret: false, prod: true, consumer: 'background jobs', failure: 'Disables auction refresh cron when true' },
  { name: 'SAVVY_MIRROR_POINTS_BALANCE', scope: 'server', requirement: 'optional', secret: false, prod: true, consumer: 'savvyBalanceService', failure: 'Mirror writes off by default (Wave 6)' },
  { name: 'BETA_MODE', scope: 'server', requirement: 'optional', secret: false, prod: true, consumer: 'betaMode', failure: 'Off by default; softens rate limits when on' },
  { name: 'FINAL10_REQUIRE_STRIPE', scope: 'server', requirement: 'optional', secret: false, prod: true, consumer: 'envValidation', failure: 'Boot exit if Stripe keys missing when true' },
  { name: 'FINAL10_REQUIRE_EBAY_APP_CREDENTIALS', scope: 'server', requirement: 'optional', secret: false, prod: true, consumer: 'envValidation', failure: 'Boot exit if eBay keys missing when true' },
  { name: 'OWNER_GRANT_SECRET', scope: 'server', requirement: 'optional', secret: true, prod: true, consumer: 'owner bootstrap', failure: 'Bootstrap grant routes unavailable' },
  { name: 'SHIELD_WEBHOOK_SECRET', scope: 'server', requirement: 'optional', secret: true, prod: true, consumer: 'shield', failure: 'Weak default blocked in production boot (Wave 7)' },
];

const CLIENT_ENV_REGISTRY = [
  { name: 'REACT_APP_API_URL', scope: 'client', requirement: 'optional', secret: false, prod: true, consumer: 'runtimeApi', failure: 'Falls back to https://api.final10.app in prod build' },
  { name: 'VITE_API_URL', scope: 'client', requirement: 'optional', secret: false, prod: true, consumer: 'runtimeApi', failure: 'Alias for REACT_APP_API_URL' },
  { name: 'REACT_APP_STRIPE_PUBLISHABLE_KEY', scope: 'client', requirement: 'optional', secret: false, prod: true, consumer: 'payments UI', failure: 'Stripe checkout unavailable' },
  { name: 'REACT_APP_API_TIMEOUT_MS', scope: 'client', requirement: 'optional', secret: false, prod: true, default: '28000', consumer: 'api.js', failure: 'Uses 28s default timeout' },
];

function listRegistry(scope = null) {
  const all = [...SERVER_ENV_REGISTRY, ...CLIENT_ENV_REGISTRY];
  if (!scope) return all;
  return all.filter((row) => row.scope === scope);
}

function productionRequiredNames() {
  return SERVER_ENV_REGISTRY.filter((r) => r.requirement === 'required' && r.prod).map((r) => r.name);
}

module.exports = {
  SERVER_ENV_REGISTRY,
  CLIENT_ENV_REGISTRY,
  listRegistry,
  productionRequiredNames,
  isProduction,
};

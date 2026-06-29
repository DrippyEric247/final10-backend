/**
 * Development-only rate limit bypass for local QA sweeps.
 * Never active when NODE_ENV === 'production'.
 *
 * Set F10_DISABLE_RATE_LIMIT_BYPASS=1 to re-enable limits locally.
 */
function shouldBypassRateLimits() {
  if (process.env.NODE_ENV === 'production') return false;
  if (process.env.F10_DISABLE_RATE_LIMIT_BYPASS === '1') return false;
  return true;
}

/** express-rate-limit skip handler */
function rateLimitSkipDev(_req, _res) {
  return shouldBypassRateLimits();
}

module.exports = {
  shouldBypassRateLimits,
  rateLimitSkipDev,
};

const { buildAllowedOrigins } = require('../middleware/cors');
const { googleEnabled, appleEnabled } = require('../config/socialAuthConfig');

function logStartupSuccess({ port, mongoReady = false, phase = 'listen' } = {}) {
  const nodeEnv = process.env.NODE_ENV || 'undefined';
  const origins = buildAllowedOrigins();
  const googleConfigured = googleEnabled();
  const appleConfigured = appleEnabled();

  console.log(
    `[startup] success phase=${phase} PORT=${port} NODE_ENV=${nodeEnv} ` +
      `allowedOrigins=${origins.size} googleConfigured=${googleConfigured} ` +
      `appleConfigured=${appleConfigured} mongoReady=${Boolean(mongoReady)} ` +
      `host=0.0.0.0`
  );
}

module.exports = { logStartupSuccess };

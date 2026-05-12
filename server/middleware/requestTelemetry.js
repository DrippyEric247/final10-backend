const { info } = require('../services/structuredLog');
const { isProduction } = require('../config/envValidation');

const SLOW_MS = Number(process.env.FINAL10_SLOW_ROUTE_MS || 3000);

/**
 * Records request duration; logs slow routes (production monitoring hook).
 */
function requestTelemetry(req, res, next) {
  const start = process.hrtime.bigint();
  res.on('finish', () => {
    const durMs = Number(process.hrtime.bigint() - start) / 1e6;
    if (durMs >= SLOW_MS) {
      info('SLOW_ROUTE', {
        path: req.originalUrl,
        method: req.method,
        status: res.statusCode,
        durationMs: Math.round(durMs),
        env: isProduction() ? 'production' : 'development',
      });
    }
  });
  next();
}

module.exports = { requestTelemetry };
